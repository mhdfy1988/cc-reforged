# CCR Plugin 兼容迁移、回滚与发布收口

本文记录 Plugin 产品化 P12 的兼容边界、入口收口、数据迁移、回滚语义和发布门禁。长期领域设计见 [CCR Plugin 接入与产品化设计](./plugin-system-product-design.md)，源码证据见 [Plugin 系统源码证据索引](../references/plugin-system-source-evidence.md)。

## 1. 当前结论

Plugin 产品化 P0-P12 已形成一条统一主链：

```text
CLI / Ink / Desktop / App Server
  -> PluginDomainAdapter / Plugin Core
  -> immutable plan
  -> confirmation
  -> apply
  -> journal transaction
  -> operation terminal state
  -> explicit runtime activation
```

所有已落地的 Plugin 写操作都经过同一领域计划和执行器。本地文件夹导入、压缩包导入、启用、禁用、修复、卸载、更新和回滚都不绕过 plan/apply 主链。Capability Catalog 继续只负责发现、关系和管理入口投影，不执行 Plugin 生命周期动作。

## 2. 入口收口

| 入口 | 收口方式 | 保留边界 |
| --- | --- | --- |
| Core | `createCcrCore().plugins` 是计划、执行和查询权威 | 不依赖 UI 状态 |
| App Server | 独立 `plugins/*` 协议映射 Core | 不进入通用 Capability action switch |
| Desktop | `pluginManagementClient` 只消费协议 DTO | Renderer 不推导领域 effects |
| CLI / Ink | `pluginOperations.ts` 是薄兼容 facade，委托 `PluginDomainAdapter` | 保留既有命令和交互，不保留旧写编排 |
| 推荐与启动检查 | 调用同一 adapter / facade | 不直接写 settings、cache 或安装记录 |
| built-in Plugin | 使用显式命名的 built-in intent adapter | 仅处理没有安装记录的内置 Plugin，不作为失败 fallback |

新路径失败时必须显式失败，不允许回到 settings-first、cache-first 或直接修改安装记录的旧实现。

## 3. 数据与协议兼容

| 对象 | 当前兼容策略 |
| --- | --- |
| Plugin manifest | 本地包导入支持根目录 `plugin.json`；导入事务规范化为内部 `.claude-plugin/plugin.json`；两者继续使用同一 Zod schema |
| Plugin identity | 继续使用 `plugin@marketplace`；bare name 只有唯一匹配时才可解析 |
| Marketplace | 保留现有来源配置、known marketplaces 和缓存布局作为兼容数据；Desktop 当前不提供远程 Marketplace 主浏览入口 |
| 安装记录 | 读取 V1/V2；首次事务写入时将 V1 原子迁移为 V2 |
| 旧 V2 文件 | 检测到 `installed_plugins_v2.json` 时合并到主安装记录后原子写回 |
| 未知 schema/version | 显式拒绝并返回诊断，不猜测、不静默降级 |
| Plugin action plan | 保持不可变计划、状态摘要、确认 token、过期和单次消费语义 |
| operation | 保持持久化终态、取消和恢复语义 |

V1 到 V2 的迁移只发生在事务写边界。只读 catalog、inspect 和 diagnostics 不修改用户数据。

## 4. 三类回滚必须分开

### 4.1 CCR 应用回滚

CCR 应用回滚是 CLI / Desktop / App Server 自身版本回退。它通过发布包、安装器或包管理器完成，不自动修改已安装 Plugin 包，也不伪造 Plugin runtime 状态。

### 4.2 Plugin 包回滚

Plugin 包回滚是把某个安装实例切换到 retention 中保留的精确版本。它必须经过 plan、确认、事务提交和引用感知 GC。成功只表示安装记录和磁盘物化版本已改变，不表示当前运行时已经激活该版本。

### 4.3 运行时激活与宿主重启

运行时激活由 `PluginRuntimeActivator` 和宿主 adapter 显式执行。组件级失败保留旧 runtime snapshot，并返回 partial、restart-required 或 unavailable 诊断。激活失败不反向改写已安装包，也不触发 CCR 应用回滚。

不变式：

```text
CCR version rollback
  != Plugin package rollback
  != runtime activation / restart
```

## 5. 发布门禁

P12 发布收口至少执行：

```powershell
npm.cmd run smoke:plugin-release
npm.cmd run smoke:external-extension-matrix
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd run smoke:desktop-release-gate
git diff --check
```

`smoke:plugin-release` 包含 Core/Desktop 类型检查、Core/Desktop build 和 Plugin 产品化矩阵。Plugin 产品化矩阵当前登记 76 项用例、42 个异常场景、14 条最终不变式和 18 条真实 evidence script。

2026-06-08 收口结果：

- `smoke:plugin-release` 通过。
- `smoke:external-extension-matrix` 通过，共 85 cases。
- `smoke:mcp-release`、`smoke:skill-release` 和 `smoke:desktop-release-gate` 通过。
- `git diff --check` 通过。

2026-06-12 发布前补充：

- Desktop Plugin 产品口径收敛为本地 Plugin 包管理，不再把远程 Marketplace 当作当前主入口。
- 本地导入支持文件夹和压缩包两种方式，默认用户全局；支持根目录 `plugin.json` 和内部 `.claude-plugin/plugin.json`，导入后按内部结构规范化。
- Plugin 列表承载搜索和启停开关，详情页只保留图标操作和分区事实，避免“运行中 / 已启用”重复展示。
- 能力目录继续作为独立页面，Plugin 页面只展示 Plugin bundle 及其贡献关系。
- 发布前需继续执行 `smoke:plugin-release`、`smoke:external-extension-matrix`、`smoke:desktop-plugin-workbench` 和 `git diff --check`。

## 6. 兼容验证

P12 增加三组专项证据：

- `smoke:plugin-adapter-parity`：验证 Core 与 CLI / Ink adapter 对同一目标生成等价计划，并覆盖真实 install、enable、disable、update、uninstall。
- `smoke:plugin-registry-compatibility`：验证 V1 到 V2 迁移、旧 V2 文件合并和未知版本拒绝。
- `smoke:plugin-legacy-write-boundary`：验证生产入口不再调用旧 settings/cache/registry 直接写路径。

## 7. 后续边界

P0-P12 完成不代表所有 Plugin 生态能力都已结束。远程 Marketplace 浏览、远端 registry 新协议、更细粒度权限 enforcement、签名与供应链策略、跨设备同步等仍属于后续独立设计，不应在兼容层内以临时字段或静默 fallback 预埋。
