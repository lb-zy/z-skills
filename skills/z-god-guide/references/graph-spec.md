# 神引图谱规范

## 目录

- [文件关系](#文件关系)
- [顶层结构](#顶层结构)
- [版本迁移](#版本迁移)
- [视图](#视图)
- [节点](#节点)
- [关系](#关系)
- [父子一致性](#父子一致性)
- [拓扑与布局](#拓扑与布局)

## 文件关系

每个图谱维护两个文件：

- `<spec>` = `<name>.god-guide.json`：保存图谱语义状态，供后续增量更新。
- `<out>` = `<name>.html`：由脚本生成的自包含离线交付物。

所有视图、节点和关系的 `id` 使用 ASCII 字母、数字、连字符或下划线，并在整个图谱内共同保持唯一。面向用户的标题、标签和说明使用用户的语言。

## 顶层结构

```json
{
  "version": 3,
  "title": "图谱标题",
  "rootViewId": "root",
  "views": []
}
```

- `version`：固定为 `3`。
- `title`：整个图谱的标题。
- `rootViewId`：顶层视图的 `id`。
- `views`：所有层级的视图数组。

## 版本迁移

续作 `version: 1` 或 `version: 2` 图谱时，先执行以下迁移，再进入紧回路：

1. 检查每个旧 `closure` 字段。把图中尚未表达、但仍影响主题的文字合并到相关节点，或新增 `candidate` 节点承载；随后删除 `closure`。
2. 把旧 `closed` 状态改为 `confirmed`。若视图仍含候选节点或候选关系，则改为 `building`。
3. 保留 `building`、节点、关系、接口和父子版本信息，把顶层 `version` 设为 `3`。

迁移完成时，每个视图都符合 version 3 结构，旧闭环摘要中的有效语义已进入图本身，且不存在 `closure` 或 `closed` 残留。

## 视图

```json
{
  "id": "root",
  "title": "顶层视图",
  "layout": "flow",
  "status": "building",
  "interface": {
    "inputs": [],
    "outputs": []
  },
  "nodes": [],
  "edges": []
}
```

- `layout`：使用 `flow`、`tree`、`loop` 或 `free`，按当前层的实际结构选择。
- `status`：使用 `building` 或 `confirmed`。`building` 可保留候选项；`confirmed` 只包含确认节点和确认关系，且至少有一个确认节点。`review` 只由父子版本或接口不一致自动推导。
- `interface.inputs`、`interface.outputs`：该视图作为父节点内部实现时承诺的输入和输出；根视图的两个数组均为空。
- `nodes`、`edges`：只保存当前层内容。关系两端均位于当前视图；当前层没有关系时，`edges` 使用空数组。

子视图额外填写：

```json
{
  "parentNodeId": "solution",
  "parentRevision": 1
}
```

`parentRevision` 表示子图基于父节点的哪个版本。修改父节点的语义、输入或输出时递增父节点 `revision`，暂不修改子视图的 `parentRevision`；渲染器会把该子图显示为“待复核”。完成复核后再同步版本。

## 节点

```json
{
  "id": "solution",
  "label": "设计方案",
  "summary": "形成满足约束的可执行方案",
  "state": "confirmed",
  "leaf": false,
  "revision": 1,
  "inputs": ["已确认目标", "关键约束"],
  "outputs": ["可执行方案"],
  "evidence": ["用户明确确认"]
}
```

- `state`：使用 `confirmed` 或 `candidate`。用户直接给出的事实、要求或明确确认的语义使用 `confirmed`；从证据归纳出的结构保持 `candidate`，直到用户确认。
- `leaf`：达到目标驱动停止条件时设为 `true`；叶节点省略 `childViewId`。
- `revision`：从 `1` 开始。只有改变节点语义契约时递增；文案微调不改变含义时不递增。
- `inputs`、`outputs`：节点与其未来子图之间的接口契约。
- `summary`、`evidence`：可选。证据只记录已有来源，不把推测写成事实。
- `childViewId`：只在确认非叶节点已有子图时填写。

`free` 布局中的每个节点还必须填写 `x`、`y`，值在 `0` 到 `1` 之间，表示归一化中心位置。

## 关系

```json
{
  "id": "goal-to-solution",
  "from": "goal",
  "to": "solution",
  "label": "约束",
  "state": "confirmed",
  "kind": "dependency"
}
```

- `from`、`to`：只能引用同一视图内的节点。
- `state`：使用 `confirmed` 或 `candidate`，遵循与节点相同的确认门禁。
- `kind`：使用 `forward`、`dependency` 或 `feedback`。只有实际存在反馈语义时使用 `feedback`。
- `label`：可选，保持简短；关系已能由方向表达时省略。

## 父子一致性

父节点和子视图必须双向引用：

- 父节点的 `childViewId` 等于子视图 `id`。
- 子视图的 `parentNodeId` 等于父节点 `id`。
- 子视图的 `interface.inputs` 与父节点 `inputs` 一致。
- 子视图的 `interface.outputs` 与父节点 `outputs` 一致。
- 子视图的 `parentRevision` 与父节点 `revision` 一致。

版本或接口不一致是合法的增量状态；渲染器会产生警告，并把源文件中的 `confirmed` 展示为“待复核”。使用 `--strict` 时，这些警告会导致校验失败。

## 拓扑与布局

先判断当前层实际表达的结构，再设置布局：

- `flow`：顺序、因果、决策、依赖或一般架构流。
- `tree`：分类、分解、层级或从属关系。
- `loop`：真实循环或反馈路径是当前主题核心，至少包含一条 `feedback` 关系，且节点不多于八个。
- `free`：空间、网络或其他布局更能表达含义时使用，并明确给出节点位置。

布局只影响呈现。节点和关系由材料中的语义决定；节点过多导致拥挤时，抽象分组并下沉到子图，同时保持文字可读。
