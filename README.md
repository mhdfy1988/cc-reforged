> **免责声明：** 本仓库包含从 [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm 包内置的 source map（`cli.js.map`）恢复出的源码。这不是 Anthropic 官方发布的源码。相关权利归各自权利方所有。

[简体中文](README.md) | [English](README.en.md)

# CCR

![](https://img.shields.io/badge/Node.js-24%2B-brightgreen?style=flat-square)
![](https://img.shields.io/badge/Desktop-Windows-blue?style=flat-square)
![](https://img.shields.io/badge/current-0.6.1-orange?style=flat-square)

CCR 是一个终端编码 Agent 的恢复构建与持续演进版本。它保留终端优先的工作方式，同时把配置、LLM 运行时、App Server 和 Desktop 客户端逐步收敛到 CCR 自己的边界内。

当前 `0.6.1` 版本线聚焦 Skill / Plugin 和外部能力包治理，在 MCP 基础管理面之上补齐 Skill 安装、运行时启用、审计和管理入口，并继续打磨 Desktop 管理页体验。

![CCR](docs/architecture/assets/ccr-desktop-main-workbench-clean.png)

## 一眼看懂

CCR 的目标不是简单“换一个模型接口”，而是把一个本地编码 Agent 需要的几条链路统一起来：

| 层面 | CCR 负责什么 |
| --- | --- |
| 终端 Agent | 保留 `ccr` CLI / TUI 对话、工具调用、权限确认和项目上下文体验 |
| Desktop 工作台 | 管理工作区、历史会话、模型配置、权限、日志、更新和生成物展示 |
| LLM Runtime | 管理 provider、Profile、凭据、模型目录、协议适配、能力声明和每轮元数据 |
| 多模态协议 | 统一文本、图片、文件、工具结果、生成图片和历史恢复的内部内容块 |
| 工具治理 | 让模型只看到当前真实可用的工具，并把 MCP 工具、安装、启停和诊断纳入统一管理 |
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
| 当前版本 | `0.6.1` |
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
| MCP 浏览器工具 | Desktop MCP 页 / `ccr mcp add-playwright` | 适合安装 Playwright MCP，让模型在需要时调用真实浏览器工具 |
| Provider 接入开发 | `docs/architecture/provider-integrations/` | 适合继续补新模型、新协议、新能力矩阵 |

## 0.5.2 重点

- ThreadDisplay：历史恢复和实时展示统一到 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 与 Ordered Display Reducer，Desktop 不再靠旧 replay 或 raw fallback 展示主聊天流。
- 会话恢复：compact 后当前模型上下文和 UI 可见历史改为同源双投影，减少恢复到旧上下文、工具结果错位和历史裁剪问题。
- 使用统计：新增模型调用使用事件流和 Desktop 使用统计页面，可按 provider、profile、model、project 聚合 token、调用次数和单次调用事实。
- 多模态展示：用户图片、模型生成图片、附件、工具结果和生成物进入统一内容块 / 附件展示路径，避免退化成本地路径正文或 `[图片]` 占位。
- 发布链路：`v0.5.2` 已公开发布 npm 包和 Windows Desktop 安装器，GitHub Actions Desktop Release 会构建 `CCR-0.5.2-win-x64.exe`、`.blockmap` 和 `latest.yml` 并验证自动更新 feed。

`0.5.2` 更具体的变化可以按几条线看：

| 方向 | 已完成 |
| --- | --- |
| 展示协议 | App Server 单一 ordered display state、DisplayFact 中间层、历史 snapshot 和实时 patch 同源输出 |
| Desktop 消费 | Renderer 直接消费 App Server projection，缺失 / 非法 projection 展示协议错误卡，不静默回退 raw content |
| 会话上下文 | compact 后 `currentContextMessages` 从 ordered transcript events 生成，UI 历史仍保留压缩前后可见记录 |
| 工具与附件 | 并行工具、乱序 result、工具进度 / 失败 / 中断、用户图片和模型输出图片进入黄金回归覆盖 |
| 使用统计 | `~/.ccr/usage-events/YYYY-MM.jsonl` 使用事件和 Desktop 使用统计页面 |
| 发布 | `CCR-0.5.2-win-x64.exe`、`.blockmap`、`latest.yml` 和远端 auto-update feed 校验 |

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

## MCP 安装与使用

MCP 已提前进入 `0.5.x` 工具治理线。CCR 当前已经有用户级 MCP 配置、Desktop MCP 管理页、受控安装计划、安装记录、导入 / 创建安装配置、常用候选、启用/禁用、检测、卸载和 MCP 工具卡展示。

### Desktop 推荐流程

日常使用优先走 Desktop：

1. 打开 CCR Desktop，进入左侧 `MCP` 页面。
2. 在安装区搜索 `playwright`、`context7` 或 `sentry`。
3. 点击 `安装`。
4. 在确认弹窗里检查写入位置、启动方式、风险提示和数据边界。
5. 点击 `确认安装`。
6. 安装后点击 `检测`，确认工具能被发现。
7. 会话里需要浏览器时，明确说“用浏览器打开/查询/操作”。成功时会看到 `MCP playwright / browser_*` 工具卡。

如果已经安装，候选会显示“已安装”，不要重复安装；直接在 MCP 页面里使用 `检测`、`重启`、`禁用/启用`。由 CCR 安装器管理的 server 会在详情页提供 `卸载`，配置漂移或缺失时提供 `修复`。

自写 MCP 优先使用 `导入 MCP 安装配置` 或 `创建 MCP 安装配置`。导入 / 创建后会先生成安装计划，用户确认后才写入真实 MCP 配置；确认弹窗可勾选 `保存到常用安装配置`，让它以后出现在安装候选里。

### CLI 安装

Playwright MCP 用户级快捷安装：

```powershell
ccr mcp add-playwright
```

常用变体：

```powershell
ccr mcp add-playwright --headless
ccr mcp add-playwright --version 0.0.71
ccr mcp add-playwright --mode managed
```

也可以手动添加其它 MCP：

```powershell
ccr mcp add --scope user playwright -- npx.cmd -y @playwright/mcp@latest
ccr mcp add --scope user --transport http sentry https://mcp.sentry.dev/mcp
```

### 配置和安全边界

| 路径 | 用途 |
| --- | --- |
| `~/.ccr/mcp.json` | 用户全局 MCP 配置，Desktop 推荐安装默认写这里 |
| 项目根目录 `.mcp.json` | 项目级共享 MCP 配置 |
| `~/.ccr/mcp/installed.json` | CCR 受控安装记录 |
| `~/.ccr/mcp/lock.json` | CCR 受控安装锁定记录 |
| `~/.ccr/mcp/manifests/` | 用户保存的常用 MCP 安装配置 |
| `~/.ccr/mcp/packages/` | CCR installer-owned 包缓存和 owner marker |
| `~/.ccr/logs/mcp/` | MCP 安装、连接和诊断日志 |

`npx` 快速模式不会把 `@playwright/mcp` 复制进 CCR 安装目录；首次启动时会由 npm/npx 获取并缓存。`installed.json` 和 `lock.json` 记录的是 CCR installer-owned 的配置与卸载边界，不代表所有手工配置。

模型可以建议需要某类 MCP 能力，但不能绕过用户确认自行下载安装、写配置、启动陌生 stdio server 或卸载删除文件。

自写 MCP 可以通过 `导入 MCP 安装配置`、`创建 MCP 安装配置` 或手写配置进入。手写配置只会进入 Server 列表；如需让 CCR 负责修复 / 卸载，需要在详情页显式 `接管`。

更完整的 MCP 文档见 [MCP 文档入口](docs/mcp/README.md) 和 [MCP 配置示例](docs/mcp/config-examples.md)。

## Skill 安装与使用

Skill 是可被模型按需调用的本地指令包，入口文件是 `SKILL.md`。CCR 当前支持 Desktop Skill 页面，也支持 CLI 管理安装候选、导入、安装、状态、详情、修复和卸载。

CLI 常用命令：

```powershell
ccr skill search starter
ccr skill import --kind local-skill-dir --path .\my-skill --yes
ccr skill install ccr-skill-starter --yes
ccr skill status --json
ccr skill inspect ccr-skill-starter --json
ccr skill repair ccr-skill-starter --yes
ccr skill uninstall ccr-skill-starter --yes
```

当前内置 Skill 安装候选包括 `Skill 包助手`、`Skill 安装助手`、`MCP 配置助手`、`BUG 排查助手`、`发布检查助手` 和 `文档更新助手`。它们都是 CCR 内置 preset，安装前仍会进入统一安装计划和用户确认流程。

导入和安装默认只生成 dry-run plan；只有带 `--yes` 时才会使用 plan 里的确认 token 写入 `~/.ccr/skills/`。更完整的 Skill 设计、Manifest 和兼容说明见 [Skill 文档入口](docs/skills/README.md)。

## Desktop 能力

- 本地 App Server 生命周期管理。
- 工作区切换和项目级 settings 隔离。
- 按工作区分组的历史会话、搜索和恢复。
- 一级“模型”页面，支持供应商 Profile、凭据、模型和测试连接管理。
- 一级“MCP”页面，支持 MCP server 查看、安装、检测、启用 / 禁用、重启和卸载。
- 一级“Skill”页面，支持 Skill 查看、导入外部 Skill、安装、启用 / 禁用、修复和卸载；新建 Skill 由会话中的 `Skill 包助手` 生成完整包后再登记为安装候选，Plugin 页面保留为后续扩展入口。
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
| `~/.ccr/mcp.json` | 用户全局 MCP 配置 |
| `~/.ccr/mcp/installed.json` | CCR 受控 MCP 安装记录 |
| `~/.ccr/mcp/lock.json` | CCR 受控 MCP 安装锁定记录 |
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

`0.5.2` 公开发布资产命名为：

- `CCR-0.5.2-win-x64.exe`
- `CCR-0.5.2-win-x64.exe.blockmap`
- `latest.yml`

正式公开发布以 GitHub Release 和 tag 为准；`0.5.2` 与历史版本 SHA256 记录保留在 Desktop 发布验收 Runbook 中。

当前安装包允许 unsigned 发布，release note 会保留 SHA256 校验值。未来如果购买代码签名证书，可以开启 `CCR_REQUIRE_SIGNED=1` 做强制签名门禁。

## 路线图

| 版本线 | 重点 |
| --- | --- |
| `0.5.x` | 多模态、多模型、工具调用、MCP 管理面、错误诊断、历史会话、发布质量继续稳定化 |
| `0.6.0` | Skill / Plugin 和外部能力包治理，补齐 Skill 安装管理、运行时启用、审计和管理入口 |
| `0.6.1` | Skill / MCP 管理页状态语义与详情操作区体验优化 |
| 后续 | 远端 registry、跨供应商能力路由、音频 / 视频 / 文件生成、更多 provider conformance matrix |

`0.5.x` 期间不会把没有能力声明的模型伪装成全能模型，也不会默认跨供应商发送用户数据。所有 provider 能力都应进入模型目录、Profile 覆盖或显式工具配置。

## 文档导航

- [文档总入口](docs/README.md)
- [技术文档索引](docs/architecture/README.md)
- [阶段任务目录](docs/stages/README.md)
- [阶段目标目录](docs/goals/README.md)
- [MCP 文档入口](docs/mcp/README.md)
- [Skill 文档入口](docs/skills/README.md)
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
- [CCR 工具注册目录](docs/architecture/tool-registry-catalog.md)

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
