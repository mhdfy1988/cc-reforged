# CCR MCP 文档入口

本目录用于沉淀 CCR 的通用 MCP 接入设计、安装使用流程、验证方法、风险边界和具体 MCP 服务方案。Skill / MCP / Plugin / Tool 的总体关系先看 [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)。原则是：核心运行时保持通用，具体 MCP 服务通过配置、预设、受控安装计划和文档进入，不把单个 MCP 硬编码进主循环。

## 目录职责

| 路径 | 职责 | 是否放真实用户配置 |
| --- | --- | --- |
| `src/services/mcp/` | 通用 MCP 运行时：配置解析、连接、工具发现、调用、状态同步 | 否 |
| `docs/mcp/` | MCP 设计、规范、验证手册、专项方案 | 否 |
| `docs/examples/mcp/` | 可复制的示例配置 | 否 |
| 项目根目录 `.mcp.json` | 当前项目实际启用的 MCP 配置 | 是，按项目需要 |
| `~/.ccr/mcp.json` | 用户级长期 MCP 配置 | 是，用户本机状态 |
| `~/.ccr/mcp/installed.json` | CCR 受控安装记录 | 是，用户本机状态 |
| `~/.ccr/mcp/lock.json` | CCR 受控安装锁定记录 | 是，用户本机状态 |
| `~/.ccr/mcp/manifests/` | 用户保存的常用 MCP 安装配置，进入 Desktop 安装候选 | 是，用户本机状态 |
| `~/.ccr/mcp/packages/` | CCR installer-owned MCP 包缓存与 owner marker | 是，用户本机状态 |
| `~/.ccr/logs/mcp/` | MCP 安装、连接和诊断日志落点 | 是，用户本机状态 |
| `~/.ccr/skills/` | CCR 管理的用户 skill 安装目录 | 是，用户本机状态 |
| `~/.ccr/plugins/` | CCR 管理的用户 plugin 安装目录 | 是，用户本机状态 |

## 当前文档

- [通用 MCP 接入规范](./integration-standard.md)：后续接入任何 MCP 前先看这里。
- [MCP 安装清单与导入设计](./install-manifest-and-import-design.md)：安装候选、manifest、导入本地 MCP、手工配置接管的当前设计。
- [MCP 配置示例](./config-examples.md)：真实 `mcp.json`、项目 `.mcp.json`、安装清单和常用候选目录的示例。
- [MCP 模块化路线图](./modularization-roadmap.md)：当前权威路线，包含已完成 C 系列和后续 D 系列 goal。
- [MCP 模块化 Goal C-1 设计](./modularization-goal-c1.md)：历史滚动记录，保留 C 系列背景和执行结果。
- [MCP 验证与排查手册](./verification-runbook.md)：按命令验证配置、连接、工具发现和只读 smoke。
- [Playwright MCP 接入设计](./playwright-integration-design.md)：浏览器 MCP 的第一条正式接入路线。
- [MCP 示例配置](../examples/mcp/README.md)：当前可直接复制的 JSON 配置。
- [CCR 用户目录与安装布局](../architecture/ccr-home-layout.md)：`~/.ccr` 下 MCP、skill、plugin、配置、缓存的默认落点。

## 接入原则

- 新 MCP 默认先走通用 `mcpServers` 配置，不新增核心代码。
- 如果要加快捷命令，只写成预设或配置生成器，不改变通用 MCP 运行时语义。
- 高风险 MCP 必须先有风险边界和 smoke，不允许只靠“能连上”就进入默认配置。
- 专有、缺失、不可公开验证的 MCP 不做假恢复；要么显式禁用，要么换成公开生态方案。
- 示例配置不等于启用配置，仓库根目录不默认放 `.mcp.json`，避免开发者启动 CCR 时被迫拉起外部服务。
- CCR 自己管理的 MCP、skill、plugin 默认落到 `~/.ccr`；通过 npm/npx 引用的第三方 MCP 只是外部执行源，不算 CCR 复制到本地的安装目录。

## 当前权威状态

当前 MCP 模块化与安装管理以 [MCP 模块化路线图](./modularization-roadmap.md) 为权威入口；`modularization-goal-c1.md` 只保留 C 系列历史滚动记录，不再作为继续实现的唯一入口。

内置安装候选当前包括：

- Playwright MCP：stdio npm package，适合浏览器自动化、截图和本地页面验证。
- Context7 MCP：stdio npm package，适合按库名检索最新 API 文档和代码示例。
- Sentry MCP：hosted remote HTTP MCP，入口 `https://mcp.sentry.dev/mcp`，首次连接由远端 OAuth 授权。

## 当前路线

第一阶段已经从“示例验证”推进到“用户级默认入口 + Desktop 管理面”。当前版本线已经进入 `0.6.x` 扩展能力治理：MCP server 和 MCP tool 会进入统一 Capability Catalog，MCP 管理页继续负责连接、检测、重启、安装、修复和卸载等 server 级操作。

已完成：

- 用户级 MCP 配置默认落到 `~/.ccr/mcp.json`。
- Desktop 已有一级 MCP 页面，可查看 server、启用/禁用、重启、检测、搜索安装候选、确认安装、展示配置状态，并在详情页修复漂移/缺失配置或卸载 CCR installer-owned MCP。
- Desktop 安装当前默认写入用户全局 scope；项目共享 / 本地项目 scope 暂不在界面展示。
- 当前内置安装候选提供 Playwright、Context7 和 Sentry remote MCP。
- Desktop 支持 `导入 MCP 安装配置` 和 `创建 MCP 安装配置`，覆盖本地 stdio、本地 HTTP、npm 包和远端 HTTP。
- 导入或创建的安装计划确认时可选择 `保存到常用安装配置`，保存后写入 `~/.ccr/mcp/manifests/<name>.json`，并进入安装候选列表。
- 手工配置可以在 Server 详情页显式接管为 CCR 受控安装记录；接管前只展示和检测，不提供 installer-owned 卸载 / 修复语义。
- 安装计划必须经用户确认后才写配置、记录安装清单和锁文件；模型不能绕过宿主确认自行下载或改配置。
- `ccr mcp add-playwright` 会把官方 Playwright MCP 写入用户级配置。
- `ccr mcp add-playwright --mode npx` 保持快速模式，Windows 使用 `npx.cmd -y @playwright/mcp@<version>`。
- `ccr mcp list/get` 和 TUI 默认 MCP 启动链路都会读取 `~/.ccr/mcp.json`。
- 旧 settings 中的 user MCP 只作为迁移期只读兼容来源，新写入不再进入旧配置文件。
- MCP server / MCP tool 已接入统一能力目录；需要跨 Skill / MCP / Tool 查看来源和运行时可见性时，可使用 `capabilities/list` 或 CLI `capabilities list`。
- MCP server 管理动作已接入统一 capability action plan / apply：Desktop 只按管理投影的 `allowedActions/actionRef` 展示启用、禁用、检测、重启、修复和卸载；真正执行时由 App Server `capabilities/management/action/plan|apply` 预检后再分发到 MCP 领域服务。
- `configured`、`installed`、`runtimeConnected`、`available` 已拆开表达：手工配置是 configured，不等于 CCR installer-owned；runtime-only server 只能 inspect，不能通过管理动作写本地配置；plugin-owned MCP 由父 Plugin 管理，不开放本地 enable / disable / restart / uninstall 写入动作。

## 使用入口

### Desktop 推荐流程

日常用户优先走 Desktop：

1. 打开 CCR Desktop，进入左侧 `MCP` 页面。
2. 在安装区搜索 `playwright`、`context7` 或 `sentry`。
3. 点击 `安装`，查看确认弹窗里的写入位置、启动方式、数据边界和风险提示。
4. 点击 `确认安装` 后，CCR 会写入 `~/.ccr/mcp.json`，并记录 `~/.ccr/mcp/installed.json` 和 `~/.ccr/mcp/lock.json`。
5. 安装后在 MCP 页面点击 `检测`，确认能发现工具。
6. 会话里需要对应能力时，明确说“用浏览器打开/查询/操作”“查某个库文档”或“查 Sentry issue”。成功调用时，聊天流会出现对应 MCP 工具卡。

如果候选已显示“已安装”，不要重复安装；直接在左侧 server 列表里点 `检测`、`重启` 或 `禁用/启用`。
如果该 server 来自 CCR 安装记录，详情页顶部会提供 `卸载`，配置漂移或缺失时会提供 `修复`。
如果要接入自己写的 MCP，优先在安装区使用 `导入 MCP 安装配置` 或 `创建 MCP 安装配置`，生成安装计划后再确认安装。安装确认弹窗里的 `保存到常用安装配置` 会把该 manifest 保存为以后可重复安装的候选。

### CLI 快速安装

Playwright MCP 的用户级快捷安装：

```powershell
ccr mcp add-playwright
```

常用变体：

```powershell
ccr mcp add-playwright --headless
ccr mcp add-playwright --version 0.0.71
ccr mcp add-playwright --mode managed
```

`npx` 快速模式不会把 `@playwright/mcp` 复制进 CCR 安装目录；它会在启动时由 npm/npx 获取并缓存。受控安装记录只说明这条配置由 CCR 安装器写入和管理，不表示第三方包已经被 CCR 复制到本地。

### 手动配置

如果要接入其它 stdio / HTTP / SSE MCP，可以用通用命令：

```powershell
ccr mcp add --scope user playwright -- npx.cmd -y @playwright/mcp@latest
ccr mcp add --scope user --transport http sentry https://mcp.sentry.dev/mcp
```

也可以手写用户全局 `~/.ccr/mcp.json`：

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx.cmd",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

手写用户全局配置不会自动进入 `installed.json`，因此不会被当成 CCR installer-owned 项；但 Server 列表仍会展示它，并允许检测、启用、禁用和重启。项目 `.mcp.json` 适合团队共享声明，会作为运行时发现来源进入列表，但普通 Desktop / App Server 管理动作不写回项目文件。后续如需支持安全卸载，应先走“接管已有配置”的显式确认流程。

更多配置格式示例见 [MCP 配置示例](./config-examples.md)。

## 安装与运行边界

- `~/.ccr/mcp.json` 是用户全局 MCP 主配置，适合“所有项目都能用”的浏览器、搜索、文档类工具。
- 项目根目录 `.mcp.json` 适合团队共享的项目级 MCP，但不要提交 token、cookie、私有路径或个人浏览器 profile。
- `~/.ccr/mcp/installed.json` 和 `~/.ccr/mcp/lock.json` 只记录 CCR 受控安装，不代表所有手写 MCP。
- 统一能力目录里的 `configured=true` 只表示存在配置来源；`installed=true` 只用于 CCR installer-owned 项；`runtimeConnected=true` 表示当前 runtime client 已连接；这三个字段不能互相冒充。
- `~/.ccr/mcp/manifests/` 保存用户常用 MCP 安装配置；它们只让候选出现在安装区，不代表已经启用。
- `~/.ccr/mcp/packages/` 由 owner marker 保护，卸载时只清理 CCR 确认归属的目录。
- `npx` 来源首次运行可能访问 npm 网络并启动本地 stdio 进程；这也是安装确认里会提示 `requires_user_confirmation`、`starts_local_process` 和 `may_access_network` 的原因。
- 模型可以建议需要某类 MCP 能力，但真实安装、写配置、卸载、启停都必须由宿主执行并经过用户确认。

后续再继续做：

- 远端 registry、团队共享安装源和 manifest 分享机制已暂停，不进入当前 MCP 实现序列；后续恢复前需要先补 registry URL 配置、index schema、checksum、缓存、信任策略和失败诊断设计，详见 [MCP 安装清单与导入设计](./install-manifest-and-import-design.md)。
- MCP 连接失败诊断和 availability 原因继续细化。
- 浏览器工具风险分类和权限提示继续细化。
- Skill / Plugin 复用 MCP installer-owned、registry、availability 和 Desktop 管理页模式。
