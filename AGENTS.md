# Claude Code Reforged 项目协作规则（精简版）

目标：减少上下文占用。详细条款已拆分为分册，索引见
[docs/agent-rules/index.md](D:/agent_project/claude-code-reforged/docs/agent-rules/index.md)。

## 1. 角色分工

1. 默认采用“双线程协作”：主线程负责文档与评审，修复线程负责实现与验证。
2. 当用户要求主线程只做评审时，主线程不直接改业务实现文件。

## 2. 子线程交付与失效处理

1. 交付必须有真实代码改动，不接受“仅状态回复”作为完成。
2. 每轮必须提交：改动文件、关键改动点、验证命令与结果、剩余阻塞。
3. 连续两次仅状态回复视为无效线程：关闭并重建，任务收窄到更小文件单元。
4. 子线程生命周期采用“复用优先 + 定期重建”：
   - 同一任务域且近期有有效产出时优先复用旧线程
   - 每完成一个阶段或连续 `3-5` 轮后默认重建线程，避免上下文膨胀

## 3. 等待与中断策略

1. 子线程进入长任务后，主线程默认长等待，不因超时提示提前收工。
2. 网络中断或机器重启后，必须重新核验线程存活、实际改动和验证输出。
3. `wait_agent` 超时不等于失败；无代码结果时按“未完成”处理。
4. 出现以下任一情况时立即重建线程：连续空回包、明显偏航、响应显著变慢、额度或网络异常、任务域切换。
5. 当前 Windows 环境如果 `rg.exe` 返回 `Access is denied`，不要反复尝试同一路径；直接改用 `Get-ChildItem -Recurse | Select-String` 做本地检索。

## 4. 评审标准

1. 默认执行“完整审查本轮所有改动文件”，非抽查。
2. 评审必须基于真实文件与验证输出；无 diff 不给通过口径。
3. 高风险入口（运行时/服务/权限/命令）额外检查：禁止假成功、静默吞错、过宽桥接。
4. 当前仓库运行时是 ESM；恢复源码里残留的懒加载 `require(...)` 必须改为 `createRequire(import.meta.url)` 或动态 `import(...)`，不得依赖全局 `require`。

## 5. 专用审查线程

1. 可启用专用审查线程；主线程负责裁决与纠偏。
2. 审查线程偏离范围时先纠偏重派；连续两次偏离再关闭并重建。
3. 未完成逐文件审查前，不得以“子线程口头完成”作为通过依据。
4. 审查线程默认短生命周期，建议每 `1-2` 轮重建一次；修复线程可相对更长。

## 6. 每轮修复闭环

每个文件或清晰切片按固定顺序推进：

1. 每轮开始或中断恢复后，先刷新计划任务，明确“派发 / 等待 / 主线程复核 / 独立审查 / 文档更新”的当前阶段。
2. 抓取当前目标文件的精确报错。
3. 下发给修复线程，只允许其处理指定范围。
4. 修复线程交付后，主线程实读改动并跑定向 `typecheck`。
5. 独立审查线程完整审查本轮改动，主线程裁决 `PASS/FAIL`。
6. 通过后刷新全仓快照、刷新任务队列、更新当前看板，再进入下一目标。
7. 刷新任务队列必须基于最新全仓 `typecheck` 热点重新选择当前主线和下一批候选；不得沿用过期排序。
8. 刷新全仓快照前，必须先生成一份 fresh `typecheck` 输出文件，再基于这份 fresh 快照统计错误数、文件数和热点；不要复用旧 `.codex-typecheck*.txt`，避免被过期日志误导。
9. “当前轮闭环”不等于“项目收口”：只要全仓 `typecheck` 仍未清零，主线程不得用“已完成 / 已收口 / 可以结束主任务”的口径对外结案；只能表述为“当前文件或当前切片已闭环”，并立即切换到下一主线继续推进，除非用户明确要求暂停、转向或接受阶段性停点。
10. 只要下一步明确且不存在外部硬阻塞，本轮不得停在“仅抓报错 / 仅读现场 / 仅分析结论”状态；在任何可能结束当前回合的输出前，主线程至少要推进到以下三种状态之一：
   - 已派发下一修复线程并进入长等待
   - 已完成主线程复核并已派发独立审查线程进入等待
   - 已完成独立审查 `PASS`、已更新 backlog，并已锁定且派发下一个热点
11. “抓完现场但尚未派单”不是合法停点；如果目标文件已锁定、下一动作清晰，就必须在同一轮内继续派单。
12. 只有以下情况才允许停在未派单状态：网络/额度/机器异常、子线程接口异常、用户主动打断、或需要用户做高风险决策。
13. 如果发生了上条中的被迫中断，下一轮恢复时必须先执行固定恢复清单：确认当前主线、读取最新 `.codex-typecheck.txt`、核对 backlog 当前态、检查旧子线程是否仍有效、重新锁定“当前处于派发 / 等待 / 复核 / 审查 / 文档更新”的哪一阶段，再继续推进；不得跳过恢复直接展开新分析。

修复线程不得在未被明确授权时主动更新 `current-repair-backlog.md` 等看板文档；看板由主线程在独立审查结论落地后统一刷新。

若审查失败，先纠偏并回派修复线程返工；不得跳过刷新与文档同步直接切换任务。当前轮未独立审查 `PASS` 前，只能标记为待审查或待刷新，不得提前把看板切到下一轮。

## 7. 文档同步

1. 每轮审查结论后，先更新文档再进入下一轮。
2. 默认同步：
   - [docs/current-repair-backlog.md](D:/agent_project/claude-code-reforged/docs/current-repair-backlog.md)
   - 必要时同步 [docs/recovery-repair-plan.md](D:/agent_project/claude-code-reforged/docs/recovery-repair-plan.md)

## 8. CCR Core 统一接口护栏

1. 本仓库所有产品能力都必须优先收敛到 `CCR Core` 统一能力接口；这里的能力不仅包括 LLM 调用，也包括配置、认证、模型选择、MCP、workspace、thread/turn/session、权限、工具执行、文件操作、状态持久化和事件流。
2. CLI / TUI / App Server / Desktop / VS Code 都只能是入口适配层。入口层负责参数解析、UI 渲染、协议收发、用户交互和事件映射，不得成为第二套业务运行时。
3. 新增任何入口功能前必须先判断是否已有 Core API。已有 Core API 时只能调用 Core API；没有 Core API 时先补 Core API，再做入口映射。
4. App Server 只能把 JSON-RPC request 映射到 Core API，把 Core result / Core event 映射成 JSON-RPC response / notification；不得直接读 token、拼模型请求、执行工具、管理 MCP 生命周期或自定义权限状态机。
5. CLI/TUI 当前仍存在历史直连链路时，只能视为迁移中的旧实现细节。新增代码不得继续扩大旧链路，后续迁移应逐步改为调用 Core API。
6. 如果某个实现看起来需要在入口层复制 Core 逻辑，必须先停下来补 `docs/architecture/ccr-core-interface-boundary.md` 或对应 Core service 设计，不得边写边形成隐性分叉。

## 9. Provider / OAuth / SDK 接入护栏

1. 本节不是替代全局“查询优先、试错其次”规则，而是对本仓库 LLM provider / OAuth / SDK 接入场景的强制细化。
2. 凡是涉及 LLM provider、OAuth、外部 SDK、外部协议、成熟第三方库或陌生运行时行为，无论是新增、改造、修复、排查还是验证，都必须先做资料对照，不得直接凭印象手写；至少对照：
   - 官方文档或官方源码/README
   - 本机已有成熟实现或参考仓库
   - 第三方依赖的源码、类型声明和示例
3. 如果本机已有跑通过的成熟实现，优先复用其调用路径和参数口径；只有在项目边界确实不同的情况下，才允许改走更底层 API，并必须写清楚差异原因。
4. 如果从高层 helper 切到低层 `stream/complete` 等 API，必须逐字段对照入参名称、默认值、传输方式和错误降级行为，并补 smoke 断言防止口径漂移。
5. 真实登录凭据、token、refresh token 和 credential JSON 绝不打印、不贴回复、不写入文档；验证只输出脱敏状态和路径。
6. 这类接入验证失败时，先回到资料对照和实际 payload/transport 差异排查，不得优先猜测网络、代理或环境问题。
7. 模型可见的系统身份、产品说明和归因头必须按 provider 隔离：官方 Anthropic / Bedrock / Vertex / Foundry 链路可保留 Claude Code 兼容信息；`codex-oauth`、BigModel、OpenAI-compatible 或其他 Anthropic-compatible 代理不得注入 `cc_version`、`x-anthropic-billing-header` 或 “You are Claude Code” 这类会被模型复述的身份信息。
8. `CodexOAuthSession` 属于 OAuth 登录与凭据生命周期链路，不属于普通 provider 请求链路；`beginAuthorization`、`exchangeAuthorizationCode`、`refreshCredential`、`saveCredential` 默认冻结。不得为了统一 provider 网络策略、统一 probe、图片生成、stream 或普通模型请求，顺手把 `configureGlobalFetchDispatcher()`、全局 undici dispatcher、provider retry/proxy 封装塞进 token exchange / refresh / save 路径。
9. 凡是修改 `src/services/llm/sessions/CodexOAuthSession.ts` 中授权码换 token、refresh token 刷新或凭据写回行为，必须同时完成：`npm.cmd run smoke:codex-oauth-session`、`npm.cmd run smoke:codex-oauth-provider`、真实 Desktop 浏览器登录回归，并确认 `llm.credentials.local.json` 对应 profile 的凭据实际写入或更新时间变化；mock smoke 不能替代真实登录验证。

## 10. 已有能力与成熟方案复用护栏

1. 新增或改造功能前，必须先检索当前仓库是否已经存在同类能力、类型、协议、service、hook、UI 组件或测试脚本；已有能力不得重复造一套。
2. 如果已有能力只差入口适配，应优先做适配层或补 Core API，不得在 App Server / Desktop / VS Code / CLI / TUI 各自复制业务逻辑。
3. 如果第三方已经有成熟稳定的通用能力，默认先评估复用；不要为了“自己写”而手搓 OAuth、SDK 协议、MCP 客户端、运行时校验、日志、HTTP/JSON-RPC、配置解析等通用工程能力。
4. 只有在确认现有能力不适用、第三方方案边界不匹配或为了阶段性最小原型时，才允许新写实现；必须在文档或代码注释里说明不复用的原因。
5. 详细执行清单见 [06-existing-capability-and-reuse.md](D:/agent_project/claude-code-reforged/docs/agent-rules/06-existing-capability-and-reuse.md)。

## 11. CLI / TUI 兼容护栏

1. Desktop / App Server 的体验修复默认不得改变原 TUI 和 `-p` CLI 的输出语义；除非任务目标明确要求统一迁移，否则不要把 Desktop 展示层判断写回 CLI/TUI 打印链路。
2. 修改 `apps/desktop/**` 的 UI、样式、renderer 状态和 Desktop 专属组件时，通常只需验证 Desktop；不得误称会修复 TUI/CLI。
3. 修改 `src/core/**`、`src/app-server/**`、`src/services/llm/**`、工具协议、消息转换、provider、OAuth、模型适配或 `dist/src/**` 对应产物时，必须视为共享链路改动。
4. 共享链路改动合入前，至少跑三路回归：Desktop/App Server 定向 smoke、`ccr -p` 非交互 CLI、`ccr` 交互式 TUI 基础启动或等价最小验证。
5. 如果某次修复只为了 Desktop 展示，例如工具卡片合并、Todo 浮窗、思考展示、权限卡片布局，应优先把逻辑限制在 Desktop domain / renderer 层；确实需要 Core 事件补字段时，只补协议字段和稳定 ID，不改变 CLI/TUI 消费的原始消息内容。
6. 每次解释影响面时，必须明确标注该改动属于：Desktop-only、App Server 协议层、Core 共享层、LLM 共享层或构建产物同步。
7. `npm.cmd run typecheck:desktop` 必须加载根仓库已有类型环境；`apps/desktop/tsconfig.json` 需要保留 `bun` 类型，以及 `../../src/types/**/*.d.ts`、`../../sdk-tools.d.ts` include。遇到 `MACRO`、`Bun` 或可选依赖缺失时，优先检查 Desktop tsconfig 是否丢了这些 root ambient declarations，不要把它长期归类为已知噪音。

## 12. Desktop / Electron 视觉验证护栏

1. 验证 CCR Desktop / Electron 界面时，不得使用 `PrintWindow` 截图结果作为布局判断依据；该方式在 Electron 窗口上可能出现裁切、错位或只截到标题栏。
2. 如需用 `CopyFromScreen` 截图，必须先确认当前验证动作会不会影响用户正在看的窗口；需要最大化、置顶或切换前台时，先在过程说明里讲清楚。
3. 截图脚本必须先设置进程 DPI aware，再检查窗口状态：如果窗口最小化，不能直接截；需要恢复或最大化后再截。
4. 截图后必须同时记录并汇报关键尺寸：`windowRect`、`windowSize`、`showCmd`、`screen`。若尺寸异常，例如 `159x27`、小于预期窗口、或与屏幕/用户截图明显不一致，该截图视为无效。
5. Desktop 视觉结论以用户实际截图和肉眼确认为准；本机截图只能作为辅助证据。截图异常或与用户所见不一致时，先判定为截图环境问题，不得据此擅自修改 UI。

## 13. 详细规则入口

按需读取，不要一次性加载全部分册：

1. [01-threading-and-delivery.md](D:/agent_project/claude-code-reforged/docs/agent-rules/01-threading-and-delivery.md)（线程分工、交付、轮换）
2. [02-review-baseline.md](D:/agent_project/claude-code-reforged/docs/agent-rules/02-review-baseline.md)（评审基线、高风险检查）
3. [03-type-narrowing-patterns.md](D:/agent_project/claude-code-reforged/docs/agent-rules/03-type-narrowing-patterns.md)（类型收口与 guard 模式）
4. [04-review-thread-governance.md](D:/agent_project/claude-code-reforged/docs/agent-rules/04-review-thread-governance.md)（审查线程治理与纠偏）
5. [05-retro-and-doc-sync.md](D:/agent_project/claude-code-reforged/docs/agent-rules/05-retro-and-doc-sync.md)（复盘模板与文档同步）
6. [06-existing-capability-and-reuse.md](D:/agent_project/claude-code-reforged/docs/agent-rules/06-existing-capability-and-reuse.md)（已有能力检索、第三方成熟方案复用、新实现准入）
