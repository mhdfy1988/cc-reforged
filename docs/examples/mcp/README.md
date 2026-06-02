# MCP 示例配置

本目录只放可复制的 MCP 示例配置，不放用户真实配置、token、cookie、profile 或本机私有路径。

## 当前示例

| 文件 | 用途 |
| --- | --- |
| [playwright.json](./playwright.json) | Playwright MCP 默认 headed 模式，适合本地可视化验证 |
| [playwright-headless.json](./playwright-headless.json) | Playwright MCP headless 模式，适合 CI 或无界面环境 |
| [local-stdio-manifest.json](./local-stdio-manifest.json) | 本地开发的 stdio MCP 安装清单示例，用于 Desktop 导入 manifest |
| [local-http-manifest.json](./local-http-manifest.json) | 本地 HTTP MCP 安装清单示例，用于 Desktop 导入 manifest |

## 使用方式

日常用户优先使用 Desktop 的 `MCP` 页面安装和检测；本目录示例主要用于源码调试、临时 smoke 或手动配置。

`*-manifest.json` 文件是 CCR 安装清单示例，不是直接启用的 `.mcp.json` 配置。它们需要通过 Desktop 的 `导入 MCP 安装配置` 或安装计划接口确认后，才会写入真实 MCP 配置和 CCR 安装记录。

如果希望某个 manifest 长期出现在 Desktop 安装候选里，可以在安装确认弹窗勾选 `保存到常用安装配置`，或手动放到：

```text
~/.ccr/mcp/manifests/<name>.json
```

保存到候选目录只表示“可安装”，不表示已经启用。真正启用仍要写入 `~/.ccr/mcp.json` 或项目 `.mcp.json`。

更多真实配置和 manifest 示例见 [MCP 配置示例](../../mcp/config-examples.md)。

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
