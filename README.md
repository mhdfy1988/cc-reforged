> **免责声明：** 本仓库包含从 [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm 包内置的 source map（`cli.js.map`）恢复出的源码。这不是 Anthropic 官方发布的源码。相关权利归各自权利方所有。

[简体中文](README.md) | [English](README.en.md)

# CCR

![](https://img.shields.io/badge/Node.js-24%2B-brightgreen?style=flat-square)
![](https://img.shields.io/badge/Desktop-Windows-blue?style=flat-square)
![](https://img.shields.io/badge/current-0.5.0-orange?style=flat-square)

CCR 是一个终端编码 Agent 的恢复构建与持续演进版本。它保留终端优先的工作方式，同时把配置、LLM 运行时、App Server 和 Desktop 客户端逐步收敛到 CCR 自己的边界内。

当前 `0.5.x` 版本线聚焦三件事：多模型、多模态和工具调用。下一条 `0.6.0` 主线会进入 MCP、Skill、Plugin 与外部能力治理。

![CCR](docs/architecture/assets/ccr-desktop-main-workbench-clean.png)

## 一眼看懂

CCR 的目标不是简单“换一个模型接口”，而是把一个本地编码 Agent 需要的几条链路统一起来：

| 层面 | CCR 负责什么 |
| --- | --- |
| 终端 Agent | 保留 `ccr` CLI / TUI 对话、工具调用、权限确认和项目上下文体验 |
| Desktop 工作台 | 管理工作区、历史会话、模型配置、权限、日志、更新和生成物展示 |
| LLM Runtime | 管理 provider、Profile、凭据、模型目录、协议适配、能力声明和每轮元数据 |
| 多模态协议 | 统一文本、图片、文件、工具结果、生成图片和历史恢复的内部内容块 |
| 工具治理 | 让模型只看到当前真实可用的工具，后续继续接入 MCP、Skill、Plugin |
| 项目隔离 | 使用 `.ccr` 项目配置，避免污染 Claude Code、Codex、OpenClaw 等其它工具 |

你可以把它理解成三层组合：

```text
ccr CLI / TUI
  -> Core Agent Runtime
  -> LLM Runtime / Tools / Permission / Session

CCR Desktop
  -> App Server
  -> 同一套 Core Agent Runtime

Provider Adapters
  -> Codex OAuth / OpenAI / DeepSeek / MiniMax / Kimi / GLM
```

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

典型使用路径：

| 场景 | 推荐入口 | 说明 |
| --- | --- | --- |
| 继续终端编码 | `ccr` | 适合熟悉 TUI、希望直接在终端里和 Agent 协作的人 |
| 本地工作台 | CCR Windows 客户端 | 适合需要历史会话、模型切换、权限页、日志页和图片预览的人 |
| 多模型调试 | Desktop 模型页 / `ccr model` | 适合比较 Codex OAuth、OpenAI、DeepSeek、MiniMax、Kimi、GLM 等供应商 |
| 多模态 / 生图 | Desktop 会话 | 适合发送图片、生成图片、查看缩略图和预览生成物 |
| Provider 接入开发 | `docs/architecture/provider-integrations/` | 适合继续补新模型、新协议、新能力矩阵 |

## 0.5.0 重点

- 多供应商模型管理：Codex OAuth、OpenAI、DeepSeek、MiniMax、Kimi、GLM API / Coding Plan 已进入统一 Profile 管理。
- 多模态输入：图片和文件附件进入草稿队列，发送前按当前模型能力校验。
- 统一生图工具：模型可见 `GenerateImage`，不再让模型猜测应该写 SVG、调用 shell 还是手写文件。
- 生成物展示：GLM 返回的远程 URL 会先下载落盘，再复用本地缩略图和预览 UI。
- Desktop 体验修复：历史会话、计划卡、错误诊断、工具卡片、附件展示和长 JSON 溢出都做了收敛。
- 发布链路：Windows 安装包、`.blockmap`、`latest.yml`、SHA256 和 GitHub Release 流程已经跑通。

`0.5.0` 更具体的变化可以按几条线看：

| 方向 | 已完成 |
| --- | --- |
| 多供应商 | Profile、凭据隔离、provider 目录、测试连接、顶部模型 / 连接配置切换 |
| 多模态输入 | 图片 / 文件草稿队列、模型能力校验、内容块协议、历史恢复展示 |
| 图片生成 | OpenAI / Codex OAuth / MiniMax / GLM 输出统一为 `generatedArtifact` |
| Desktop 展示 | 附件卡、图片预览、工具卡、错误卡、日志原始数据块和长诊断限宽 |
| 会话历史 | 工作区分组、当前会话展示、运行中不可切换、历史恢复过滤内部合成消息 |
| 发布 | `CCR-0.5.0-win-x64.exe`、`.blockmap`、`latest.yml`、SHA256 和公开 GitHub Release |

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

### 首次启动建议

如果你只是想快速试用，建议按这个顺序：

1. 先安装或启动 `ccr`。
2. 通过 `/login` 完成 Codex OAuth 登录。
3. 用一个简单问题确认文本对话可用。
4. 再打开 Desktop，配置其它 API Key 或切换模型。
5. 需要生图时，优先切到支持图片生成的 provider，例如 GLM API、OpenAI、MiniMax 或 Codex OAuth。

如果你主要使用 Desktop，可以先安装 Windows 包，再在“模型”页面里完成连接配置。

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

源码开发时常用路径：

| 路径 | 说明 |
| --- | --- |
| `src/` | CLI、Core、LLM Runtime、工具、配置和协议适配 |
| `apps/desktop/` | Electron Desktop 主进程、renderer、IPC 和 UI |
| `scripts/` | smoke、打包、发布、probe 和辅助检查脚本 |
| `docs/architecture/` | 长期架构、协议、provider、Desktop、发布与升级文档 |
| `docs/stages/` | 当前 todo、阶段指针、修复清单和交接记录 |
| `docs/goals/` | 每个阶段的目标、验收标准和完成记录 |

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

### Profile 是什么

CCR 里“供应商”和“连接配置”是两回事：

- 供应商类型：例如 `glm-api`、`openai`、`minimax-cn`，表示协议、默认 base URL 和内置模型目录。
- Profile：一条真实连接配置，包含名称、供应商类型、endpoint、默认模型、模型列表和凭据槽。
- 凭据：API Key 或 OAuth token，单独按 `profileId` 存在 `llm.credentials.local.json`。

这样同一个供应商可以保存多个账号或多个 endpoint，例如：

```text
glm-api-1    -> 个人 GLM API Key
glm-api-2    -> 团队 GLM API Key
openai-1     -> 官方 OpenAI
minimax-cn-1 -> 国内 MiniMax
```

恢复历史会话不会自动切换当前模型。CCR 会在每轮 turn metadata 里记录当时实际使用的 `profileId / provider / model / apiMode`，用于排查和审计。

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

### 生图调用口径

生图不是让模型“自己画图”，也不是让模型写一个 SVG 文件糊弄用户。CCR 的目标是把生图变成模型可见的真实工具能力：

```text
用户说“生成一张图片”
-> Desktop / App Server 识别生图意图
-> 当前 provider 支持生图则调用 GenerateImage
-> provider adapter 调用真实图片生成接口
-> 输出归一化为 generatedArtifact
-> 后端落盘或下载 URL
-> Desktop 展示缩略图、预览、打开、定位、另存、复制
```

当前各 provider 的生图路径：

| Provider | 生图路径 |
| --- | --- |
| Codex OAuth | Responses hosted `image_generation` tool |
| OpenAI | `/images/generations`，也支持 Responses hosted tool 路径 |
| MiniMax | 原生 `image_generation` 接口 |
| GLM API | `glm-image` / `/images/generations`，返回 URL 后先下载落盘 |

后续如果接音频、视频、文件生成，也会先扩展 `generatedArtifact` 生命周期，而不是把 provider 原始响应直接塞进 UI。

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

### Desktop 当前工作流

Desktop 当前围绕一个“本地工作区 + 会话流”展开：

1. 顶部选择当前工作区。
2. 顶部选择当前模型和连接配置。
3. 会话区发送消息、附件或生图请求。
4. 工具调用、权限请求、计划确认、错误诊断都以卡片形式进入时间线。
5. 历史会话按 workspace 分组展示，运行中的会话不能被重复切换。
6. 日志页用于查看 Desktop / App Server 事件，长 JSON 在内部滚动，不撑开页面。

这套体验仍在 `0.5.x` 继续打磨，特别是工具能力治理、错误诊断、运行中状态和多会话观测。

## 配置与目录

| 路径 | 用途 |
| --- | --- |
| `~/.ccr/data/llm.config.local.json` | 普通模型配置、Profile、当前选择、provider 覆盖 |
| `~/.ccr/data/llm.credentials.local.json` | API Key、OAuth token 等敏感凭据 |
| `~/.ccr/generated_outputs/` | 模型生成图片等本地持久化产物 |
| `.ccr/settings*.json` | 项目级 CCR 设置 |
| `%APPDATA%/CCR/` | Windows Desktop 的窗口状态、日志、UI 本地状态 |

凭据只按 `profileId` 写入本地凭据文件，不进入仓库、不进入普通导出，也不应写进 `llm.config.local.json`。

### 数据和安全边界

- API Key、OAuth token、refresh token 只进入本机凭据文件，不写入仓库。
- 生成图片默认落盘到 `~/.ccr/generated_outputs/`，历史恢复只保存轻量引用。
- 远程图片 URL 会尽量由后端下载为本地文件，避免 UI 依赖临时链接。
- 项目级设置使用 `.ccr/settings*.json`，不再运行时读取旧 `.claude/settings*.json`。
- 当前不会默认跨供应商路由用户数据；未来跨供应商能力路由必须显式配置。
- 错误诊断会尽量结构化和脱敏，原始 JSON 只放在可展开详情里。

## 架构边界

CCR 当前按这些边界推进：

- CLI / TUI：保留终端优先的编码 Agent 体验。
- Core：负责会话、turn、工具、权限、历史和标准内容块。
- LLM Runtime：负责 provider、Profile、协议适配、模型能力和生成物归一化。
- App Server：负责 Desktop / 未来客户端和 Core 之间的事件协议。
- Desktop：负责工作区、历史、模型配置、权限、日志、展示和发布更新体验。

长期方向不是把所有能力都塞到一个模型里，而是通过能力声明、Profile、工具治理和外部扩展边界，让模型只看到当前真实可用的能力。

### 运行链路

```text
用户输入
-> Desktop / CLI
-> App Server turn/start
-> CoreSessionService
-> LLM Runtime
-> Provider Adapter
-> 标准内容块 / 工具事件 / generatedArtifact
-> App Server events
-> Desktop DisplayEvent
```

这条链路的核心约束是：UI 不解析 provider 原始协议，provider adapter 不决定 UI 展示，工具执行结果不伪装成用户消息。

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

### 推荐验证组合

| 改动类型 | 推荐命令 |
| --- | --- |
| README / 文档 | `git diff --check` |
| LLM 配置 / provider | `npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime-status` |
| 图片生成 | `npm.cmd run smoke:generate-image-tool`、`npm.cmd run smoke:session-generated-image-flow` |
| Desktop 展示 | `npm.cmd run smoke:desktop-display-events`、`npm.cmd run desktop:build` |
| 发布资产 | `npm.cmd run desktop:dist`、`npm.cmd run smoke:desktop-release-artifacts` |
| npm 包内容 | `npm.cmd pack --dry-run --json` |

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

## 路线图

| 版本线 | 重点 |
| --- | --- |
| `0.5.x` | 多模态、多模型、工具调用、错误诊断、历史会话、发布质量继续稳定化 |
| `0.6.0` | MCP、Skill、Plugin、外部能力治理、能力发现和安装配置 |
| 后续 | 跨供应商能力路由、音频 / 视频 / 文件生成、更多 provider conformance matrix |

`0.5.x` 期间不会把没有能力声明的模型伪装成全能模型，也不会默认跨供应商发送用户数据。所有 provider 能力都应进入模型目录、Profile 覆盖或显式工具配置。

## 文档导航

- [文档总入口](docs/README.md)
- [技术文档索引](docs/architecture/README.md)
- [阶段任务目录](docs/stages/README.md)
- [阶段目标目录](docs/goals/README.md)
- [MCP 文档入口](docs/mcp/README.md)
- [修复与恢复资料索引](docs/recovery/README.md)

如果你是第一次看这个仓库，建议按这个顺序读：

1. [CCR 版本路线图](docs/architecture/version-roadmap.md)
2. [CCR 多入口与 App Server 总体方案](docs/architecture/entrypoints-runtime-app-server-desktop-vscode.md)
3. [CCR 标准 LLM 协议](docs/architecture/ccr-standard-llm-protocol.md)
4. [CCR 多供应商模型与协议接入设计](docs/architecture/multi-provider-model-management-design.md)
5. [CCR 模型输出归一化与展示标准](docs/architecture/model-output-normalization-and-display-standard.md)
6. [阶段任务目录](docs/stages/README.md)

如果你要继续开发某个 provider，直接看：

- [Provider 接入文档](docs/architecture/provider-integrations/README.md)
- [Provider 协议盘点与官方文档对照](docs/architecture/provider-protocol-inventory-and-official-docs.md)
- [Provider 工具协议统一化标准](docs/architecture/provider-tool-protocol-normalization.md)

## 常见问题

### 为什么默认 README 是中文？

CCR 当前主要维护和协作场景是中文环境，很多路径、Windows PowerShell、Desktop 体验和 provider 调试记录都来自中文工作流。英文版保留在 [README.en.md](README.en.md)。

### 为什么 Windows 安装包会提示未知发布者？

当前没有购买代码签名证书，所以安装器允许 unsigned 发布。请以 GitHub Release 地址和 release note 中的 SHA256 校验值确认来源。

### 为什么生图要先落盘？

不同 provider 返回结果不同：OpenAI / MiniMax 可能返回 base64，GLM 可能返回临时下载 URL，Codex OAuth 走 hosted tool。CCR 统一落盘后再展示，能保证缩略图、预览、历史恢复和复制路径行为一致。

### 为什么不是所有模型都能发图片或生图？

CCR 不靠模型名猜能力。模型是否支持图片输入、工具调用、结构化输出或图片生成，必须来自内置能力目录、Profile 覆盖或 provider 明确声明。

### 为什么要用 `.ccr` 而不是 `.claude`？

CCR 需要和 Claude Code、Codex、OpenClaw 等本机工具并存。项目级设置放在 `.ccr/settings*.json`，可以避免权限、配置和历史文件互相污染。

### `README.zh-CN.md` 和 `README.md` 有什么区别？

当前两者内容保持一致，`README.md` 是 GitHub 默认中文入口，`README.zh-CN.md` 保留给旧链接和明确语言文件名使用。

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
