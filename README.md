# z-skills

`z-skills` 是一个 Agent Skill 与 Agent 基本规则的维护源码集合。目前主要面向软件开发与 Skill 维护场景。

Skills 按需安装和调用；Agent 基本规则通过项目根目录 `AGENTS.md` 在本项目中生效。本项目不提供中央路由器或固定工作流。

> 只有 `skills/` 中且列入下表的内容属于 Skill 集合；Agent 基本规则的唯一维护源码是 [`docs/agent-basic-rules/zh-CN.md`](./docs/agent-basic-rules/zh-CN.md)。

## Skill 目录

| Skill | 用途 | 调用 |
|---|---|---|
| [`$z-skill-creator-guide`](./skills/z-skill-creator-guide/SKILL.md) | 确认 Skill 需求契约，再交给系统 Creator 实现并按契约验收 | 仅显式调用；确认前只读，内部依赖系统 `$skill-creator` |
| [`$z-ui-design`](./skills/z-ui-design/SKILL.md) | 评审现有 UI、形成新建或重构方案，或制作独立交互原型 | 可隐式或显式调用；每个交付分支分别确认 |

新增 Skill 时只需在此增加一行。复杂配置、多个使用模式或较长示例应放入独立文档，再从表中链接。

## 快速开始

### 安装 Skill

从仓库根目录选择一个 Skill，单独复制到 Codex Skills 目录：

```sh
skill_name="z-skill-creator-guide"
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R "./skills/$skill_name" "${CODEX_HOME:-$HOME/.codex}/skills/"
```

目标位置已有同名 Skill 时，先比较来源和改动再决定如何替换。安装后从目标位置重新检查文件，并在新的 Codex 任务中使用。

不要把整个仓库复制到运行目录。

### 使用 Agent 基本规则

Agent 基本规则及语言版本见 [`docs/agent-basic-rules/`](./docs/agent-basic-rules/README.md)。其中 `zh-CN.md` 是规范来源；项目根目录 [`AGENTS.md`](./AGENTS.md) 是本项目实际加载的副本。

Codex 在新任务开始时加载项目根目录的 `AGENTS.md`。当前任务不会动态重新加载修改后的规则。本项目尚未将这些规则安装为 Codex 全局指令；全局安装需要另行执行。

准则内容参考 [`karpathy-guidelines`](https://github.com/multica-ai/andrej-karpathy-skills/blob/64723a49ea6117894304eb491f0d32a60570bf45/skills/karpathy-guidelines/SKILL.md)；全局 `AGENTS.md` 的加载方式参考 Codex 文档 [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md)。

### 调用

安装后，可以按名称显式调用 Skill，并在同一请求中说明目标：

```text
使用 $<skill-name> <要取得的结果>
```

允许隐式调用的 Skill，也可以由 Agent 根据 `description` 和当前任务自动选择。具体调用方式、前置条件和触发边界以目录表及对应 `SKILL.md` 为准。

## 仓库内容

```text
z-skills/
├── AGENTS.md                            # 本项目实际加载的 Agent 基本规则
├── skills/                              # 可独立验证和发布的 Skills
└── docs/                                # 项目级资料，不进入 Skill 运行上下文
    ├── agent-basic-rules/
    │   ├── README.md                    # 语言版本与同步约定
    │   ├── zh-CN.md                     # Agent 基本规则的规范来源
    │   └── en.md                        # 英文翻译
    ├── skill-development.md             # Skill 设计、验证、发布与安装
    ├── domains/                         # 各领域 Skill 集的确定设计
    └── research/                        # 有明确来源的外部研究
```

- [`docs/agent-basic-rules/zh-CN.md`](./docs/agent-basic-rules/zh-CN.md) 是 Agent 基本规则的唯一维护来源；项目根目录 `AGENTS.md` 是加载副本，不反向定义源码。
- [`skills/`](./skills/) 是现行 Skill 的唯一维护来源，也是发布内容的来源。
- [`docs/`](./docs/) 解释设计、来源和维护约定，不作为运行时指令来源。

## 文档

- [Agent 基本规则](./docs/agent-basic-rules/README.md)：语言版本、规范来源与同步约定。
- [Skill 开发](./docs/skill-development.md)：设计约定、单 Skill 结构、验证、发布与安装边界。
- [软件开发 Skill 集设计](./docs/domains/software-development.md)：软件开发阶段、能力范围与关键边界。
- [软件设计文档体系](./docs/software-design/README.md)：可裁剪的架构、UI/UX、前端、后端、接口、数据库、平台与验证模板。
- [`mattpocock/skills` 参考分析](./docs/research/mattpocock-skills.md)：外部 Skill 仓库的结构、设计模式与取舍。

## 许可

本仓库目前尚未包含许可证。在许可证明确前，不应假定这些内容可以被复制、修改或再分发。
