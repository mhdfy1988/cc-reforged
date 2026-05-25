# CCR 更新日志

本文记录 CCR 面向用户可见的版本变化。主分支可能包含最新版本之后的开发中改动；正式发布以 GitHub Release 和 tag 为准。

## Unreleased

### 改动

- Desktop 历史恢复和实时展示主路径统一为 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，Renderer 不再消费旧 `threadMessages` replay 展示状态。
- Core 当前模型上下文与 UI 可见历史改为同源双投影：compact 后继续对话使用压缩后的 `currentContextMessages`，历史 UI 仍从 transcript 展示投影恢复压缩前后可见记录。
- 历史恢复新增 Codex-like ordered 语义适配层：transcript 会先生成 `classifiedTranscriptEvents`，再解析 `currentContextTailUuid`；`canonicalLeafUuid` 仅保留为兼容字段，不再表示 parent graph leaf。
- 会话物化边界收口：`conversationMaterialization.ts` 自己读取 transcript JSONL 生成 ordered/rawIndex/坏行诊断；`sessionStorage.ts` 和 `buildConversationChain(...)` 仅保留为原生读侧 helper，不再承载 UI replay 或 current tail 产品语义。
- 工具展示按来源 ID 归并：一个 `tool_use` 对应一张工具卡，`tool_result` 按 `tool_use_id` 回填对应工具卡，支持同一 turn 内多个工具调用和结果乱序返回。
- 普通历史恢复提示不再显示易混淆的“已回放 N 条”数量；raw transcript、Core context、visible timeline 等数量仅用于调试和诊断。
- Desktop 主路径不再支持旧 replay 展示协议、旧实时展示通知或缺失 projection 的 raw fallback；缺失 / 非法 projection 会展示协议错误卡。

### BUG 修复

- 修复上下文压缩后切换会话再恢复时，Core 当前上下文可能回到 compact 前旧消息的问题。
- 修复手动 compact 后立即回读 transcript 时可能读到未 flush 的旧 JSONL，导致实时上下文 token 仍显示压缩前大小的问题。
- 修复手动 compact 后恢复上下文短于实时上下文的问题；compact 后的附件和系统附属消息会跟随摘要进入当前模型上下文。
- 修复手动 compact 完成后顶部“上下文”数字仍显示 compact 前估算，切换会话后才更新的问题；Desktop 状态快照会刷新 runtime context 后再返回。
- 修复历史恢复时 compact 前 UI 可见历史被误裁掉的问题。
- 修复并行工具结果 sibling 或旧 parent leaf 多候选导致恢复失败，并被误显示成 `Session transcript not found` 的问题；物化失败现在保留具体 diagnostic code。
- 修复并行工具结果按返回顺序或 raw content 误绑定，导致工具卡重复、错位或变成 assistant 普通文本的问题。
- 修复权限请求被拒绝后，实时 UI 仍停留在“等待授权”直到刷新才变成失败卡的问题。
- 补齐会话恢复 smoke 覆盖：普通恢复、compact 后恢复、compact 前 UI 历史可见、并行工具、tool_result 乱序、多 legacy leaf 诊断、物化失败 diagnostic、App Server snapshot 和 Desktop display events。

## 0.5.1 - 2026-05-22

### 改动

- 新增只读 `CcrToolRegistry` 第一版，先从现有 `Tool[]` 生成工具中文名、分类、来源、direct/deferred/internal 暴露建议和展示建议，不改变模型协议、App Server 事件协议或 Desktop 展示。
- 新增 `CcrToolAvailability` 第一版，App Server 工具池可集中输出 `Bash`、`Agent`、`GenerateImage`、MCP 工具等不可用原因，后续 ToolSearch 和 Desktop 展示可复用。
- 新增 `CcrToolSearchPolicy` 第一版，`ToolSearch` 搜索候选改为只来自 available 且 deferred 的工具，避免返回 `GenerateImage`、`TodoWrite`、`ToolSearch` 等 direct/internal 工具。
- 新增 App Server 工具池检查脚本与 registry smoke，固定 Windows 下 `PowerShell` 可见、`Bash` / 无 agent definitions 的 `Agent` 被过滤、`GenerateImage` 保持 `alwaysLoad` 的验收基线。
- 抽出 App Server 平台工具过滤 helper，让运行时和检查脚本复用同一套 Windows 过滤逻辑。
- 新增共享工具展示目录 `toolDisplayCatalog`，`toolRegistry` 与 Desktop `toolEvents` 统一读取中文名、分类、`summaryKeys` 摘要 fallback、`detailKeys` 详情裁剪和 `showInMainTimeline` 主时间线建议，工具卡展示口径和注册口径收敛但不改变模型协议。
- 新增 Provider 能力工具快照，`GenerateImage` 的生图能力可统一说明当前来源 provider/model、同供应商数据边界和不可用原因，并在 App Server / Desktop 模型页诊断中展示。
- 新增 `prepare:ripgrep`，按当前平台准备 `vendor/ripgrep/<arch-platform>/rg(.exe)`；桌面打包和 `ci:smoke` 会在构建/验收前执行，避免发布包依赖用户机器预装 `rg`。
- 更新 README 与 MCP 文档入口，补齐 Desktop / CLI 的 MCP 安装、检测、启停、卸载、配置位置、安装清单、锁文件和 `npx` 快速模式边界说明。
- Desktop 侧边栏新增 Skill / Plugin 占位入口，为 `0.6.0` 扩展能力包治理预留导航位置。

### BUG 修复

- 修复 dev / 非 bundled 环境没有随仓库携带 `vendor/ripgrep` 二进制时，`Glob` / ripgrep 链路直接访问缺失的 `dist/.../vendor/ripgrep/.../rg.exe` 并报 `ENOENT` 的问题；内置 ripgrep 不存在时会自动回退到系统 `rg`，系统 `rg` 也不可用时会走 Node 原生文件搜索兜底。
- 新增文件搜索链路 smoke，覆盖内置 `rg` 可用、无内置 `rg` 且无系统 `rg` 时的 `Glob`、`Grep` 和全局搜索 stream 兜底。
- 优化 Doctor 搜索诊断，真实 `rg` 不可用但 Node 原生文件搜索兜底可用时会显示 fallback 状态，而不是只显示 `Not working`。

### 版本线规划

- `0.5.x`：继续收敛多模态、多模型和工具调用相关问题，包括 provider 能力边界、图片/附件展示、历史请求修复、错误诊断、工具权限体验和 MCP 动态工具治理。
- `0.6.0`：进入 Skill、Plugin 等扩展能力包主线，重点处理外部能力发现、安装启用、命名空间、版本和审计。

## 0.5.0 - 2026-05-20

### 新功能

- 完成 P23 多模态输入第一版：模型能力目录、Profile 覆盖、发送前校验、`turn/start` 内容块协议、Core 内容块保存和 provider adapter 图片映射已串通。
- Desktop 输入框支持图片/文件选择与粘贴；图片可生成缩略图、发送后展示、点开预览，小文本文件可受限读取后进入上下文。
- `codex-oauth / gpt-5.5` 已支持真实图片请求；文本模型发送图片会在发送前被拦截，避免静默漏发。
- 新增 OpenAI、Kimi、GLM 与 OpenAI-compatible provider 接入，补齐模型目录、Profile 配置、API Key 管理和 provider probe 入口。
- GLM API 模型目录新增 `glm-4.7`、`glm-4.6v` 和 `glm-4.5-air`，便于直接使用开放平台赠送资源包额度。
- 新增 provider-neutral 图片生成输出链路，支持 OpenAI / Codex OAuth / MiniMax 等生成适配器、会话内生成图片事件和生成产物持久化。
- 新增模型可见 `GenerateImage` 工具，GLM / OpenAI / Codex OAuth 等生图请求可走统一工具入口，不再依赖模型自行猜测文件或命令工具。
- 重做 Desktop 日志页为“日志文件 / 事件列表 / 事件详情”三栏工作台，支持不同日志文件切换、事件化阅读、原始 JSON 查看和搜索。
- 日志页新增轻量实时刷新开关，复用现有日志读取入口，不扩展为告警、统计图或监控面板。

### 改动

- 新增 `CCR 标准 LLM 协议 v0.1` 文档，明确多模型、多 provider、多模态、工具调用和错误展示不以某一家原始协议为标准，而以 CCR 内部标准协议为准。
- 新增 Provider 协议盘点与官方文档对照，明确 OpenAI Responses、OpenAI Chat、Anthropic Messages、Gemini GenerateContent、DeepSeek、MiniMax、OpenRouter 和 Vercel AI Gateway 后续需要对接的协议族、协议面和 probe 矩阵。
- 调整后续标准层开发顺序：先做 `CcrContentBlock` 共享类型，再做发送前历史校验，最后推进 `ErrorSnapshot` 错误分类展示。
- 新增 `CcrContentBlock` 共享类型，LLM、Core、App Server 和 Desktop 展示事件开始复用同一套内容块口径。
- 新增 LLM 历史校验器，OpenAI-compatible / DeepSeek 请求前会按 provider profile 修复缺失工具结果或阻断不支持的工具历史。
- 新增 `ErrorSnapshot` 第一版，Desktop 展示事件可携带统一错误分类、来源、严重级别、可重试状态和脱敏诊断详情。
- 历史恢复和工具展示补齐多模态附件条、代码块复制、工具中断状态和内部合成消息过滤。
- 新增 Provider 工具协议能力声明，DeepSeek / OpenAI-compatible / Anthropic 工具 schema、结果回填、strict、deferred tool search 能力有统一查询入口。
- 为日志页及其它原始数据展示区增加统一复制按钮，便于复制 JSON、日志片段和工具详情。
- 优化上下文压缩后的附件恢复展示，明确标识压缩携带附件并隐藏重复附件通知，避免压缩恢复内容显得像无来源的普通附件消息。
- 扩展 provider、生成输出、会话图片流、Desktop 展示事件和模型能力 smoke，`ci:smoke` 会覆盖更多标准协议回归。
- 工具生图结果发回模型时保持文本摘要，App Server / Desktop 事件保留结构化图片块，复用现有附件缩略图和预览 UI。
- 整理文档结构，将架构、恢复清单、阶段 todo、provider 集成说明和源码证据索引归并到更明确的目录入口。
- 项目级 settings 已统一切换到 `.ccr/settings*.json`，不再运行时兼容读取旧 `.claude/settings*.json`。
- Desktop、App Server、CLI/TUI 文案、worktree 复制、settings sync、权限保护和 sandbox 禁写已同步使用 `.ccr` 项目配置路径。

### BUG 修复

- 修复 OpenAI-compatible / DeepSeek 场景下工具调用中断、缺失工具结果、TodoWrite schema 未常驻导致的会话卡死和参数校验问题。
- 修复 OpenAI-compatible / DeepSeek 历史中延迟或孤立 tool result 可能再次污染请求的问题，发送前会丢弃不合法 tool result 并补齐 synthetic 结果。
- 修复 `ExitPlanMode` 和 `TaskOutput` 异常展示口径，避免不存在的 task id 或权限类工具失败时展示成吓人的通用工具执行失败。
- 隐藏计划确认内部 `.ccr/plans/*.md` 草稿写入卡片，避免计划审批卡下方出现重复的“写入文件”事件。
- 计划确认内部草稿与权限卡改用稳定的计划系列 ID 对齐，避免同一轮多次计划写入或事件顺序变化时串卡。
- 修复 GLM-Image 被普通 chat/SSE 路径调用的问题；Desktop 中文自然生图意图会走同一 `glm-api` 供应商下的 `/images/generations`，`glm-image` 误走聊天路径时会在本地拦截。
- 修复 GLM / OpenAI-compatible 工具调用间空文本 delta 被显示成 `暂无内容` 的问题。
- 修复模型生成图片和工具图片附件展示不一致的问题，GLM URL 图片与本地生成图都会复用同一套缩略图和预览 UI。
- 优化 `GenerateImage` 在当前供应商不支持生图时的反馈，改为提示切换到 GLM API、OpenAI 或 Codex OAuth，而不是暴露底层 provider 异常。
- 优化 Desktop 历史会话入口，历史列表会始终展示当前会话；当前会话不可重复切换，运行中显示“运行中”，其他历史会话在任务完成前显示“需等待”且不可切换。
- 修复 GLM / OpenAI 生图返回下载 URL 时缩略图破图的问题；URL 输出会先由后端下载并持久化为本地生成物，历史里已保存的远程 URL 也会由 Desktop 主进程下载后生成缩略图。
- 优化模型生成图片消息展示，文件名、类型、供应商和保存路径只在图片卡片内展示，避免正文和附件卡重复。
- 修复错误诊断信息过长时撑开聊天宽度的问题，原始诊断块改为宽度受限并在块内滚动。
- 修复生成图片工具卡片重复展示同一段提示词的问题，摘要已包含目标时不再额外显示“目标”元信息。
- 修复历史恢复中内部合成消息被展示的问题，不再显示 `No response requested.`。
- 新增 settings 隔离 smoke，防止项目级 settings 路径后续回退到 `.claude`。

## 0.4.7 - 2026-05

- 修复 Windows 打包态 `CCR.exe` 资源图标仍保留旧图的问题，桌面快捷方式和任务栏现在会使用统一的 CCR 图标。
- 将安装器快捷方式名称固定为 `CCR`，避免继续生成旧的 `CCR Desktop` 快捷方式。
- 调整图标生成脚本，生成 Windows 兼容性更好的 BMP/DIB ICO，并在品牌 smoke 中校验 exe 资源编辑配置。

## 0.4.6 - 2026-05

- 统一产品展示名为 CCR，桌面窗口、安装包、默认会话和发布产物不再使用 CCR Desktop 作为面向用户的名称。
- 统一项目图标来源，安装包、任务栏、标题栏和启动页共用同一套 CCR 品牌图标资产。
- 优化启动页为极简 CCR 图标、状态点和顶部细进度线，并增加最短展示时间，避免启动动画一闪而过。
- 增强桌面品牌 smoke，校验 renderer 图标引用和安装包品牌配置，防止后续图标再次分叉。

## 0.4.5 - 2026-05

- 修复 CCR Desktop 打包安装后窗口过早显示的问题：窗口改为在 renderer 完成加载后显示，并保留启动诊断日志，避免启动时停在白屏。

## 0.4.4 - 2026-05

- 优化 CCR Desktop 启动首屏：窗口等到 renderer 首帧准备好后再显示，避免启动时短暂出现白屏和未初始化布局。
- 增加轻量启动界面作为兜底，在 React/CSS 接管前显示统一的 CCR Desktop 启动画面。

## 0.4.3 - 2026-05

- 新增一级“模型”页面，按“供应商类型 / 连接配置 / 详情”管理 Profile、凭据、模型和连接测试。
- 新增 Profile 优先的 LLM 配置结构：当前选择写入 `current.profileId/current.model`，敏感凭据按 `profileCredentials[profileId]` 存储。
- 新增 `ccr model status/list/set/profile`，TUI `/model` 同步支持 Profile 和模型切换。
- 新增 DeepSeek 官方 API provider，默认模型为 `deepseek-v4-flash`，并支持 `deepseek-v4-pro`。
- 新增 MiniMax 国际版 / 国内版 provider，走 Anthropic Messages 兼容协议，支持 `MiniMax-M2.7` 和 `MiniMax-M2.7-highspeed`。
- 抽出 OpenAI Chat Completions 公共协议适配器，供 DeepSeek 和后续 OpenAI Compatible / 第三方中转复用。
- 抽出 Anthropic Messages 兼容协议适配器，供 MiniMax 和后续 Anthropic-compatible provider 复用。
- 新增模型可用性状态与手动测试连接的 Core / App Server / SDK / Desktop 链路。
- Desktop 顶部拆成“模型切换”和“连接配置切换”两个入口，切换只影响下一轮消息，不自动改写历史会话。
- 每轮消息记录实际使用的 `profileId/provider/apiMode/model/contextWindow` 等元数据，便于审计和排查。
- Desktop 侧边栏引入更明确的图标和悬浮态，后续会继续演进轻量会话侧栏。

## 0.4.2 - 2026-05

- 修复 Desktop GitHub Release 上传超时后的恢复逻辑，重新执行发布脚本会复用已有 release 并补齐缺失资产。
- 强化自动更新发布链路，确保 `latest.yml`、安装器和 `.blockmap` 能稳定对应。
- 统一 Desktop 安装包命名为 `CCR-Desktop-<version>-win-x64.exe`，避免自动更新 metadata 指向不存在的文件。
- 明确 unsigned 安装包发布策略：短期允许未签名发布，并在 release note 中保留 SHA256 校验值。
- 统一 Core 版本和 package 版本口径，避免会话里继续暴露旧的 Claude Code 版本信息。

## 0.4.1 - 2026-05

- 完成 CCR Desktop 自动更新状态机第一版。
- 增加更新检查、下载、重新安装和开发态模拟入口。
- 补充 GitHub Release feed 验证脚本，用于确认远端 `latest.yml` 和安装器资产是否可用。
- 优化 Desktop 设置页，增加自动更新状态展示。

## 0.4.0 - 2026-05

- 发布 CCR Desktop Windows 安装包第一版。
- 新增 Desktop App Server 打包链路，避免安装时释放大量无关文件。
- 增加历史会话弹窗，支持跨工作区分组、搜索和恢复。
- 增加项目级 `.ccr/settings*.json` 隔离方案，避免继续写入 `.claude/settings*.json`。
- 增加权限设置页面，用于查看和修改本地 / 项目 / 用户级工具权限。
- 增加 App Server 会话、权限、上下文、压缩和运行状态相关 smoke。

## 0.3.0 - 2026-05

- 推进 CCR Desktop 原型，接入 App Server、本地工作区、会话启动和基础聊天界面。
- 增加 Desktop 打包、品牌资源、日志和错误可观测相关专项文档。
- 增加 App Server 协议设计和 Desktop 客户端框架选型文档。

## 0.2.0 - 2026-04

- 建立 CCR 自有配置目录 `~/.ccr`。
- 新增内置 LLM Runtime 原型。
- 接入 Codex OAuth provider。
- 保留 Anthropic 兼容边界，用于恢复代码中的旧链路逐步迁移。
- 增加 Playwright MCP 接入和基础 runtime smoke。
