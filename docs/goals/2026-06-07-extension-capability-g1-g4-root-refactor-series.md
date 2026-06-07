# Goal Series：G1-G4 外部扩展根因重构

## 1. 背景

R0-R30 已经建立 Capability Catalog、Skill 运行时目录、MCP 子能力、Plugin 关系、管理动作和外部扩展 smoke，但 2026-06-07 的再次复审确认：若继续按单点问题补丁推进，仍会反复出现“列表能表达、真实流程未闭合”的情况。

本序列不再按页面或单个 Provider 修补，而是围绕四个共享根因重构：

- 请求级运行环境没有唯一快照。
- capability 身份和父子关系没有统一图模型。
- 当时 App / Connector 还停留在 DTO 预留，没有会话级生命周期。
- 测试以实现路径为主，缺少能击穿错误设计的反例。

一句话口径：

```text
Core 在请求边界生成一份能力运行环境快照；
Provider 只把快照投影为 capability；
Catalog 用 canonical identity 和关系图统一归属；
App / Connector 从注册到管理动作使用同一会话级事实；
发布门禁用反例验证这些不变式。
```

## 2. 总体不变式

- `cwd` 和 `configHomeDir` 是请求级输入，不允许 Provider 在投影阶段重新读取进程全局值。
- MCP runtime、MCP config、Plugin、App 和 Tool 必须属于同一次能力快照，不能各自在不同时间重新加载。
- `capability.id` 表达来源感知的稳定身份；`relations.runtimeRef` 表达真实调用入口，两者不能混用。
- 同名不同来源能力必须拥有不同 canonical id。
- Plugin、App、MCP server 与子能力的关系必须是可遍历的关系图，不靠 metadata 猜测。
- `capabilities/list`、`capabilities/management/list`、action plan 和 action apply 必须读取同一个会话级 App / Connector registry。
- 外部扩展读取路径不得触发 Plugin 网络刷新或安装副作用。
- 缺少父能力、跨 home、同名冲突、状态漂移必须显式诊断，不允许静默回退到进程全局或旧路径。

## 3. 阶段总表

| Goal | 目标 | 主要问题 |
| --- | --- | --- |
| G1 | 统一能力运行环境快照 | MCP / Plugin Provider 读取全局状态；SkillTool cwd 不是 request-scoped；不同 Provider 观察时间不一致 |
| G2 | 统一 capability identity 与父子关系图 | 非 Skill ID 不带来源；同名 MCP tool 冲突；App child 关系只在 metadata；父状态传播不完整 |
| G3 | 闭合 App / Connector 生命周期 | App 只在 list 参数临时存在；plan / apply 重建投影后丢失；无会话级 registry |
| G4 | 反例驱动验收与发布收口 | 既有 smoke 能通过错误实现；缺少跨 home、重复名称、生命周期连续性等反例 |

## G1 统一能力运行环境快照

状态：已完成（2026-06-07）。

### 目标

由 CCR Core 在能力查询边界一次性构建 `CapabilityRuntimeEnvironment`，统一携带：

- 请求 `cwd`
- 请求 `configHomeDir`
- MCP 配置目录快照
- MCP runtime 快照
- Plugin cache-only 快照
- App / Connector 注册快照
- 真实 Tool pool 和权限输入

Provider 只消费该快照，不再自行访问进程全局配置、Plugin loader 或 MCP 配置加载器。

### 输入

- `cwd`
- `configHomeDir`
- 可选的已构建 MCP runtime / Plugin / App 快照
- Tool permission context
- 当前平台和 active agent 数量

### 输出

- 同一次请求内不可变的能力运行环境。
- Skill、MCP、Tool、Plugin、App Provider 对该环境的只读投影。
- ToolUseContext 中明确的 request-scoped `cwd/configHomeDir`。

### 边界

- Core 可以加载基础设施快照；Provider 不可以。
- Plugin 目录查询只允许 cache-only，不允许触发网络刷新、复制或安装。
- 指定了非当前进程 home，但基础设施尚不支持读取该 home 时，必须返回显式诊断，不得读取当前 home 冒充结果。
- 本阶段不改 capability id 规则和 App registry 生命周期。

### 验收

- MCP Provider 不再直接调用 `listCoreMcpServers()`。
- Plugin Provider 不再直接调用 `loadAllPlugins()` 或 `loadAllPluginsCacheOnly()`。
- 两个不同 `configHomeDir` 的能力查询不会互相看到对方 MCP 配置。
- Skill listing、discovery、SkillTool validate/call 使用同一个请求 `cwd/configHomeDir`。
- 同一次能力查询中的 MCP server、MCP tool、Plugin 和 Tool 来自同一环境快照。

### 完成记录

- 新增 `CapabilityRuntimeEnvironment`，由 `capabilityCore` 在请求边界统一构建 request、MCP config/runtime、Plugin cache-only、App 和 Tool pool 快照。
- MCP、Plugin、Skill、Tool、App Provider 已改为只读环境快照；MCP Provider 不再调用 Core loader，Plugin Provider 不再触发 full/cache-only loader。
- `ToolUseContext.options.cwd` 已成为请求级必填字段，SkillTool、discovery 和 listing 不再从全局 project root 推断 cwd。
- MCP config inventory 已支持显式 `cwd/configHomeDir`，非当前 home/workspace 不再借用进程项目状态。
- 当前 config home 使用跨平台路径等价判断；Windows 路径仅大小写不同不会被误判为 foreign home。
- 新增 `smoke:capability-runtime-environment`，并移除 `smoke:skill-request-context-e2e` 对 `setProjectRoot()` 的遮蔽。

## G2 统一 capability identity 与父子关系图

状态：已完成（2026-06-07）。

### 目标

让所有能力类型通过统一 identity builder 生成来源感知 ID，并在 Catalog 中构建可遍历关系图。

### 输入

- G1 的统一运行环境。
- Provider 产出的来源字段和 runtime reference。
- Plugin / App / MCP server 的父子声明。

### 输出

- 全类型 canonical capability id。
- Plugin、App、MCP server、Skill、Tool、Resource、Prompt 的父子关系图。
- 统一的缺失父节点和父状态传播诊断。

### 边界

- `runtimeRef` 继续保留真实调用名，不因 canonical id 改变工具协议。
- 同名不同来源不合并；只在 runtime conflict policy 中决定哪一个可见。
- App capability 自身不能把自己写成 `parentAppId`。

### 验收

- 两个不同 MCP server 提供同名无前缀 tool 时 ID 不同。
- Plugin / App 提供的 Skill、MCP、Tool 都可反向追溯父能力。
- Plugin disabled、App needs-auth、MCP unavailable 能按关系图传播到子能力。
- 缺少父能力时产生显式 diagnostic，不伪造正常可用状态。

### 完成记录

- 新增统一来源感知 identity builder，Skill 之外的 MCP server/tool/resource/prompt、Tool、Plugin 和 App 也使用 canonical capability id。
- `runtimeRef` 保留真实调用名，同名不同 MCP server 的 Tool 不再发生 capability id 碰撞。
- Catalog 已统一解析 Plugin、App、MCP server 父子关系，并传播 disabled、needs-auth、missing 和 unavailable 状态。
- App 与 Plugin 根能力不再自指父节点；缺失父节点产生显式 diagnostic。
- 多个 App 同时认领同一子能力时不再静默后写覆盖，而是标记 `parent-app-ambiguous` 并 fail closed。
- 新增 `smoke:capability-identity-relations`，并回归 App、Plugin、管理投影与 Capability API 链路。

## G3 闭合 App / Connector 生命周期

状态：已完成（2026-06-07）。

### 目标

建立 Core / App Server 会话级 `AppCapabilityRegistry`，让注册、查询、管理动作和状态更新使用同一个事实源。

### 输入

- 宿主注册或更新的 App / Connector snapshot。
- 当前会话身份。
- 鉴权、启用和连接状态。

### 输出

- 会话级 App registry snapshot。
- list、management list、plan、apply 共享的 App capability。
- App 状态变化后的子能力可用性传播。

### 边界

- App / Connector 是授权和数据连接能力，不等于 Tool。
- 协议中的一次性 `apps` 参数只能作为显式注册或兼容适配入口，不能成为唯一事实源。
- 没有真实注册来源时不伪造用户可见 App。
- App 管理动作只声明真实可执行动作。

### 验收

- App 在 list 中出现后，plan / apply 不会因重建投影而丢失。
- App auth / enable 状态变化会更新其子 Skill、MCP server 和 Tool 的可用性。
- Desktop、App Server 和 Core 读取同一 registry snapshot。
- 会话结束后 registry 不泄漏到其他 App Server 会话。

### 完成记录

- 新增 Core 实例级 `AppCapabilityRegistry`，支持 `replace`、`upsert`、snapshot 和 clear。
- 新增 App Server `capabilities/apps/register` 与 client `registerCapabilityApps()`，并通过 `capabilityApps` server capability 声明支持。
- `capabilities/list` / `capabilities/management/list` 的 `apps` 参数保留为兼容注册入口，后续 plan / apply 不再要求重复传入。
- App 状态更新会通过统一关系图传播到子 Skill、MCP server 和 Tool。
- 新增 `smoke:app-capability-registry-lifecycle`，覆盖注册、查询、plan、apply、needs-auth 更新和会话隔离。

## G4 反例驱动验收与发布收口

状态：已完成（2026-06-07）。

### 目标

把能击穿错误设计的反例加入自动测试和 release gate，并同步总架构、roadmap、Goal README 和 CHANGELOG。

### 必须覆盖的反例

- home A / home B MCP 配置隔离。
- workspace A / workspace B Skill 目录隔离。
- 两个 MCP server 提供同名 tool。
- App list -> plan -> apply 生命周期连续。
- App needs-auth / disabled 向子能力传播。
- Plugin disabled 向 Skill / MCP / Tool 传播。
- parent id 不存在时产生 diagnostic。
- Plugin 目录读取不触发 full refresh。
- Catalog、Tool Registry、ToolSearch、真实 Tool pool 对齐。
- management list 与 action apply 使用同一状态摘要。

### 验收

- 外部扩展矩阵不少于 50 个用例，并新增上述反例。
- 关键反例在旧实现上能失败，在新实现上通过。
- release smoke group 自动执行新增矩阵。
- 文档不再把 DTO 预留描述为已闭合真实能力。
- `typecheck`、`build`、Capability / Skill / MCP 定向 smoke、CLI / TUI 最小回归通过。

### 完成记录

- 外部扩展反例矩阵扩展到 85 项，覆盖跨 home/workspace、同名 MCP Tool、App 生命周期、父状态传播、缺失/歧义父节点和管理状态同源。
- `smoke:capability-runtime-environment`、`smoke:capability-identity-relations`、`smoke:app-capability-registry-lifecycle` 已接入 MCP、Skill、Skill internal 和 Desktop release smoke group。
- 发布门禁通过：MCP 19/19、Skill 50/50、Skill internal 33/33、Desktop 15/15。
- 真实 `ccr -p` 使用当前 `GLM API / glm-5.1` 配置返回固定结果 `CCR_G4_OK`；真实 Windows TTY 中的外部构建 TUI 启动后保持运行，临时验证进程已全部清理。
- Skill discovery 旧 smoke fixture 已改为显式传入 request-scoped `cwd/configHomeDir`，不再用全局 project root 掩盖运行时契约。
- 总架构、roadmap、Goal README、App Server 协议/客户端设计和 CHANGELOG 已同步当前实现与边界。

## 4. 完成后下一步

G1-G4 完成后，本序列不再继续追加新的根因重构项。后续问题应拆到新的产品化或领域 goal 中处理：

- Plugin manifest 与 App 注册入口：定义插件包如何声明 App、Skill、MCP 和 Tool。
- 样例 Plugin 端到端：覆盖安装、启用、禁用、卸载、App registry 注册和能力目录展示。
- Desktop Plugin / App 管理页产品化：把统一管理投影做成用户可操作入口。
- 发布拆分与升级链路：区分随 `cc-reforged` 发布的能力和随 Plugin 包发布的能力。

这些后续目标可以复用 G1-G4 建立的 `CapabilityRuntimeEnvironment`、canonical capability id、关系图和 `AppCapabilityRegistry`，但不应把 Skill、MCP、Tool 和 App 合并成同一种运行时。

## 5. 执行顺序

```text
G1 -> G2 -> G3 -> G4
```

每个 Goal 完成后都要：

1. 运行本阶段定向 smoke。
2. 审查本阶段所有改动文件。
3. 更新本文件状态和完成记录。
4. 再进入下一个 Goal。

## 6. 非目标

- 不把 Skill、MCP、Tool 合并成同一种运行时。
- 不改变模型现有 Tool / Skill 调用协议。
- 不在本序列引入远端 Plugin marketplace 新协议。
- 不重写 Desktop 页面布局。
- 不触碰 ThreadDisplay 和会话历史物化语义。
- 不以 legacy fallback 掩盖新路径失败。
