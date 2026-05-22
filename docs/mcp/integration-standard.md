# 通用 MCP 接入规范

本文档规定 CCR 后续接入 MCP 服务的统一方式。目标是把 MCP 当作可插拔工具层，而不是把每个外部能力都写进核心 agent runtime。

## 1. 分层边界

CCR 的 MCP 分层固定为：

1. 配置层：`.mcp.json`、用户配置、项目配置、local 配置、`--mcp-config`。
2. 解析层：校验 `mcpServers` schema，区分 `stdio`、`http`、`sse`、`ws`、`sdk`。
3. 策略层：企业策略、allow/deny、保留名称、scope 合并。
4. 连接层：创建 transport，建立 MCP client，会话生命周期管理。
5. 发现层：拉取 tools、resources、prompts、server instructions。
6. 工具层：把 MCP tool 包装成 CCR tool，进入主循环工具池。
7. 调用层：转发 tool call，处理输出、错误、超时、重试。
8. 体验层：TUI `/mcp`、状态提示、排查命令、未来 App/Web 设置页。

任何具体 MCP 服务都不应越过这些层直接进入主循环。

## 2. 目录约定

| 内容 | 放置位置 |
| --- | --- |
| 通用 MCP 运行时代码 | `src/services/mcp/` |
| MCP 工具包装逻辑 | `src/tools/MCPTool/` |
| MCP 命令 | `src/commands/mcp/` |
| MCP 专项设计 | `docs/mcp/<name>-integration-design.md` |
| MCP 示例配置 | `docs/examples/mcp/<name>.json` |
| 临时验证工作区 | `tmp/<name>-mcp-smoke/` |
| 用户级 MCP 配置 | `~/.ccr/mcp.json` |
| CCR 受控安装清单 | `~/.ccr/mcp/installed.json` |
| CCR 受控安装锁文件 | `~/.ccr/mcp/lock.json` |
| CCR installer-owned 包缓存 | `~/.ccr/mcp/packages/<package>/<version>/` |
| CLI managed 本地 MCP 安装 | `~/.ccr/mcp/servers/<name>/` |
| 用户 skill 安装 | `~/.ccr/skills/` |
| 用户 plugin 安装 | `~/.ccr/plugins/` |

后续如果新增预设命令，建议放到 `src/services/mcp/presets/` 或 `src/commands/mcp/` 下，不要把预设写进 `client.ts` 的连接主干。

注意：第三方 MCP 通过 `npx.cmd -y <package>` 启动时，npm 包仍由 npm/npx 自己管理；CCR 只保存配置引用。只有 CCR 自己下载、展开、管理生命周期的 MCP server，才进入 `~/.ccr/mcp/servers/`。

当前实现口径：

- `user` scope 的主配置文件是 `~/.ccr/mcp.json`。
- 旧全局 settings 里的 `mcpServers` 只做只读兼容，新命令不再写入旧 settings。
- `ccr mcp add-playwright` 默认写入 `~/.ccr/mcp.json`。
- `ccr mcp list/get`、TUI MCP 启动链路和 `getClaudeCodeMcpConfigs()` 都会读取 `~/.ccr/mcp.json`。

Playwright MCP 的安装来源采用双模式：

- `npx` 快速模式：Windows 配置里直接写 `npx.cmd -y @playwright/mcp@<version>`，包下载和缓存由 npm/npx 管理。
- `.ccr` 管理式安装模式：CCR 把指定版本安装到 `~/.ccr/mcp/servers/playwright/`，配置里指向本地入口。
- Desktop 受控安装模式：先写安装计划、用户确认、配置、安装清单、锁文件和 owner marker；stdio npm 包实际获取仍由 npm/npx 在启动时完成。

两种模式都必须走同一套 `mcpServers` schema 和 MCP runtime；不要因为 `.ccr` 管理式安装就绕过通用 MCP 连接层。

## 3. 接入流程

每个新 MCP 至少按下面步骤推进：

1. 资料对照：先看官方文档、官方示例、成熟仓库实现，确认启动命令和能力边界。
2. 示例配置：新增 `docs/examples/mcp/<name>.json`，Windows 下优先使用 `.cmd` 入口。
3. 设计文档：新增或补充 `docs/mcp/<name>-integration-design.md`。
4. 用户级入口：如果这是常用 MCP，优先提供 `ccr mcp add-<name>` 或等价预设命令，默认写入 `~/.ccr/mcp.json`。
5. 静态校验：确认 JSON 可解析，字段符合 CCR schema。
6. 连接 smoke：通过 MCP SDK 或 `ccr mcp list/get` 确认 server connected。
7. 工具发现：确认关键工具出现在 tool list。
8. 只读 smoke：优先做不修改外部状态的调用。
9. 交互 smoke：只在公开 demo 或用户确认环境里做点击、输入、上传等动作。
10. 回归验证：至少跑 `typecheck`、`build`、相关 smoke。
11. 文档回写：把实际命令、坑点、失败原因和最终验证结果写回文档。

## 4. 命名规则

- MCP server 名称使用小写短名，例如 `playwright`。
- CCR 暴露给模型的工具名遵循 `mcp__<server>__<tool>`。
- 示例配置文件使用 `<server>.json` 和 `<server>-<variant>.json`。
- 不再新增 `claude-*` 命名的 CCR 自有能力。
- 旧专有名称只作为历史兼容或保留名称存在，不能成为新入口。

## 5. Windows 规则

在当前 Windows 环境下：

- npm/npx 入口优先使用 `npm.cmd`、`npx.cmd`。
- stdio MCP 优先直接使用明确可执行入口，例如 `command: "npx.cmd"`；只有确实需要 shell 语义时才使用 `cmd /c` 包装。
- 不要在 PowerShell 5.1 命令里使用 `&&` / `||`。
- 如果 Node loader 使用绝对路径，在非仓库目录运行时要写成 `file:///D:/.../bun-bundle-loader.mjs`。

## 6. 安全边界

MCP 服务按风险分级：

| 风险级别 | 示例 | 默认要求 |
| --- | --- | --- |
| 低 | 只读资源、公开文档查询 | 可做基础 smoke |
| 中 | 浏览器打开页面、读取快照、网络请求 | 先只读，后交互 |
| 高 | 文件上传、表单提交、支付、执行代码、读取 cookie/profile | 必须明确用户确认和权限边界 |
| 极高 | 本地 shell、远程控制、凭据读取、生产数据库写入 | 不进默认配置，必须专项设计 |

Playwright MCP 属于中到高风险：`browser_snapshot`、`browser_navigate` 可先测，`browser_file_upload`、`browser_run_code`、登录态 profile 要单独设计权限边界。

## 7. 验收标准

新 MCP 至少满足：

- 示例配置可解析。
- MCP server 可连接。
- 关键工具可发现。
- 至少一个只读 smoke 成功。
- 文档说明启动命令、验证命令、常见失败点。
- 不影响没有 MCP 配置时的 CCR 默认启动。
- 不把用户真实 token、cookie、profile 写进仓库。
- CCR 自己管理的配置、安装和缓存默认落到 `~/.ccr`，不再写 `.claude`。
