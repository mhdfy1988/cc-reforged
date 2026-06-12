# MCP 配置示例

本文档只说明 CCR 当前支持的 MCP 配置形态。真实 token、cookie、个人路径和私有服务地址不要写进仓库文档，也不要提交到项目 `.mcp.json`。

## 配置对象区别

| 对象 | 用途 | 由谁维护 |
| --- | --- | --- |
| `~/.ccr/mcp.json` | 用户全局 MCP 配置，Desktop 默认安装写这里 | 用户 / CCR |
| 项目根目录 `.mcp.json` | 项目级共享 MCP 配置 | 项目团队 |
| `~/.ccr/mcp/manifests/*.json` | 常用 MCP 安装配置，进入 Desktop 安装候选 | 用户 / CCR |
| `~/.ccr/mcp/installed.json` | CCR 受控安装记录 | CCR |
| `~/.ccr/mcp/lock.json` | CCR 受控安装锁定记录 | CCR |

`mcp.json` 和 `.mcp.json` 是“已经启用什么 MCP”。`manifests/*.json` 是“可以安装什么 MCP”。`installed.json` 和 `lock.json` 是“哪些 MCP 由 CCR 安装器管理”。这三类不要混用。

## 用户全局 MCP 配置

用户全局配置适合所有项目都能使用的 MCP，例如浏览器、文档检索、个人常用本地服务。

路径：

```text
~/.ccr/mcp.json
```

示例：

```json
{
  "mcpServers": {
    "local_stdio_echo": {
      "type": "stdio",
      "command": "node",
      "args": ["D:\\my-mcp-server\\dist\\index.js"]
    },
    "local_http_echo": {
      "type": "http",
      "url": "http://127.0.0.1:3217/mcp"
    },
    "context7": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx.cmd", "-y", "@upstash/context7-mcp@latest"]
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp"
    }
  }
}
```

Windows 下 npm / npx 来源推荐使用 `cmd /c npx.cmd ...`，避免 PowerShell 执行策略拦截 `npx.ps1`。

## 项目级 MCP 配置

项目级配置适合团队共享、且不含个人秘密的 MCP。

路径：

```text
<project>/.mcp.json
```

示例：

```json
{
  "mcpServers": {
    "project_docs": {
      "type": "stdio",
      "command": "node",
      "args": ["./tools/mcp/project-docs/dist/index.js"]
    }
  }
}
```

项目 `.mcp.json` 可以提交，但前提是：

- 不包含 token、cookie、私有 header。
- 不包含只在某个开发者机器上存在的绝对路径。
- 团队确认启动 CCR 时可以默认发现这个 MCP。

## 导入 MCP 安装配置

安装清单（install manifest）是 CCR 自己定义的安装描述。它不是 MCP 官方协议，也不是直接启用的 `mcp.json`。它通过 Desktop 的 `导入 MCP 安装配置` 进入安装计划确认流程。

本地 stdio 示例：

```json
{
  "schemaVersion": 1,
  "name": "local-stdio-example",
  "displayName": "Local stdio MCP example",
  "description": "本地开发的 stdio MCP 示例。",
  "source": {
    "kind": "local-directory",
    "path": "D:\\my-mcp-server"
  },
  "transport": "stdio",
  "entry": {
    "command": "node",
    "args": ["D:\\my-mcp-server\\dist\\index.js"]
  },
  "permissions": [
    {
      "kind": "process",
      "required": true,
      "description": "启动本地 MCP 进程。"
    }
  ],
  "dataBoundary": "local-only"
}
```

本地 HTTP 示例：

```json
{
  "schemaVersion": 1,
  "name": "local-http-example",
  "displayName": "Local HTTP MCP example",
  "description": "本机已经运行的 HTTP MCP 示例。",
  "source": {
    "kind": "remote-url",
    "url": "http://127.0.0.1:3217/mcp",
    "headersRequired": false
  },
  "transport": "http",
  "permissions": [
    {
      "kind": "network",
      "required": true,
      "description": "连接本机 HTTP MCP 服务。"
    }
  ],
  "dataBoundary": "local-only"
}
```

npm 包示例：

```json
{
  "schemaVersion": 1,
  "name": "context7",
  "displayName": "Context7 MCP",
  "description": "按需检索库文档和代码示例。",
  "version": "latest",
  "source": {
    "kind": "stdio-npm-package",
    "packageName": "@upstash/context7-mcp",
    "packageManager": "npx"
  },
  "transport": "stdio",
  "permissions": [
    {
      "kind": "process",
      "required": true,
      "description": "通过 npx 启动本地 MCP 进程。"
    },
    {
      "kind": "network",
      "required": true,
      "description": "首次运行可能访问 npm registry。"
    }
  ],
  "dataBoundary": "remote-service"
}
```

远端 HTTP 示例：

```json
{
  "schemaVersion": 1,
  "name": "remote-http-example",
  "displayName": "Remote HTTP MCP example",
  "description": "远端 HTTP MCP 示例。",
  "source": {
    "kind": "remote-url",
    "url": "https://example.com/mcp",
    "headersRequired": true
  },
  "transport": "http",
  "permissions": [
    {
      "kind": "network",
      "required": true,
      "description": "连接远端 MCP 服务。"
    },
    {
      "kind": "secret",
      "required": true,
      "description": "需要用户提供认证 header 或 token。"
    }
  ],
  "dataBoundary": "remote-service"
}
```

## 创建 MCP 安装配置

Desktop 的 `创建 MCP 安装配置` 会按模板生成 manifest，然后进入同一套安装计划确认流程。

第一版模板：

| 类型 | 适用场景 | 关键字段 |
| --- | --- | --- |
| 本地 stdio | 自己写的本地 MCP，由 CCR 启动进程 | 名称、命令、参数、工作目录 |
| 本地 HTTP | 本机已经启动的 HTTP MCP，CCR 只负责连接 | 名称、URL、headers |
| npm 包 | 发布到 npm 的 MCP，使用 npx 启动 | 名称、包名、版本、额外参数 |
| 远程 HTTP | 公网或内网 HTTP MCP | 名称、URL、认证说明 |

生成安装计划后，确认弹窗可勾选 `保存到常用安装配置`。勾选后 CCR 会把 manifest 写入：

```text
~/.ccr/mcp/manifests/<name>.json
```

保存到该目录只表示“以后出现在安装候选里”，不代表已经启用。真正启用仍要走安装确认，写入 `~/.ccr/mcp.json`。

## 手工配置和接管

手工写入 `~/.ccr/mcp.json` 的 MCP 会出现在 Server 列表中，可以检测、启用、禁用和重启。项目 `.mcp.json` 也会作为项目共享声明进入发现结果，但普通 Desktop / App Server 管理动作不写回项目文件；需要修改项目声明时应直接维护 `.mcp.json`，并按项目协作和审批规则处理。

手工配置默认不会：

- 出现在安装候选列表。
- 写入 `installed.json`。
- 获得 CCR installer-owned 的修复和卸载语义。

如果希望 CCR 管理这个手工配置，需要在 Server 详情页执行 `接管`。接管只创建 CCR 管理记录，不会重新安装服务，也不会静默改写原配置。

## 自写 MCP 的推荐流程

1. 本地先让 MCP server 能独立运行。
2. 如果是 stdio，准备启动命令和参数；如果是 HTTP，先确认 URL 可访问。
3. 在 Desktop 里点 `创建 MCP 安装配置`，选择对应类型。
4. 生成安装计划，检查写入位置、权限和数据边界。
5. 确认安装。
6. 如果后续会反复使用，勾选 `保存到常用安装配置`。
7. 安装后在 Server 详情页点击 `检测`，确认工具列表能返回。

如果已经有手写 `mcp.json`，也可以先让它进入 Server 列表，再通过 `接管` 转成 CCR 受控安装记录。
