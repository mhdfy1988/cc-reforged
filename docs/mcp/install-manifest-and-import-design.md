# MCP 安装清单与导入设计

本文档记录 CCR 对 MCP 安装清单、安装候选、手工配置和导入 / 创建能力的产品与架构口径。它描述的是当前实现边界和下一步设计，不等同于 MCP 官方协议规范。

## 目标

MCP 管理面必须区分三类对象：

| 对象 | 含义 | 当前入口 | 管理能力 |
| --- | --- | --- | --- |
| 已配置 MCP | 当前 CCR 能从配置源读到的 MCP server | `~/.ccr/mcp.json`、项目 `.mcp.json`、旧 settings、插件、企业配置等 | 查看、检测、启用、禁用、重启 |
| 可安装 MCP | 可以由 CCR 安装器生成安装计划的候选 | 内置 preset registry、用户本地 manifest 目录；远端 registry 已暂停 | 安装计划、确认安装 |
| CCR 受控安装记录 | 由 CCR 安装器写入并记录 owner 的 MCP | `~/.ccr/mcp/installed.json`、`~/.ccr/mcp/lock.json` | 状态校验、修复、卸载 |

这三者不能混成一个列表。安装列表展示“可以安装什么”，Server 列表展示“当前实际配置了什么”，安装记录只表示“CCR 安装器拥有管理权的东西”。

## 当前实现状态

当前安装候选来自统一候选搜索结果：

- `src/services/mcp/presets/playwright.ts`
- `src/services/mcp/presets/context7.ts`
- `src/services/mcp/presets/sentry.ts`
- `src/services/mcp/presets/registry.ts`
- 用户本地 manifest 目录：`~/.ccr/mcp/manifests/*.json`
- 远端 registry：已暂停，仅保留 disabled source / backlog 记录，当前不访问公网服务

Desktop 的安装区调用 `mcp/install/search`，最终走 `searchCcrMcpInstallCandidates(...)`。返回候选会带 `sourceType`、`sourceLabel`、`originPath`、`state`、`stateMessage` 和 `duplicateGroupCount`，前台只负责展示这些状态，不自行推断来源语义。

手工写入 MCP 配置不会自动进入安装列表，也不会自动写入 CCR 安装记录。它会出现在 Server 列表中，但默认不获得 installer-owned 的卸载和修复语义。

## 安装清单定位

安装清单（install manifest）是 CCR 自己定义的安装描述，不是 MCP 官方协议的一部分。它用于让 CCR 在写配置前知道：

- MCP 名称、展示名和说明。
- 来源类型：npm 包、本地目录、远端 URL、内置预设、插件提供或手工配置。
- 连接方式：`stdio`、`http`、`sse`、`ws`、`sdk` 等。
- 启动命令、URL、环境变量、权限、数据边界。
- 是否需要用户确认、写哪些文件、安装后能否安全卸载或修复。

当前 schema 定义在 `src/services/mcp/installManifest.ts`。

## 支持的使用形态

### 本地进程型 MCP

本地进程型 MCP 通常使用 `stdio`。CCR 根据配置启动本地进程，然后通过 stdio 和 MCP server 通信。

示例配置：

```json
{
  "type": "stdio",
  "command": "node",
  "args": ["D:\\my-mcp-server\\dist\\index.js"]
}
```

对应 manifest：

```json
{
  "schemaVersion": 1,
  "name": "my-mcp",
  "displayName": "我的 MCP",
  "description": "本地自定义 MCP 服务。",
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

### npm 包型 MCP

npm 包型 MCP 也是本地进程型 MCP，只是启动命令由 package 信息生成。Windows 下运行配置通常会落成 `cmd /c npx.cmd -y <package>@<version>`。

```json
{
  "schemaVersion": 1,
  "name": "playwright",
  "displayName": "Playwright MCP",
  "description": "浏览器自动化 MCP。",
  "version": "latest",
  "source": {
    "kind": "stdio-npm-package",
    "packageName": "@playwright/mcp",
    "packageManager": "npx"
  },
  "transport": "stdio",
  "permissions": [
    { "kind": "network", "required": true },
    { "kind": "process", "required": true }
  ],
  "dataBoundary": "remote-service"
}
```

### HTTP / SSE MCP

HTTP / SSE MCP 由 CCR 连接 URL。公网服务、本地 HTTP 服务都属于这一类，差别只在数据边界和生命周期。

本地 HTTP MCP 示例：

```json
{
  "schemaVersion": 1,
  "name": "my-local-http-mcp",
  "displayName": "我的本地 HTTP MCP",
  "description": "运行在本机的 HTTP MCP 服务。",
  "source": {
    "kind": "remote-url",
    "url": "http://127.0.0.1:3001/mcp",
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

公网远端 MCP 示例：

```json
{
  "schemaVersion": 1,
  "name": "sentry",
  "displayName": "Sentry MCP",
  "description": "远程查询 Sentry issue。",
  "source": {
    "kind": "remote-url",
    "url": "https://mcp.sentry.dev/mcp",
    "headersRequired": false
  },
  "transport": "http",
  "permissions": [
    { "kind": "network", "required": true },
    { "kind": "oauth", "required": true }
  ],
  "dataBoundary": "remote-service"
}
```

本地 HTTP MCP 的第一版口径是“CCR 负责连接，不负责启动服务”。如果要一键启动本地 HTTP 服务，需要后续扩展 manifest 的本地服务启动任务。

## 前台入口设计

当前已落地“导入 manifest”和轻量创建向导，不做完整 manifest 可视化编辑器。

### 导入 MCP 安装配置

入口：`导入 MCP 安装配置`。

流程：

1. 用户选择 MCP 安装配置 JSON。
2. CCR 读取并用当前 manifest schema 校验。
3. 前台展示名称、来源、连接方式、权限、数据边界、写入位置。
4. CCR 调用现有 `mcp/install/plan` 生成安装计划。
5. 用户确认安装，可选择“保存到常用安装配置”。
6. CCR 写入 MCP 配置、`installed.json` 和 `lock.json`。
7. 如果用户选择保存，CCR 将 manifest 写入 `~/.ccr/mcp/manifests/<name>.json`，后续出现在安装候选列表中。
8. 安装后进入 Server 列表，并获得卸载 / 修复能力。

第一版不直接上传或托管 MCP 包，只导入本地 manifest。包下载、服务启动或远端连接仍由 manifest 描述的来源类型决定。

### 创建 MCP 安装配置

入口：`创建 MCP 安装配置`。

向导不暴露完整 JSON，而是给常见模板：

| 模板 | 用户填写 | 生成 manifest |
| --- | --- | --- |
| 本地 stdio MCP | 名称、显示名、命令、参数、工作目录、环境变量 | `source.kind = local-directory`、`transport = stdio` |
| 本地 HTTP MCP | 名称、显示名、URL、headers | `source.kind = remote-url`、`transport = http`、`dataBoundary = local-only` |
| npm 包 MCP | 名称、包名、版本、额外参数 | `source.kind = stdio-npm-package`、`transport = stdio` |
| 远端 HTTP MCP | 名称、URL、OAuth/header 说明 | `source.kind = remote-url`、`transport = http` |

向导生成 manifest 后，仍进入同一套安装计划确认流程。
第一版只在安装计划确认弹窗提供“保存到常用安装配置”选项，避免创建表单和当前 server 详情页混入候选目录管理语义。

### 高级模式：JSON 编辑

完整 JSON 编辑器只作为高级模式。它可以用于调试和快速验证，但不作为主入口。原因是 manifest 字段较多，直接暴露会让普通用户难以判断 `source`、`serverConfig`、`entry`、`permissions` 和 `dataBoundary` 的关系。

### 安装确认弹窗

MCP 安装确认弹窗沿用“先理解，再确认，再看技术细节”的结构：

1. 顶部展示动作标题、MCP 名称和安装范围。
2. 如果 manifest 提供 `description`，以独立说明块展示；没有说明时不占位。
3. 主确认区只放确认后会发生的动作和必要注意事项，例如写入用户全局 MCP 配置、以后可在 MCP 页面管理、使用时会启动本地进程或连接远端服务。
4. 启动方式、数据边界、来源类型、配置变更数量、具体路径和原始 manifest 事实放入折叠的“技术细节”。
5. 前台只展示安装计划返回的风险、写入项和注意事项，不自行复制 installer 的判断逻辑。

本地进程、HTTP、SSE、远端服务这几类对象在用户侧的风险感知不同。主确认区应优先说清“运行时会启动本地进程”或“运行时会连接远端 URL”，不要只展示 `transport=stdio/http` 这类实现字段。

## 接管已有配置

手工配置可以被“接管为 CCR 管理”，但必须单独确认。

建议流程：

1. 用户在 Server 详情页点击 `接管`。
2. CCR 从当前 MCP config 反推最小 manifest。
3. 前台展示“这不是新安装，只是创建 CCR 管理记录”。
4. 用户确认后写入 `installed.json` 和 `lock.json`。
5. 接管后才允许 installer-owned 的修复和卸载。

接管不应静默发生。否则用户手写配置可能被误删或误覆盖。

## 不变式

- 所有写配置、修复、卸载都必须经过用户确认。
- 手工配置只进入 Server 列表，不自动进入安装记录。
- 安装列表只展示可由 manifest 生成安装计划的候选。
- Desktop 不复制 installer 的风险判断，只展示 plan / status 结果。
- 没有 owner 记录的 MCP 不做 installer-owned 卸载。
- 不把旧实现作为静默 fallback；manifest 校验失败要显式报错。

## 当前已落地

1. Desktop 支持 `导入 MCP 安装配置`，本地 manifest 校验后进入安装计划确认。
2. Desktop 支持 `创建 MCP 安装配置`，覆盖本地 stdio、本地 HTTP、npm 包和远端 HTTP。
3. 安装确认弹窗支持 `保存到常用安装配置`，写入 `~/.ccr/mcp/manifests/<name>.json` 后进入安装候选。
4. 用户本地 manifest 目录已经进入统一候选搜索结果。
5. Server 详情页支持显式 `接管` 手工配置，接管后才获得 installer-owned 修复和卸载语义。

## 后续增强

1. 远端 registry 暂停，后续若恢复，需要先完成 registry URL 配置、index schema、checksum、缓存、信任策略、权限提示和失败诊断设计。
2. 团队共享安装源需要区分“项目建议候选”和“项目已启用配置”。
3. 本地 HTTP MCP 如需由 CCR 一键启动，需要在 manifest 中扩展受控启动任务，不能默认把 HTTP URL 当作可启动服务。
4. 完整 JSON 编辑器只作为高级模式，仍必须复用当前 schema 校验和安装计划确认。
