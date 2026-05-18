# CCR App Server 实施 Todo

## 当前任务列表（实时）

- [x] P0 现状盘点与边界确认
- [x] P1 App Server 协议详细设计
- [x] P2 最小 stdio JSON-RPC 运行骨架
- [x] P3 CLI 入口接入 `ccr app-server --listen stdio`
- [x] P4 第一批只读能力 handler
- [x] P5 App Server smoke 验证链路
- [x] P6 Thread / Turn / Item 会话 API 设计
- [x] P6.5 CCR Core 统一能力接口边界补强
- [x] P7 Turn 执行与事件流最小闭环
- [x] P8 权限请求与客户端响应闭环
- [x] P9 Desktop 原型接入准备
- [x] P10 Desktop App 最小原型
- [x] P11 Desktop 打包、启动与本机验证
- [x] P12 Desktop 会话、权限与错误交互增强
- [x] P13 Desktop 设置、MCP 与日志页面
- [x] P14 Desktop 安装包与升级准备
- [x] P15 Desktop 日志落盘与错误可观测
- [x] P16 Desktop 图标、安装器与更新通道准备
- [x] P17 版本、协议兼容与回滚加固
- [x] P18 Desktop 输出能力基线、事件协议与前端模块化补齐
- [x] P19 控制信息面板与运行元数据展示
- [x] P20 工具事件卡片产品化
- [x] P21 文件、附件与引用系统
- [ ] P22 结构化输出与 JSON/Schema 视图（已撤回，后续按具体场景重新设计）
- [x] P23 多模态输入/输出、附件上传与预览
- [ ] P24 错误分类、限流与拒答状态治理
- [x] P25 原生上下文链路恢复与短期记忆治理
- [x] P26 上下文、压缩与记忆能力 App Server 桥接

## 当前指针

- 已完成：P23 多模态输入/输出、附件上传与预览第一版。
- 当前正在做：`P24-3 错误分类映射器`，在 ErrorSnapshot 第一版基础上继续补 provider / tool / auth / rate limit / safety 映射。
- 完成后下一项：完成 P24-3 后进入 `P24-4 用户动作与恢复入口`。
- 历史会话恢复索引：[history-session-recovery-index-2026-05-18.md](history-session-recovery-index-2026-05-18.md)
- 说明：P22 全局结构化展示已撤回；P23 不再和多供应商专项混在一起，附件真实随消息发送、预览、输入协议和多模态能力边界治理进入独立文档。

## 标准文档落地队列

来源：

- [CCR 模型输出归一化与展示标准](../architecture/model-output-normalization-and-display-standard.md)
- [CCR Provider 工具协议统一化标准](../architecture/provider-tool-protocol-normalization.md)

这些不是独立空文档，而是 P23 收口后继续实施的标准化队列。执行顺序如下：

1. [x] STD-PROTOCOL-01 CCR 标准 LLM 协议文档
   - 已完成：新增 `CCR 标准 LLM 协议 v0.1`，明确 CCR 不以某一家 provider 原始协议为标准，而以内部标准消息、内容块、工具、能力和错误快照为基准；已有多模态、输出展示和工具协议文档已引用该标准。
2. [x] STD-PROTOCOL-02 Provider 协议盘点与官方文档对照
   - 已完成：新增 `Provider 协议盘点与官方文档对照`，按官方文档列出 OpenAI Responses、OpenAI Chat、Anthropic Messages、Gemini GenerateContent、DeepSeek、MiniMax、OpenRouter 和 Vercel AI Gateway 需要对接的协议族、协议面、必须实现项和 probe 矩阵。
3. [x] STD-TOOL-01 修复 OpenAI-compatible / DeepSeek 悬空工具结果和 TodoWrite schema 常驻
   - 已完成：`TodoWrite` 不再 deferred；OpenAI-compatible 请求前会修复缺失工具结果；中断和参数错误不会让会话卡死。
4. [x] STD-TOOL-02 Provider 工具协议第一版收口
   - 目标：补 `ProviderToolProfile` 或等价结构，明确工具 schema、strict 支持、并行工具和工具结果回填能力。
   - 已完成：新增 `LlmProviderToolProfile` 与 `toolProtocolProfile` 解析入口；DeepSeek / OpenAI Chat compatible / Anthropic / MiniMax 已有内置或默认 profile；OpenAI Chat adapter 会按 profile 判断工具支持与工具结果修复；新增 `smoke:provider-tool-profile` 覆盖 DeepSeek、OpenAI-compatible、Anthropic 和 custom 默认行为。
5. [x] STD-DISPLAY-01 抽 `CcrContentBlock` 共享类型
   - 目标：把 Desktop / App Server / Runtime 里分散的 `text/image/file/audio/tool/json` 内容块口径收成共享类型。
   - Goal：[2026-05-18 STD-DISPLAY-01 CcrContentBlock 共享类型](../goals/2026-05-18-std-display-01-ccr-content-block.md)
   - 已完成：新增共享 `CcrContentBlock` 类型；LLM、Core、App Server 和 Desktop display event 已开始复用；Desktop 展示事件新增标准 `contentBlocks` 快照，现有 UI 行为保持不变。
6. [x] STD-HISTORY-01 History Validator 发送前历史校验
   - 目标：发送给 provider 前扫描历史，处理悬空 tool call、缺 tool result、Gemini `functionResponse`、Anthropic `tool_result` 和 reasoning / thinking 回放规则。
   - Goal：[2026-05-18 STD-HISTORY-01 History Validator 发送前历史校验](../goals/2026-05-18-std-history-01-history-validator.md)
   - 已完成：新增 LLM 历史校验器；OpenAI-compatible / DeepSeek 请求前会按 provider profile 修复缺失 tool result、丢弃孤立 tool result，且在不支持工具的 provider profile 下阻断非法工具历史。Anthropic / Gemini / Responses 规则已在 goal 中预留。
7. [ ] STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke
   - 目标：补 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 的输出样例，覆盖文本、工具、附件、错误和历史恢复。
   - 验收：新增 provider 时至少补一组 fixture，不允许 UI 直接消费 provider 原始结构。
8. [ ] P24-1 / P24-2 ErrorSnapshot 与错误分类展示
   - 目标：把 provider 错误、工具错误、参数校验错误、中断、限流、认证过期等统一为可行动错误卡。
   - Goal：[2026-05-18 P24 ErrorSnapshot 错误分类与展示模型](../goals/2026-05-18-p24-errorsnapshot.md)
   - 已完成第一版：新增 `ErrorSnapshot` 类型、基础分类和 Desktop display event `errorSnapshot` 承载；工具失败和普通错误事件已能生成错误快照。
9. [ ] STD-OUTPUT-03 生成型多模态输出设计
   - 目标：模型生成图片、音频、文件这类输出单独设计生命周期和安全策略。
   - 说明：这不是 P23 第一版范围，放在展示标准稳定后再做。


## 归档索引

- 插队修复任务归档：[app-server-fix-archive.md](app-server-fix-archive.md)
- 已完成阶段归档：[app-server-completed-archive.md](app-server-completed-archive.md)
- 历史会话恢复索引：[history-session-recovery-index-2026-05-18.md](history-session-recovery-index-2026-05-18.md)

说明：`app-server-todo.md` 只保留当前任务列表、当前指针、标准队列和当前正在做的 P24 详情；历史细节移动到归档文件。

## P24 错误分类、限流与拒答状态治理

状态：进行中，P24-1 / P24-2 第一版已完成。

Goal：[2026-05-18 P24 ErrorSnapshot 错误分类与展示模型](../goals/2026-05-18-p24-errorsnapshot.md)

目标：

- 把错误从普通红框升级成可行动的分类状态。
- 覆盖认证过期、限流、额度不足、模型拒答、安全拦截、工具错误、网络错误、协议错误。
- 把 Desktop、App Server、Core、provider、工具、MCP 的错误统一收敛成面向用户的错误模型。

需要补齐：

- 错误分类：`auth_expired`、`rate_limited`、`quota_exceeded`、`model_refusal`、`safety_blocked`、`tool_error`、`network_error`、`protocol_error`。
- 用户动作：重新登录、重试、切换模型、查看日志、复制诊断信息。
- 错误卡片：面向用户展示简短原因，详情折叠；原始错误只进日志或详情。
- 限流/额度：如果 provider 给出重试时间或额度信息，优先展示。
- 安全拦截：明确是模型拒绝、工具权限拒绝，还是 CCR 本地安全策略拦截。

关键字段：

- `errorId`：展示错误 ID。
- `category`：错误分类。
- `severity`：`info`、`warning`、`error`、`fatal`。
- `title` / `message`：面向用户的短文案。
- `source`：`desktop`、`app_server`、`core`、`provider`、`tool`、`mcp`、`network`。
- `retryable`：是否可重试。
- `recommendedActions`：可操作项，例如重新登录、重试、切模型、打开日志。
- `retryAfterMs`：限流重试时间。
- `requestId` / `turnId` / `toolUseId` / `permissionRequestId`：定位字段。
- `safeDetails`：脱敏后的诊断详情。
- `rawRef`：日志引用，不直接把敏感 raw 铺到 UI。

完成标准：

- 用户能知道“为什么失败”和“下一步能做什么”。
- 错误不会被误当成普通 assistant 文本。
- 日志中保留排查所需字段，但继续执行脱敏规则。

### P24 子任务拆分

执行顺序：

1. [x] P24-1 错误来源与现有错误码盘点
   - 目标：盘点 Desktop client-error、App Server JSON-RPC error、CoreError、provider error、tool error、MCP error。
   - 具体动作：列出已有 error kind/code/message/requestId 字段，标出脱敏风险。
   - 已完成：确认 Desktop `DisplayEvent`、工具 `ToolSnapshot.errorClass`、Core `CoreError.kind`、App Server JSON-RPC error 是第一版主要来源。
2. [x] P24-2 ErrorSnapshot 展示模型
   - 目标：定义统一错误展示快照。
   - 具体动作：包含 `category/severity/source/retryable/actions/requestId/safeDetails/rawRef`。
   - 已完成：新增共享 `CcrErrorSnapshot` 类型，Desktop `DisplayEvent` 已支持 `errorSnapshot` 字段。
3. [ ] P24-3 错误分类映射器
   - 目标：把已知错误映射到稳定分类。
   - 具体动作：覆盖 auth、rate limit、quota、model refusal、safety、tool、network、protocol、unknown。
   - 验收：未知错误不会崩溃，至少进入 `unknown_error` 并提示查看日志。
4. [ ] P24-4 用户动作与恢复入口
   - 目标：错误卡片提供下一步动作。
   - 具体动作：重新登录、重试 turn、切换模型、打开日志、复制诊断信息；不支持的动作先显示禁用原因。
   - 验收：用户看到错误后知道能点什么，而不是只能截图。
5. [ ] P24-5 限流、额度和重试时间展示
   - 目标：把 provider 返回的 retry-after、quota、billing、rate limit 信息展示出来。
   - 具体动作：解析已知字段，显示剩余等待时间和建议。
   - 验收：限流错误不再只是普通红框。
6. [ ] P24-6 模型拒答与安全拦截区分
   - 目标：区分模型拒答、本地权限拒绝、本地安全策略、provider safety。
   - 具体动作：分别展示来源、原因和用户可做动作。
   - 验收：用户能看出是模型不回答、工具没权限，还是 CCR 本地拦截。
7. [ ] P24-7 日志脱敏与复制诊断
   - 目标：错误详情可排查但不泄露 token、refresh token、cookie、路径敏感片段。
   - 具体动作：复用现有日志脱敏规则，提供复制安全诊断包。
   - 验收：复制诊断不包含常见 secret key。
8. [ ] P24-8 Fixture / Smoke / 文档收口
   - 目标：补 auth、rate limit、tool error、network、protocol、safety、unknown 的回归样例。
   - 验收：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、App Server/Display event smoke 通过。
