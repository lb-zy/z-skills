#!/usr/bin/env python3
"""校验神引图谱规范，并生成自包含的离线交互 HTML。"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any


ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
SPEC_VERSION = 3
LAYOUTS = {"flow", "loop", "tree", "free"}
VIEW_STATES = {"building", "confirmed"}
ITEM_STATES = {"confirmed", "candidate"}
EDGE_KINDS = {"forward", "feedback", "dependency"}
DATA_MARKER = "/*__GOD_GUIDE_DATA__*/"


class SpecError(ValueError):
    """表示图谱规范无法被可靠渲染。"""


def _is_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_id(value: Any) -> bool:
    return isinstance(value, str) and bool(ID_PATTERN.fullmatch(value))


def _check_text_list(
    value: Any, path: str, errors: list[str], *, required: bool = True
) -> list[str]:
    if value is None and not required:
        return []
    if not isinstance(value, list) or any(not _is_text(item) for item in value):
        errors.append(f"{path} 必须是非空字符串组成的数组")
        return []
    return [item.strip() for item in value]


def _normalized(values: list[str]) -> list[str]:
    return sorted({value.strip() for value in values if value.strip()})


def _validate_hierarchy(
    child_by_node: dict[str, str], node_by_view: dict[str, list[str]], errors: list[str]
) -> None:
    view_edges: dict[str, set[str]] = {view_id: set() for view_id in node_by_view}
    owner_by_node = {
        node_id: view_id
        for view_id, node_ids in node_by_view.items()
        for node_id in node_ids
    }
    for node_id, child_view_id in child_by_node.items():
        owner = owner_by_node.get(node_id)
        if owner and child_view_id in view_edges:
            view_edges[owner].add(child_view_id)

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(view_id: str) -> None:
        if view_id in visiting:
            errors.append(f"视图层级包含循环引用：{view_id}")
            return
        if view_id in visited:
            return
        visiting.add(view_id)
        for child_id in view_edges.get(view_id, set()):
            visit(child_id)
        visiting.remove(view_id)
        visited.add(view_id)

    for view_id in view_edges:
        visit(view_id)


def validate_spec(spec: Any) -> list[str]:
    """校验规范；返回不会阻止渲染、但需要复核的警告。"""

    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(spec, dict):
        raise SpecError("规范顶层必须是 JSON 对象")

    if spec.get("version") != SPEC_VERSION:
        errors.append(f"version 必须为 {SPEC_VERSION}")
    if not _is_text(spec.get("title")):
        errors.append("title 必须是非空字符串")
    if not _is_id(spec.get("rootViewId")):
        errors.append("rootViewId 必须是合法标识符")

    views = spec.get("views")
    if not isinstance(views, list) or not views:
        errors.append("views 必须是非空数组")
        views = []

    view_by_id: dict[str, dict[str, Any]] = {}
    node_by_id: dict[str, dict[str, Any]] = {}
    node_owner: dict[str, str] = {}
    node_by_view: dict[str, list[str]] = {}
    child_by_node: dict[str, str] = {}
    edge_ids: set[str] = set()
    identifier_owners: dict[str, str] = {}

    def register_identifier(identifier: str, owner: str) -> None:
        existing = identifier_owners.get(identifier)
        if existing is None:
            identifier_owners[identifier] = owner
        else:
            errors.append(
                f"标识符必须在整个图谱内唯一，{identifier} 同时用于 {existing} 和 {owner}"
            )

    for view_index, view in enumerate(views):
        view_path = f"views[{view_index}]"
        if not isinstance(view, dict):
            errors.append(f"{view_path} 必须是对象")
            continue

        view_id = view.get("id")
        if not _is_id(view_id):
            errors.append(f"{view_path}.id 必须是合法标识符")
            continue
        if view_id in view_by_id:
            errors.append(f"视图 id 重复：{view_id}")
            continue
        register_identifier(view_id, f"视图 {view_id}")
        view_by_id[view_id] = view
        node_by_view[view_id] = []

        if not _is_text(view.get("title")):
            errors.append(f"视图 {view_id} 的 title 必须是非空字符串")
        if view.get("layout") not in LAYOUTS:
            errors.append(
                f"视图 {view_id} 的 layout 必须是 {', '.join(sorted(LAYOUTS))} 之一"
            )
        if view.get("status") not in VIEW_STATES:
            errors.append(
                f"视图 {view_id} 的 status 必须是 building 或 confirmed"
            )

        interface = view.get("interface")
        if not isinstance(interface, dict):
            errors.append(f"视图 {view_id} 的 interface 必须是对象")
            interface = {}
        view_inputs = _check_text_list(
            interface.get("inputs"), f"视图 {view_id}.interface.inputs", errors
        )
        view_outputs = _check_text_list(
            interface.get("outputs"), f"视图 {view_id}.interface.outputs", errors
        )
        if view_id == spec.get("rootViewId") and (view_inputs or view_outputs):
            errors.append(f"根视图 {view_id} 的 interface.inputs 和 outputs 必须为空")
        if "closure" in view:
            errors.append(f"version 3 视图 {view_id} 不能包含 closure；请先完成迁移")

        nodes = view.get("nodes")
        if not isinstance(nodes, list):
            errors.append(f"视图 {view_id} 的 nodes 必须是数组")
            nodes = []

        for node_index, node in enumerate(nodes):
            node_path = f"视图 {view_id}.nodes[{node_index}]"
            if not isinstance(node, dict):
                errors.append(f"{node_path} 必须是对象")
                continue
            node_id = node.get("id")
            if not _is_id(node_id):
                errors.append(f"{node_path}.id 必须是合法标识符")
                continue
            if node_id in node_by_id:
                errors.append(f"节点 id 必须全局唯一，发现重复：{node_id}")
                continue
            register_identifier(node_id, f"节点 {node_id}")
            node_by_id[node_id] = node
            node_owner[node_id] = view_id
            node_by_view[view_id].append(node_id)

            if not _is_text(node.get("label")):
                errors.append(f"节点 {node_id} 的 label 必须是非空字符串")
            if node.get("state") not in ITEM_STATES:
                errors.append(
                    f"节点 {node_id} 的 state 必须是 confirmed 或 candidate"
                )
            if not isinstance(node.get("leaf"), bool):
                errors.append(f"节点 {node_id} 的 leaf 必须是布尔值")
            revision = node.get("revision")
            if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                errors.append(f"节点 {node_id} 的 revision 必须是大于等于 1 的整数")
            _check_text_list(node.get("inputs"), f"节点 {node_id}.inputs", errors)
            _check_text_list(node.get("outputs"), f"节点 {node_id}.outputs", errors)
            _check_text_list(
                node.get("evidence"), f"节点 {node_id}.evidence", errors, required=False
            )
            summary = node.get("summary")
            if summary is not None and not _is_text(summary):
                errors.append(f"节点 {node_id} 的 summary 必须是非空字符串")

            child_view_id = node.get("childViewId")
            if child_view_id is not None:
                if not _is_id(child_view_id):
                    errors.append(f"节点 {node_id} 的 childViewId 不是合法标识符")
                else:
                    child_by_node[node_id] = child_view_id
                if node.get("leaf") is True:
                    errors.append(f"叶节点 {node_id} 不能拥有 childViewId")
                if node.get("state") == "candidate":
                    errors.append(f"候选节点 {node_id} 不能拥有正式子图")

            if view.get("layout") == "free":
                for coordinate in ("x", "y"):
                    value = node.get(coordinate)
                    if (
                        not isinstance(value, (int, float))
                        or isinstance(value, bool)
                        or not 0 <= value <= 1
                    ):
                        errors.append(
                            f"free 布局节点 {node_id} 的 {coordinate} 必须在 0 到 1 之间"
                        )

        if view.get("layout") == "loop" and len(nodes) > 8:
            errors.append(f"loop 布局视图 {view_id} 最多包含 8 个节点")

        edges = view.get("edges")
        if not isinstance(edges, list):
            errors.append(f"视图 {view_id} 的 edges 必须是数组")
            edges = []
        for edge_index, edge in enumerate(edges):
            edge_path = f"视图 {view_id}.edges[{edge_index}]"
            if not isinstance(edge, dict):
                errors.append(f"{edge_path} 必须是对象")
                continue
            edge_id = edge.get("id")
            if not _is_id(edge_id):
                errors.append(f"{edge_path}.id 必须是合法标识符")
            elif edge_id in edge_ids:
                errors.append(f"关系 id 必须全局唯一，发现重复：{edge_id}")
            else:
                edge_ids.add(edge_id)
                register_identifier(edge_id, f"关系 {edge_id}")
            if edge.get("state") not in ITEM_STATES:
                errors.append(
                    f"关系 {edge_id or edge_path} 的 state 必须是 confirmed 或 candidate"
                )
            if edge.get("kind") not in EDGE_KINDS:
                errors.append(
                    f"关系 {edge_id or edge_path} 的 kind 必须是 {', '.join(sorted(EDGE_KINDS))} 之一"
                )
            label = edge.get("label")
            if label is not None and not _is_text(label):
                errors.append(f"关系 {edge_id or edge_path} 的 label 必须是非空字符串")

        if view.get("layout") == "loop" and not any(
            edge.get("kind") == "feedback" for edge in edges if isinstance(edge, dict)
        ):
            errors.append(f"loop 布局视图 {view_id} 至少需要一条 feedback 关系")

        if view.get("status") == "confirmed":
            if any(node.get("state") == "candidate" for node in nodes if isinstance(node, dict)):
                errors.append(f"已确认视图 {view_id} 不能包含候选节点")
            if any(edge.get("state") == "candidate" for edge in edges if isinstance(edge, dict)):
                errors.append(f"已确认视图 {view_id} 不能包含候选关系")
            if not any(node.get("state") == "confirmed" for node in nodes if isinstance(node, dict)):
                errors.append(f"已确认视图 {view_id} 至少需要一个确认节点")

    root_view_id = spec.get("rootViewId")
    if _is_id(root_view_id) and root_view_id not in view_by_id:
        errors.append(f"rootViewId 指向不存在的视图：{root_view_id}")

    for view_id, view in view_by_id.items():
        parent_node_id = view.get("parentNodeId")
        if view_id == root_view_id:
            if parent_node_id is not None:
                errors.append("根视图不能设置 parentNodeId")
            continue
        if not _is_id(parent_node_id) or parent_node_id not in node_by_id:
            errors.append(f"子视图 {view_id} 必须引用存在的 parentNodeId")
            continue
        parent_node = node_by_id[parent_node_id]
        if parent_node.get("childViewId") != view_id:
            errors.append(
                f"子视图 {view_id} 与父节点 {parent_node_id} 的 childViewId 未双向对应"
            )
        parent_revision = view.get("parentRevision")
        if not isinstance(parent_revision, int) or isinstance(parent_revision, bool):
            errors.append(f"子视图 {view_id} 的 parentRevision 必须是整数")
        elif parent_revision != parent_node.get("revision"):
            warnings.append(
                f"子视图 {view_id} 基于父节点 {parent_node_id} 的旧版本，显示为待复核"
            )

        interface = view.get("interface", {})
        child_inputs = interface.get("inputs") if isinstance(interface, dict) else []
        child_outputs = interface.get("outputs") if isinstance(interface, dict) else []
        if _normalized(child_inputs or []) != _normalized(parent_node.get("inputs") or []):
            warnings.append(
                f"子视图 {view_id} 的输入与父节点 {parent_node_id} 不一致，显示为待复核"
            )
        if _normalized(child_outputs or []) != _normalized(parent_node.get("outputs") or []):
            warnings.append(
                f"子视图 {view_id} 的输出与父节点 {parent_node_id} 不一致，显示为待复核"
            )

    for node_id, child_view_id in child_by_node.items():
        child_view = view_by_id.get(child_view_id)
        if child_view is None:
            errors.append(f"节点 {node_id} 指向不存在的子视图：{child_view_id}")
        elif child_view.get("parentNodeId") != node_id:
            errors.append(
                f"节点 {node_id} 与子视图 {child_view_id} 的 parentNodeId 未双向对应"
            )

    for view_id, view in view_by_id.items():
        local_nodes = set(node_by_view.get(view_id, []))
        for edge in view.get("edges", []):
            if not isinstance(edge, dict):
                continue
            edge_id = edge.get("id", "<unknown>")
            if edge.get("from") not in local_nodes:
                errors.append(f"关系 {edge_id} 的 from 不属于视图 {view_id}")
            if edge.get("to") not in local_nodes:
                errors.append(f"关系 {edge_id} 的 to 不属于视图 {view_id}")

    _validate_hierarchy(child_by_node, node_by_view, errors)

    if errors:
        raise SpecError("\n".join(f"- {message}" for message in errors))
    return list(dict.fromkeys(warnings))


def _safe_json(spec: dict[str, Any]) -> str:
    payload = json.dumps(spec, ensure_ascii=False, separators=(",", ":"))
    return (
        payload.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def render_html(spec: dict[str, Any], output: Path) -> None:
    template = Path(__file__).resolve().parent.parent / "assets" / "interactive-map.html"
    source = template.read_text(encoding="utf-8")
    if source.count(DATA_MARKER) != 1:
        raise SpecError(f"模板必须且只能包含一个数据标记：{DATA_MARKER}")
    html = source.replace(DATA_MARKER, f"window.__GOD_GUIDE_DATA__={_safe_json(spec)};")

    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{output.name}.", suffix=".tmp", dir=output.parent
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(html)
        os.replace(temporary_name, output)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="校验神引图谱 JSON，并生成自包含离线 HTML。"
    )
    parser.add_argument("--spec", required=True, type=Path, help="图谱 JSON 路径")
    parser.add_argument("--out", type=Path, help="生成的 HTML 路径")
    parser.add_argument(
        "--validate-only", action="store_true", help="只校验，不生成 HTML"
    )
    parser.add_argument(
        "--strict", action="store_true", help="把父子待复核警告视为失败"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.validate_only and args.out is None:
        print("错误：生成 HTML 时必须提供 --out", file=sys.stderr)
        return 2
    if not args.validate_only and args.out is not None:
        if args.spec.resolve() == args.out.resolve():
            print("错误：--out 不能覆盖 --spec 语义来源", file=sys.stderr)
            return 2
        if args.out.suffix.lower() != ".html":
            print("错误：--out 必须使用 .html 扩展名", file=sys.stderr)
            return 2
    try:
        with args.spec.open(encoding="utf-8") as handle:
            spec = json.load(handle)
        warnings = validate_spec(spec)
        if args.strict and warnings:
            raise SpecError("\n".join(f"- {message}" for message in warnings))
        if not args.validate_only:
            render_html(spec, args.out)
    except (OSError, UnicodeError, json.JSONDecodeError, SpecError) as error:
        print(f"校验失败：\n{error}", file=sys.stderr)
        return 1

    summary = {
        "ok": True,
        "views": len(spec["views"]),
        "nodes": sum(len(view["nodes"]) for view in spec["views"]),
        "warnings": warnings,
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
