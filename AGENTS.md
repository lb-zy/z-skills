# 仓库指南

## 项目结构与模块组织

本仓库维护可复用的 Agent Skills，而不是可编译的应用程序。`README.md` 是项目入口，`docs/design.md` 是整体设计与职责边界的唯一事实来源，行为评测案例位于 `docs/evaluation.md`。每个 Skill 使用 `skills/<skill-name>/` 目录，其中必须包含 `SKILL.md` 和 `agents/openai.yaml`；多个 Skills 共用的参考资料放在 `skills/_shared/`。当前没有独立的源码、资源或自动化测试目录。

## 构建、测试与开发命令

本项目无需构建或安装依赖。在仓库根目录运行以下轻量检查：

- `rg --files | sort`：列出仓库内容，帮助发现位置错误的文件。
- `rg -n '^(name|description):' skills/*/SKILL.md`：检查必需的 frontmatter 字段。
- `rg -n '^(interface:|  display_name:|  short_description:|  default_prompt:)' skills/*/agents/openai.yaml`：检查元数据结构。
- `git diff --check`：在 Git 检出目录中提交改动前检查空白字符错误。

改动涉及表格、链接或 Mermaid 图时，应渲染或预览 Markdown。

## 编码风格与命名约定

Markdown 应简洁，标题应准确描述内容，段落保持短小，仅在便于浏览时使用列表。保留仓库现有的 UTF-8 中文内容。Skill 目录使用小写 kebab-case，通常以 `z-` 开头，例如 `skills/z-implement/`；frontmatter 中的 `name` 必须与目录名一致。YAML 使用两空格缩进，并保留既有的 `interface` 字段。只有多个 Skills 确实复用的说明才放入 `_shared`，避免在 `README.md`、设计文档和 Skill 文件之间重复规则。

## 测试指南

本项目按场景验证，不设覆盖率指标。遵循 `docs/evaluation.md`：在干净上下文中运行案例，并记录实际选择的 Skills、执行动作、结果和授权边界。修改 Skill 后，至少验证两个正例、两个相近但不应触发的反例、一个组合案例、一个授权边界案例和一个结果质量案例。同时检查 frontmatter、元数据、链接及跨文档引用。

## 提交与 Pull Request 指南

当前检出目录没有可用的 Git 历史，因此无法确认项目特有的提交格式。提交标题应简短、使用祈使语气并标明范围，例如 `docs: clarify skill evaluation rules`；每次提交只聚焦一项改动。Pull Request 应说明改动的行为原因，列出受影响的 Skills 和文档，总结评测证据，并指出剩余盲区。关联相关 Issue；仅在渲染结果出现回归时附截图。修改源码不代表已获授权部署到运行时 Skill 目录。
