---
name: skill-creator
description: 创建高效 Skill 的指南。当用户希望创建新 Skill 或更新现有 Skill，以通过专业知识、工作流程或工具集成扩展 Codex 的能力时，应使用此 Skill。
metadata:
  short-description: 创建或更新 Skill
---

# Skill 创建器

本 Skill 提供创建高效 Skill 的指导。

## 关于 Skill

Skill 是模块化、自包含的文件夹，通过提供专业知识、工作流程和工具来扩展 Codex 的能力。可以把它们看作特定领域或任务的“上手指南”：它们将 Codex 从通用 Agent 转变为专业 Agent，并为其配备任何模型都无法完全掌握的程序性知识。

### Skill 提供的内容

1. 专业工作流程：面向特定领域的多步骤过程
2. 工具集成：处理特定文件格式或 API 的说明
3. 领域知识：公司特有的知识、Schema 和业务逻辑
4. 捆绑资源：用于复杂、重复任务的脚本、参考资料和资产

## 核心原则

### 简洁至关重要

上下文窗口是公共资源。Skill 与 Codex 所需的其他一切共享上下文窗口，包括系统提示词、对话历史、其他 Skill 的元数据以及用户的实际请求。

**默认假设：Codex 已经非常聪明。** 只添加 Codex 尚不具备的上下文。审视每一条信息：“Codex 真的需要这段解释吗？”以及“这段内容对得起它占用的 token 吗？”

优先使用简洁示例，而非冗长说明。

### 设置适当的自由度

根据任务的脆弱性和可变性确定说明的具体程度：

**高自由度（文本说明）**：适用于多种方法均有效、决策依赖上下文或需要启发式判断的情况。

**中自由度（伪代码或带参数的脚本）**：适用于存在首选模式、允许一定变化或行为受配置影响的情况。

**低自由度（具体脚本、少量参数）**：适用于操作脆弱且容易出错、一致性至关重要或必须遵循特定顺序的情况。

把 Codex 想象成在探索一条道路：两侧是悬崖的窄桥需要明确护栏（低自由度），开阔地带则允许选择多条路线（高自由度）。

### 保护验证的完整性

迭代期间，可以使用子 Agent 验证 Skill 能否处理真实任务，或确认怀疑的问题是否确实存在。这最适合在修订后独立检查 Skill 的行为、输出或失败模式。只有在能够启动新子 Agent 时才这样做。

使用子 Agent 验证时，应将其视为一个评估界面。目标是了解 Skill 能否泛化，而不是确认另一个 Agent 能否从泄露的上下文中重建答案。

优先提供示例提示词、输出、diff、日志或 trace 等原始产物。只提供执行验证所需的最少任务局部上下文。除非验证明确需要，否则不要透露预期答案、怀疑的缺陷、计划中的修复或已有结论。

### Skill 的结构

每个 Skill 都包含一个必需的 `SKILL.md` 文件，以及可选的捆绑资源：

```
skill-name/
├── SKILL.md（必需）
│   ├── YAML frontmatter 元数据（必需）
│   │   ├── name:（必需）
│   │   └── description:（必需）
│   └── Markdown 说明（必需）
├── agents/（推荐）
│   └── openai.yaml - Skill 列表和标签使用的 UI 元数据
└── 捆绑资源（可选）
    ├── scripts/          - 可执行代码（Python/Bash 等）
    ├── references/       - 需要时加载到上下文中的文档
    └── assets/           - 输出中使用的文件（模板、图标、字体等）
```

#### SKILL.md（必需）

每个 `SKILL.md` 包含：

- **Frontmatter**（YAML）：包含 `name` 和 `description` 字段。这是 Codex 判断何时使用该 Skill 时读取的唯一字段，因此必须清晰、完整地描述该 Skill 是什么以及何时使用。
- **正文**（Markdown）：Skill 的使用说明和指导。仅在 Skill 被触发后才加载（如果触发）。

#### Agent 元数据（推荐）

- 面向 Skill 列表和标签的 UI 元数据
- 生成值之前读取 `references/openai_yaml.md`，并遵循其中的说明和约束
- 阅读 Skill 后创建面向用户的 `display_name`、`short_description` 和 `default_prompt`
- 通过 `--interface key=value` 将这些值传给 `scripts/generate_openai_yaml.py` 或 `scripts/init_skill.py`，以确定性方式生成
- 更新 Skill 时，验证 `agents/openai.yaml` 是否仍与 `SKILL.md` 一致；如已过时则重新生成
- 仅在用户明确提供时才包含其他可选界面字段（图标、品牌颜色）
- 字段定义和示例见 `references/openai_yaml.md`

#### 捆绑资源（可选）

##### 脚本（`scripts/`）

用于要求确定性可靠性或会被反复重写的任务的可执行代码（Python/Bash 等）。

- **何时包含**：同一段代码会被反复编写，或需要确定性可靠性时
- **示例**：用于旋转 PDF 的 `scripts/rotate_pdf.py`
- **优点**：节省 token、结果确定，并且无需加载到上下文即可执行
- **注意**：Codex 仍可能需要读取脚本，以便修补或适配具体环境

##### 参考资料（`references/`）

需要时加载到上下文中，以帮助 Codex 处理和思考的文档与参考材料。

- **何时包含**：Codex 工作时应查阅某些文档
- **示例**：金融 Schema 使用 `references/finance.md`，公司 NDA 模板使用 `references/mnda.md`，公司政策使用 `references/policies.md`，API 规范使用 `references/api_docs.md`
- **用途**：数据库 Schema、API 文档、领域知识、公司政策、详细工作流程指南
- **优点**：保持 `SKILL.md` 精简，仅在 Codex 判断有需要时加载
- **最佳实践**：文件很大（超过 1 万词）时，在 `SKILL.md` 中提供 grep 搜索模式
- **避免重复**：信息只能存在于 `SKILL.md` 或参考文件其中之一，不能两处重复。除非内容确实是 Skill 的核心，否则详细信息应优先放入参考文件。`SKILL.md` 只保留必要的程序性说明和工作流程指导；详细参考材料、Schema 和示例应移至参考文件。这样既能保持 `SKILL.md` 精简，也方便发现信息，并避免占满上下文窗口。

##### 资产（`assets/`）

这些文件不应加载到上下文中，而应由 Codex 用于生成输出。

- **何时包含**：Skill 需要最终输出会使用的文件时
- **示例**：品牌资产 `assets/logo.png`、PowerPoint 模板 `assets/slides.pptx`、HTML/React 样板 `assets/frontend-template/`、字体 `assets/font.ttf`
- **用途**：模板、图片、图标、样板代码、字体，以及会被复制或修改的示例文档
- **优点**：将输出资源与文档分离，使 Codex 无需把文件加载到上下文中即可使用

#### Skill 中不应包含什么

Skill 只应包含直接支持其功能的必要文件。不要创建多余文档或辅助文件，包括：

- `README.md`
- `INSTALLATION_GUIDE.md`
- `QUICK_REFERENCE.md`
- `CHANGELOG.md`
- 等等

Skill 只应包含 AI Agent 完成当前工作所需的信息，不应包含 Skill 创建过程、设置和测试流程、面向用户的文档等辅助上下文。创建额外文档只会增加杂乱和困惑。

### 渐进式披露设计原则

Skill 使用三级加载系统来高效管理上下文：

1. **元数据（name + description）**：始终在上下文中（约 100 词）
2. **`SKILL.md` 正文**：Skill 触发时加载（少于 5,000 词）
3. **捆绑资源**：由 Codex 按需加载（不限，因为脚本可以不读入上下文直接执行）

#### 渐进式披露模式

只在 `SKILL.md` 正文中保留必要内容，并控制在 500 行以内，以减少上下文膨胀。接近此限制时，把内容拆分到其他文件。拆分时，必须从 `SKILL.md` 引用这些文件，并清楚说明何时读取，以确保 Skill 的使用者知道它们存在以及何时使用。

**关键原则：** 当一个 Skill 支持多个变体、框架或选项时，`SKILL.md` 只保留核心工作流程和选择指导。将变体特有的细节（模式、示例、配置）移到独立参考文件。

**模式 1：带参考资料的高层指南**

```markdown
# PDF 处理

## 快速开始

使用 pdfplumber 提取文本：
[代码示例]

## 高级功能

- **填写表单**：完整指南见 [FORMS.md](FORMS.md)
- **API 参考**：所有方法见 [REFERENCE.md](REFERENCE.md)
- **示例**：常见模式见 [EXAMPLES.md](EXAMPLES.md)
```

Codex 只在需要时加载 `FORMS.md`、`REFERENCE.md` 或 `EXAMPLES.md`。

**模式 2：按领域组织**

对于包含多个领域的 Skill，应按领域组织内容，避免加载无关上下文：

```
bigquery-skill/
├── SKILL.md（概览和导航）
└── reference/
    ├── finance.md（营收、计费指标）
    ├── sales.md（商机、销售管线）
    ├── product.md（API 使用、功能）
    └── marketing.md（营销活动、归因）
```

用户询问销售指标时，Codex 只读取 `sales.md`。

同样，对于支持多个框架或变体的 Skill，应按变体组织：

```
cloud-deploy/
├── SKILL.md（工作流程 + 云提供商选择）
└── references/
    ├── aws.md（AWS 部署模式）
    ├── gcp.md（GCP 部署模式）
    └── azure.md（Azure 部署模式）
```

用户选择 AWS 时，Codex 只读取 `aws.md`。

**模式 3：条件式细节**

展示基础内容，并链接到高级内容：

```markdown
# DOCX 处理

## 创建文档

新建文档时使用 docx-js。参见 [DOCX-JS.md](DOCX-JS.md)。

## 编辑文档

简单编辑可直接修改 XML。

**修订模式**：参见 [REDLINING.md](REDLINING.md)
**OOXML 细节**：参见 [OOXML.md](OOXML.md)
```

只有当用户需要这些功能时，Codex 才读取 `REDLINING.md` 或 `OOXML.md`。

**重要准则：**

- **避免深层嵌套引用**：参考资料与 `SKILL.md` 之间只保留一层。所有参考文件都应从 `SKILL.md` 直接链接。
- **组织较长参考文件**：超过 100 行的文件应在顶部提供目录，使 Codex 预览时能看到完整范围。

## Skill 创建流程

创建 Skill 包括以下步骤：

1. 通过具体示例理解 Skill
2. 规划可复用的 Skill 内容（脚本、参考资料、资产）
3. 初始化 Skill（运行 `init_skill.py`）
4. 编辑 Skill（实现资源并编写 `SKILL.md`）
5. 验证 Skill（运行 `quick_validate.py`）
6. 根据真实使用情况迭代，并对复杂 Skill 进行前向测试

按顺序执行这些步骤。只有在有明确理由不适用时才能跳过。

### Skill 命名

- 只使用小写字母、数字和连字符；将用户提供的标题规范化为连字符形式（例如 `Plan Mode` -> `plan-mode`）。
- 生成名称时，名称长度应少于 64 个字符（字母、数字、连字符）。
- 优先使用以动词开头、描述操作的简短短语。
- 当工具命名空间有助于理解或触发时，使用工具作为命名空间（例如 `gh-address-comments`、`linear-address-issue`）。
- Skill 文件夹名称必须与 Skill 名称完全一致。

### 第 1 步：通过具体示例理解 Skill

只有当 Skill 的使用模式已经非常清楚时才能跳过此步骤。即使处理现有 Skill，这一步仍然有价值。

要创建高效 Skill，必须清楚理解它会如何被使用的具体示例。这种理解可以来自用户直接提供的示例，也可以来自生成后经用户反馈验证的示例。

例如，构建图片编辑 Skill 时，相关问题包括：

- “图片编辑 Skill 应支持哪些功能？编辑、旋转，还是其他功能？”
- “能否提供一些这个 Skill 的使用示例？”
- “我能想到用户可能会说‘去掉这张图片中的红眼’或‘旋转这张图片’。你还设想了其他用法吗？”
- “用户说什么话时应该触发这个 Skill？”
- “应该在哪里创建这个 Skill？如果你没有偏好，我会把它放在 `$CODEX_HOME/skills`（未设置 `CODEX_HOME` 时为 `~/.codex/skills`），让 Codex 自动发现它。”

为避免让用户不知所措，不要在一条消息中提出太多问题。先从最重要的问题开始，再按需追问，以提高效果。

当 Skill 应支持的功能已经清晰时，结束此步骤。

### 第 2 步：规划可复用的 Skill 内容

要将具体示例转化为高效 Skill，应对每个示例进行以下分析：

1. 思考如何从零开始完成该示例
2. 确定重复执行这些工作流程时，哪些脚本、参考资料和资产会有帮助

示例：构建 `pdf-editor` Skill 来处理“帮我旋转这个 PDF”之类的请求时，分析结果是：

1. 旋转 PDF 每次都需要重写相同代码
2. 将 `scripts/rotate_pdf.py` 脚本存入 Skill 会很有帮助

示例：为“帮我构建一个待办事项应用”或“构建一个跟踪步数的仪表盘”之类的请求设计 `frontend-webapp-builder` Skill 时，分析结果是：

1. 编写前端 Web 应用每次都需要相同的 HTML/React 样板
2. 将包含 HTML/React 项目样板文件的 `assets/hello-world/` 模板存入 Skill 会很有帮助

示例：构建 `big-query` Skill 来处理“今天有多少用户登录？”之类的请求时，分析结果是：

1. 查询 BigQuery 时，每次都要重新发现表的 Schema 和关系
2. 将记录表 Schema 的 `references/schema.md` 文件存入 Skill 会很有帮助

要确定 Skill 的内容，应分析每个具体示例，列出需要包含的可复用资源：脚本、参考资料和资产。

### 第 3 步：初始化 Skill

现在可以真正创建 Skill。

只有正在开发的 Skill 已经存在时才能跳过此步骤；此时继续下一步。

运行 `init_skill.py` 之前，先询问用户希望在哪里创建 Skill。如果用户未指定位置，默认使用 `$CODEX_HOME/skills`；未设置 `CODEX_HOME` 时，回退到 `~/.codex/skills`，让 Codex 自动发现它。

从零创建新 Skill 时，始终运行 `init_skill.py`。该脚本会生成新的模板 Skill 目录，并自动包含 Skill 所需的一切，使创建过程更高效、更可靠。

用法：

```bash
scripts/init_skill.py <skill-name> --path <output-directory> [--resources scripts,references,assets] [--examples]
```

示例：

```bash
scripts/init_skill.py my-skill --path "${CODEX_HOME:-$HOME/.codex}/skills"
scripts/init_skill.py my-skill --path "${CODEX_HOME:-$HOME/.codex}/skills" --resources scripts,references
scripts/init_skill.py my-skill --path ~/work/skills --resources scripts --examples
```

该脚本会：

- 在指定路径创建 Skill 目录
- 生成带有正确 frontmatter 和 TODO 占位符的 `SKILL.md` 模板
- 使用通过 `--interface key=value` 传入、由 Agent 生成的 `display_name`、`short_description` 和 `default_prompt` 创建 `agents/openai.yaml`
- 根据 `--resources` 按需创建资源目录
- 设置 `--examples` 时按需添加示例文件

初始化后，根据需要定制 `SKILL.md` 并添加资源。如果使用了 `--examples`，替换或删除占位文件。

阅读 Skill 后生成 `display_name`、`short_description` 和 `default_prompt`，然后通过 `--interface key=value` 将其传给 `init_skill.py`；也可以用以下命令重新生成：

```bash
scripts/generate_openai_yaml.py <path/to/skill-folder> --interface key=value
```

只有用户明确提供时，才包含其他可选界面字段。完整字段说明和示例见 `references/openai_yaml.md`。

### 第 4 步：编辑 Skill

编辑新生成或现有 Skill 时，请记住，这个 Skill 是供另一个 Codex 实例使用的。应包含对 Codex 有帮助但不显而易见的信息。思考哪些程序性知识、领域特有细节或可复用资产能帮助另一个 Codex 实例更高效地执行这些任务。

进行重大修订后，或 Skill 特别棘手时，应使用子 Agent 在真实任务或产物上进行前向测试。此时，传递待验证的产物，而不是你对问题的诊断；提示词应足够通用，使成功依赖可迁移的推理，而非隐藏的标准答案。

#### 从可复用的 Skill 内容开始

开始实现时，先处理上面确定的可复用资源：`scripts/`、`references/` 和 `assets/` 文件。注意，这一步可能需要用户输入。例如，实现 `brand-guidelines` Skill 时，用户可能需要提供放入 `assets/` 的品牌资产或模板，或放入 `references/` 的文档。

新增脚本必须实际运行测试，确保没有缺陷且输出符合预期。如果有许多相似脚本，只需测试具有代表性的样本，在完成时间与整体可信度之间取得平衡。

如果使用了 `--examples`，删除 Skill 不需要的所有占位文件。只创建确实需要的资源目录。

#### 更新 SKILL.md

**写作准则：** 始终使用祈使句或不定式形式。

##### Frontmatter

编写包含 `name` 和 `description` 的 YAML frontmatter：

- `name`：Skill 名称
- `description`：Skill 的主要触发机制，帮助 Codex 理解何时使用该 Skill。
  - 同时说明 Skill 做什么，以及使用它的具体触发条件和上下文。
  - 所有“何时使用”的信息都应放在这里，不要放在正文中。正文只在触发后加载，因此正文里的“何时使用此 Skill”章节无法帮助 Codex 触发它。
  - `docx` Skill 的示例描述：“支持修订、评论、保留格式和文本提取的完整文档创建、编辑与分析能力。当 Codex 需要处理专业文档（.docx 文件）时使用，包括：(1) 创建新文档，(2) 修改或编辑内容，(3) 处理修订，(4) 添加评论，或执行任何其他文档任务。”

不要在 YAML frontmatter 中包含任何其他字段。

##### 正文

编写 Skill 及其捆绑资源的使用说明。

### 第 5 步：验证 Skill

Skill 开发完成后，验证 Skill 文件夹，以便尽早发现基础问题：

```bash
scripts/quick_validate.py <path/to/skill-folder>
```

验证脚本会检查 YAML frontmatter 格式、必需字段和命名规则。如果验证失败，修复报告的问题并重新运行命令。

### 第 6 步：迭代

测试 Skill 后，你可能发现它足够复杂，需要前向测试；用户也可能要求改进。

用户测试通常就发生在使用 Skill 之后，此时对 Skill 的实际表现仍有新鲜上下文。

**前向测试和迭代工作流程：**

1. 在真实任务中使用 Skill
2. 留意困难或低效之处
3. 确定应如何更新 `SKILL.md` 或捆绑资源
4. 实施更改并再次测试
5. 在合理且适当时进行前向测试

## 前向测试

进行前向测试时，启动子 Agent，以最少上下文对 Skill 进行压力测试。
子 Agent **不应**知道自己正在测试 Skill。应将其视为一个收到用户任务的 Agent。给子 Agent 的提示词应类似：
`Use $skill-x at /path/to/skill-x to solve problem y`
而不是：
`Review the skill at /path/to/skill-x; pretend a user asks you to...`

前向测试的决策规则：

- 倾向于进行前向测试
- 如果前向测试可能存在以下风险，应先请求批准：
  - 耗时很长
  - 需要用户提供额外批准
  - 修改线上生产系统

在这些情况下，向用户展示拟使用的提示词，并请求：(1) 是/否决定，以及 (2) 对提示词的修改建议。

前向测试的注意事项：

- 使用新任务进行独立检查
- 以用户相似的方式传递 Skill 和请求
- 传递原始产物，而不是你的结论
- 避免展示预期答案或计划中的修复
- 每轮迭代后，从源产物重新构建上下文
- 检查子 Agent 的输出、推理和产出的文件
- 避免在迭代之间留下 Agent 能在磁盘上发现的产物；清理子 Agent 的产物，防止额外污染

如果前向测试只有在子 Agent 看到泄露的上下文时才能成功，应先收紧 Skill 或前向测试设置，再信任测试结果。
