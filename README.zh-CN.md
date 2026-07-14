# HKX Pi Workflows

[English](./README.md) | 中文

面向 [pi](https://pi.dev) / pi-subagents 的 pi-native 工作流包，思路来自 HKX / Everything Claude Code，并改写为当前 pi 包与安装模型。

本包刻意保持精简，聚焦一层可复用的核心工作流，而不是变成覆盖所有领域的巨型目录。

## 提供什么

- **agents** — 可移植的 pi-subagents 定义（运行时名 `hkx.<name>`）
- **chains** — 可复用的多智能体工作流（`hkx-*.chain.json`）
- **commands** — 面向操作者的 slash 提示词（仓库目录 `commands/`；在 `package.json` 中声明为 `pi.prompts`）
- **skills** — 工作流与语言/领域指导
- **rules** — 轻量仓库/会话提醒（仅完整安装路径）
- **extensions** — 低噪声质量与门禁扩展
- **外部扩展配置** — 受管覆盖层（如 `pi-permission-system`；仅完整安装）
- **全局 agent 设置** — `configs/agent-settings.json` → 合并进 `~/.pi/agent/settings.json`（仅完整安装）
- **全局上下文文件** — 安装源：`~/.pi/agent/AGENTS.md`、`~/.pi/agent/APPEND_SYSTEM.md`（仅完整安装）

## 快速开始

有 **两条安装路径**，按你需要的完整程度选择。

### 路径 A — 官方 Pi Package（核心运行时）

作为普通 pi 包从 git（或本地 checkout）安装：

```bash
# 需要稳定版本时建议 pin ref
pi install git:git@github.com:Hkxtor/hkx-pi-workflows
# 也支持：
pi install git:github.com/Hkxtor/hkx-pi-workflows
pi install https://github.com/Hkxtor/hkx-pi-workflows
```

这会把包写入 `~/.pi/agent/settings.json` 的 `packages`，并按 `package.json` 加载**官方包资源**：

| 清单字段 | 加载内容 |
| --- | --- |
| `pi.extensions` | `extensions/*.ts` |
| `pi.skills` | `skills/` |
| `pi.prompts` | `commands/`（slash 提示词模板） |
| `pi-subagents.agents` | `agents/` 作为 package agents（`hkx.<name>`） |
| `pi-subagents.chains` | `chains/` 作为 package chains |

**agents / chains 前置依赖：** 需先安装 `pi-subagents`（例如 `pi install npm:pi-subagents`）。skills / extensions / prompts 不依赖它即可加载。

**路径 A 不会安装：** `rules/`、`GLOBAL_AGENTS.md`、`APPEND_SYSTEM.md`、MCP 合并、`configs/agent-settings.json`、以及 permission-system 配置覆盖层。需要这些请用路径 B。

后续更新：

```bash
pi update --extensions
# 或重新安装到新的 ref
pi install git:git@github.com:Hkxtor/hkx-pi-workflows@main
```

### 路径 B — 完整操作者安装（`install-global`）

在本仓库 clone 中：

```bash
npm run install-global
```

这是**完整**操作者路径：把各 surface 同步到 `~/.pi/agent/`，深合并受管 settings，对 `configs/agent-settings.json` 中列出的包执行 `pi update --extensions`，并安装受管扩展配置覆盖层。

当你需要 rules、MCP 默认值、全局 AGENTS / APPEND_SYSTEM，以及受管依赖包清单时，请用路径 B，而不是只装包原生资源。

### 或从当前 checkout 试跑（开发）

```bash
pi -e .
```

或在包根目录的 `.pi/settings.json`：

```json
{
  "packages": ["."]
}
```

本地包发现仍遵循 `package.json`（`pi` + `pi-subagents`）。覆盖层仍需要路径 B。

## 双路径对比

| Surface | 路径 A（`pi install`） | 路径 B（`npm run install-global`） |
| --- | --- | --- |
| extensions | 是（来自 package） | 是 → `~/.pi/agent/extensions/` |
| skills | 是（来自 package） | 是 → `~/.pi/agent/skills/` |
| commands / prompts | 是（`pi.prompts` → `commands/`） | 是 → `commands/` **与** `prompts/` |
| agents | 是（经 pi-subagents 包发现） | 是 → `~/.pi/agent/agents/hkx/` |
| chains | 是（经 pi-subagents 包发现） | 是 → `~/.pi/agent/chains/` |
| rules | 否 | 是 → `~/.pi/agent/rules/` |
| agent settings 合并 | 否 | 是 |
| 受管 `packages` 更新 | 否（仅本包条目） | 是（`pi update --extensions`） |
| permission 配置覆盖层 | 否 | 是 |
| GLOBAL_AGENTS / APPEND_SYSTEM | 否 | 是 |
| MCP 默认值 / 模板 | 否 | 是 |

## 路径 B 安装到哪里

| Surface | 目标 |
| --- | --- |
| agents | `~/.pi/agent/agents/hkx/*.md` |
| chains | `~/.pi/agent/chains/hkx-*.chain.json` |
| commands | `~/.pi/agent/commands/` 与 `~/.pi/agent/prompts/` |
| skills | `~/.pi/agent/skills/` |
| rules | `~/.pi/agent/rules/` |
| extensions | `~/.pi/agent/extensions/` |
| agent settings | `configs/agent-settings.json` → 深合并进 `~/.pi/agent/settings.json`（`packages` + 可移植默认值；保留机器本地键） |
| pi packages | settings 合并后：`pi update --extensions` |
| permission 配置覆盖层 | 包更新后：`configs/pi-permission-system/config.json` → `~/.pi/agent/extensions/pi-permission-system/config.json`（目录不存在时会创建） |
| 全局 AGENTS | `GLOBAL_AGENTS.md` → `~/.pi/agent/AGENTS.md` |
| append system | `APPEND_SYSTEM.md` → `~/.pi/agent/APPEND_SYSTEM.md` |
| MCP 默认值 | `.mcp.json` → 合并进 `~/.pi/agent/mcp.json` |
| MCP 模板/目录 | `mcp-configs/` → `~/.pi/agent/hkx-pi-workflows/mcp-configs/` |
| MCP profile 助手 | `scripts/apply-mcp-profile.mjs` → `~/.pi/agent/hkx-pi-workflows/scripts/` |

## 常用工作流

### 评审 diff 或 PR

- `hkx-pr-review`
- `hkx-adversarial-review`
- `hkx-security-scan`

```bash
/run-chain hkx-pr-review "Review current local diff"
```

### 实现功能或修复缺陷

- `hkx-feature-flow`
- `hkx-fix-defect`
- `hkx-refactor-flow`
- `hkx-build-fix`

```ts
subagent({
  chainName: "hkx-feature-flow",
  task: "Add thin-slice feature X",
  async: true,
  context: "fresh"
})
```

### 直接调用专家 agent

代表性 agents：

- `hkx.code-reviewer`
- `hkx.security-reviewer`
- `hkx.typescript-reviewer`
- `hkx.python-reviewer`
- `hkx.go-reviewer`
- `hkx.rust-reviewer`
- `hkx.planner`
- `hkx.tdd-guide`
- `hkx.build-error-resolver`

```ts
subagent({
  agent: "hkx.code-reviewer",
  task: "Review the current local diff. Do not modify files.",
  context: "fresh",
  async: true
})
```

## 工具假设

这些 agents 与 chains 面向以下工具栈调优：

- **pi-fff**：`fffind`、`ffgrep`、`fff-multi-grep`
- **pi-lens**：`lsp_diagnostics`、`lsp_navigation`、`ast_grep_search`、`ast_grep_replace`
- 核心文件/Shell 工具：`read`、`edit`、`write`、`ls`、`bash`

简言之：用 pi-fff 搜索，用 pi-lens 理解代码，窄范围修改。

## 上下文文件分工

- `AGENTS.md` — **本仓库**维护规则（给维护者）
- `GLOBAL_AGENTS.md` — 通用全局开发手册源，路径 B 安装到 `~/.pi/agent/AGENTS.md`
- `APPEND_SYSTEM.md` — 简短系统级工具纪律追加源

## 脚本

### 日常 npm 脚本

| 脚本 | 用途 |
| --- | --- |
| `npm run install-global` | 完整操作者安装到 `~/.pi/agent/`（路径 B） |
| `npm run validate` | 校验 package surfaces、frontmatter 与双路径清单 |
| `npm run mcp:apply-profile` | 应用 MCP 模板 profile |

官方包安装（路径 A）**不是** npm 脚本：

```bash
pi install git:git@github.com:Hkxtor/hkx-pi-workflows
```

### 仅维护用助手

这些**不属于**正常安装/运行路径，也不作为 npm scripts 暴露：

| 助手 | 用途 |
| --- | --- |
| `node scripts/convert-agents-to-pi.mjs` | 将旧 agent 定义批量导入当前 pi-subagents 格式。新 agent 请直接按当前 pi-native 格式编写。 |

## 校验

```bash
npm run validate
```

## 设计原则

- 可移植的 pi-native agents 与 chains
- 紧凑、可复用的工作流 surface
- 评审者默认只读，实现 agent 窄范围写入
- MCP 配置做加法，而不是沉重安装逻辑
- 可选领域包不进入核心包

## 相关文档

- [English README](./README.md) — 英文主页（权威安装说明的英文版）
- `docs/README.md` — 文档索引与路由
- `docs/architecture.md` — 分层与 surface 边界
- `docs/conversion-map.md` — 当前包 surface 地图
- `docs/skill-routing.md` — skill 族重叠时的主 skill 选择
- `docs/language-hooks.md` — 语言规则与运行时扩展的分工
- `AGENTS.md` — 本仓库维护规则
- `GLOBAL_AGENTS.md` — 全局开发手册源
- `APPEND_SYSTEM.md` — 全局系统级工具纪律源
