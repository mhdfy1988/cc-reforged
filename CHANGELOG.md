# CCR 更新日志

本文记录 CCR 面向用户可见的版本变化。主分支可能包含最新版本之后的开发中改动；正式发布以 GitHub Release 和 tag 为准。

## Unreleased

### 新功能

- 完成 P23 多模态输入第一版：模型能力目录、Profile 覆盖、发送前校验、`turn/start` 内容块协议、Core 内容块保存和 provider adapter 图片映射已串通。
- Desktop 输入框支持图片/文件选择与粘贴；图片可生成缩略图、发送后展示、点开预览，小文本文件可受限读取后进入上下文。
- `codex-oauth / gpt-5.5` 已支持真实图片请求；文本模型发送图片会在发送前被拦截，避免静默漏发。
- 重做 Desktop 日志页为“日志文件 / 事件列表 / 事件详情”三栏工作台，支持不同日志文件切换、事件化阅读、原始 JSON 查看和搜索。
- 日志页新增轻量实时刷新开关，复用现有日志读取入口，不扩展为告警、统计图或监控面板。

### 改动

- 新增 `CCR 标准 LLM 协议 v0.1` 文档，明确多模型、多 provider、多模态、工具调用和错误展示不以某一家原始协议为标准，而以 CCR 内部标准协议为准。
- 新增 Provider 协议盘点与官方文档对照，明确 OpenAI Responses、OpenAI Chat、Anthropic Messages、Gemini GenerateContent、DeepSeek、MiniMax、OpenRouter 和 Vercel AI Gateway 后续需要对接的协议族、协议面和 probe 矩阵。
- 调整后续标准层开发顺序：先做 `CcrContentBlock` 共享类型，再做发送前历史校验，最后推进 `ErrorSnapshot` 错误分类展示。
- 历史恢复和工具展示补齐多模态附件条、代码块复制、工具中断状态和内部合成消息过滤。
- 新增 Provider 工具协议能力声明，DeepSeek / OpenAI-compatible / Anthropic 工具 schema、结果回填、strict、deferred tool search 能力有统一查询入口。
- 为日志页及其它原始数据展示区增加统一复制按钮，便于复制 JSON、日志片段和工具详情。
- 项目级 settings 已统一切换到 `.ccr/settings*.json`，不再运行时兼容读取旧 `.claude/settings*.json`。
- Desktop、App Server、CLI/TUI 文案、worktree 复制、settings sync、权限保护和 sandbox 禁写已同步使用 `.ccr` 项目配置路径。

### BUG 修复

- 修复 OpenAI-compatible / DeepSeek 场景下工具调用中断、缺失工具结果、TodoWrite schema 未常驻导致的会话卡死和参数校验问题。
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
