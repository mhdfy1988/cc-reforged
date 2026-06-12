# Plugin 系统源码证据索引

本文记录 CCR 当前 Plugin 系统的关键源码路径、已确认行为和对后续产品设计的约束。它只保存高信号证据，不替代源码本身。

权威设计见 [CCR Plugin 接入与产品化设计](../architecture/plugin-system-product-design.md)。

## 1. Manifest、本地导入与来源缓存

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/utils/plugins/schemas.ts` | `PluginManifestSchema` 已支持 metadata、dependencies、commands、agents、skills、hooks、outputStyles、channels、MCP、LSP、settings、userConfig | 复用现有 schema，不新增 `.ccr-plugin` |
| `src/utils/plugins/schemas.ts` | Plugin ID 使用 `plugin@marketplace`；Marketplace 支持多种远端和本地 source | 沿用现有身份和目录体系 |
| `src/utils/plugins/schemas.ts` | manifest 未知顶层字段会被 Zod 剥离；validate 命令使用 strict 模式提示作者 | CCR 扩展字段必须正式进入 schema |
| `src/services/plugins/pluginLocalImportService.ts` | 本地 Plugin 导入支持文件夹和压缩包；根目录 `plugin.json` 与 `.claude-plugin/plugin.json` 进入同一校验和规范化流程 | Desktop 当前只做本地包导入，不把远程 Marketplace 做成主浏览入口 |
| `src/utils/plugins/validatePlugin.ts` | 校验 manifest、Marketplace、路径穿越、版本差异和 frontmatter | 新 plan 复用验证器，不另写一套 |

## 2. 安装、作用域与版本

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/services/plugins/pluginOperations.ts` | 保留 CLI / Ink 兼容 API，但 Marketplace-backed install、uninstall、enable、disable、update 全部委托 `PluginDomainAdapter` | 旧入口是薄 facade，不再拥有第二套写逻辑 |
| `src/services/plugins/pluginDomainAdapter.ts` | 使用同一 `createCcrCore()` Plugin plan/confirm/apply/operation 主链，并绑定请求级 cwd/config home | CLI / Ink 与 Core、App Server、Desktop 保持计划语义一致 |
| `src/utils/plugins/pluginInstallationHelpers.ts` | 只保留路径和 identity 解析等只读工具 | settings-first、cache/register 直接写路径已退出生产入口 |
| `src/services/plugins/pluginInstallTransaction.ts` | 依赖闭包先 stage 和校验，再按 journal 提交缓存、安装记录和 intent | 避免部分失败留下假安装 |
| `src/utils/plugins/installedPluginsManager.ts` | V2 允许同一 Plugin 在 managed/user/project/local 多作用域安装不同版本 | 动作目标必须包含 scope/projectPath |
| `src/utils/plugins/installedPluginsManager.ts` | 存在进程级安装记录缓存和内存快照 | P1 必须按 config home/workspace 分区或移入请求级 repository |
| `src/services/plugins/pluginOperations.ts` | update 使用新版本缓存并更新磁盘安装记录，当前内存状态保持到重启 | 管理读模型增加 activeVersion/pendingActivation |
| `src/utils/plugins/cacheUtils.ts` | 旧版本无引用后标记 orphan | 回滚窗口和 GC 必须按引用管理 |

## 3. 依赖与安全

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/utils/plugins/dependencyResolver.ts` | 安装时 DFS 解析依赖、检测循环；加载时固定点降级缺依赖 Plugin | 依赖进入领域 plan 和 diagnostics |
| `src/utils/plugins/dependencyResolver.ts` | 跨 Marketplace 依赖默认阻止，只允许 root Marketplace 显式 allowlist | Desktop 安装确认展示信任边界 |
| `src/utils/plugins/pluginPolicy.ts` | managed policy 可阻止 Plugin | policy 状态进入读模型 |
| `src/utils/plugins/schemas.ts` | Marketplace 名称有官方来源和同形攻击防护 | 来源与信任进入详情页 |
| `src/utils/plugins/pluginInstallationHelpers.ts` | 本地来源使用 base path containment 校验 | 继续复用，不另造路径判断 |

## 4. 配置、密钥与数据

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/utils/plugins/pluginOptionsStorage.ts` | 普通配置写 settings，敏感配置写 secure storage | Desktop 配置分区不回显 secret |
| `src/utils/plugins/pluginOptionsStorage.ts` | 当前实现从 merged settings 读取后写回 user scope，代码内已有 project-scope 泄漏 TODO | P7 改为请求级、作用域明确的配置写入 |
| `src/utils/plugins/pluginOptionsStorage.ts` | options/secrets 主要按 pluginId 寻址，缓存未表达安装作用域 identity | P7 先冻结 user-global 与 scope-specific 配置归属 |
| `src/utils/plugins/pluginDirectories.ts` | Plugin data directory 跨版本保留，最后作用域卸载时才删除 | 卸载包和删除数据分开确认 |
| `src/services/plugins/pluginOperations.ts` | 最后作用域卸载时删除 options/secrets，可选择删除 data dir | 管理计划必须展示数据影响 |

## 5. 加载与当前会话激活

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/utils/plugins/pluginLoader.ts` | loader 从 settings、安装记录、cache、Marketplace 和 inline source 构建 LoadedPlugin | 读模型必须合并多层事实 |
| `src/utils/plugins/pluginLoader.ts` | loader 使用模块级 memoized snapshot，部分“只读加载”路径仍会更新 Plugin settings cache | P1/P2 必须建立隔离缓存和无副作用 Inspector |
| `src/utils/plugins/refresh.ts` | 明确三层：settings intent、磁盘 materialization、当前 AppState active components | 状态模型不能压成一个 enabled |
| `src/utils/plugins/refresh.ts` | refresh 更新 Command、Agent、Hook、MCP、LSP 和 AppState，但绑定 Ink/AppState 与进程级运行时 | P5 抽出 host-neutral PluginRuntimeActivator 和分组件诊断 |
| `src/types/plugin.ts` | PluginError 类型预留了 cache、manifest、dependency、MCP/LSP/Hook 等分类，但当前生产路径只稳定使用其中一部分 | P2 需要补错误归一化和具体 Plugin/安装实例/组件归属，不能把类型预留写成现状已覆盖 |

## 6. Capability 与 App 关系

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/services/capabilities/pluginCapabilityProvider.ts` | 当前只把 LoadedPlugin 投影为 bundle，并统计组件数量 | P2 增加候选、作用域、版本和激活事实 |
| `src/services/capabilities/managementProjectionService.ts` | Plugin 当前只有 inspect；通用 action target 不能表达作用域、版本、依赖闭包和删除选项 | P3 建立独立 Plugin plan/apply 协议，Capability 只引用领域计划 |
| `src/app-server/handlers/capabilityHandlers.ts` | apply 当前只执行 Skill 和 MCP Server 动作 | Plugin 动作不塞入通用分支，不走 allowedActions/actionRef 猜测 |
| `src/services/capabilities/appCapabilityProvider.ts` | App 状态来自会话级 registry，可关联 parentPluginId | manifest 只声明关系，连接状态仍来自 registry |
| `src/core/capabilityCore.ts` | 非当前 config home 的 Plugin snapshot 直接返回 unavailable | P1 请求级 PluginDomainContext 是前置条件 |

## 7. Desktop 当前基线

| 源码 | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `apps/desktop/src/renderer/src/components/pages/PluginsPage.tsx` | 当前产品形态是左侧本地 Plugin 列表、列表内搜索与启停开关、右侧详情和图标操作；不展示远程 Marketplace 主浏览列表 | Renderer 只消费 Plugin 独立协议，不派生领域 effects |
| `apps/desktop/src/renderer/src/domain/pluginManagementClient.ts` | catalog、inspect、本地导入、plan/apply、operation、runtime、config 和 App 关系统一通过 preload 调用 | Desktop 领域入口保持单一 client |
| `src/services/plugins/pluginLocalImportService.ts` | 文件夹/压缩包导入会先检查 manifest，再写入用户全局安装实例和本地 cache | 本地包导入是当前 Desktop Plugin 产品主入口 |
| `src/services/plugins/pluginMarketplaceService.ts` | Marketplace 来源兼容服务保留为领域能力；删除来源不删除已安装包 | 远程来源与已安装事实解耦，不作为当前 Desktop 主产品浏览入口 |
| `src/app-server/router.ts` | operation get/cancel 在生成 JSON-RPC response 前等待 handler 完成 | 禁止把异步结果序列化成 `{}`；参数错误留在协议错误边界内 |
| `apps/desktop/src/renderer/src/components/pages/CapabilitiesPage.tsx` | 能力目录已是独立菜单 | Plugin 页面不再承担全局能力目录 |
| `scripts/create-plugin-productization-acceptance-fixtures.mjs` | 生成临时 home、workspace、Marketplace、安装记录、运行时和诊断验收数据 | 视觉和真实 IPC/App Server 验收不污染用户配置 |

## 8. P11 生命周期与专项矩阵证据

| 源码 / smoke | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/services/plugins/pluginLifecycleTransaction.ts` | enable、disable、uninstall 使用作用域锁、journal 和幂等 reconciliation；卸载按 intent、registry、配置删除和 GC 分阶段提交 | 生命周期动作不再停在协议或 Desktop 按钮层 |
| `src/services/plugins/pluginActionService.ts` | 启停按目标作用域 intent 校验，不再用全局 effective enabled 误判；共享 data 只允许最后实例显式删除 | 多作用域动作身份和数据边界 |
| `scripts/smoke-plugin-lifecycle-transaction.mjs` | user/project/local 安装实例、继承 intent、配置/secret/data 删除选项、runtime 引用保护和最终 GC | 完整生命周期正反例 |
| `scripts/smoke-plugin-transaction-fault-matrix.mjs` | 安装与生命周期共 8 个 fault boundary；提交前无假状态，提交后可幂等恢复 | journal 与 reconciliation |
| `scripts/smoke-plugin-cross-process-lock.mjs` | 两个真实 Node 进程争抢同一 scope/workspace 时显式冲突，释放后可重新获取 | 跨进程并发控制 |
| `scripts/smoke-plugin-productization-sample.mjs` | Skill、MCP、App relation、普通配置、secret、依赖、启停、activation、update、rollback、uninstall 可组合工作 | P1-P10 组合验收 |
| `scripts/plugin-productization-test-cases.mjs` | P11 建立 70 项清单；P12 兼容收口后扩展为 76 项，覆盖 42 个异常场景和 14 条最终不变式正反例 | 最终覆盖率权威清单 |
| `scripts/smoke-plugin-productization-matrix.mjs` | 顺序执行 18 条领域、协议、Desktop、兼容和外部扩展证据 | Plugin 专项 release gate |

## 9. P12 兼容迁移证据

| 源码 / smoke | 已确认行为 | 设计落点 |
| --- | --- | --- |
| `src/services/plugins/pluginRegistryCompatibility.ts` | V1/V2 可读；首次事务写入将 V1 原子迁移为 V2，并合并旧 V2 文件；未知版本拒绝 | 数据兼容只发生在写边界，不污染只读查询 |
| `src/services/plugins/builtinPluginIntentAdapter.ts` | built-in Plugin 因无安装记录而使用显式 intent adapter | 特化边界可见，不成为 Marketplace-backed Plugin fallback |
| `scripts/smoke-plugin-adapter-parity.mjs` | Core 与 adapter 生成等价计划，并覆盖真实生命周期动作 | CLI / Ink 适配一致性 |
| `scripts/smoke-plugin-registry-compatibility.mjs` | 覆盖 V1 -> V2、旧 V2 合并和未知版本拒绝 | 迁移兼容证据 |
| `scripts/smoke-plugin-legacy-write-boundary.mjs` | facade、推荐和启动检查不再调用旧直接写路径 | No Silent Legacy Fallback |

## 10. 已确认的设计约束

1. 现有 Plugin 子系统是唯一写侧权威。
2. 不新增第二套 manifest、安装记录或 Marketplace。
3. Plugin 查询和动作必须请求级化。
4. Plugin 多作用域事实不能压成单个 actionRef。
5. 安装事务必须解决 settings-first 的部分失败。
6. 磁盘版本和当前会话版本必须分别展示。
7. App 连接状态不能由 manifest 推断。
8. Agent、Hook、LSP、Output Style、Channel、Settings 先作为运行时贡献清单，不强行升级为可调用 Capability。
9. 现有 policy、依赖、路径和 secret 边界必须复用。
10. 新 App Server 路径不得在失败时静默回退旧 Plugin 操作。
11. 管理查询必须无副作用，Marketplace refresh、repair 和 activation 必须是显式动作。
12. 安装、启用和 runtime activation 是三个独立状态变化。
13. Plugin 长操作必须有 journal、operation store、revision 与恢复语义。
14. Capability Catalog 只做统一发现和关系投影，不执行 Plugin 生命周期动作。

## 11. P0-P12 兼容入口清单

| 当前入口 | 当前职责 | P1-P12 处理方式 | 退出条件 |
| --- | --- | --- | --- |
| `src/utils/plugins/schemas.ts` 的 `PluginManifestSchema`、Marketplace 与 installed V2 schema | manifest、候选来源和安装记录运行时校验 | 保留为唯一 schema 权威，通过 adapter 注入请求级路径 | 不退出；只允许兼容升级 |
| `src/services/plugins/pluginOperations.ts` | CLI / Ink 兼容 facade | 已调用 `PluginDomainAdapter` 和同一 Core plan/apply | 已完成；不包含领域写编排 |
| `src/utils/plugins/pluginInstallationHelpers.ts` | 路径和 identity 只读工具 | settings-first 安装已由 journal transaction 替代 | 已完成；无生产入口直接调用旧写路径 |
| `src/utils/plugins/installedPluginsManager.ts` | V1/V2 迁移、安装记录读写和进程级缓存 | schema/migration 保留；P1 把读写和缓存移入 request-scoped repository | 所有新 Core 路径都不依赖未分区模块缓存 |
| `src/utils/plugins/pluginLoader.ts` | 组装 LoadedPlugin、处理来源和组件路径、维护模块级 memoize | loader 逻辑保留；P1/P2 增加隔离 cache 与无副作用 Inspector | 管理查询不再直接调用会写 cache/settings 的 loader 路径 |
| `src/utils/plugins/refresh.ts` | 清缓存并刷新 Ink AppState、Hook、MCP 和 LSP | P5 下沉为 host adapter，核心激活由 `PluginRuntimeActivator` 管理 | CLI / Ink 只保留 UI/AppState 映射 |
| `src/utils/plugins/pluginOptionsStorage.ts` 与 `mcpbHandler.ts` | Plugin 和 channel 配置、secret 存储 | P7 通过 options/secrets repository 明确配置 identity 和作用域 | 不再从 merged settings 整包写回 user scope |
| `src/services/plugins/pluginCliCommands.ts` | CLI 参数解析与调用 Plugin operations | 保留为入口 adapter | 文件内不再包含领域状态推导和写入编排 |
| `src/commands/plugin/*.tsx` | Ink 浏览、管理、信任提示和配置交互 | 保留交互与文案；领域判断迁入 Core service | Ink 组件只消费 DTO、plan 和 operation |
| `src/services/capabilities/pluginCapabilityProvider.ts` | 将 LoadedPlugin 投影成 Plugin capability bundle | P2 改为消费 Plugin management snapshot | 不再从 LoadedPlugin 推导安装和激活事实 |
| `src/services/capabilities/managementProjectionService.ts` | 统一管理页读投影，Plugin 当前只开放 inspect | 保留导航和关系投影 | 不增加 Plugin 生命周期执行分支 |
| `src/app-server/handlers/capabilityHandlers.ts` | Skill / MCP 的通用管理动作 handler | 保留现有领域；Plugin 使用独立 handler | Plugin 写动作不进入 capability action switch |
| `apps/desktop/.../PluginsPage.tsx` | 当前基础 Plugin 列表和子能力详情 | P9/P10 改为消费 Plugin 独立协议 | Renderer 不再自行推导 Plugin 状态和 effects |

兼容规则：

1. 旧入口在退出条件满足前可以存在，但只能显式作为 adapter 使用。
2. 新 Core 路径失败时不得调用旧写路径作为 fallback。
3. V1 安装记录迁移属于数据兼容，不属于业务 fallback，必须继续保留并覆盖测试。
4. CLI / Ink 的既有输出和交互在对应迁移 Goal 前保持稳定。
5. `.claude-plugin/plugin.json`、Marketplace 和 `installed_plugins.json` V2 不被新协议替代。
