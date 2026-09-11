# SoL-Pi vs hkx-pi-workflows — 功能重叠对比

> **研究记录（advisory，非 shipped surface）**。本文档对比 NVIDIA `NVlabs/SoL-Pi` 扩展与
> 本仓库现有扩展/技能的功能重叠，供采纳与组合决策参考。**本仓库目前未采纳任何 SoL-Pi 机制。**
> 撰写时 SoL-Pi 为非常新的项目（0.1.0，2026-09 前后发布），其机制未受大规模生产验证。

上游：
- 仓库：<https://github.com/NVlabs/SoL-Pi>
- 博客：<https://nvlabs.github.io/SoL-Pi/>
- 版本参考：依赖锁定 `@earendil-works/pi-coding-agent@0.84.2`，MIT 协议

---

## 1. 结论速览

| 维度 | 结论 |
| --- | --- |
| **直接重叠** | 极小——无不冲突、无同机制重复实现 |
| **邻居级靠近点** | 2 处（与 `hkx-language-quality` 互补；与 `hkx-session-summary` 相邻但意图不同） |
| **本仓库空白** | SoL-Pi 四大机制（工具/观测/委派/上下文效率）在我们仓库**均无对应运行时实现** |
| **建议关注** | **Action Fusion**（与 `hkx-language-quality` 天然组合）；**ObservationPack**（为规则层的省上下文提供运行时底座） |
| **不建议纳入** | Evidence-Preserving Reducer（远程模型、数据外发风险）；Online Context Compact（自动开新轮次续跑、行为侵入性强） |

---

## 2. 机制层面映射（按 Pi 扩展表层）

SoL-Pi 覆盖 Pi 的**工具 / 观测 / 委派 / 上下文**四类运行时表层：

| SoL-Pi 机制 | Pi 表层 | 触发 hook | 核心行为 | 额外模型调用 | 中断运行 |
| --- | --- | --- | --- | --- | --- |
| **Action Fusion** | 工具 | tool_call | edit/write 在同一调用里跑 follow-up 验证命令 → 省一次模型往返 | 否 | 否 |
| **ObservationPack** | 观测 | observation | 重复大文本结果 → 稳定句柄 + 精确分页召回 | 否 | 否 |
| **Evidence-Preserving Reducer** | 委派 | delegation | 长诊断日志 → 紧凑"收据"；仅当每个保留引文与归档源逐字匹配才缩减 | **是**（reducer 模型） | 否 |
| **Online Context Compact** | 上下文 | compaction | 已完成 plan 步骤 → 原生压缩候选；压缩后新轮次自动续跑 | 否 | **是**（自动新轮次） |

HKX 现有扩展的表层覆盖（按 hook）：

| HKX 扩展 | Pi 表层 | hook | 核心行为 | 与 SoL-Pi 关系 |
| --- | --- | --- | --- | --- |
| `hkx-gateguard` | 工具安全 | tool_call | 破坏性命令硬闸 | **无关**（安全，非效率） |
| `hkx-hookify` | 工具行为 | tool_call / bash / file / prompt / session_start / stop | 行为护栏规则 | **无关**（护栏，非效率） |
| `hkx-language-quality` | 工具结果 | **tool_result** | 编辑/写入后语言检查（typecheck/lint/test 提示） | **邻居**——见 §3.1 |
| `hkx-subagent-supervisor-auto-reply` | 委派 | session_start | supervisor 审批自动回复，避免链脱管 | **邻居**——见 §3.2 |
| `hkx-working-indicator` | 外观 | session_start | accent 加载 spinner | **无关**（UI） |
| `hkx-custom-header` | 外观 | session_start | 启动头（logo + 快捷键提示） | **无关**（UI） |

以及一个**技能**（skill，非扩展）：`hkx-session-summary` → LLM 摘录整个会话 —— **邻居**，见 §3.4。

---

## 3. 四个"邻居"逐条对比

### 3.1 `hkx-language-quality` ↔ SoL-Pi「Action Fusion」

| 维度 | hkx-language-quality | SoL-Pi Action Fusion |
| --- | --- | --- |
| 挂载点 | `tool_result`（**结果之后**） | tool_call（**动作之中**） |
| 做什么 | 检测语言类型 → **提示/通知**该跑什么检查 | 把 follow-up 验证命令**作为原语并入**调用让模型一并执行 |
| 谁决定执行 | AI 决定是否跑 | 模型在**同一调用**执行 |
| 省什么 | 省"遗漏验证" | 省**一次模型往返** |
| 每动作花费 | 无额外模型调用 | 无额外模型调用 |

**重叠度：低。方向互补。**
`hkx-language-quality` 回答"该检查什么"，Action Fusion 负责"怎么一步跑完"。两者可叠加：语言质量检测出 typecheck 后，复用 Action Fusion 的合并执行通道一次完成——这是**当前最自然的落地组合**。

### 3.2 `hkx-subagent-supervisor-auto-reply` ↔ SoL-Pi「Evidence-Preserving Reducer」

| 维度 | hkx-subagent-supervisor-auto-reply | Evidence-Preserving Reducer |
| --- | --- | --- |
| 表层 | 委派（链/审批） | 委派（日志缩减） |
| 减少什么 | 链卡住后的**审批往返** | 长诊断日志**占用上下文** |
| 副作用 | 无（纯本地文件写授权） | 可能把日志发给 reducer 模型（Pi 托管认证） |

**重叠度：几乎 0。** 虽同处"委派"表层，但一个管审批流、一个管日志体积，是两个方向。

### 3.3 ObservationPack ↔ 本仓库空白

- 本仓库**没有**任何"大观测 → 句柄 + 分页召回"的运行时机制，**这是空白**。
- 最接近的是 `rules/`、`skills/` 里的"保持精简上下文"**劝告**，以及 `pi-tool-display` 等外部配置层——都是规则层，**非运行时机制**。
- **方向一致但层面不同**：SoL-Pi 提供了服务于"省上下文"取向的**运行时底座**。

### 3.4 `hkx-session-summary`（skill）↔ SoL-Pi 四个机制

- `hkx-session-summary` 摘录的是**整个会话**（留存/回顾用途），是**事后产物**，不减实时 token 消耗。
- SoL-Pi 的 **Online Context Compact** 是**运行中**按经济/窗口压力触发、压缩后自动续跑的实时机制。
- 两者**意图指向不同**：前者"回顾留存"，后者"运行时省上下文"。**不冲突。**

---

## 4. 空白与推荐采纳矩阵

| SoL-Pi 机制 | 本仓库是否缺失 | 风险 | 采纳建议 |
| --- | --- | --- | --- |
| **Action Fusion** | 是 | 低（无额外模型调用，不中断） | **推荐试点**——与 `hkx-language-quality` 组合 | 
| **ObservationPack** | 是 | 低（无额外模型调用，不中断） | **推荐试点**——省上下文运行时底座 |
| Evidence-Preserving Reducer | 是 | 中高（远程模型、日志可能外发） | **不建议**，除非明确需求且日志必须本地 |
| Online Context Compact | 是 | 中（自动开新轮次续跑，行为侵入） | **不建议**，除非明确需求 |

**试点原则**（与仓库"低风险、opt-in、尊重 Pi 运行时"取向一致）：

1. 在**单个项目本地**试点（`pi install git:... --local --approve`），勿全局启用。
2. 先只开 `actionFusion` + `observationPack`（保守配置 JSON 见 SoL-Pi README）。
3. 涉及远程缩减（Reducer）或自动续跑（Online Compact）前，先审 SoL-Pi 的 `SECURITY.md` 与本仓库安全取向。
4. 若自研而非依赖上游：保持"no Pi patches、显式 opt-in、保留证据、尊重 Pi 运行时"四条规则。

---

## 5. 维护提醒

- 本文档是**调研记录**，未入选 shipped surface。
- **尚未**写入 `conversion-map.md`（其为最终态 surface 映射）。
- 若后续真采纳某机制请**更新本文档结论**：从"试点建议"改为"已采纳"，并同步 `conversion-map.md`、`architecture.md` 扩展清单、docs/README 索引。
- 若 SoL-Pi 机制或 Pi API 演进，核对 `@earendil-works/pi-coding-agent` 版本后再复用其实现思路。

---
