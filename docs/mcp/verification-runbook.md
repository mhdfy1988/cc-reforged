# MCP 验证与排查手册

本文档记录 CCR MCP 的通用验证步骤。后续每接一个 MCP，都按这里的顺序先验证连接，再验证工具调用，最后才进入 TUI/模型主链路。

## 1. 静态校验

先确认示例配置是合法 JSON：

```powershell
node -e "const fs=require('fs'); for (const p of ['docs/examples/mcp/playwright.json','docs/examples/mcp/playwright-headless.json']) { JSON.parse(fs.readFileSync(p,'utf8')); console.log(p + ' ok'); }"
```

预期输出：

```text
docs/examples/mcp/playwright.json ok
docs/examples/mcp/playwright-headless.json ok
```

## 2. Server 级连接 smoke

当模型调用不可用或不想消耗模型额度时，先直接用 MCP SDK 验证 server 能启动和列工具。

```powershell
@'
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const config = JSON.parse(await readFile('docs/examples/mcp/playwright.json', 'utf8'));
const server = config.mcpServers.playwright;
const transport = new StdioClientTransport({
  command: server.command,
  args: server.args,
  env: { ...process.env },
});
const client = new Client({ name: 'ccr-playwright-smoke', version: '0.1.0' });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const names = tools.tools.map(tool => tool.name).sort();
  console.log(JSON.stringify({
    ok: true,
    toolCount: names.length,
    hasNavigate: names.includes('browser_navigate'),
    hasSnapshot: names.includes('browser_snapshot'),
    firstTools: names.slice(0, 20)
  }, null, 2));
} finally {
  await client.close();
}
'@ | node --input-type=module
```

当前 Playwright MCP 预期至少包含：

```text
browser_navigate
browser_snapshot
browser_click
browser_type
browser_take_screenshot
```

## 3. 只读工具 smoke

只读 smoke 用公开页面，避免外部状态变更：

```powershell
@'
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const config = JSON.parse(await readFile('docs/examples/mcp/playwright.json', 'utf8'));
const server = config.mcpServers.playwright;
const transport = new StdioClientTransport({
  command: server.command,
  args: server.args,
  env: { ...process.env },
});
const client = new Client({ name: 'ccr-playwright-readonly-smoke', version: '0.1.0' });
try {
  await client.connect(transport);
  await client.callTool({ name: 'browser_navigate', arguments: { url: 'https://example.com' } });
  const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  const text = snapshot.content?.map(item => item.text ?? '').join('\n') ?? '';
  await client.callTool({ name: 'browser_close', arguments: {} }).catch(() => undefined);
  console.log(JSON.stringify({
    ok: true,
    snapshotHasExampleDomain: text.includes('Example Domain'),
    snapshotPreview: text.slice(0, 800)
  }, null, 2));
} finally {
  await client.close();
}
'@ | node --input-type=module
```

预期结果：

- `ok: true`
- `snapshotHasExampleDomain: true`
- 快照里包含 `Page Title: Example Domain`

## 3.1 Playwright MCP 浏览器工具使用边界

模型驱动 Playwright MCP 时允许出现探索性失败，但以下几类属于已知高频误用，CCR 侧应尽量提前阻断或在提示词中给出明确推荐方式。

### 3.1.1 禁止直接导航 `file://`

Playwright MCP 的 `browser_navigate` 不能打开 `file://` URL。遇到本地 HTML 文件时，不要让模型直接调用：

```json
{
  "url": "file:///D:/learn_code/snake-game/index.html"
}
```

正确做法是先启动本地 HTTP 服务，再导航到 `http://localhost:<port>/`。

Windows 临时预览服务推荐用独立进程启动：

```powershell
Start-Process -WindowStyle Hidden -FilePath python -ArgumentList "-m http.server 8080" -WorkingDirectory "D:\learn_code\snake-game"
```

不推荐让模型用 `Start-Job` 拼临时服务链路。`Start-Job` 的生命周期、工作目录和作业查询都更容易出错，尤其是把 Job 对象直接传给 `Get-Job` 时会被当作名称解析。

### 3.1.2 点击前必须刷新快照

`browser_click` 里的 `ref` 是当前页面快照里的临时引用。页面刷新、重新导航或 DOM 变化后，旧 `ref` 可能失效。

推荐流程：

1. `browser_snapshot`
2. 从最新快照中选择目标元素的 `ref`
3. `browser_click` 使用该 `ref`

不要复用上一轮页面里的旧 `ref`。

### 3.1.3 不要把自然语言当 CSS selector

`browser_click.target` 如果按 CSS selector 解析，就不能传入类似 `button "重新开始"` 这种自然语言描述。需要么使用快照 `ref`，要么使用 MCP 工具明确支持的定位字段。

错误示例：

```json
{
  "target": "button \"重新开始\"",
  "element": "重新开始按钮"
}
```

### 3.1.4 unsafe code 不要假设完整全局环境

`browser_run_code_unsafe` 的运行环境不等同于完整 Node 或页面全局环境。等待时优先使用 Playwright API：

```js
await page.waitForTimeout(1000)
```

不要默认使用裸 `setTimeout`。

## 4. CCR 项目级连接 smoke

`--mcp-config` 是主会话入口参数，不适合直接和 `mcp list` 组合。要验证 `ccr mcp list/get`，用临时目录放 `.mcp.json`：

```powershell
$smokeDir = 'D:\agent_project\claude-code-reforged\tmp\playwright-mcp-smoke'
New-Item -ItemType Directory -Force -Path $smokeDir | Out-Null
Copy-Item -LiteralPath D:\agent_project\claude-code-reforged\docs\examples\mcp\playwright.json -Destination "$smokeDir\.mcp.json" -Force
```

然后在临时目录运行：

```powershell
node --no-warnings --experimental-loader file:///D:/agent_project/claude-code-reforged/bun-bundle-loader.mjs D:\agent_project\claude-code-reforged\cli.js mcp list
```

预期输出：

```text
Checking MCP server health...

playwright: npx.cmd -y @playwright/mcp@latest - ✓ Connected
```

查看详情：

```powershell
node --no-warnings --experimental-loader file:///D:/agent_project/claude-code-reforged/bun-bundle-loader.mjs D:\agent_project\claude-code-reforged\cli.js mcp get playwright
```

预期输出包含：

```text
Scope: Project config (shared via .mcp.json)
Status: ✓ Connected
Type: stdio
Command: npx.cmd
Args: -y @playwright/mcp@latest
```

## 5. CCR 用户级连接 smoke

用户级配置的生产入口是 `~/.ccr/mcp.json`。为了验证时不污染真实用户目录，可以临时指定 `CCR_CONFIG_DIR`：

```powershell
$env:CCR_CONFIG_DIR = 'D:\agent_project\claude-code-reforged\tmp\ccr-home-mcp-smoke'
New-Item -ItemType Directory -Force -Path $env:CCR_CONFIG_DIR | Out-Null
```

写入 Playwright MCP：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js mcp add-playwright
```

预期生成：

```text
D:\agent_project\claude-code-reforged\tmp\ccr-home-mcp-smoke\mcp.json
```

然后验证列表读取的是用户级配置：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js mcp get playwright
```

预期输出包含：

```text
Scope: User config (available in all your projects)
Status: ✓ Connected
Command: npx.cmd
Args: -y @playwright/mcp@latest
```

验证结束后清理当前 PowerShell 会话里的临时目录变量：

```powershell
Remove-Item Env:\CCR_CONFIG_DIR
```

### 5.1 历史：CCR 用户级 `.ccr` 管理式安装 smoke

当前 Desktop 安装默认采用用户全局配置 + installer-owned 安装记录，不把第三方 npm 包复制进 `~/.ccr/mcp/servers/`。本节保留为历史 CLI managed 模式验证记录；如果相关 CLI 模式继续维护，运行前先确认当前命令仍支持 `--mode managed`。

管理式安装会下载 `@playwright/mcp` 到 CCR 用户目录，并把 `~/.ccr/mcp.json` 指向本地入口。验证时仍然使用临时 `CCR_CONFIG_DIR`，避免污染真实用户目录：

```powershell
$env:CCR_CONFIG_DIR = 'D:\agent_project\claude-code-reforged\tmp\ccr-home-mcp-managed-smoke'
New-Item -ItemType Directory -Force -Path $env:CCR_CONFIG_DIR | Out-Null
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js mcp add-playwright --mode managed --version 0.0.71
```

预期生成：

```text
D:\agent_project\claude-code-reforged\tmp\ccr-home-mcp-managed-smoke\mcp.json
D:\agent_project\claude-code-reforged\tmp\ccr-home-mcp-managed-smoke\mcp\servers\playwright\manifest.json
```

检查配置是否指向本地托管入口：

```powershell
Get-Content -Encoding utf8 "$env:CCR_CONFIG_DIR\mcp.json"
Get-Content -Encoding utf8 "$env:CCR_CONFIG_DIR\mcp\servers\playwright\manifest.json"
```

预期 `mcp.json` 包含：

```text
"command": "<当前 Node 可执行文件>"
"args": ["<临时 CCR_CONFIG_DIR>/mcp/servers/playwright/node_modules/@playwright/mcp/cli.js"]
```

然后验证 CCR MCP 能连接：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js mcp get playwright
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js mcp list
```

验证结束后清理当前 PowerShell 会话里的临时目录变量：

```powershell
Remove-Item Env:\CCR_CONFIG_DIR
```

## 6. CCR 主链路 smoke

TUI 启动：

```powershell
cd D:\agent_project\claude-code-reforged
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js
```

进入后：

1. 运行 `/mcp`。
2. 确认 `playwright` 是 connected。
3. 让模型执行只读任务：

```text
打开 https://example.com，读取页面快照，并告诉我页面标题。
```

如果 `-p` 非交互模式出现 `[Builtin LLM Runtime] fetch failed`，先不要把它判断成 MCP 问题。需要先用本文档第 2、3、4、5 步确认 MCP server、工具调用和 CCR MCP 配置链路是否正常。

## 7. 常见问题

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| `mcp list` 把 `mcp` / `list` 当成配置文件 | `--mcp-config` 是可变参数，位置不适合 | 用临时 `.mcp.json` 验证 |
| Windows 找不到 `npx` 或被执行策略拦截 | 命中了 PowerShell 脚本入口 | 示例里使用明确的 `npx.cmd` |
| Node loader 报 `ERR_UNSUPPORTED_ESM_URL_SCHEME` | 在非仓库目录传了 Windows 绝对路径 loader | 使用 `file:///D:/.../bun-bundle-loader.mjs` |
| Playwright 首次启动很慢 | `npx` 首次下载包或浏览器依赖 | 等待完成，后续考虑 pin 版本或预安装 |
| 模型 fetch failed | LLM provider/auth/network 问题 | 先用 MCP SDK 和 `mcp list/get` 排除 MCP 问题 |
| `ccr mcp add-playwright` 重复添加失败 | 同名 `playwright` 已在该 scope 存在 | 使用 `ccr mcp add-playwright --force` 覆盖 |

## 8. Installer / Desktop 回归命令

MCP installer、preset registry、Desktop MCP 页面或 App Server MCP API 改动后执行：

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:mcp-adopt
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:mcp-manifest-builder
npm.cmd run smoke:mcp-manifest-import
npm.cmd run smoke:mcp-install-presets
npm.cmd run smoke:mcp-cli-install
npm.cmd run smoke:mcp-discovery-adapters
npm.cmd run smoke:mcp-discovery-service
npm.cmd run smoke:mcp-remote-transport-options
npm.cmd run smoke:app-server-client
npm.cmd run desktop:build
```

remote preset 验证要求：

- 先确认官方 URL 和认证方式。
- preset 不写用户 token、cookie 或静态个人 header。
- `source.kind` 使用 `remote-url`，`dataBoundary` 使用 `remote-service`。
- smoke 用临时 `CCR_CONFIG_DIR` 覆盖 install/status/repair/uninstall，不污染真实用户配置。
- OAuth 型 remote MCP 可验证到 install plan / config preview / needs-auth 边界，不要求在 CI 中完成用户授权。

## 9. 回归命令

MCP 配置或运行时改动后至少执行：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build -- --pretty false
npm.cmd run ci:smoke
```

如果只改文档或示例配置，至少执行 JSON 静态校验和相关 smoke。
