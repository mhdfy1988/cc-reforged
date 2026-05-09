# CCR App Server 版本、协议兼容与回滚规则

## 1. 目标

Desktop / VS Code / Web 这类客户端不能凭感觉连接任意版本的 App Server。P17 的目标是把版本信息、协议兼容判断和回滚边界固定下来。

第一版只做本地协议兼容，不做复杂在线迁移。

## 2. initialize 版本字段

`initialize` 返回：

```json
{
  "serverInfo": {
    "name": "ccr-app-server",
    "version": "0.1",
    "serverVersion": "0.1",
    "coreVersion": "0.2"
  },
  "serverVersion": "0.1",
  "protocolVersion": "0.1",
  "schemaVersions": {
    "config": "0.1"
  }
}
```

字段语义：

- `coreVersion`：CCR Core / npm 包版本。
- `serverVersion`：App Server 实现版本，当前与协议版本保持一致。
- `protocolVersion`：JSON-RPC 协议版本。
- `schemaVersions.config`：配置 schema 版本。

`serverInfo.version` 保留给旧客户端兼容，后续新客户端优先读 `serverVersion`。

## 3. Desktop 兼容判断

Desktop main process 在 `initialize` 成功后立即判断：

```text
Desktop 支持 protocol 0.1
App Server 返回 protocol 0.1
  -> 允许继续启动

App Server 返回其他 protocol
  -> 标记 App Server failed
  -> 写入日志
  -> renderer 展示可解释错误
```

判断在 main process 内完成，不交给 renderer 自己推导。

## 4. 向后兼容规则

协议小版本约束：

- 允许新增字段。
- 允许新增 capability。
- 客户端遇到未知字段必须忽略。
- 服务端遇到未知 capability 不能假装支持。
- 字段删除、字段改义、错误码改义必须升级 major。

当前第一版先采用精确匹配：

```text
supportedProtocol = 0.1
actualProtocol = 0.1
```

等协议稳定后再扩展为 semver range。

## 5. 配置 schema 规则

配置版本必须独立于协议版本。

第一版：

```text
schemaVersions.config = 0.1
```

后续配置迁移规则：

- 迁移前先备份。
- 新版本负责读取旧 schema。
- 老版本遇到未知字段应尽量忽略。
- OAuth token / refresh token 不参与自动迁移覆盖。
- MCP 配置迁移必须保留原始文件备份。

## 6. 回滚规则

Desktop 第一版不做独立 Core runtime 热更新，所以回滚边界是：

```text
Desktop 安装包回滚 = Core runtime 回滚
```

当前允许：

- 用户重新安装旧版本 Desktop。
- `~/.ccr` 配置不被安装包覆盖。
- 未知配置字段尽量忽略。

当前不做：

- Desktop 不变，在线替换 Core。
- 自动降级 Core runtime。
- 会话执行中迁移 runtime。

## 7. Smoke 覆盖

当前 smoke 覆盖：

- `smoke:app-server` 检查 `protocolVersion`、`serverVersion`、`schemaVersions.config`。
- `smoke:desktop-packaged` 检查打包态 App Server 也返回同样版本字段。
- `ci:smoke` 覆盖普通构建、Desktop 构建、App Server、Client SDK、runtime、permissions、deps。

## 8. 后续增强

后续可以继续补：

- `protocolVersion` semver range。
- Desktop 设置页展示协议兼容状态。
- 更新前协议兼容预检。
- 配置 migration 备份目录。
- 失败版本记录与手动回滚入口。
