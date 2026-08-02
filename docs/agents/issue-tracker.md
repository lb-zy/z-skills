# 问题跟踪器：本地 Markdown

本仓库的问题和规格文档以 Markdown 文件的形式存放在 `.scratch/` 中。

## 约定

- 每个 feature 使用一个目录：`.scratch/<feature-slug>/`
- 规格文档位于 `.scratch/<feature-slug>/spec.md`
- 每个 ticket 的实现 issue 单独存放在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md` 中，从 `01` 开始编号；不要将多个 ticket 合并到一个文件中
- 分流状态记录在每个 issue 文件顶部附近的 `Status:` 行中（角色字符串参见 `triage-labels.md`）
- 评论和对话历史追加到文件底部的 `## Comments` 标题下

## 当某个 skill 说“publish to the issue tracker”（发布到问题跟踪器）时

在 `.scratch/<feature-slug>/` 下创建新文件（必要时一并创建目录）。

## 当某个 skill 说“fetch the relevant ticket”（获取相关 ticket）时

读取引用路径对应的文件。用户通常会直接提供路径或 issue 编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个文件，每个 ticket 对应一个 **child** 文件。

- **Map**：`.scratch/<effort>/map.md`，正文包含 Notes / Decisions-so-far / Fog。
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 开始编号，正文包含问题。用 `Type:` 行记录 ticket 类型（`research`/`prototype`/`grilling`/`task`），用 `Status:` 行记录 `claimed`/`resolved`。
- **Blocking**：顶部附近的 `Blocked by: NN, NN` 行。只有当它列出的每个文件都为 `resolved` 时，ticket 才算解除阻塞。
- **Frontier**：扫描 `.scratch/<effort>/issues/`，查找处于打开状态、未阻塞且未认领的文件；按编号优先处理最小编号。
- **Claim**：开始任何工作前，将 `Status: claimed` 写入文件并保存。
- **Resolve**：在 `## Answer` 标题下追加答案，将 `Status: resolved` 写入文件，然后在 `map.md` 的 Decisions-so-far 中追加上下文指针（摘要和链接）。
