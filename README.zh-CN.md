> **免责声明：** 本仓库包含从 [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm 包内置的 source map（`cli.js.map`）恢复出的源码。这不是 Anthropic 官方发布的源码。相关权利归各自权利方所有。

[English](README.md) | [简体中文](README.zh-CN.md)

# CCR

![](https://img.shields.io/badge/Node.js-24%2B-brightgreen?style=flat-square)
![](https://img.shields.io/badge/Desktop-Windows-blue?style=flat-square)
![](https://img.shields.io/badge/current-0.5.0-orange?style=flat-square)

CCR 是一个终端编码 Agent 的恢复构建与持续演进版本。它保留终端优先的工作方式，同时把配置、LLM 运行时、App Server 和 Desktop 客户端逐步收敛到 CCR 自己的边界内。

当前主线重点：

- `ccr` CLI / TUI 运行时，支持 Codex OAuth。
- CCR Windows 客户端，负责本地 App Server 管理、历史会话、权限设置、自动更新和安装包发布。
- 内置 LLM Runtime，逐步支持多供应商、多连接配置档案、多协议、多模态内容块、生成物和每轮模型元数据。
- 默认支持 Codex OAuth、OpenAI、DeepSeek 官方 API、MiniMax 国际版 / 国内版、Kimi、GLM API / Coding Plan，并抽出 OpenAI Chat Completions 与 Anthropic Messages 两条公共协议适配器。
- 通过统一 `GenerateImage` 工具提供跨供应商生图入口，生成图片先持久化，再由 Desktop 展示缩略图和预览。
- 项目级 `.ccr` 设置隔离，避免和本机 Claude Code、Codex、OpenClaw 等工具互相污染。

![CCR](docs/architecture/assets/ccr-desktop-main-workbench-clean.png)

## 当前状态

- npm 包名：`cc-reforged`
- 当前版本：`0.5.0`
- CLI 命令：`ccr`
- 桌面应用：`CCR`
- 运行时要求：Node.js `>=24.0.0`
- 默认配置目录：`~/.ccr`
- 默认 LLM 配置文件：`~/.ccr/data/llm.config.local.json`
- 默认 LLM 凭据文件：`~/.ccr/data/llm.credentials.local.json`
- 发布入口：[`mhdfy1988/cc-reforged` GitHub Releases](https://github.com/mhdfy1988/cc-reforged/releases)

主分支可能包含最新版本之后的开发中改动。面向用户的版本变化见 [CHANGELOG.md](CHANGELOG.md)。

`0.5.x` 版本线继续收敛多模态、多模型和工具调用体验；后续 `0.6.0` 主线进入 MCP、Skill、Plugin 与外部能力治理。

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

```powershell
npm.cmd install
npm.cmd run build
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

## 模型供应商

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

模型和供应商配置默认保存在 `~/.ccr` 下。当前构建采用 Profile 优先的配置模型：`llm.config.local.json` 保存 `schemaVersion + current + profiles + providerOverrides`，`llm.credentials.local.json` 按 `profileCredentials[profileId]` 保存敏感凭据。一个 Profile 组合供应商类型、协议、endpoint、凭据槽、可用模型和默认模型。

可以通过 CLI 查看和切换模型配置：

```powershell
ccr model status
ccr model list
ccr model set gpt-5.5
ccr model profile codex-oauth-1 gpt-5.4
```

CCR 已新增一级“模型”页面，用于管理供应商 / Profile、填写 API Key、测试连接，并配合顶部模型 / 连接配置两个快速切换入口。顶部切换只影响下一轮消息，不会改写或绑定恢复出来的历史会话。

当前内置供应商：

| 供应商 | 协议 | 认证 | 备注 |
| --- | --- | --- | --- |
| Codex OAuth | OpenAI Responses | OAuth | 文本、图片输入、hosted image generation |
| OpenAI | OpenAI Chat / Images / Responses | API Key | 文本、图片输入、图片生成 |
| DeepSeek | OpenAI Chat Completions | API Key | 文本与工具调用 |
| MiniMax 国际版 | Anthropic Messages + 原生图片接口 | API Key | 文本、工具调用、图片生成 |
| MiniMax 国内版 | Anthropic Messages + 原生图片接口 | API Key | 文本、工具调用、图片生成 |
| Kimi API / Kimi Code | OpenAI Chat / Anthropic Messages compatible | API Key | 文本与工具调用 |
| GLM API | OpenAI Chat compatible + Images | API Key | 文本、视觉模型、`glm-image` 生图 |
| GLM Coding Plan | OpenAI Chat compatible | API Key | Coding Plan 专用端点 |

## Desktop 能力

- 本地 App Server 生命周期管理。
- 工作区切换和项目级 settings 隔离。
- 按工作区分组的历史会话。
- 一级“模型”页面，支持供应商 Profile、凭据、模型和测试连接管理。
- 顶部当前模型和连接配置快速切换。
- 多模态输入卡片、模型生成图片卡片、本地缩略图 / 预览和生成物持久化。
- 本地 / 项目 / 用户级权限设置页面。
- 通过 GitHub Releases 检查自动更新。
- Windows 安装器打包、发布资产校验和 unsigned 发布提示。

## 开发验证

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop
npm.cmd run build -- --pretty false
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
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
npm.cmd run smoke:cli-model
npm.cmd run desktop:build
```

不要直接用 `node scripts/...` 运行 runtime smoke 脚本，除非确认该脚本不需要项目 loader。npm scripts 已经处理了需要 `bun-bundle-loader.mjs` 的入口。

## 发布

- 版本更新日志：[CHANGELOG.md](CHANGELOG.md)
- 版本路线图：[docs/architecture/version-roadmap.md](docs/architecture/version-roadmap.md)
- Desktop 发布验收 Runbook：[docs/architecture/desktop-release-acceptance-runbook.md](docs/architecture/desktop-release-acceptance-runbook.md)
- GitHub Release 发布流程：[docs/architecture/desktop-github-release-workflow.md](docs/architecture/desktop-github-release-workflow.md)
- npm 发布流程：[docs/release/npm-publish-workflow.md](docs/release/npm-publish-workflow.md)

## 重要边界

- CCR 不是 Anthropic 官方源码发布版本。
- `CLAUDE.md` 在恢复代码的部分流程中仍是兼容文件名。
- 一些 Anthropic、Claude、Claude Desktop、Chrome extension、GitHub App 和 remote-session 文案可能仍会保留，因为它们指向真实外部服务或协议。
- 新增或面向用户展示的产品身份，应统一使用 `CCR` 或 `ccr`。

## 问题反馈

可以在 CCR 内使用 `/bug` 命令，也可以提交 [GitHub issue](https://github.com/mhdfy1988/cc-reforged/issues)。

## 上游参考

- 上游源码来源：[`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88)
- 上游产品介绍：[Claude Code](https://claude.com/product/claude-code)
- 上游文档参考：[code.claude.com/docs](https://code.claude.com/docs/en/overview)
