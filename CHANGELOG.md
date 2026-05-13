# CCR 更新日志

本文记录 CCR 面向用户可见的版本变化。主分支可能包含最新版本之后的开发中改动；正式发布以 GitHub Release 和 tag 为准。

## Unreleased

- 暂无。

## 0.4.2 - 2026-05

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
