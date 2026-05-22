# MCP 示例配置

本目录只放可复制的 MCP 示例配置，不放用户真实配置、token、cookie、profile 或本机私有路径。

## 当前示例

| 文件 | 用途 |
| --- | --- |
| [playwright.json](./playwright.json) | Playwright MCP 默认 headed 模式，适合本地可视化验证 |
| [playwright-headless.json](./playwright-headless.json) | Playwright MCP headless 模式，适合 CI 或无界面环境 |

## 使用方式

日常用户优先使用 Desktop 的 `MCP` 页面安装和检测；本目录示例主要用于源码调试、临时 smoke 或手动配置。

临时主会话：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js --mcp-config .\docs\examples\mcp\playwright.json
```

项目级配置：

```powershell
Copy-Item -LiteralPath .\docs\examples\mcp\playwright.json -Destination .\.mcp.json
```

注意：项目级 `.mcp.json` 会被 `ccr mcp list/get`、TUI 和主会话读取；不要在仓库默认提交真实启用配置，除非明确希望项目默认启用该 MCP。

Windows 示例使用 `npx.cmd` 直启，避免命中 PowerShell `npx.ps1` 执行策略拦截。只有确实需要 shell 语义时才额外包一层 `cmd /c`。
