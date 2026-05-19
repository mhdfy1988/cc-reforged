# CCR 文档分区说明

本文说明 `docs/` 下各类文档的职责边界。后续新增文档先按这里判断落点，避免技术方案、任务进度、历史归档混在一起。

## 目录职责

| 目录 | 类型 | 用途 | 示例 |
| --- | --- | --- | --- |
| `architecture/` | 长期技术文档 | 架构、协议、接口契约、状态机、接入方案、跨模块设计 | App Server 协议、模型输出标准、Desktop 事件契约 |
| `architecture/provider-integrations/` | 厂商接入技术文档 | 不同模型厂商 / provider 的认证、协议、模型、请求链路和 smoke 不变式 | Codex OAuth、DeepSeek、MiniMax |
| `mcp/` | MCP 技术文档 | MCP 接入规范、验证手册、具体 MCP 方案 | Playwright MCP、通用 MCP 接入 |
| `references/` | 源码证据与外部参考 | 从成熟项目或官方源码确认的证据索引 | OpenAI Codex 生成物源码对照 |
| `release/` | 发布流程文档 | npm、桌面包、GitHub Release 等发布流程 | npm 发布流程 |
| `examples/` | 示例配置 | 可复制的配置样例 | MCP 示例配置 |
| `agent-rules/` | 协作规则 | Agent 协作、评审、规则沉淀 | 评审基线、复盘同步 |
| `recovery/` | 修复与恢复资料 | 恢复方案、运行时缺失目标、依赖恢复、ESM 审计、构建适配清单 | `recovery-repair-plan.md` |
| `goals/` | 阶段目标记录 | 某个阶段为什么做、做什么、验收什么、完成记录 | `STD-OUTPUT-08` goal |
| `stages/` | 任务推进状态 | todo、handoff、archive、当前指针、阶段归档、当前修复看板 | `app-server-todo.md` |
| `backlog-history/` | 历史 backlog | 旧 backlog、旧 current todo 归档 | typecheck backlog 归档 |
| `design/` | 设计素材 | 原型图、HTML mockup、截图资产 | 模型配置页 mockup |

## 判断规则

1. 需要长期复用、给后续实现做依据的内容，放 `architecture/`。
2. 某个模型厂商怎么接入、怎么认证、请求如何映射、smoke 怎么覆盖，放 `architecture/provider-integrations/`。
3. 某一轮任务为什么做、完成了什么、跑了哪些验证，放 `goals/`。
4. 当前还剩什么、下一步做什么、暂停/阻塞在哪里，放 `stages/*todo.md`。
5. 从外部源码或成熟项目确认的证据，只保留关键路径和结论，放 `references/`。
6. 修复恢复类资料如果是长期排查依据或清单，放 `recovery/`；如果是当前还剩什么、下一步做什么，放 `stages/`。
7. 不确定是技术文档还是任务文档时，先问一句：后续实现者是要“按它设计/接入”，还是只要“知道这轮完成了什么”。前者放 `architecture/`，后者放 `goals/` 或 `stages/`。

## Provider 文档规则

Provider 相关文档按两层维护：

1. 总体标准：
   - `architecture/multi-provider-model-management-design.md`
   - `architecture/provider-protocol-inventory-and-official-docs.md`
   - `architecture/provider-tool-protocol-normalization.md`
   - `architecture/model-output-normalization-and-display-standard.md`
2. 单厂商接入：
   - `architecture/provider-integrations/<provider>.md`

单厂商文档至少说明：

- 供应商 ID 和地区/入口边界
- 认证方式和凭据落盘
- 文本 / 工具 / 图片 / 文件等不同能力分别走哪个协议
- 默认模型和模型能力
- 请求链路与关键适配器
- raw response 如何进入 CCR 标准模型
- smoke 覆盖的不变式

## Goal 与技术文档的关系

`goals/` 是阶段记录，不替代技术文档。

例如 MiniMax 图片生成：

- 阶段记录：`goals/2026-05-18-std-output-08-provider-neutral-minimax-image-generation.md`
- 长期技术文档：`architecture/provider-integrations/minimax.md`
- 通用标准文档：`architecture/model-output-normalization-and-display-standard.md`

后续如果 goal 中沉淀出长期规则，应同步回写到对应的 `architecture/` 文档。
