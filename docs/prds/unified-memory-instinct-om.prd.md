# PRD: Unified Memory 对齐 instinct / OM

**Status**: **closed (M0–M4 shipped)**  
**Close-out**: 2026-07-27 — acceptance 勾选回填；Open Questions → Resolved；里程碑证据 commit 写入下表。

> **Canonical versioned copy** of the closed PRD (local working copies may also live under gitignored `.pi/prds/`).

## Problem

ECC `unified-memory` 提供跨 harness 的 Memory Vault（`ecc.memory.v1` Markdown，project/team/user 三 scope，recall → save → handoff → validate）。

hkx 侧已有两套相邻但未统一的记忆面：

1. **Instinct store**（`HKX_HOMUNCULUS_DIR` / XDG `hkx-homunculus`）：pending → personal/inherited，CLI 含 learn / from-om / accept / promote / decay / prune / projects / evolve。
2. **OM（Observational Memory）**：session ledger → `from-om` 仅 **单向** 折成 pending instincts。

缺口：

- 无通用「会话/项目上下文」vault（决策、约束、handoff、非 instinct 形态的笔记）。
- 无对称的 **recall-before-write** 工作流（ECC vault 的核心用法）。
- 若再实现一套 `~/.ecc/memory` 式根目录，会与 homunculus **第三套存储** 冲突，运维与路径心智分裂。
- team/git 共享记忆与 instinct 的 personal/global 晋升模型未对齐。

目标操作者需要：**一套数据根、多种文档类型、明确进出 OM/instinct 的边界**，而不是再装一个 Claude 向 memory 运行时。

## Goals

- 在 **现有** `hkx-homunculus` 数据根上增加 **Memory Vault** 层（或明确子树），文档形态可移植（建议 `hkx.memory.v1`，语义对齐 `ecc.memory.v1` 但命名/字段 pi 化）。
- 定义 scope 与 instinct 的对应关系，避免双写与隐式泄漏：
  - `project` 记忆 ↔ 当前 project id 下 vault
  - `user` 记忆 ↔ global/user vault（默认不进入 project recall）
  - `team` 记忆 ↔ 可选、可 git 审阅的共享区（或明确 Non-Goal 延后）
- 提供最小操作面：`recall` / `save` / `handoff` / `validate`（CLI 子命令和/或 thin commands），默认 **预览优先**，写操作可审计。
- **对齐 OM**：规定 OM → vault 与 OM → instinct 的分工（例：reflections 可进 instinct；短时会话上下文/约束进 vault；禁止静默双写）。
- **对齐 instinct**：vault 条目可 **显式** 提升为 pending instinct（人工门），instinct 不自动回写成 vault 垃圾。
- 文档与 `conversion-map` / `instinct-evolve` skill 说明「何时用 vault vs instinct vs OM from-om」。
- Linux + Windows 路径与现有 `paths.mjs` 一致；`HKX_HOMUNCULUS_DIR` 一处覆盖。

## Non-Goals

- 移植 ECC 的完整 multi-harness 运行时或 `ECC_MEMORY_*` 环境名作为一等 API。
- 再引入第二数据根（`~/.ecc/memory` 并行权威源）。
- bash observer-loop、default-on 自动 capture、自动 formal skill 安装（仍 out of scope）。
- 完整 team 协作产品（CR 流程、权限、远程 sync）— 仅目录占位 + 文档约定（team 无默认 save/recall）。
- 向量 DB / 云同步 / 跨机器实时复制。
- 替换 pi 宿主自带的 session/compaction 机制；vault 是 **可选** 持久层，不是 transcript 镜像。
- 一次做完 epic/PRP/sessions 书签全家桶。
- 简易全文检索（FTS）/ 向量检索（Open Q5 锁定为不做）。

## Users And Workflows

- **User**: hkx/pi 操作者与 agent（主会话唯一 writer 习惯不变）。
- **Workflow A — Recall before write**: 开工或改共享模块前 `recall` project（+ 显式 user）记忆，注入约束后再改代码。
- **Workflow B — Save context**: 会话结束或里程碑将决策/约束 `save` 为 vault 文档（非 instinct trigger 形态）。
- **Workflow C — Handoff**: 跨会话/跨 agent 用 handoff 文档传递「做到哪、别动什么」。
- **Workflow D — OM bridge**: 从 OM session 导入时，映射规则分流 → vault 与/或 pending instinct；`from-om --to vault|instinct|both`（**默认 instinct-only**）。
- **Workflow E — Promote to instinct**: 稳定、可触发的行为模式从 vault **显式** 转为 pending instinct → 现有 accept/evolve 管道。

## Requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| UM-1 | 单一数据根：vault 布局挂在现有 homunculus（或文档化的子树），复用 project id / `projects.json` | P0 | **done** (M1) |
| UM-2 | 文档 schema：`hkx.memory.v1`（id、scope、title、tags、created/updated、body；可选 source=om\|manual\|session\|import） | P0 | **done** (M1) |
| UM-3 | Scope 语义：project 默认 recall；user 仅显式；team 若做则 fail-closed gitignore / 审阅约定 | P0 | **done** (M1 stub team) |
| UM-4 | CLI：`memory recall\|save\|handoff\|validate`（+ M3/M4 扩展），`--json`，写默认预览 + 显式 `--apply` | P0 | **done** (M1–M4) |
| UM-5 | Thin commands：单一 `/unified-memory` 路由 | P1 | **done** (M2) |
| UM-6 | OM 对齐：书面映射 + 不破坏 `from-om` → pending；扩展有测试 | P0 | **done** (M3 `--to`) |
| UM-7 | Instinct 对齐：`vault → pending` 显式命令；不自动 reverse-sync | P1 | **done** (M3 promote-instinct) |
| UM-8 | Skill：`unified-memory` 描述何时用哪一层 | P0 | **done** (M2+) |
| UM-9 | 测试：schema round-trip、scope 隔离、from-om 回归 | P0 | **done** (`instinct-memory` / `instinct-om`) |
| UM-10 | 文档：conversion-map；README 中英一句；Non-Goals 无第二数据根 | P0 | **done** |
| UM-11 | 安全：不把 secrets 写入 vault；validate 可扫明显 secret 模式（尽力而为） | P1 | **done** (M4) |
| UM-12 | 迁移：可选从 ECC `.ecc/memory` **只读导入**（非持续双向同步） | P2 | **done** (M4 `import-ecc`) |

## Acceptance Criteria

- [x] 无第二权威数据根；仅 `HKX_HOMUNCULUS_DIR` / 现有 XDG·LocalAppData 解析  
  **证据**: `paths.mjs` + skill 布局说明；ECC 导入写入 homunculus vault，不保留 `~/.ecc/memory` 为权威源。
- [x] 能 `save` 一条 project 记忆并在同 project `recall` 命中；user 记忆默认不出现在 project recall  
  **证据**: `scripts/tests/instinct-memory.mjs`（project/user 隔离用例）。
- [x] `validate` 对损坏 frontmatter / 越权路径失败并给出可读错误  
  **证据**: `validateMemories` + 测试「validate catches broken」；secret high 亦失败（M4）。
- [x] 现有 `npm test` instinct 套件（含 from-om）全绿；新增 memory 测试纳入 `scripts/tests/run.mjs`  
  **证据**: `instinct-memory.mjs` / `instinct-om.mjs` 由 `scripts/tests/run.mjs` 发现；pre-push `npm test` 17 suites。
- [x] `from-om` 默认行为与文档一致（instinct 管道不被静默改掉）  
  **证据**: 默认 / 省略 `--to` → pending instinct；`--to vault|both` 显式；`instinct-om` 回归。
- [x] Skill + conversion-map + README 说明 vault vs instinct vs OM  
  **证据**: `skills/unified-memory/SKILL.md`、`docs/conversion-map.md`、`README.md` / `README.zh-CN.md` 一句入口。
- [x] `npm run validate` 通过；命令 frontmatter 合法  
  **证据**: `commands/unified-memory.md` + package validate。
- [x] 明确写出：不启用 default-on capture / observer-loop  
  **证据**: 本 PRD Non-Goals；skill / conversion-map 边界说明。

## Delivery Milestones

| Milestone | Scope | Status | Plan / evidence |
| --- | --- | --- | --- |
| M0 | 本 PRD 定稿；路径/schema/OM 分流决策书面化 | **done** | 本文件 + plan-time locks |
| M1 | 布局 + schema + `recall/save/validate` CLI + 测试 | **done** | local plan + commit `89c9949` |
| M2 | thin commands + skill + conversion-map/README | **done** | commit `51cd8a7` · `/unified-memory` + skill `unified-memory` |
| M3 | handoff + vault→pending instinct + OM 分流扩展 | **done** | local plan + commit `a7550d2` |
| M4 | 可选 ECC vault 只读导入；secret 扫描加强 | **done** | local plan + commit `bfa8297` |

**Shipped surface (operator)**:

```bash
node scripts/instinct/cli.mjs memory recall|save|handoff|promote-instinct|import-ecc|validate
node scripts/instinct/cli.mjs from-om [--to instinct|vault|both]
# slash: /unified-memory
```

## Risks

| Risk | Mitigation | Outcome |
| --- | --- | --- |
| 与 instinct 文档模型混淆，双写膨胀 | 类型正交；禁止隐式同步 | 已实现边界（promote 显式；from-om 默认 instinct） |
| 重做成 ECC 运行时依赖 | Non-Goals；Node CLI + markdown | 无 MCP/ECC 运行时依赖 |
| project 记忆误提交密钥 | validate 启发式 + save 拒绝 high + 文档 | M4 best-effort；非合规扫描器 |
| OM 映射改坏 from-om | 回归测试 + 显式 `--to` | M3 测试锁定默认路径 |
| team scope 过早产品化 | 仅 stub 目录 | 仍 Non-Goal |
| 路径/Windows 分叉 | 复用 `paths.mjs` | 与 instinct 同根 |

## Open Questions → Resolved

| # | Question | Resolution |
| --- | --- | --- |
| 1 | 挂载点：`homunculus/memory/{project,user,team}/` vs `projects/<id>/memory/` | **Canonical**: `projects/<12-hex>/memory/`（project）；root `memory/user/`（user）；root `memory/team/` **目录占位 only** |
| 2 | team：完全推迟还是目录+gitignore | **Stub only**：`ensureLayout` 空目录；无 save/recall 默认含 team；完整 team 产品仍 Non-Goal |
| 3 | from-om 默认 | **默认仅 pending instinct**；`--to vault\|both` 显式 opt-in（永不默认 both） |
| 4 | 命令形态 | **单一** `/unified-memory` 路由 + CLI `memory *`（不做多条 `/hkx-memory-*`） |
| 5 | 检索是否要 FTS | **不做 FTS**；id / tag / title·body 子串 + 列出 |

## Plan-time decisions (locked for M1; still authoritative)

| Q | Decision for M1 |
| --- | --- |
| 挂载点 | **Canonical**: `projects/<12-hex>/memory/`（project）；root `memory/user/`（user）；root `memory/team/` **目录占位 only** |
| team | M1：`ensureLayout` 创建空目录 + 文档约定；无 save/recall 默认包含 team |
| from-om | **默认不变**（仅 pending instinct）；扩展用显式 flag（M3） |
| 命令形态 | M1：**仅 CLI**；M2：thin `/unified-memory` |
| 检索 | id / tag / title 子串 + 列出；**无 FTS** |

## Documentation close-out (this pass)

| Action | Result |
| --- | --- |
| Acceptance `[ ]` → `[x]` + 证据 | done |
| Open Questions → Resolved 表 | done |
| Requirements 加 Status 列 | done |
| Milestones 补 commit 证据 | `89c9949` / `51cd8a7` / `a7550d2` / `bfa8297` |
| PRD Status | **closed (M0–M4 shipped)** |
| Versioned path | `docs/prds/unified-memory-instinct-om.prd.md` (`.pi/prds/` is gitignored local state) |

**Out of PRD（若将来新开 PRD）**: team 真写入与 git 共享流、FTS、ECC MCP 打包、持续双向同步、更强可配置 secret 规则。

---

*End of PRD. Implementation lives under `scripts/instinct/lib/memory-*.mjs`, CLI `memory` / `from-om`, skill `unified-memory`, command `/unified-memory`.*
