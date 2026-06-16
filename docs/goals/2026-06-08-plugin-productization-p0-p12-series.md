# Goal Series：Plugin 产品化 P0-P12

状态：已完成（P0-P12，2026-06-08；2026-06-16 补齐本地导入、运行时刷新和子能力展示回归）。

权威设计：

- [CCR Plugin 接入与产品化设计](../architecture/plugin-system-product-design.md)
- [Plugin 系统源码证据索引](../references/plugin-system-source-evidence.md)
- [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)
- [Plugin 兼容迁移、回滚与发布收口](../architecture/plugin-system-compatibility-and-release.md)

本文把 Plugin 权威设计拆成可依次执行的阶段目标。P0-P12 已全部实现并完成阶段记录；长期架构和兼容发布口径仍以对应架构文档为权威。

2026-06-16 补充收口：

- 本地 Plugin 包导入支持文件夹和 zip archive，兼容根目录 `plugin.json` 与内部 `.claude-plugin/plugin.json`。
- Plugin runtime refresh 会清理 installed registry 缓存，避免导入或启停后 catalog / detail 仍读旧快照。
- Plugin 贡献的 Skill / MCP 在各自管理页补齐正文、资源、安全、包路径、server key、父 Plugin hidden reason 和只读动作边界。
- 本地导入包不展示只适用于 marketplace 重新物化的 repair 动作。
- 新增 `smoke:plugin-local-archive-import`、`smoke:plugin-mcp-relative-path`、`smoke:plugin-runtime-activator` 和 Desktop Plugin 工作台断言。

## 1. 背景

CCR 已经存在 `.claude-plugin/plugin.json`、Marketplace、多作用域安装记录、版本缓存、依赖解析、配置、CLI 管理和运行时加载能力。

当前缺口不是“没有 Plugin”，而是既有领域还没有形成可靠的请求级服务、事务、运行时激活协议和 Desktop 产品闭环：

- Plugin 查询仍受进程级 home、cwd 和模块缓存影响。
- 候选、作用域意图、安装实例、包物化、加载和运行时激活尚未形成统一读模型。
- 通用 Capability 动作无法表达 Plugin 的作用域、版本、依赖和长操作。
- 安装流程缺少覆盖 settings、安装记录和版本缓存的 journal 事务。
- refresh 仍绑定 CLI / Ink AppState，不能直接服务 App Server 和 Desktop。
- 配置归属、回滚版本保留、App 关系和 Desktop 管理边界尚未完全定型。

一句话口径：

```text
复用现有 Plugin 写侧权威；
先建立请求级会话和无副作用读模型；
再建立独立 Plugin 协议、事务和运行时激活；
最后接 Desktop、样例矩阵和发布迁移。
```

## 2. 执行规则

1. P0-P12 按依赖顺序执行，不把多个主要领域边界塞进同一个 active goal。
2. 开始某个 P Goal 时，直接创建或接续 Goal，不需要用户再次指定“使用 goal”。
3. 每次只能有一个 P Goal 处于执行中。
4. Goal 完成前必须补完成记录、验证证据和残留风险；不能只根据代码已写完标记完成。
5. 源码发生变化且 smoke 实际运行 `dist` 时，必须先执行 build。
6. 不允许新路径失败后静默回到旧 Plugin 实现。
7. Desktop 不得先复制临时 Plugin 状态判断等待后端补齐。
8. 查询接口不得触发 Marketplace refresh、repair、安装、settings 写入或 runtime 激活。
9. 安装、启用和运行时激活必须保持三个独立状态变化。
10. 发现权威设计需要调整时，先更新架构文档，再继续实现。

## 3. 总体不变式

- Plugin 领域只有一套 manifest、Marketplace、安装记录和版本缓存权威。
- Capability Catalog 统一发现和关系投影，不执行 Plugin 生命周期动作。
- Plugin 查询和动作绑定请求级 workspace、cwd、config home 和 runtime instance。
- 同一 Plugin 的不同作用域安装实例独立表达。
- intent、installation、materialization、loaded、active 不互相冒充。
- 所有管理查询无副作用。
- 安装不等于启用，启用不等于 runtime 已激活。
- Plugin disabled 后子能力 fail closed。
- App 连接状态只来自真实 App registry。
- Plugin 写操作先 plan，再确认 apply。
- 跨文件写入有 journal、revision 和幂等 reconciliation。
- rollback retention、runtime 引用和 operation 引用优先于 orphan GC。
- Desktop 只展示领域事实，不自行推导 effects。

## 4. 问题映射

| 编号 | 问题 | Goal |
| --- | --- | --- |
| PLG-01 | 进程级 home、cwd 和缓存导致跨请求串状态 | P1 |
| PLG-02 | 查询路径可能更新 cache/settings，不是纯读 | P1、P2 |
| PLG-03 | 全局布尔状态无法表达多作用域、多版本 | P2 |
| PLG-04 | Plugin 错误无法稳定归属到实例和组件 | P2 |
| PLG-05 | 通用 Capability action target 无法表达 Plugin effects | P3 |
| PLG-06 | settings-first 安装会留下假安装 | P4 |
| PLG-07 | 缺少并发冲突、journal 和崩溃恢复 | P4 |
| PLG-08 | refresh 绑定 Ink/AppState，部分失败语义不清 | P5 |
| PLG-09 | 依赖事实只依赖已加载快照，回滚版本可能被 GC | P6 |
| PLG-10 | 配置、密钥和数据的作用域归属不明确 | P7 |
| PLG-11 | Plugin 与 App 的提供、依赖、推荐、配置关系混淆 | P8 |
| PLG-12 | Desktop 尚未消费完整 Plugin 领域协议 | P9、P10 |
| PLG-13 | 缺少事务、并发、恢复和多作用域故障矩阵 | P11、P12 |

## 5. 依赖关系

```text
P0
  -> P1
     -> P2
        -> P3
           -> P4
           -> P5
           -> P6
           -> P7
           -> P8

P2 + P3 + P4 + P5 + P6 + P7 + P8
  -> P9

P4 + P6 + P7 + P8 + P9
  -> P10

P4 + P5 + P6 + P7 + P8 + P9 + P10
  -> P11

P11
  -> P12
```

P4-P8 可以在 P3 后分别推进，但 P9 必须等待它们提供真实领域结果。

## P0 设计权威与兼容基线

状态：已完成（2026-06-08）。

### 目标

冻结 Plugin 产品化的权威设计、现状证据、兼容入口和术语，确保后续实现不会再造第二套 Plugin 系统。

### 输入

- Plugin 产品设计文档。
- Plugin 源码证据索引。
- 当前 manifest、Marketplace、安装记录、缓存和 CLI 管理实现。

### 范围

- 核对 Plugin 设计与当前源码路径。
- 建立现有入口、计划保留入口、计划替换入口清单。
- 统一 candidate、intent、installation、materialization、loaded、active 等术语。
- 确认 `.claude-plugin/plugin.json` 和 `installed_plugins.json` V2 为唯一权威。
- 搜索并清理 `.ccr-plugin`、第二套安装数据库、虚构生命周期脚本等错误目标。

### 输出

- 冻结后的设计文档和源码证据索引。
- 兼容入口清单及淘汰条件。
- P1-P12 使用的术语与不变式基线。

### 非目标

- 不修改 Plugin 运行逻辑。
- 不新增协议和 Desktop 功能。
- 不删除仍被 CLI 使用的兼容入口。

### 验收

- 架构文档、Goal、README 和 CHANGELOG 不再互相矛盾。
- 搜索不到把 `.ccr-plugin/plugin.json` 或第二套安装数据库写成实施目标的当前文档。
- 每个 legacy 入口都有明确保留原因和退出条件。

### 建议验证

```powershell
git diff --check
```

### 完成记录

- 已确认 `.claude-plugin/plugin.json`、Marketplace schema 和 `installed_plugins.json` V2 是唯一 manifest、候选与安装记录权威。
- 已确认 `pluginOperations.ts` 是当前领域写入口，`pluginInstallationHelpers.ts` 的 settings-first 路径由 P4 替换，不作为新路径 fallback。
- 已确认 `pluginCliCommands.ts` 与 `src/commands/plugin/*.tsx` 保留为入口 adapter，后续只迁移领域判断和写入编排。
- 已确认 Capability Catalog 只做统一发现和关系投影，Plugin 生命周期使用独立 Plugin plan/apply。
- 已在源码证据索引增加 P0 兼容入口、处理方式和退出条件清单。
- 已同步扩展运行时 roadmap 中 P1-P11 的新口径。
- 已检查当前文档中的 `.ccr-plugin`、第二套安装数据库和生命周期脚本表述；命中均为明确的禁止项、历史纠正或验收反例，不再作为实施目标。

验证：

```text
git diff --check
文档相对链接检查通过
Plugin Goal 数量检查：P0-P12 共 13 个
```

## P1 请求级 Plugin 会话、路径端口与缓存隔离

状态：已完成（2026-06-08）。

### 目标

建立 `PluginDomainSession`，让 Plugin 查询和动作不再隐式依赖进程级 home、cwd、环境和未分区缓存。

### 输入

- `CapabilityRuntimeEnvironment`。
- settings、Marketplace、installed registry、cache、options、secrets 和 runtime snapshot 现有实现。

### 范围

- 定义 `PluginDomainContext` 与 `PluginDomainSession`。
- 区分 `workspaceRoot` 和 `currentCwd`。
- 注入 `configHomeDir`、`runtimeInstanceId`、`requestId` 和环境覆盖。
- 抽出路径解析、settings、安装记录、Marketplace、包缓存、配置、密钥和 runtime snapshot 端口。
- 清理或分区模块级 loader、installed registry 和 options 缓存。
- 为 CLI / Ink 建立显式当前进程 adapter。

### 输出

- 请求级 Plugin 会话工厂。
- 可替换的领域 repository/port。
- 按 home、workspace、runtime instance 隔离的缓存策略。

### 非目标

- 不建立完整管理读模型。
- 不修改安装事务。
- 不改 Desktop 页面。

### 验收

- 同一进程查询两个 config home，结果不串。
- 同一 home 查询两个 workspace，project/local 结果不串。
- Core / App Server 新路径不读取进程级 home fallback。
- Plugin 查询不会因为另一个请求清理缓存而改变结果。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:capability-runtime-environment
git diff --check
```

### 完成记录

- 新增 `PluginDomainContext`、`PluginDomainSession` 和显式 `PluginPathResolver`，请求必须提供 workspace、cwd、config home 和 runtime instance。
- settings、安装记录、Marketplace、包检查、options、secrets 和 runtime snapshot 已抽成可替换 repository/port。
- 默认文件 repository 只读取显式路径；项目级配置使用 CCR 的 `.ccr/settings.json` 与 `.ccr/settings.local.json`。
- loader、安装记录和 settings 的模块全局缓存不再进入 Core / App Server 新查询路径；每个 session 只缓存自身只读 snapshot。
- 新增 `createCurrentProcessPluginDomainSession()`，CLI / Ink 后续可显式适配当前进程，不把进程状态藏进领域服务。
- `capabilityCore` 已使用请求级 Plugin session；删除异 home unavailable 占位和旧 loader 静默 fallback。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-domain-session
npm.cmd run smoke:capability-runtime-environment
git diff --check
```

## P2 无副作用 Inspector 与多实例管理读模型

状态：已完成（2026-06-08）。

### 目标

建立只读 `PluginInspector` 和多实例 `PluginManagementRecord`，完整表达 Plugin 的各层事实。

### 输入

- P1 的 `PluginDomainSession`。
- Marketplace candidate、settings intent、V2 installation、cache、loader 和 runtime snapshot。

### 范围

- 建立 `PluginCandidate`、`PluginInstallationInstance`、`PluginIntentByScope`、`PluginRuntimeActivation`。
- 建立 `PluginCatalogSnapshot` 与派生状态 resolver。
- 将 builtin、inline、managed、Marketplace Plugin 分别表达。
- 将错误归属到 Plugin、安装实例、组件和事实层。
- 禁止 Inspector 更新 settings、Marketplace、cache 或 runtime。
- 支持 Marketplace 离线和 runtime 未启动时的本地检查。

### 输出

- 无副作用 `PluginInspector`。
- 多作用域、多版本 Plugin 管理读模型。
- 可解释的 diagnostics 和 derived state。

### 非目标

- 不执行修复。
- 不执行 Plugin 生命周期动作。
- 不根据诊断自动改写 settings。

### 验收

- 多作用域、多版本、cache miss、load error 和 pending activation 可区分。
- 同名不同来源 Plugin 不按 display name 合并。
- 读取前后 settings、安装记录和 runtime snapshot 不发生变化。
- 失败 Plugin 仍作为具体记录出现，不聚合成虚构 catalog error Plugin。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
git diff --check
```

### 完成记录

- 新增无副作用 `PluginInspector`、`PluginCatalogSnapshot`、`PluginManagementRecord` 和候选、安装实例、作用域意图、运行时激活等领域事实类型。
- 安装实例按作用域、workspace、版本和包路径独立保留；project/local 安装只对匹配 workspace 生效。
- `present`、`missing`、`drifted`、`invalid` 物化状态与 enabled、active、pending activation 分开派生。
- 同名不同来源继续使用完整 `plugin@source` 身份，不按 display name 合并。
- builtin 与 inline Plugin 可由 runtime snapshot 端口注入并独立标识；Marketplace 离线或 runtime 未启动时仍可返回本地 settings、registry 和 package 事实。
- Plugin 诊断附着到具体 record / installation；Capability Provider 消费管理记录，不再为新路径生成虚构 `plugin:catalog-errors`。
- 新增 `smoke:plugin-domain-session`，覆盖双 home、双 workspace、多作用域、多来源、缺包、快照稳定、查询无写入和 builtin/inline runtime 事实。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-domain-session
npm.cmd run smoke:capability-catalog-plugin-relations
npm.cmd run smoke:external-extension-matrix
git diff --check
```

## P3 Plugin 独立协议与领域 plan / apply

状态：已完成（2026-06-08）。

### 目标

建立独立 Plugin App Server 协议和不可变 plan/apply 契约，Capability 管理层只引用 Plugin 领域计划。

### 输入

- P1 请求级会话。
- P2 管理读模型。
- 现有 Plugin operations 和 App Server capability handlers。

### 范围

- 增加 `plugins/catalog/list` 和 `plugins/inspect`。
- 增加 `plugins/action/plan` 和 `plugins/action/apply`。
- 增加 operation 查询和取消协议外形。
- 建立结构化 `PluginActionTarget`。
- plan 包含 revisions、依赖、effects、风险、删除选项、过期时间和确认。
- apply 只接受 `planId + confirmation`。
- Capability projection 返回 Plugin action link，不自行构造 effects。

### 输出

- Plugin 领域协议 DTO 和 handler/client 边界。
- Plugin action planner 与 apply guard。
- 兼容 CLI adapter 接口。

### 非目标

- 不在 P3 完成真实安装事务。
- 不让通用 Capability handler 增长为 Plugin 巨型分支。
- 不由 Desktop 生成领域 effects。

### 验收

- 非法作用域、陈旧 revision、过期 plan 和被篡改 target fail closed。
- plan 与 apply 使用同一请求上下文。
- Capability 层无法绕过 Plugin plan 直接执行安装或卸载。
- 重复 confirmation token 不可复用。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:capability-management-confirmation-token
npm.cmd run smoke:capability-api
git diff --check
```

### 完成记录

- 新增独立 `plugins/catalog/list`、`plugins/inspect`、`plugins/action/plan`、`plugins/action/apply`、`plugins/operation/get` 和 `plugins/operation/cancel` App Server 协议。
- 新增结构化 `PluginActionTarget`、不可变 action plan、effects、risks、delete options、revision、过期时间和确认 token。
- apply 协议只接受 `planId` 与确认信息；目标和 effects 从 Core 内保存的 plan 读取，调用方篡改返回 DTO 不会改变服务端计划。
- apply 前重新读取请求级 Plugin catalog 并比较 revision；状态变化、过期、非法作用域、错误 token 和重复 apply 均 fail closed。
- 新增 operation store 外形和协作式取消边界；commit 开始后不再允许取消。
- Capability 管理投影只返回 `domainActionLink`，Plugin 生命周期动作仍只允许通过独立 Plugin planner。
- 真实写事务通过 `PluginActionExecutor` 端口接入；P3 默认执行器显式报 unavailable，不伪装成功，也不回退旧路径。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-action-protocol
npm.cmd run smoke:capability-management-confirmation-token
npm.cmd run smoke:capability-api
npm.cmd run smoke:plugin-domain-session
git diff --check
```

## P4 Journal、并发控制与安装事务

状态：已完成（2026-06-08）。

### 目标

建立覆盖依赖闭包、版本缓存、安装记录和 settings intent 的可恢复安装事务。

### 输入

- P3 Plugin plan/apply。
- 现有安装、缓存和安装记录实现。
- 文件原子写入能力。

### 范围

- 全量 stage 主 Plugin 和依赖闭包。
- 提交前完成 manifest、来源、policy、完整性和可加载校验。
- 增加 operation journal 和持久化 operation store。
- 增加作用域锁或 optimistic revision。
- 定义每个提交边界和 reconciliation。
- 让 reconciliation 幂等。
- 将安装与启用拆开，Desktop 默认安装后保持 disabled。
- 明确 operation 取消边界。

### 输出

- `PluginInstallTransaction` 或等价领域服务。
- Journal schema、operation store 和恢复器。
- 并发冲突错误与诊断。

### 非目标

- 不实现运行时热激活。
- 不实现完整更新和回滚。
- 不以旧 settings-first 路径作为异常 fallback。

### 验收

- 下载、依赖或校验失败不会留下假安装。
- 每个提交边界故障后都能恢复或显式 reconciliation。
- 两个并发 apply 不会静默覆盖。
- 重复恢复不会重复安装、重复启用或误删版本。
- 安装完成后仅在 plan 明确要求时继续启用。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
git diff --check
```

### 完成记录

- `PluginActionPlan` 已固化主 Plugin 与依赖闭包的 Marketplace source、版本、strict 规则和目标作用域；apply 不再重新猜测候选。
- 新增 `PluginInstallTransaction`，先将全部包写入 request-scoped staging，并在提交前完成 manifest、名称和可加载校验。
- 新增作用域文件锁；同一 config home、scope 和 workspace 的并发写显式返回 `plugin-operation-conflict`，不会静默覆盖。
- 新增原子 JSON 写入、operation store、安装 journal 和幂等 reconciliation；operation 最终状态可在 App Server/Core 重启后按显式 config home 查询。
- 提交边界固定为版本缓存、V2 安装记录和可选 intent；提交后故障保留 `reconciliation-required` journal，重复恢复不会重复安装或重复写入。
- 安装默认 `enableAfterInstall=false`；只有 plan 显式设置时才在安装记录提交后写入目标作用域 intent。
- V1 安装记录不会被事务路径静默改写；新路径明确返回 migration-required，旧 settings-first 安装也未作为失败 fallback。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-install-transaction
npm.cmd run smoke:plugin-action-protocol
npm.cmd run smoke:plugin-domain-session
npm.cmd run smoke:capability-api
npm.cmd run smoke:external-extension-matrix
git diff --check
```

## P5 PluginRuntimeActivator 与组件级刷新

状态：已完成。

### 目标

抽出与 Ink/AppState 解耦的 `PluginRuntimeActivator`，准确表达 installed、enabled、active 和 restart-required。

### 输入

- P2 runtime activation 读模型。
- P3 Plugin activation plan。
- 现有 refresh、MCP、LSP、Hook、Command、Agent 和 Skill runtime。

### 范围

- 建立 activation plan/result。
- 绑定 `runtimeInstanceId` 和 `activationRevision`。
- 分别处理 Command、Agent、Skill、Hook、MCP、LSP、Channel、Output Style。
- 定义每类组件的旧快照保留、部分失败和重启要求。
- 让 CLI / Ink 和 App Server 使用 host adapter。
- 激活结果回写 runtime snapshot，不改写安装事实。

### 输出

- Host-neutral `PluginRuntimeActivator`。
- 组件级激活结果和 diagnostics。
- pending/partial/restart-required 状态。

### 非目标

- 不保证所有组件都支持热刷新。
- 不让激活失败回滚磁盘安装事务。
- 不把不同 runtime host 合并成全局单例。

### 验收

- 新快照构建失败不会先清空仍有效旧组件。
- MCP/LSP 单组件失败不会伪装成整体成功。
- 页面能区分已安装、已启用待激活、部分激活和需要重启。
- 不同 runtime instance 的 activeVersion 不串。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
git diff --check
```

### 完成记录

- 新增 host-neutral `PluginRuntimeActivator`，激活流程固定为 prepare、commit、原子写入 runtime snapshot；prepare 或 commit 失败时保留上一份有效快照。
- runtime snapshot 按 `configHomeDir + runtimeInstanceId` 隔离，激活结果绑定稳定 `activationRevision`，不同宿主实例不会串 active version。
- Command、Agent、Skill、Hook、MCP、LSP、Channel 和 Output Style 使用组件级结果；MCP/LSP/Hook 可表达局部失败，Channel/Output Style 明确标记 `restart-required`。
- Plugin 管理读模型新增 `active-partial` 和 `restart-required` 派生状态，安装事实、启用 intent 与运行时事实保持分离。
- CLI / Ink 的当前进程 refresh 已通过 runtime host adapter 接入；App Server 新增 `plugins/runtime/activate` 与 `plugins/runtime/get`，宿主必须显式注入 adapter，未注入时返回 `plugin-runtime-host-unavailable`，不会回退进程全局 home 或旧 refresh。
- runtime snapshot 只在新宿主状态成功提交后写入，不改写 settings 或安装记录。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-runtime-activator
npm.cmd run smoke:plugin-domain-session
npm.cmd run smoke:external-extension-matrix
git diff --check
```

## P6 依赖、更新与回滚

状态：已完成。

### 目标

让依赖、更新和回滚使用候选与安装 manifest 的完整事实，并建立可靠的版本保留规则。

### 输入

- P2 多实例读模型。
- P3 plan/apply。
- P4 journal 事务。
- P5 runtime activation。

### 范围

- 依赖图读取 candidate/installed manifest，不只使用 `LoadedPlugin[]`。
- 将直接依赖、反向依赖和跨 Marketplace 信任进入 plan。
- 更新采用非原地版本缓存和 journal commit。
- 建立 rollback retention record。
- GC 同时检查 installation、runtime、operation 和 rollback 引用。
- 明确当前 semver 支持边界。

### 输出

- 依赖图和影响分析服务。
- 更新与回滚计划。
- Retention/GC 引用模型。

### 非目标

- 不宣称完整 semver 求解。
- 不自动更新 Plugin。
- 不在没有缓存版本时伪造可回滚。

### 验收

- 已安装但禁用或加载失败的 Plugin 仍进入反向依赖分析。
- 回滚候选在保留窗口内不会被 GC。
- runtime 或 operation 正在引用的版本不会被删除。
- 更新写盘后 activeVersion 仍准确反映当前 runtime。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
git diff --check
```

### 完成记录

- 新增 `PluginDependencyAnalysis`，从 Marketplace candidate 与全部安装实例 manifest 构建直接依赖、传递依赖、反向依赖和跨 Marketplace 信任边；禁用、缺包或加载失败的安装实例不会从影响分析中消失。
- Plugin action plan 现在携带直接依赖、依赖闭包、反向依赖、跨 Marketplace trust edge 和明确的 `exact-version-only` semver 支持边界。
- 更新、修复和回滚复用 P4 的 stage、校验、锁、journal 和安装记录提交事务；更新使用非原地版本缓存，回滚只接受已存在且重新校验通过的精确缓存版本。
- 更新或回滚切换安装记录前会写入 rollback retention record；旧版本默认保留七天，不因当前安装记录切换而立即进入 GC。
- 新增 Plugin cache GC 引用模型，同时检查 installation、runtime activation、pending/running operation、未完成 journal 和未过期 rollback retention。
- 更新写盘不会改写 runtime snapshot；当前会话继续准确显示旧 `activeVersion`，直到宿主显式激活新版本。
- 修复 operation 终态持久化竞态：最终状态先原子写入 operation store，再发布到内存查询，Core 重启不会在成功返回后读到旧 `running`。
- 依赖 version range 当前只保留声明兼容性，不进行完整范围求解，也不在产品口径中声称支持。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-version-lifecycle
npm.cmd run smoke:plugin-install-transaction
npm.cmd run smoke:plugin-action-protocol
npm.cmd run smoke:plugin-runtime-activator
npm.cmd run smoke:external-extension-matrix
git diff --check
```

## P7 配置、密钥与数据治理

状态：已完成。

### 目标

冻结 Plugin 配置、密钥和数据的归属、覆盖、删除与迁移规则。

### 输入

- P1 options/secrets repository。
- P2 安装实例和配置状态。
- 现有 Plugin options、MCP channel config 和 secure storage。

### 范围

- 区分 user-global 与 scope-specific 配置。
- 配置 identity 包含必要的 scope/project 信息。
- 展示值来源和覆盖层。
- 写入只修改用户选择的目标层。
- secret 不进入 project settings，空敏感字段保留旧值。
- 卸载包、删除配置、删除密钥、删除数据分别确认。
- 定义 schema 变化和 secret migration 诊断。

### 输出

- 配置归属和 precedence 契约。
- 请求级 options/secrets repository。
- 数据删除计划和确认 DTO。

### 非目标

- 不回显 secret。
- 不在卸载最后实例时默认删除数据。
- 不把 merged settings 整包写回 user scope。

### 验收

- 两个 config home 的配置和密钥不串。
- user/project/local 配置来源和有效值可解释。
- secure storage 失败不会误标 configured。
- 默认卸载保留 Plugin data。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
git diff --check
```

### 完成记录

- 新增请求级 Plugin 配置服务与 `plugins/config/get|save|delete` App Server 协议，所有读写绑定显式 `workspaceRoot/configHomeDir`。
- 普通配置按 user、project、local 三层独立读取和写入；保存只修改用户选择的目标 settings 文件，不再从 merged settings 整包回写 user scope。
- user 配置归 config home；project/local 普通配置归 workspace。同一 workspace 切换 config home 仍可见项目层，但用户层和密钥严格隔离。
- 敏感字段按 manifest `userConfig.sensitive` 自动分流到凭据存储，不会进入 project/local settings；project/local secret 使用 `pluginId + scope + workspace hash` identity。
- 空敏感字段表示保留旧值，不会在重新配置时清空已有 secret；读取 API 只返回 configured、key count、storage identity 和诊断，不回显 secret。
- 凭据文件读取失败时返回 `plugin-secret-storage-unavailable` 且 `configured=false`，不会把不可读状态误标成已配置。
- 配置 schema 变化、陈旧 key 和 settings 中出现敏感字段均产生结构化诊断。
- options、secrets 和 Plugin data 使用三个独立删除选项；默认删除配置或卸载计划不会顺带删除 data。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-configuration-governance
npm.cmd run smoke:plugin-version-lifecycle
npm.cmd run smoke:plugin-action-protocol
npm.cmd run smoke:external-extension-matrix
git diff --check
```

## P8 App 关系语义、注册桥接与生命周期

状态：已完成。

### 目标

明确 Plugin 与 App 的关系种类、注册所有权和生命周期，再落地最小 manifest 扩展。

### 输入

- 现有 `AppCapabilityRegistry`。
- P2 Plugin 关系读模型。
- P3 Plugin protocol。

### 范围

- 定义 `provides/requires/suggests/configures`。
- 定义 App identity 和冲突规则。
- 建立宿主 App registration adapter。
- 定义 Plugin 禁用、卸载和 App 状态变化的传播。
- 定义未注册 App、needs-auth、disabled、disconnected。
- 最后增加并校验 `ccr.apps` schema。

### 输出

- App relation DTO。
- Plugin App registration adapter。
- Manifest schema 与关系投影。

### 非目标

- 不由 manifest 伪造 connected。
- 不让 requires/suggests/configures 关系注册或卸载宿主 App。
- 不新增内置浏览器或让 Plugin 获取浏览器 cookie。

### 验收

- 未注册 App 不显示为 connected。
- 非 provides 关系不会取得 App ownership。
- Plugin disabled、App needs-auth 和 App disconnected 可区分。
- App 实体由真实 registry 管理，manifest 只声明关系。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-capability-registry-lifecycle
npm.cmd run smoke:capability-identity-relations
git diff --check
```

### 完成记录

- Plugin manifest 新增经过 Zod 校验的最小 `ccr.apps` 扩展，关系只允许 `provides/requires/suggests/configures`，未知顶层关系字段不会静默进入领域模型。
- Plugin 管理读模型新增 App relation DTO；manifest 只声明 identity、关系和展示/子能力引用，不生成 connected、needs-auth 等运行时事实。
- 新增 `PluginAppRelationProjection`，将 manifest 关系与会话级 `AppCapabilityRegistry` 快照合并为 unregistered、connected、needs-auth、disabled、disconnected 状态。
- 新增 `PluginAppRegistrationAdapter` 与 `plugins/apps/register|unregister|list` 协议；只有 `provides` 关系可注册并取得 Plugin ownership，其他关系无法注册或卸载宿主 App。
- App registry upsert 新增 owner conflict 检查；同一 App identity 不允许在无 owner、其他 Plugin owner 和当前 Plugin owner之间静默覆盖。
- Plugin 清理只删除 `parentPluginId/pluginId` 确认属于该 Plugin 的 App，requires/suggests/configures 关联的宿主 App继续保留。
- App auth 状态增加 disconnected；Plugin disabled、App needs-auth、App disabled 和 App disconnected 使用不同诊断和 hidden reason 传播。
- 父 Plugin 禁用通过 App 向子能力传播 `plugin-disabled`，不会被二次误标成 `app-disabled`。

验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-app-relations
npm.cmd run smoke:app-capability-registry-lifecycle
npm.cmd run smoke:capability-identity-relations
npm.cmd run smoke:external-extension-matrix
git diff --check
```

## P9 Desktop 已安装管理

状态：已完成。

### 目标

建立左侧列表、右侧详情的完整已安装 Plugin 工作台，并只消费 Plugin 领域协议。

### 输入

- P2 管理读模型。
- P3 Plugin protocol。
- P4-P8 的事务、激活、依赖、配置和 App 结果。

### 范围

- 已安装 Plugin 列表、搜索、筛选和作用域状态。
- 概览、能力、运行时贡献、配置、依赖更新、安全来源和诊断分区。
- 安装实例和 installed/active/candidate/rollback version 展示。
- 动态操作区和 operation 状态。
- 整行选择、控制点击隔离、独立滚动和窄屏布局。
- Marketplace 离线时仍可管理本地 Plugin。

### 输出

- Desktop Plugin 已安装工作台。
- Plugin protocol renderer client。
- 定向 Desktop smoke 和视觉验收记录。

### 非目标

- 不在 Renderer 推导 Plugin effects。
- 不用静态 fixture 接入生产导航冒充已实现。
- 不承担全局能力目录职责。

### 验收

- Plugin 不依赖 child capability 存在才能显示。
- installed、enabled、active、partial、restart-required 文案准确。
- 列表和详情拥有稳定高度与滚动边界。
- 所有动作通过 Plugin domain protocol。
- 窄屏和常用桌面尺寸无重叠或无限增长。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-release-gate
git diff --check
```

完成后使用 in-app Browser 对实际 Desktop 页面做截图和交互验证。

### 完成记录

- 解决问题：Desktop Plugin 页面不再消费 Capability 管理投影，也不再依赖子能力存在才能展示父 Plugin；已安装、启用、运行、部分激活、需重启、缺包和更新状态均来自 Plugin 领域读模型。
- 权威输入输出：Renderer 通过独立 `pluginManagementClient` 消费 `plugins/catalog/list`、`plugins/inspect`、`plugins/runtime/get`、`plugins/config/get`、`plugins/apps/list`、`plugins/action/plan|apply` 和 operation 协议；Renderer 不推导依赖、风险或运行时 effects。
- 请求级 context：Desktop 主进程只补当前 workspace `cwd`，App Server 继续解析显式 config home 和 `runtimeInstanceId=app-server`；Plugin Inspector 按请求读取安装、Marketplace、配置、密钥、运行时和 rollback retention。
- 状态与恢复：所有写动作先生成不可变 plan，危险动作在页面内确认后 apply；长操作展示 operation ID、阶段、状态、错误和取消入口，终态后重新拉取 catalog 与详情。
- 用户可见变化：形成左侧 Plugin 列表、右侧七分区详情的 Plugin 工作台；搜索和启停进入左侧列表，详情区只放图标操作和分区事实，支持更新、修复、卸载、回滚、配置事实、依赖、App 关系、安全来源和诊断展示。
- 验收夹具：新增 `fixtures:desktop-plugin`，仅在临时目录生成已安装、停用、缺包、部分激活、需重启、候选更新、回滚版本、配置、secret、依赖和 App relation 数据，不接入生产导航。
- 自动验证：`npm.cmd run typecheck`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run desktop:build`、`npm.cmd run smoke:desktop-plugin-workbench`、`npm.cmd run smoke:plugin-version-lifecycle`、`npm.cmd run smoke:plugin-app-relations`、`npm.cmd run smoke:plugin-action-protocol`、`git diff --check` 通过。
- 视觉验证：使用独立临时 `CCR_CONFIG_DIR` 和 Electron user-data 验收实例验证真实 preload/App Server 链路；`1536x834` 下列表与详情稳定，`900x720` 下无横向溢出，列表和详情保持独立滚动，七个详情分区和更新 plan 确认可用。
- 残留范围：本地 Plugin 包导入和安装流程留给 P10；P9 不在 Renderer 复制安装解析或来源状态机。

## P10 Desktop 本地包导入与安装

状态：已完成（2026-06-08）。

### 目标

在 Plugin 工作台中增加本地 Plugin 包导入、安装计划确认和安装结果刷新。

### 输入

- P4 安装事务。
- P6 依赖和版本影响。
- P7 配置需求。
- P8 App relation。
- P9 Desktop 工作台。

### 范围

- 本地文件夹和压缩包导入。
- 根目录 `plugin.json` 与内部 `.claude-plugin/plugin.json` 兼容检查。
- Plugin 详情、组件预览和信任提示。
- 安装作用域默认用户全局。
- 依赖闭包、风险、配置、App 和激活选项确认。
- 安装 operation 进度、失败和 reconciliation。

### 输出

- Desktop Plugin 本地包导入与安装流程。
- 安装确认和 operation UI。
- 本地包缺 manifest、坏压缩包、坏 manifest 和重复安装错误状态。

### 非目标

- 不自动启用或激活，除非 plan 明确选择。
- 不以浏览失败阻断已安装管理。
- 不在 Desktop 重写依赖解析。
- 不把 GitHub、Git、URL 或远程 Marketplace 浏览作为当前产品入口。

### 验收

- apply 前可见来源、作用域、依赖、风险、配置和激活选择。
- 安装失败能显示阶段、operation ID 和恢复建议。
- 本地包不可用时已安装页仍正常。
- 信任提示复用领域事实，不复制 CLI 页面状态机。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-release-gate
git diff --check
```

完成后使用 in-app Browser 验证本地导入、安装确认、失败状态和滚动布局。

### 完成记录

- 解决问题：补齐 PLG-12 的 Desktop 产品闭环；Plugin 工作台现在提供本地文件夹和压缩包导入，导入失败不会阻断已安装 Plugin 管理。
- 权威输入输出：Desktop 通过 `pluginManagementClient` 消费请求级本地导入、catalog、inspect、plan/apply 和 operation 协议；依赖闭包、风险、配置、App 关系、作用域和默认激活选择均来自 Core plan。
- 本地导入管理：新增本地文件夹和压缩包导入；根目录 `plugin.json` 与 `.claude-plugin/plugin.json` 均进入同一检查流程，导入后默认用户全局并规范化到内部结构。
- 状态变化：导入默认只安装，不自动启用、不自动激活；安装成功后 operation 进入 `succeeded/completed`，catalog 刷新后新增实例可在左侧 Plugin 列表中选中和启停。
- 操作与恢复：安装计划在 apply 前展示来源、作用域、依赖闭包、风险、配置和 App；operation UI 展示 ID、阶段、失败与取消边界，终态后刷新 catalog。
- 协议修复：`plugins/operation/get|cancel` 路由现在等待异步 handler 完成；修复首轮查询把 `Promise` 序列化为 `{}`、后续轮询丢失 `operationId` 并终止 App Server 的连锁问题。坏参数现在只返回 `invalid_params`，服务保持可继续查询。
- 用户可见变化：新增本地 Plugin 包导入、安装选项、安装计划确认、安装进度与错误状态；左侧列表内搜索和启停，右侧详情保持图标操作、分区事实和独立滚动。
- 自动验证：`npm.cmd run typecheck`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run desktop:build`、`npm.cmd run smoke:plugin-action-protocol`、`npm.cmd run smoke:plugin-marketplace-service`、`npm.cmd run smoke:desktop-plugin-workbench`、`git diff --check` 通过。
- 真实链路验证：使用独立临时 `CCR_CONFIG_DIR`、Electron user-data 和 CDP 端口验证 preload -> Electron main -> App Server -> Core；有效 operation 返回完整记录，无效参数后同一 App Server 仍可继续查询。
- 视觉验证：`1536x834` 和 `900x720` 下无横向溢出，本地导入、安装计划、安装终态和已安装目录刷新均可见。
- 残留范围：P11 负责不少于 50 个 Plugin 专项场景、样例包和故障注入矩阵；P12 负责 CLI / Ink 迁移与发布收口。

## P11 样例 Plugin 与故障维度矩阵

状态：已完成。

### 目标

用本地样例 Plugin 和故障注入矩阵验证 P1-P10 的所有关键不变式。

### 输入

- P1-P10 的领域协议和产品入口。
- Plugin 异常场景矩阵。
- 现有外部扩展 release smoke。

### 范围

- 建立包含 Skill、MCP、App relation、普通配置、secret 和依赖的本地样例。
- 覆盖 user/project/local 安装。
- 覆盖 install/configure/enable/activate/update/rollback/disable/uninstall。
- 覆盖双 home、双 workspace、双进程。
- 对事务每个边界做故障注入。
- 覆盖 secure store、部分激活、rollback GC、managed policy 和 Marketplace 下架。
- 将 Plugin 专项矩阵接入 release group。

### 输出

- 本地样例 Plugin fixture。
- Plugin 专项 smoke matrix。
- 每个不变式的正例与反例。

### 非目标

- 不依赖真实 GitHub、OAuth 或外部网络。
- 不用数量代替覆盖率。
- 不把端到端矩阵替代领域单元和定向 smoke。

### 验收

- Plugin 专项用例不少于 50。
- 设计文档中的异常场景全部有自动化证据。
- 每个架构不变式至少一个正例和一个反例。
- 关键反例在错误实现上能失败。
- Release smoke 自动执行矩阵。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
npm.cmd run smoke:desktop-release-gate
git diff --check
```

### 完成记录

完成时间：2026-06-08。

- 新增 `PluginLifecycleTransaction`，默认 Core 现在真实执行 enable、disable、uninstall；启停只提交目标作用域 intent，卸载按 intent、安装记录、配置删除选项和引用感知 GC 分阶段 journal 提交。
- 修复多作用域动作计划误用全局 effective state 的问题；启停校验改为目标作用域 intent，project/local 目标同时绑定当前 workspace。
- 最后一个安装实例之前禁止删除共享 Plugin data；options、secrets 和 data 仍按用户显式删除选项分别处理。
- 新增本地产品化样例，覆盖 Skill、MCP、App relation、普通配置、secret、依赖、启停、显式 runtime activation、更新、回滚和卸载。
- 新增安装与生命周期共 8 个事务故障边界矩阵；提交前失败不留下权威状态，提交后失败可按 journal 幂等 reconciliation。
- 新增真实双进程作用域锁 smoke；同一 config home、scope 和 workspace 的并发写显式返回 `plugin-operation-conflict`。
- 新增 70 项 P11 Plugin 专项矩阵：42 个架构异常场景逐项登记，14 条最终不变式各有正例和反例，并由 15 条真实 smoke 作为证据；P12 完成后最终矩阵扩展为 76 项和 18 条证据脚本。
- `smoke:plugin-release` 已接入 typecheck、Desktop typecheck、build、Desktop build 和 Plugin 专项矩阵。

验证：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:plugin-lifecycle-transaction
npm.cmd run smoke:plugin-transaction-fault-matrix
npm.cmd run smoke:plugin-cross-process-lock
npm.cmd run smoke:plugin-productization-sample
npm.cmd run smoke:plugin-dependency-boundaries
npm.cmd run smoke:plugin-productization-matrix
git diff --check
```

结果：

- P11 Plugin 专项矩阵通过：70 cases、42 scenarios、14 invariants、15 evidence scripts；P12 最终矩阵为 76 cases、42 scenarios、14 invariants、18 evidence scripts。
- 外部扩展矩阵通过：85 cases。
- P11 不依赖外网、GitHub 或 OAuth。
- P12 已完成 CLI / Ink 薄适配、旧写路径退出、兼容迁移与最终发布收口。

## P12 兼容迁移、发布与回滚

状态：已完成（2026-06-08）。

### 目标

收口旧 CLI / Ink adapter、协议升级、发布说明和系统级回滚，完成 Plugin 产品化发布门禁。

### 输入

- P0-P11 完成记录。
- 兼容入口清单。
- Plugin 专项矩阵和 release gate。

### 范围

- 让 CLI / Ink 使用同一 Plugin domain service。
- 删除或显式隔离被替代的旧写路径。
- 定义协议、schema、安装记录和 Marketplace 兼容升级。
- 定义系统升级回滚与 Plugin 包回滚的区别。
- 更新 README、CHANGELOG、架构、Goal 和发布说明。
- 接入最终 release gate。

### 输出

- 薄 CLI / Ink adapter。
- 迁移和回滚说明。
- 完整发布门禁与 closeout 记录。

### 非目标

- 不在 P12 新增领域模型。
- 不在发布收口阶段补临时 fallback。
- 不把 Core 版本升级、Plugin 更新和 runtime 激活混写。

### 验收

- CLI、Core、App Server 和 Desktop 对同一 target 生成等价 plan。
- 新路径失败不会静默调用旧写路径。
- 旧配置和安装记录有明确迁移或兼容策略。
- 发布说明区分 Core、Plugin package 和 runtime activation。
- 所有 release gate 和 Plugin 专项矩阵通过。

### 建议验证

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:external-extension-matrix
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd run smoke:desktop-release-gate
git diff --check
```

### 完成记录

完成时间：2026-06-08。

- 新增 `PluginDomainAdapter`，CLI / Ink、推荐和启动检查现在与 Core、App Server、Desktop 复用同一 plan / confirmation / apply / operation 主链。
- `pluginOperations.ts` 收敛为兼容 facade；Marketplace-backed Plugin 不再直接写 settings、cache 或安装记录。built-in Plugin 的 intent 写入保留在显式隔离 adapter 中，不作为失败 fallback。
- 新增安装记录兼容层：V1/V2 可读，首次事务写入原子迁移到 V2，旧 `installed_plugins_v2.json` 可合并，未知版本显式拒绝。
- 新增 `smoke:plugin-adapter-parity`、`smoke:plugin-registry-compatibility` 和 `smoke:plugin-legacy-write-boundary`。
- Plugin 产品化矩阵扩展为 76 cases、42 scenarios、14 invariants、18 evidence scripts。
- 新增 [Plugin 兼容迁移、回滚与发布收口](../architecture/plugin-system-compatibility-and-release.md)，区分 CCR 应用回滚、Plugin 包回滚和 runtime activation。

专项验证：

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:plugin-adapter-parity
npm.cmd run smoke:plugin-registry-compatibility
npm.cmd run smoke:plugin-legacy-write-boundary
npm.cmd run smoke:plugin-action-protocol
npm.cmd run smoke:plugin-install-transaction
npm.cmd run smoke:plugin-lifecycle-transaction
npm.cmd run smoke:plugin-transaction-fault-matrix
npm.cmd run smoke:plugin-productization-sample
git diff --check
```

结果：

- CLI / Ink adapter 与 Core 计划语义一致，真实 install、enable、disable、update、uninstall 通过。
- V1 -> V2、旧 V2 文件合并、未知版本拒绝通过。
- 旧 settings/cache/registry 直接写路径边界检查通过。
- P0-P12 不存在新路径失败后静默回旧实现。
- `smoke:plugin-release` 通过：76 cases、42 scenarios、14 invariants、18 evidence scripts。
- `smoke:external-extension-matrix` 通过：85 cases。
- `smoke:mcp-release`、`smoke:skill-release` 和 `smoke:desktop-release-gate` 全部通过。
- MCP 发布组首次回归暴露旧 App fixture 把 `connected: false` 当成 `needs-auth`；补充显式 `authStatus` 后定向 smoke 与完整发布组均通过，运行时代码无需修改。

### 2026-06-13 后续收口记录

P0-P12 完成后，Desktop 继续按用户交互反馈补了一轮产品和父子可见性收口：

- Plugin 页面只管理本地 Plugin 包，导入支持文件夹和 zip；远程 marketplace 不作为当前主入口。
- Plugin 导入、启停和诊断默认用户全局；启停开关放在左侧列表卡，详情页只保留图标化管理操作和稳定分区事实。
- Plugin 禁用后，Plugin 自身、Plugin Skill、Plugin MCP 和子 Tool 都必须 fail closed；Skill / MCP / 能力目录展示隐藏原因，不继续当作运行时可用能力。
- Plugin Skill 在 Skill 管理页展示 `SKILL.md` 正文、资源、安全扫描和包路径；Plugin MCP 在 MCP 管理页展示只读运行时事实和父 Plugin 隐藏原因。
- Plugin 组件明细使用语义名称：Skill 使用 Skill 名称，MCP server 使用 manifest server key，不用启动命令名。

## 6. 每个 Goal 的完成门禁

每个 Goal 标记完成前必须回答：

- 本阶段解决了哪些问题编号。
- 权威输入和输出是什么。
- 请求级 context 如何传递。
- 查询是否保持无副作用。
- 状态如何变化。
- 并发、revision、失败和恢复如何处理。
- 旧入口是复用、适配还是删除。
- 用户可见变化是什么。
- 新增了哪些正例和反例。
- 验证是否运行在最新 build 产物上。
- 是否更新设计、证据、Goal 和 CHANGELOG。

## 7. 系列完成标准

P0-P12 全部完成时：

- Plugin 领域可在同一进程可靠服务多个 home 和 workspace。
- 候选、意图、安装、物化、加载、激活和版本状态可分别解释。
- 安装、更新、回滚、卸载具有可恢复事务和并发冲突语义。
- Plugin runtime 激活不再绑定单一 CLI / Ink AppState。
- Capability Catalog 只做统一发现和关系投影。
- Desktop 形成已安装管理、浏览安装和诊断闭环。
- Plugin 与 App 的关系和 ownership 明确。
- 不少于 50 个 Plugin 专项用例进入发布门禁。
- 不存在新路径失败后静默回旧实现。
