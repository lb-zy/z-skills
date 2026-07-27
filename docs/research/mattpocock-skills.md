# mattpocock/skills 参考分析

本文记录 [`mattpocock/skills`](https://github.com/mattpocock/skills) 对 `z-skills` 有参考价值的目录与 Skill 设计。它是外部设计基线，不是本项目规范；是否采用仍以本项目的实际问题和验证结果为准。

## 分析范围

- 获取日期：2026-07-27
- 固定提交：[`ed37663`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d)
- 分析对象：仓库目录、41 个 Skill 的内部结构、调用元数据、条件资料、脚本和发布清单

该提交包含 41 个 Skill：17 个 `engineering`、5 个 `productivity`、4 个 `misc`、2 个 `personal`、9 个 `in-progress` 和 4 个 `deprecated`。其中 22 个稳定 Skill 被列入 Claude plugin 的显式发布清单。

## 仓库级结构

```text
skills/
├── engineering/       # 稳定的工程 Skills
├── productivity/      # 稳定的通用 Skills
├── misc/              # 保留但不推广
├── personal/          # 个人环境专用
├── in-progress/       # 尚未发布的实验
└── deprecated/        # 不再使用

docs/                  # 只为稳定 Skills 提供人类文档
.agents/               # 仓库维护规则、调用约定和 ADR
.out-of-scope/         # 持久记录被拒绝的需求及原因
.claude-plugin/        # 显式列出发布的 Skills
scripts/               # 本地维护工具
```

### 值得借鉴

1. **活跃内容与生命周期状态显式分离。** 实验、个人和废弃内容不会进入正式发布清单。
2. **发布使用显式白名单。** 仓库中存在不等于对用户发布，发布范围由 manifest 明确决定。
3. **维护知识有独立位置。** `.agents/` 保存跨 Skill 规则和架构决策，`.out-of-scope/` 保存反复出现的拒绝项，避免把这些内容塞进每个 Skill。
4. **人类文档与 Agent 指令分离。** `docs/` 解释 Skill 的用途和位置，`SKILL.md` 负责影响 Agent 行为，两者不互相复制。

### 不建议照搬

1. `engineering`、`productivity` 是领域轴，`in-progress`、`deprecated` 是生命周期轴，却出现在同一层，目录语义不统一。
2. Skill 清单同时维护在顶层 README、bucket README、`docs/` 和 plugin manifest，产生多个真相源。该提交中 `package.json` 为 `1.1.0`，plugin manifest 为 `1.2.0`，已经出现版本漂移。
3. 本地链接脚本会链接除 `deprecated` 外的实验和个人 Skills，并覆盖冲突目标，不适合直接用于本项目。
4. `ask-matt` 形式的中央路由器和固定链条不符合 `z-skills` 由 Agent 根据当前目标动态选择、组合 Skills 的设计。

## 单个 Skill 的基本结构

```text
<skill-name>/
├── SKILL.md                 # 发现信息和调用后必须读取的执行核心
├── agents/
│   └── openai.yaml          # Codex 展示信息与调用策略适配器
├── <conditional>.md         # 条件分支、参考知识或输出模板
└── scripts/                 # 确需确定性执行时才存在
```

41 个 Skill 全部包含 `SKILL.md` 和 `agents/openai.yaml`。28 个 Skill 只有这两个必要文件，13 个 Skill 才增加资料或脚本。`SKILL.md` 长度为 7 至 140 行，中位数约 75 行，因此它的“最小”主要体现在不预建无用文件，而不是正文普遍很短。

从模块设计看：

- **调用 seam** 是 Skill 名称、`description` 和调用策略；
- **接口** 包括触发条件、承诺结果、必要前提、顺序约束、错误模式和副作用；
- **实现** 是 `SKILL.md` 正文、条件资料和脚本；
- **适配器** 是 `agents/openai.yaml` 以及其他平台的调用元数据。

## 内部设计形态

| 形态 | 代表 Skill | 设计方法 | 可借鉴之处 |
|---|---|---|---|
| 命令外壳 | [`grill-me`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d/skills/productivity/grill-me) | 用户调用的薄入口转调 `grilling` | 将人工入口与可自动复用的方法分开 |
| 核心纪律 | [`tdd`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d/skills/engineering/tdd) | 每轮都适用的规则留在正文，示例与 mocking 指南拆出 | 区分必须加载的规则和按需参考 |
| 分支路由 | [`prototype`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d/skills/engineering/prototype) | 正文选择 Logic 或 UI 分支，再加载对应文件 | 以真实分支驱动渐进披露 |
| 阶段协议 | [`diagnosing-bugs`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d/skills/engineering/diagnosing-bugs) | 六阶段诊断过程，每阶段有进入条件和完成证据 | 用可检查门槛抑制过早完成 |
| 配置生成 | [`setup-matt-pocock-skills`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d/skills/engineering/setup-matt-pocock-skills) | 主文件负责探索和选择，GitHub、GitLab、local 等模板分别存放 | 将选择逻辑与具体适配内容分开 |
| 状态工作区 | [`teach`](https://github.com/mattpocock/skills/tree/ed37663cc5fbef691ddfecd080dff42f7e7e350d/skills/productivity/teach) | Skill 定义长期工作区，格式文件约束各类持久产物 | 让跨会话状态具有明确结构 |

## 最值得采用的内部原则

### 信息层级

`SKILL.md` 只保留调用后每条路径都需要的步骤和判断。只在部分情形需要的知识放入条件资料，并由正文中的明确上下文指针说明何时读取。`prototype` 是最清晰的例子：共同规则在 `SKILL.md`，逻辑和界面分支分别进入 `LOGIC.md` 与 `UI.md`。

上下文指针必须同时表达读取条件和目标。只有链接而没有条件，会让 Agent 不稳定地忽略资料或每次全部加载。

### Skill 自包含

一个 Skill 所需的规则、模板和脚本由该 Skill 自己拥有。跨 Skill 复用通过调用另一个 Skill 的名称表达，不直接链接 `../other-skill/...`。这样每个 Skill 都形成可独立安装、理解和验证的模块。

活跃区不应恢复全局 `_shared/`。确实能独立触发、被多个 Skills 使用的方法，应形成具有自身接口的 Skill；只属于一个 Skill 的资料留在该 Skill 内。

### 调用方式显式化

该提交有 24 个 user-invoked Skill 和 17 个 model-invoked Skill。两类 Skill 不通过目录区分，而通过元数据区分：

- user-invoked 的描述面向人类，只承担浏览和选择；
- model-invoked 的描述面向模型，需要写清真实触发分支；
- `agents/openai.yaml` 保存 Codex 展示信息和是否允许隐式调用。

这个分类有价值，但不同平台中的等价字段需要校验，避免 Claude frontmatter 与 Codex 元数据发生漂移。

### 确定性内容才使用脚本

脚本适合重复、机械且需要一致结果的动作，不负责替代 Agent 的判断。`diagnosing-bugs` 的 HITL 模板只封装人工复现循环的输入输出机制，诊断判断仍留在 Skill 中。

### 完成证据进入核心正文

完成条件不是附录。`diagnosing-bugs` 要求先得到已经运行过、能捕获准确症状的单一命令，才能进入假设阶段。这样的可观察门槛比“全面调查”一类宽泛要求更能稳定改变 Agent 行为。

## 内部设计的不足

1. **资料角色不清。** `tests.md`、`UI.md`、`MISSION-FORMAT.md` 分别代表示例、执行分支和产物模板，却都平铺在 Skill 根目录。
2. **部分接口没有披露副作用。** 例如 `implement` 会提交 Git，`prototype` 会创建临时分支，`teach` 会在当前目录建立学习工作区；调用者应在触发前知道这些事实。
3. **完成标准不统一。** `diagnosing-bugs` 有强完成证据，一些命令外壳则完全依赖被调用 Skill 的隐含标准。
4. **正文仍可能膨胀。** 41 个 `SKILL.md` 的中位数约 75 行，最长 140 行；有些条件资料仍留在核心正文中。
5. **缺少持久行为评测。** 仓库没有为每个 Skill 保存正例、相近反例和组合案例，无法仅从源码验证触发与行为是否稳定。

## 对 z-skills 的采用建议

本项目继续以 [`README.md`](../../README.md) 和 [`z-skill-creator-guide`](../../skills/z-skill-creator-guide/SKILL.md) 的当前规则为准，建议使用以下单 Skill 结构：

```text
skills/<skill-name>/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/              # 条件知识、示例和分支说明，按需创建
│   └── branches/            # 只有多个真实执行分支时才创建
├── scripts/                 # 确定性工具，按需创建
└── assets/                  # 要复制或交付的模板，按需创建
```

不创建空目录。每个 `SKILL.md` 应优先写清：

1. 唯一主要结果和触发边界；
2. 必要输入、前提与权限；
3. 模型容易遗漏的核心判断或步骤；
4. 完成证据与停止情形；
5. 条件资料的读取条件；
6. 会产生的文件、提交、外部写入等副作用。

仓库级目录仍保持精简：当前不因参考 Matt 的结构而新增领域 buckets、中央路由器、发布 manifest 或空的维护目录。只有当真实候选、自动校验、架构决策或发布需求出现时，再分别引入对应结构。
