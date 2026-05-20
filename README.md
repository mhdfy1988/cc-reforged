> **免责声明：** 本仓库包含从 [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm 包内置的 source map（`cli.js.map`）恢复出的源码。这不是 Anthropic 官方发布的源码。相关权利归各自权利方所有。

[简体中文](README.md) | [English](README.en.md)

# CCR

![](https://img.shields.io/badge/Node.js-24%2B-brightgreen?style=flat-square)
![](https://img.shields.io/badge/Desktop-Windows-blue?style=flat-square)
![](https://img.shields.io/badge/current-0.5.0-orange?style=flat-square)

CCR 是一个终端编码 Agent 的恢复构建与持续演进版本。它保留终端优先的工作方式，同时把配置、LLM 运行时、App Server 和 Desktop 客户端逐步收敛到 CCR 自己的边界内。

当前 `0.5.x` 版本线聚焦三件事：多模型、多模态和工具调用。下一条 `0.6.0` 主线会进入 MCP、Skill、Plugin 与外部能力治理。

![CCR](docs/architecture/assets/ccr-desktop-main-workbench-clean.png)

## 当前状态

| 项目 | 当前值 |
| --- | --- |
| npm 包名 | `cc-reforged` |
| 当前版本 | `0.5.0` |
| CLI 命令 | `ccr` |
| 桌面应用 | `CCR` |
| 运行时要求 | Node.js `>=24.0.0` |
| 默认配置目录 | `~/.ccr` |
| LLM 配置文件 | `~/.ccr/data/llm.config.local.json` |
| LLM 凭据文件 | `~/.ccr/data/llm.credentials.local.json` |
| 发布入口 | [`mhdfy1988/cc-reforged` GitHub Releases](https://github.com/mhdfy1988/cc-reforged/releases) |

主分支可能包含最新版本之后的开发中改动。面向用户的版本变化见 [CHANGELOG.md](CHANGELOG.md)，版本路线见 [docs/architecture/version-roadmap.md](docs/architecture/version-roadmap.md)。

## 适合做什么

CCR 当前更像一个本地 Agent 工作台，而不是单纯的 CLI 包：

- 在终端中运行 `ccr`，继续使用编码 Agent 的对话、工具和权限流程。
- 在 Windows Desktop 中管理工作区、历史会话、权限、模型连接和自动更新。
- 使用内置 LLM Runtime 管理多个 provider、多个 Profile、不同协议和每轮实际模型元数据。
- 在同一套生成物协议下展示模型生成图片、工具图片、远程图片 URL、本地附件和历史恢复结果。
- 把项目级设置放进 `.ccr/settings*.json`，避免和 Claude Code、Codex、OpenClaw 等工具互相污染。

## 0.5.0 重点

- 多供应商模型管理：Codex OAuth、OpenAI、DeepSeek、MiniMax、Kimi、GLM API / Coding Plan 已进入统一 Profile 管理。
- 多模态输入：图片和文件附件进入草稿队列，发送前按当前模型能力校验。
- 统一生图工具：模型可见 `GenerateImage`，不再让模型猜测应该写 SVG、调用 shell 还是手写文件。
- 生成物展示：GLM 返回的远程 URL 会先下载落盘，再复用本地缩略图和预览 UI。
- Desktop 体验修复：历史会话、计划卡、错误诊断、工具卡片、附件展示和长 JSON 溢出都做了收敛。
- 发布链路：Windows 安装包、`.blockmap`、`latest.yml`、SHA256 和 GitHub Release 流程已经跑通。

## 安装

从 npm 安装 CLI：

```powershell
npm.cmd install -g cc-reforged
ccr --version
ccr
```

桌面端请从 GitHub Releases 下载最新 Windows 安装器：

```text
CCR-<version>-win-x64.exe
```

当前 Windows 安装包暂未购买代码签名证书。如果 Windows 提示未知发布者，请以 GitHub Release 页面和 release note 中的 SHA256 校验值确认来源。

## 从源码运行

安装依赖并构建：

```powershell
npm.cmd install
npm.cmd run build
```

运行 CLI：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js --version
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js
```

可选的本地全局链接：

```powershell
npm.cmd link
ccr --version
ccr
```

桌面端开发：

```powershell
npm.cmd run desktop:dev
```

桌面安装包构建：

```powershell
npm.cmd run desktop:dist
```

## 模型与供应商

Codex OAuth 是当前默认供应商。推荐首次使用流程：

1. 使用 `ccr` 或上面的源码命令启动 CCR。
2. 在 TUI 里运行 `/login`。
3. 选择 `Codex OAuth`。
4. 在浏览器中完成登录。
5. 输入一个简单问题，确认模型可以正常响应。

可以用下面的命令查看运行时状态：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js auth status --json
```

模型配置采用 Profile 优先模型：`llm.config.local.json` 保存 `schemaVersion + current + profiles + providerOverrides`，`llm.credentials.local.json` 按 `profileCredentials[profileId]` 保存敏感凭据。一个 Profile 组合供应商类型、协议、endpoint、凭据槽、可用模型和默认模型。

常用 CLI：

```powershell
ccr model status
ccr model list
ccr model set gpt-5.5
ccr model profile codex-oauth-1 gpt-5.4
```

Desktop 内置一级“模型”页面，用于管理供应商 / Profile、填写 API Key、测试连接，并配合顶部“模型 / 连接配置”两个快速切换入口。顶部切换只影响下一轮消息，不会改写或绑定恢复出来的历史会话。

| 供应商 | 协议 | 认证 | 当前能力 |
| --- | --- | --- | --- |
| Codex OAuth | OpenAI Responses | OAuth | 文本、图片输入、hosted image generation |
| OpenAI | OpenAI Chat / Images / Responses | API Key | 文本、图片输入、图片生成 |
| DeepSeek | OpenAI Chat Completions | API Key | 文本与工具调用 |
| MiniMax 国际版 | Anthropic Messages + 原生图片接口 | API Key | 文本、工具调用、图片生成 |
| MiniMax 国内版 | Anthropic Messages + 原生图片接口 | API Key | 文本、工具调用、图片生成 |
| Kimi API / Kimi Code | OpenAI Chat / Anthropic Messages compatible | API Key | 文本与工具调用 |
| GLM API | OpenAI Chat compatible + Images | API Key | 文本、视觉模型、`glm-image` 生图 |
| GLM Coding Plan | OpenAI Chat compatible | API Key | Coding Plan 专用端点 |

## 多模态与生图

CCR 不把各家 provider 原始响应直接交给 UI。统一链路是：

```text
Provider 原始响应
-> CCR 标准内容块
-> generatedArtifact / DisplayEvent
-> Desktop 附件卡、缩略图、预览、复制、定位
```

当前稳定口径：

- 文本模型默认只接收文本，未知模型不会因为名字像 OpenAI 就默认启用图片。
- 支持视觉的模型可以接收图片附件，发送前会按能力目录和 Profile 覆盖校验。
- `GenerateImage` 是模型可见的统一生图工具。
- 支持生图的 provider 返回图片后，CCR 会优先落盘到 `~/.ccr/generated_outputs/...`。
- GLM 这类返回临时下载 URL 的模型，CCR 会先下载再展示，避免 UI 直接依赖远程 URL 导致缩略图破图。
- 当前 provider 不支持生图时，工具返回友好提示，引导用户切换到 GLM API、OpenAI 或 Codex OAuth。

相关文档：

- [CCR 多模态输入输出设计](docs/architecture/multimodal-input-output-design.md)
- [CCR 模型输出归一化与展示标准](docs/architecture/model-output-normalization-and-display-standard.md)
- [Provider 接入文档](docs/architecture/provider-integrations/README.md)

## Desktop 能力

- 本地 App Server 生命周期管理。
- 工作区切换和项目级 settings 隔离。
- 按工作区分组的历史会话、搜索和恢复。
- 一级“模型”页面，支持供应商 Profile、凭据、模型和测试连接管理。
- 顶部当前模型和连接配置快速切换。
- 多模态输入卡片、模型生成图片卡片、本地缩略图 / 预览和生成物持久化。
- 本地 / 项目 / 用户级权限设置页面。
- 日志页、错误诊断和原始 JSON 复制。
- 通过 GitHub Releases 检查自动更新。
- Windows 安装器打包、发布资产校验和 unsigned 发布提示。

## 配置与目录

| 路径 | 用途 |
| --- | --- |
| `~/.ccr/data/llm.config.local.json` | 普通模型配置、Profile、当前选择、provider 覆盖 |
| `~/.ccr/data/llm.credentials.local.json` | API Key、OAuth token 等敏感凭据 |
| `~/.ccr/generated_outputs/` | 模型生成图片等本地持久化产物 |
| `.ccr/settings*.json` | 项目级 CCR 设置 |
| `%APPDATA%/CCR/` | Windows Desktop 的窗口状态、日志、UI 本地状态 |

凭据只按 `profileId` 写入本地凭据文件，不进入仓库、不进入普通导出，也不应写进 `llm.config.local.json`。

## 架构边界

CCR 当前按这些边界推进：

- CLI / TUI：保留终端优先的编码 Agent 体验。
- Core：负责会话、turn、工具、权限、历史和标准内容块。
- LLM Runtime：负责 provider、Profile、协议适配、模型能力和生成物归一化。
- App Server：负责 Desktop / 未来客户端和 Core 之间的事件协议。
- Desktop：负责工作区、历史、模型配置、权限、日志、展示和发布更新体验。

长期方向不是把所有能力都塞到一个模型里，而是通过能力声明、Profile、工具治理和外部扩展边界，让模型只看到当前真实可用的能力。

## 开发验证

常用验证命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop
npm.cmd run build -- --pretty false
npm.cmd run desktop:build
```

LLM Runtime 与 provider：

```powershell
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime
npm.cmd run smoke:llm-runtime-status
npm.cmd run smoke:openai-chat-protocol
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
npm.cmd run smoke:deepseek-provider
npm.cmd run smoke:minimax-provider
npm.cmd run smoke:generated-output-provider
npm.cmd run smoke:generate-image-tool
npm.cmd run smoke:session-generated-image-flow
```

App Server / Desktop：

```powershell
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-release-artifacts
```

不要直接用 `node scripts/...` 运行 runtime smoke 脚本，除非确认该脚本不需要项目 loader。npm scripts 已经处理了需要 `bun-bundle-loader.mjs` 的入口。

## 发布

- 版本更新日志：[CHANGELOG.md](CHANGELOG.md)
- 版本路线图：[docs/architecture/version-roadmap.md](docs/architecture/version-roadmap.md)
- Desktop 发布验收 Runbook：[docs/architecture/desktop-release-acceptance-runbook.md](docs/architecture/desktop-release-acceptance-runbook.md)
- GitHub Release 发布流程：[docs/architecture/desktop-github-release-workflow.md](docs/architecture/desktop-github-release-workflow.md)
- npm 发布流程：[docs/release/npm-publish-workflow.md](docs/release/npm-publish-workflow.md)

`0.5.0` 已公开发布，发布资产包括：

- `CCR-0.5.0-win-x64.exe`
- `CCR-0.5.0-win-x64.exe.blockmap`
- `latest.yml`

当前安装包允许 unsigned 发布，release note 会保留 SHA256 校验值。未来如果购买代码签名证书，可以开启 `CCR_REQUIRE_SIGNED=1` 做强制签名门禁。

## 文档导航

- [文档总入口](docs/README.md)
- [技术文档索引](docs/architecture/README.md)
- [阶段任务目录](docs/stages/README.md)
- [阶段目标目录](docs/goals/README.md)
- [MCP 文档入口](docs/mcp/README.md)
- [修复与恢复资料索引](docs/recovery/README.md)

## 重要边界

- CCR 不是 Anthropic 官方源码发布版本。
- `CLAUDE.md` 在恢复代码的部分流程中仍是兼容文件名。
- 一些 Anthropic、Claude、Claude Desktop、Chrome extension、GitHub App 和 remote-session 文案可能仍会保留，因为它们指向真实外部服务或协议。
- 新增或面向用户展示的产品身份，应统一使用 `CCR` 或 `ccr`。
- `0.5.x` 不默认跨供应商路由用户数据；跨供应商能力路由要等后续显式设计和配置。

## 问题反馈

可以在 CCR 内使用 `/bug` 命令，也可以提交 [GitHub issue](https://github.com/mhdfy1988/cc-reforged/issues)。

## 上游参考

- 上游源码来源：[`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88)
- 上游产品介绍：[Claude Code](https://claude.com/product/claude-code)
- 上游文档参考：[code.claude.com/docs](https://code.claude.com/docs/en/overview)
