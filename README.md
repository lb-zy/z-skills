# z-skills

`z-skills` 是一个可独立安装、按需调用的 Agent Skill 源码集合。目前主要面向软件开发与 Skill 维护场景，并以 Codex 为主要运行环境。

本项目只维护 Skills 及其必要资源，不提供中央路由器或固定工作流。Agent 根据用户目标和当前上下文决定是否选择及如何组合 Skills。

> 只有 `skills/` 中且列入下表的内容属于当前集合。

## Skill 目录

| Skill | 用途 | 调用 |
|---|---|---|
| [`$z-skill-creator-guide`](./skills/z-skill-creator-guide/SKILL.md) | 补全简短的 Skill 新建或升级请求，并交给系统 Creator 实现和验证 | 仅显式调用；依赖系统 `$skill-creator` |

新增 Skill 时只需在此增加一行。复杂配置、多个使用模式或较长示例应放入独立文档，再从表中链接。

## 快速开始

### 安装

从仓库根目录选择一个 Skill，单独复制到 Codex Skills 目录：

```sh
skill_name="z-skill-creator-guide"
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R "./skills/$skill_name" "${CODEX_HOME:-$HOME/.codex}/skills/"
```

目标位置已有同名 Skill 时，先比较来源和改动再决定如何替换。安装后从目标位置重新检查文件，并在新的 Codex 任务中使用。

不要把整个仓库复制到运行目录。

### 调用

安装后，可以按名称显式调用 Skill，并在同一请求中说明目标：

```text
使用 $<skill-name> <要取得的结果>
```

允许隐式调用的 Skill，也可以由 Agent 根据 `description` 和当前任务自动选择。具体调用方式、前置条件和触发边界以目录表及对应 `SKILL.md` 为准。

## 仓库内容

```text
z-skills/
├── skills/                              # 当前集合：可维护、验证和发布
└── docs/                                # 项目级资料，不进入 Skill 运行上下文
    ├── maintaining-skills.md            # 跨领域维护规范
    ├── domains/                         # 各领域 Skill 集的确定设计
    └── research/                        # 有明确来源的外部研究
```

- [`skills/`](./skills/) 是现行 Skill 的唯一维护来源，也是发布内容的来源。
- [`docs/`](./docs/) 解释如何设计和维护集合，不作为任何 Skill 的运行时依赖。

## 文档

- [Skill 编写与维护](./docs/maintaining-skills.md)：设计约定、单 Skill 结构、验证、发布与安装边界。
- [软件开发 Skill 集设计](./docs/domains/software-development.md)：软件开发阶段、能力范围与关键边界。
- [`mattpocock/skills` 参考分析](./docs/research/mattpocock-skills.md)：外部 Skill 仓库的结构、设计模式与取舍。

## 许可

本仓库目前尚未包含许可证。在许可证明确前，不应假定这些内容可以被复制、修改或再分发。
