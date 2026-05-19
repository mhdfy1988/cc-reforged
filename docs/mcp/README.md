# CCR MCP 文档入口

本目录用于沉淀 CCR 的通用 MCP 接入设计、验证流程、风险边界和具体 MCP 服务方案。原则是：核心运行时保持通用，具体 MCP 服务通过配置、预设和文档进入，不把单个 MCP 硬编码进主循环。

## 目录职责

| 路径 | 职责 | 是否放真实用户配置 |
| --- | --- | --- |
| `src/services/mcp/` | 通用 MCP 运行时：配置解析、连接、工具发现、调用、状态同步 | 否 |
| `docs/mcp/` | MCP 设计、规范、验证手册、专项方案 | 否 |
| `docs/examples/mcp/` | 可复制的示例配置 | 否 |
| 项目根目录 `.mcp.json` | 当前项目实际启用的 MCP 配置 | 是，按项目需要 |
| `~/.ccr/mcp.json` | 用户级长期 MCP 配置 | 是，用户本机状态 |
| `~/.ccr/mcp/servers/` | CCR 管理的自研/本地 MCP server 安装产物 | 是，用户本机状态 |
| `~/.ccr/skills/` | CCR 管理的用户 skill 安装目录 | 是，用户本机状态 |
| `~/.ccr/plugins/` | CCR 管理的用户 plugin 安装目录 | 是，用户本机状态 |

## 当前文档

- [通用 MCP 接入规范](./integration-standard.md)：后续接入任何 MCP 前先看这里。
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
- CCR 自己管理的 MCP、skill、plugin 默认安装到 `~/.ccr`；通过 npm/npx 引用的第三方 MCP 只是外部执行源，不算 CCR 安装目录。

## 当前路线

第一阶段已经从“示例验证”推进到“用户级默认入口”：

- 用户级 MCP 配置默认落到 `~/.ccr/mcp.json`。
- `ccr mcp add-playwright` 会把官方 Playwright MCP 写入用户级配置。
- `ccr mcp add-playwright --mode npx` 保持快速模式，使用 `cmd /c npx.cmd -y @playwright/mcp@<version>`。
- `ccr mcp add-playwright --mode managed` 会把 Playwright MCP 安装到 `~/.ccr/mcp/servers/playwright/`，并把 `~/.ccr/mcp.json` 指向本地入口。
- `ccr mcp list/get` 和 TUI 默认 MCP 启动链路都会读取 `~/.ccr/mcp.json`。
- 旧 settings 中的 user MCP 只作为迁移期只读兼容来源，新写入不再进入旧配置文件。

后续再继续做：

- MCP 连接失败诊断。
- 浏览器工具风险分类。
- App/Web 设置页里的 MCP 管理入口。
- 独立的 Playwright MCP `install/uninstall/repair/status` 管理命令。
