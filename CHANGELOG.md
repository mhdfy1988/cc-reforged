# Change Log

All notable changes to this project will be documented in this file.

主分支可能包含最新版本之后的开发中改动；正式发布以 GitHub Release 和 tag 为准。

## [Unreleased]

- 暂无。

## [0.6.5] - 2026-06-16

### Added

- 新增 `smoke:plugin-local-archive-import`，覆盖本地 Plugin zip archive 导入、根目录 `plugin.json` 规范化和坏包显式失败。
- 新增 `smoke:plugin-mcp-relative-path`，覆盖 Plugin MCP server key 命名、相对路径解析和父 Plugin 禁用隐藏传播。
- 扩展 `smoke:plugin-runtime-activator`，覆盖运行时刷新前清理 installed plugin registry 缓存，避免导入或启停后读取旧安装记录。

### Changed

- Desktop Plugin 本地导入继续收敛为文件夹 / zip 两种入口，默认用户全局；导入完成后刷新 catalog 与详情，并保持当前选中项。
- Plugin 详情页只对可从 marketplace 权威候选重新物化的 Plugin 展示修复按钮；本地导入包不再显示会失败的 repair 操作。
- Plugin 提供的 MCP 与 Skill 继续按父 Plugin 状态传播可见性；父 Plugin 禁用后，子能力在 Skill、MCP 和能力目录中 fail closed。

### Fixed

- 修复本地 zip Plugin 导入时错误按文本读取 archive、导致 manifest JSON 解析失败的问题。
- 修复 Plugin runtime refresh 没有清理 installed registry 缓存，导致刷新后组件仍不可用或版本仍停留旧快照的问题。
- 修复 Plugin MCP 组件可能用 `node` / `npx.cmd` 等启动命令当作名称，以及相对路径在运行时解析不稳定的问题。
- 修复本地导入 Plugin 详情页显示不适用的修复按钮，点击后生成 blocked repair 计划的问题。

## [0.6.4] - 2026-06-13

### Changed

- Desktop Plugin 页面继续收敛为本地 Plugin 包管理：启停开关固定在左侧列表卡，详情页不再展示短暂 operation 流程卡，分区内容改为稳定滚动区域。
- Plugin、Skill、MCP 的父子可见性语义进一步统一：父 Plugin 禁用后，Plugin 自身、Plugin Skill 和 Plugin MCP 均通过结构化隐藏原因展示，不再被误判为仍可运行。

### Fixed

- 修复 Plugin 贡献的 Skill 在 Skill 管理页缺少 `SKILL.md` 正文、资源、安全扫描和包路径信息的问题。
- 修复 Plugin 贡献的 MCP 在组件明细中用启动命令名充当名称的问题；现在优先展示 manifest 中的 MCP server key。
- 修复 Plugin 详情页标题、滚动条、组件明细和运行时分区的重复状态与布局噪音。

## [0.6.3] - 2026-06-12

### Added

- 新增统一动态 Skill 发现闭环，turn-zero、inter-turn 和 `DiscoverSkills` 共用 stable capability identity、来源和可解释匹配结果。
- 新增实验性 MCP Skill 资源适配，按 Draft SEP-2640 读取 `skill://index.json` 与 `skill:///.../SKILL.md`，并保持 Tool、Resource、Prompt、Skill 四类调用边界。
- 新增 `capabilities/management/list` 统一只读管理投影；Desktop Skill、MCP 和 Plugin 页面可展示 runtime-only 能力、父子来源、隐藏原因和 Plugin 影响面。
- 新增 app-server 最终工具池 builder，Capability Catalog 的 Tool 能力目录与 turn runner 实际工具集合共用同一份 app-server tool pool。
- 新增 Skill discovery feature gate smoke、app-server tool pool / capability catalog 对齐 smoke，以及 App / Plugin 外部关系 schema smoke。
- 新增 Skill request context、Skill visibility ledger 和能力管理确认 token smoke，覆盖 configHome 同源、canonical 去重、状态摘要、过期和重复使用边界。
- 新增请求级 `CapabilityRuntimeEnvironment`，统一能力查询使用的 workspace、config home、MCP、Plugin、App 和真实 Tool pool 快照。
- 新增 Core 会话级 `AppCapabilityRegistry` 与 App Server `capabilities/apps/register`，支持 App / Connector 快照替换、更新和管理生命周期连续性。
- 新增 capability identity / relation、App registry lifecycle 和跨 home runtime environment smoke；外部扩展反例矩阵扩展到 85 项。
- 新增 Plugin 接入与产品化设计文档及源码证据索引；确认复用现有 `.claude-plugin/plugin.json`、Marketplace、多作用域安装记录和版本缓存，并把后续路线细化为 P0-P12。
- 新增请求级 `PluginDomainSession` 与无副作用 `PluginInspector`，按 config home、workspace 和 runtime instance 隔离 settings、安装记录、Marketplace、包、配置、密钥和运行时快照，并输出多作用域、多版本 Plugin 管理读模型。
- 新增独立 Plugin App Server 管理协议与不可变 plan/apply 契约，覆盖 catalog、inspect、action plan/apply、operation query/cancel，并绑定作用域、revision、过期和单次确认 token。
- 新增 Plugin 可恢复安装事务：依赖闭包先全量 stage 和校验，再提交版本缓存、V2 安装记录与可选启用 intent；同时增加作用域锁、operation store、journal 和幂等 reconciliation。
- 新增 Plugin 组件级运行时激活器和 runtime snapshot，覆盖 Command、Agent、Skill、Hook、MCP、LSP、Channel 与 Output Style，并提供 App Server `plugins/runtime/activate|get` 宿主适配协议。
- 新增 Plugin 依赖影响分析、非原地更新、精确缓存回滚、旧版本 retention record 与引用感知 cache GC；安装、运行时、进行中 operation、未完成 journal 和回滚窗口引用的版本不会被误删。
- 新增请求级 Plugin 配置治理与 App Server `plugins/config/get|save|delete`，支持 user/project/local 分层来源、作用域密钥 identity、schema 漂移诊断和 options/secrets/data 独立删除。
- 新增 Plugin `ccr.apps` 关系 schema、App 关系投影和 `plugins/apps/register|unregister|list` 宿主桥接；只有 `provides` 可取得 ownership，其他关系只引用真实 App registry 状态。
- 新增 Desktop Plugin 已安装管理工作台和独立 Plugin renderer client，提供搜索、筛选、七分区详情、启停、更新、修复、卸载、回滚、operation 进度与确认流程。
- 新增 `fixtures:desktop-plugin` 临时验收数据集和 `smoke:desktop-plugin-workbench`，覆盖已安装、停用、缺包、部分激活、需重启、候选更新、配置、依赖、App relation 和窄屏滚动边界。
- 新增 Desktop Plugin 本地包边界：插件页只展示已安装、内置、本地导入或运行时可见的 Plugin，官方 marketplace 远程候选不再作为插件市场列表进入主界面。
- 新增请求级 Plugin 来源兼容 service 和 `smoke:plugin-marketplace-service`，覆盖来源兼容数据、依赖闭包、离线已安装管理、双 home 隔离、managed policy 和缓存路径校验。
- 新增 Plugin 生命周期事务，默认 Core 可执行目标作用域 enable、disable 和 uninstall；卸载按 intent、安装记录、配置删除选项与引用感知 GC 分阶段 journal 提交。
- 新增 Plugin 产品化本地样例和 70 项专项矩阵，覆盖 42 个异常场景、14 条最终不变式正反例、8 个事务故障边界与真实双进程锁冲突。
- 新增 `smoke:plugin-release` 发布组，统一执行 Core/Desktop 类型检查、构建和 Plugin 产品化矩阵。
- 新增 `PluginDomainAdapter` 和薄 CLI / Ink 兼容 facade，使终端、App Server 与 Desktop 复用同一 Plugin plan / confirmation / apply / operation 主链。
- 新增 Plugin 安装记录兼容层，支持 V1 -> V2 事务写边界迁移、旧 V2 文件合并和未知版本显式拒绝。
- 新增 Plugin adapter parity、registry compatibility、legacy write boundary 三组 smoke；最终产品化矩阵扩展为 76 项用例和 18 条证据脚本。
- 新增 Plugin 兼容迁移、三类回滚和发布收口文档。
- 新增本地 Plugin 包导入入口，支持文件夹和 zip archive；导入默认进入用户全局作用域，并兼容包根目录 `plugin.json` 与内部 `.claude-plugin/plugin.json` 两种清单入口。

### Changed

- Plugin identity 与 Plugin -> MCP Server -> child capability 关系贯穿 Capability Catalog，父 Plugin 或 MCP Server 不可用时统一传播结构化隐藏原因。
- Skill 模型可调用性收敛到统一运行时可见性 adapter；listing、discovery、SkillTool 和 runtime catalog 不再各自维护启用与模型调用判断。
- Skill 动态发现默认启用，不再限制 `USER_TYPE=ant`；仍可通过 `CC_REFORGED_DISABLE_FEATURES=EXPERIMENTAL_SKILL_SEARCH` 显式关闭。
- `DiscoverSkills` 和自动 `skill_discovery` 会过滤已 visible、loaded 或 discovered 的 Skill；catalog 查询仍返回完整 Skill 清单。
- 自动 Skill discovery 对普通任务只提醒最相关 Skill，并收紧中文检索 token，避免单字弱命中污染后续发现。
- Skill listing、dynamic discovery、`DiscoverSkills` 和 `SkillTool` 现在使用同一份 request-scoped `cwd/configHomeDir`；`visible`、`discovered`、`loaded` 账本优先按 canonical capability id 去重。
- 能力管理危险动作的确认 token 改为短期 opaque token，绑定 plan state digest、过期时间和当前 `cwd/configHomeDir`，apply 时重新计算投影后校验。
- App Server capabilities schema 的 `apps` 入参支持 `authStatus`、`parentPluginId`、`providedToolIds`、`providedMcpServerNames` 和 `providedSkillIds`。
- `smoke:skill-release` 与 `smoke:skill-internal-refactor` 补入 R17-R24 的关键边界门禁。
- Skill、MCP、Tool、Plugin 和 App capability 使用来源感知 canonical id，Catalog 统一传播 Plugin / App / MCP 父节点状态；真实调用名继续保留在 `runtimeRef`。
- MCP、Skill、Plugin、Tool 和 App provider 改为只读统一环境快照，不再在投影阶段自行读取进程全局或触发完整 loader。
- 深度复审 Plugin 设计：取消 `.ccr-plugin`、第二套安装数据库和虚构生命周期脚本方案，补齐请求级 Plugin 领域上下文、六层状态事实、安装事务、待激活版本、App registry 桥接、Desktop 已安装/内置管理、本地导入边界和发布迁移门禁。
- 冻结 Plugin 产品化 P0 兼容基线：明确现有 schema、安装记录、CLI / Ink、loader、refresh、Capability 投影和 Desktop 入口的保留、适配与退出条件；后续按 P1-P12 依次实施。
- Capability Plugin Provider 改为消费请求级 `PluginCatalogSnapshot`；缺包、漂移和加载失败附着到具体 Plugin / 安装实例，不再由新路径聚合成虚构 catalog error Plugin。
- Capability 管理投影对 Plugin 只返回领域 action link，不再由通用 Capability action handler构造 Plugin 安装、更新或卸载 effects。
- Plugin 安装与启用拆分；新 Desktop/Core 事务路径默认安装后保持 disabled，只有不可变 plan 显式选择时才继续写入启用 intent。
- Plugin runtime refresh 改为显式 host adapter；部分组件失败、需要重启和旧快照保留不再被压成单一成功/失败状态，未注册宿主适配器时显式返回 unavailable。
- Plugin action plan 现在展示直接依赖、反向依赖和跨 Marketplace 信任边，并明确当前版本约束只支持精确版本选择，不宣称完整 semver 求解。
- Plugin 普通配置只写入用户选择的目标层；敏感字段只进入显式 config home 的凭据存储，空敏感字段保留旧值，查询结果不回显密钥。
- App 状态细分为 connected、needs-auth、disabled、disconnected 和 unregistered；Plugin disabled 通过 App 向子能力传播时保留 `plugin-disabled` 根因。
- Desktop Plugin 页面改为只消费 Plugin 领域协议，不再复用 Capability 管理投影或在 Renderer 推导 Plugin 状态与动作 effects。
- Plugin 启停计划改为校验目标作用域 intent，不再用全局 effective state 阻止 project/local override；安装、启用和 runtime activation 继续保持独立。
- CLI / Ink、推荐和启动检查不再各自编排 Plugin settings、cache 和安装记录写入；Marketplace-backed Plugin 生命周期统一委托 Plugin 领域事务。
- built-in Plugin 的启停特化被隔离到显式 adapter；managed Plugin 生命周期保持只读，不再以兼容名义进入普通写路径。
- Desktop Plugin 页从“市场浏览”收敛为“内置与已导入管理”，导入来源只作为输入边界，不把未安装远程候选伪装成可管理 Plugin。
- Desktop Plugin 页交互收敛到 Skill / MCP 同类管理面：搜索放入左侧列表栏，启停开关放入 Plugin 列表卡，详情页只保留修复、卸载等图标动作；组件明细改为稳定图标列表，移除重复状态文案。

### Fixed

- 修复 Plugin operation 内存终态先于持久化发布的竞态；成功操作现在不会在 Core/App Server 重启查询时短暂退回旧 `running` 状态。
- 修复 Plugin operation 查询路由未等待异步 handler、导致首轮结果被序列化为 `{}`，继而轮询丢失 `operationId` 并终止 App Server 的问题；非法参数现在稳定返回协议错误。
- 修复旧 CLI / Ink 安装路径先写 settings、后写 cache/registry 可能留下部分状态的问题；新路径失败不会静默回退到旧写实现。

- 修复 Desktop 工具进度引用不到父工具调用时生成红色错误卡的问题；孤立工具进度现在保留为 warning 诊断，便于继续排查来源。
- 修复 Playwright 截图、Read 图片等工具内联媒体结果被错误升格成附件卡的问题；只有带明确附件身份、路径、名称或生成物字段的工具媒体才会生成附件展示。
- 修复 Renderer fallback 递归扫描 `tool_result` / `tool_use.result` 造成的重复附件推断；ThreadDisplay 协议路径下附件投影统一由 App Server 负责。
- 修复 Skill / MCP 左侧列表卡只有标题区域可选中的交互问题；卡片整体可选中，启用开关继续只控制启停。
- 调整 Desktop 外部扩展导航：能力目录从插件页拆成独立菜单，插件页只展示插件包及其子能力。
- 修复 Desktop 使用统计“调用明细”列表和事实面板没有有效高度约束、长列表撑高页面的问题；明细区域现在在桌面和窄屏布局下都使用内部滚动。
- 修复普通 MCP Prompt 可能因共用 `Command` 类型进入 Skill runtime catalog 的边界问题。
- 修复手工 MCP 配置在统一管理投影中可能被误判为 installer-owned、进而错误开放卸载动作的问题。
- 修复缺失父 Plugin 被当成 `plugin-disabled` 隐藏子能力的问题；缺失父 Plugin 现在只产生 diagnostic。
- 修复 runtime-only / plugin-owned MCP 被错误开放 enable / disable / restart / test 等本地写配置动作的问题。
- 修复 Skill runtime catalog 在指定 `configHomeDir` 时仍可能读取默认全局 home 的问题。
- 修复 Skill discovery name-only 去重可能误过滤同名不同来源 Skill 的问题。
- 修复能力管理 repair / uninstall 确认 token 可预测、无过期且可复用的问题。
- 修复 `DiscoverSkillsTool` / `prefetch` 在 Skill search 默认启用后产生顶层模块循环依赖的问题。
- 修复指定 `cwd/configHomeDir` 的能力查询仍可能混入当前进程 MCP / Plugin 状态的问题。
- 修复 Windows 下当前 `configHomeDir` 仅因路径大小写不同就被误判为外部 home、进而丢失当前 MCP / Plugin runtime 快照的问题。
- 修复同名不同 MCP server Tool 的 capability id 冲突，以及 App / Plugin 根节点自指父关系的问题。
- 修复 App 只在 list 参数中短暂存在、导致 management plan / apply 重建投影后丢失的问题。
- 修复多个 App 同时认领同一子能力时后写者静默覆盖的问题；现在会显式诊断并隐藏歧义能力。
- 修复 Skill discovery smoke fixture 依赖全局 project root、掩盖 request-scoped `cwd/configHomeDir` 契约的问题。
- 修复 Plugin 详情页图标因通用标题选择器命中过宽而视觉偏移的问题，头像和列表图标现在使用稳定居中样式。
- 修复 Plugin 导入后需要切换页面才显示操作按钮的问题，导入完成后会重新拉取 catalog 与详情并保持当前选择。

## [0.6.2] - 2026-06-05

### Changed

- 新增统一扩展能力目录第一版：`ExtensionCapability` 可表达 Skill、MCP server、MCP tool、Tool、Command 和 Plugin；Skill / MCP / Tool / Plugin provider 接入统一 Capability Catalog，并新增 Core / App Server `capabilities/list` / CLI `capabilities list` 只读查询入口。
- Skill 内部结构完成 B1-B6 重构：`managementService.ts` 瘦身为编排层，安装写入抽到 `installTransaction.ts`，管理 DTO 抽到 `managementDtos.ts`，持久化 helper 抽到 `managementStore.ts`，Skill 管理 capability 抽到 `capabilityProvider.ts`，managed package 到 runtime `Command` 的转换抽到 `skillRuntimeAdapter.ts`。
- 新增 `smoke:skill-internal-refactor`，覆盖 Skill 管理、安装事务、installed package inspection、能力目录和 runtime adapter 边界；`smoke:skill-release` 已覆盖完整 Skill 发布回归。

### Fixed

- 修复 Skill install `force` 计划与实际 apply 的语义不一致：installer-owned 目录可由确认后的安装事务受控替换，非 owner 目录仍不会被覆盖。
- 修复 Skill repair 先删除旧包再重建候选导致可用 Skill 可能临时变成缺包状态的问题；修复流程现在先构建候选和计划，验证通过后再由安装事务替换。

## [0.6.1] - 2026-06-05

### Changed

- Desktop Skill / MCP 管理页列表收敛状态展示：左侧卡片不再重复显示已安装 / 已配置状态文案，整体启用状态改为卡片内无文字切换开关，降低列表噪音。
- Desktop Skill / MCP 详情页操作区改为 36px 图标按钮：修复、检测、重启和卸载保留 `title` / `aria-label`，卸载保留危险色 hover 状态；Skill / MCP 安装搜索按钮同步改为放大镜图标。

### Fixed

- 修复 Skill 管理页把 `modelInvocable=false` 误显示为 Skill 已禁用的问题；安装完整性状态现在只由 `enabled` 决定，模型调用和用户调用继续作为独立调用面展示，并补 smoke 回归。

## [0.6.0] - 2026-06-05

### Changed

- MCP 保存常用安装配置收敛到 Core / App Server / client 统一入口，并新增 `smoke:mcp-end-to-end` 覆盖 manifest 矩阵、保存候选、安装、修复、卸载和 registry 暂停边界。
- Skill 安装闭环接入运行时：`~/.ccr/skills/installed.json` / `lock.json` / `packages/` 会生成 managed skill，`enabled`、`modelInvocable`、`userInvocable` 会影响 SkillTool prompt 和 slash command；drifted / missing / invalid package 不再进入运行时，并补 S-6 runtime smoke 覆盖。
- Skill managed installed runtime 补齐 `hooks` / `shell` / `version` / `paths` frontmatter 等价透传，安全扫描新增 hook command / HTTP / env 风险提示，并补 runtime / security smoke。
- Skill 来源扩展完成 S-7：导入来源新增本地 zip/tar archive，安装候选新增内置 `ccr-skill-starter` preset；builtin preset 可生成安装计划、安装成 managed package，并支持检查和修复。
- Skill 内置 preset 内容层完成 S-11：内置候选扩展为 `ccr-skill-starter`、`skill-install-helper`、`mcp-config-helper`、`bug-debug-helper`、`release-check-helper` 和 `docs-update-helper`，并拆分 `builtinPresetDefinitions` registry，避免后续继续堆大文件。
- Desktop Skill 安装入口收敛为“导入 Skill”：移除手填 manifest 壳的“创建 Skill 安装配置”表单，新建 Skill 改由会话中的 `Skill 包助手` 生成完整包后进入候选登记链路。
- Desktop Skill 导入表单新增文件夹 / 文件选择器：本地 Skill、Codex Skill、OpenClaw Skill 选择文件夹，本地 archive、Claude command 和 `openai.yaml` 选择文件，仍保留手填路径。
- Desktop Skill / MCP 管理页的导入和新建入口移到页面标题区；右侧安装栏只保留搜索和候选列表，导入 / 新建表单改用弹窗承载。
- 新增 `smoke:skill-install-builtin-presets`，遍历所有内置 Skill preset，覆盖候选搜索、安装计划、安装、检查、缺失修复和安全等级，后续新增内置 Skill 会自动进入回归。
- Skill runtime catalog 完成 S-8：dynamic skill 和 MCP skill 进入统一运行时优先级与 duplicate diagnostics，SkillTool 不再私下合并 MCP skill，管理 API 可暴露 runtime diagnostics。
- CLI 新增 `ccr skill search/import/install/status/inspect/repair/uninstall` 管理命令，复用 Skill Core 与 Management Service；导入、安装、修复和卸载默认 dry-run，显式 `--yes` 后才写入。
- Skill 新增 `smoke:skill-end-to-end`，通过 App Server stdio client 覆盖内置 preset 搜索、本地目录导入、安装、启用 / 禁用、保存常用安装配置、修复和卸载闭环。
- Skill / MCP 新增 `smoke:skill-mcp-negative-boundaries`，固定坏 manifest 诊断、Skill import schema 拒绝暂停来源，以及远端 registry 暂停能力不进入安装候选。
- Desktop 发布验收 Runbook 新增 Skill / MCP 管理页人工验收清单，并新增 `fixtures:desktop-management-acceptance` 生成本地页面验收数据。
- 发布前测试门禁新增 `smoke:mcp-release`、`smoke:skill-release` 和 `smoke:desktop-release-gate` 分组入口，统一输出失败 group / step，发布前可直接运行领域级 smoke。
- Skill / MCP 发布前 closeout 完成：同步 README、Skill / MCP 文档、goal 文档和 dist，补齐 Skill / MCP 关键 smoke 验证记录。
- Skill 文档补齐 Codex 用户 Skill 复用边界：`bug-debug-helper`、`docs-update-helper` 和 `release-check-helper` 复制到 `~/.codex/skills` 后需用新线程验证可用 Skill 注入，旧线程恢复不视为刷新成功。
- MCP 和 Skill 的远端 registry 候选提供器暂停实现，当前只记录为后续 backlog；后续恢复前需先补 registry URL 配置、index schema、checksum、缓存、信任策略和失败诊断。

### Fixed

- 修复 dynamic / conditional Skill 纳入 runtime catalog 后的缓存边界：路径命中激活的 conditional Skill 会触发 command cache 重新装配，并保留原始 `managed` / `skills` 来源元数据。
- 修复 `smoke:desktop-display-events` 仍引用 MCP 页面旧 helper 的问题，补回 `formatInstalledRecord` 导出以固定 installed record 摘要格式。

## 0.5.3 - 2026-06-02

### 改动

- MCP 安装推荐清单抽出为共享 `installPresets`，安装搜索、计划和应用流程复用同一套 preset 定义，减少后续新增 MCP 来源时在 client / installer 内重复维护。
- MCP 安装 preset 继续模块化：新增 `presets/registry`、`presets/playwright` 和 C-1 设计文档，后续新增 MCP 候选不再需要改 `installManager`。
- MCP 安装 preset registry 增加重复 id 校验、可实例化测试 registry、包名搜索覆盖和 smoke，避免新增候选时静默覆盖或漏搜。
- MCP client 开始抽通用 helper：新增 `toolSafety` 承载 `file://` 导航阻断判断和错误构造，并补 `smoke:mcp-tool-safety`。
- MCP client 结果处理抽出为 `resultProcessing`，统一承载 MCP content 转换、schema 推断、大输出处理和图片保护逻辑，并补 `smoke:mcp-result-processing`。
- MCP URL elicitation 解析抽出为 `urlElicitation`，统一校验 error data、阻断 `file://` elicitation 并生成拒绝文案。
- MCP 工具调用运行时辅助抽出为 `toolRuntime`，覆盖 timeout、duration、tool error 解析和 HTTP session closed 判断，并补 `smoke:mcp-tool-runtime`。
- MCP 能力发现结果适配抽出为 `discoveryAdapters`，先承载 resource 映射、prompt command 包装、tool 搜索提示和描述截断规则，并补 smoke。
- MCP discovery 编排继续拆分：新增 `discoveryService` 承载 tools/resources/prompts 的 SDK list 请求、prompt command 获取和资源工具补齐，`client.ts` 保留工具调用运行时闭包。
- MCP transport 构造辅助抽出为 `transportFactory`，先承载 stdio launch config、Node websocket transport 和 SDK control transport 创建，并补 `smoke:mcp-transport-factory`。
- MCP remote transport options 抽出为 `remoteTransportOptions`，统一承载 SSE / HTTP / claude.ai proxy 的 headers、auth provider、proxy、step-up detection 和 request timeout 组合，并补 `smoke:mcp-remote-transport-options`。
- Playwright MCP 专属安装实现归位到 `providers/playwright/install`，旧 `playwrightPreset` 保留兼容导出口，并补 provider smoke 固定新旧导出一致。
- MCP 安装 preset 新增 Context7，复用 registry / provider 结构暴露 `@upstash/context7-mcp` 的 stdio 安装候选，并补搜索与 plan smoke。
- MCP 安装 preset 新增 Sentry hosted remote MCP，使用 `https://mcp.sentry.dev/mcp` 的 HTTP remote-url 配置，明确 OAuth / remote-service 数据边界，并补 CLI install/uninstall smoke。
- Desktop MCP 页面安装候选适配多 preset 展示，候选卡会显示状态、来源、transport、数据边界和权限标签，并优先展示可安装项。
- CLI 新增 `ccr mcp search/install/status/uninstall/repair` 管理命令，复用 `installManager`，默认 dry-run，显式 `--yes` 后才写入或卸载，并补端到端 smoke。
- MCP installer status 新增安装记录与当前配置签名校验，能区分 `configured`、`drifted` 和 `missing-config`；Desktop MCP 页面会展示配置一致、漂移或缺失状态，repair smoke 覆盖缺失配置恢复。
- Desktop MCP 管理页补齐安装范围选择和已安装记录修复入口；App Server 新增 `mcp/install/repair`，Desktop 可对内置 preset 的缺失/漂移配置执行用户确认后的修复。
- Desktop MCP 安装入口收敛为用户全局默认安装，新增本地 manifest 导入和轻量创建向导；导入 / 创建都会进入统一安装计划确认，不直接写配置。
- Desktop MCP 安装确认支持将导入 / 创建生成的 manifest 保存到常用安装配置，保存后会进入本地候选目录并出现在安装候选列表中。
- MCP 安装 manifest schema 补齐示例、文档和 builder smoke，可描述本地 stdio、本地 HTTP、npm 包和远端 HTTP MCP。
- MCP 支持显式接管已有手工配置：从当前 config 反推最小 manifest，用户确认后写入 `installed.json` / `lock.json`，接管后才开放 installer-owned 修复 / 卸载，并补 `smoke:mcp-adopt`。
- MCP 安装候选搜索升级为统一来源模型，支持内置 preset、本地 `~/.ccr/mcp/manifests/*.json` 只读扫描和远端 registry 占位，返回来源、路径、状态和同名冲突信息，并补 `smoke:mcp-install-candidates`。
- MCP 文档同步当前导入 / 创建 / 保存常用安装配置 / 接管能力，新增配置示例说明 `~/.ccr/mcp.json`、项目 `.mcp.json`、安装清单和本地候选目录的区别。
- Desktop 展示协议错误卡补齐诊断字段，缺失 projection 时会展示来源、item 类型、状态、内容形态、身份字段和原始引用等信息，便于定位真实坏协议来源。

### BUG 修复

- 修复实时工具结果在 ThreadDisplay reducer 中可能没有进入工具生命周期归并，导致工具调用和工具结果分开展示的问题。
- 修复 AskUserQuestion / 权限回答后刷新 snapshot 时，system 形态的内部合成控制消息 `No response requested.` 可能被转成缺少 projection 的裸 `system_notice` 协议错误卡的问题。

## 0.5.2 - 2026-05-31

### 改动

- Desktop 历史恢复和实时展示主路径统一为 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，Renderer 不再消费旧 `threadMessages` replay 展示状态。
- App Server 展示投影继续收敛：历史普通消息、实时 started item、实时 completed item、工具生命周期展示项和系统类特殊项复用公共 `ThreadDisplayItem` factory，为后续统一 display reducer 铺路。
- App Server 历史 snapshot 和实时 patch 入口开始委托同一个 display reducer；附件 / 错误 projection 拆出独立 projector，降低主投影器继续膨胀的风险。
- Core 当前模型上下文与 UI 可见历史改为同源双投影：compact 后继续对话使用压缩后的 `currentContextMessages`，历史 UI 仍从 transcript 展示投影恢复压缩前后可见记录。
- 历史恢复新增 Codex-like ordered 语义适配层：transcript 会先生成 `classifiedTranscriptEvents`，再解析 `currentContextTailUuid`；`canonicalLeafUuid` 仅保留为兼容字段，不再表示 parent graph leaf。
- 会话物化边界收口：`conversationMaterialization.ts` 自己读取 transcript JSONL 生成 ordered/rawIndex/坏行诊断；`sessionStorage.ts` 和 `buildConversationChain(...)` 仅保留为原生读侧 helper，不再承载 UI replay 或 current tail 产品语义。
- 工具展示按来源 ID 归并：一个 `tool_use` 对应一张工具卡，`tool_result` 按 `tool_use_id` 回填对应工具卡，支持同一 turn 内多个工具调用和结果乱序返回。
- 新增统一上下文预算 resolver，Core、Desktop 顶栏、自动压缩、附件预算、工具搜索和成本记录统一从当前 provider/profile/model 的模型目录读取上下文窗口，不再用旧 model-string 逻辑静默兜底。
- 上下文预算状态新增 `totalContextWindow`、`effectiveInputWindow`、`autoCompactThreshold` 等字段，DeepSeek 1M、Codex OAuth 200K 等模型切换后会同步影响展示和压缩阈值。
- 新增模型调用使用事件流，CLI 和 Desktop / App Server Core 会在模型调用结算后写入用户级 `~/.ccr/usage-events/YYYY-MM.jsonl`，固化 provider、profile、model、contextBudget、usage、cost 状态和 request/session/thread 信息，供后续独立“使用统计”页面聚合；未知价格表不会写入伪造成本。
- Desktop 新增独立“使用统计”页面，读取 usage event 按时间范围展示 token 使用量和调用次数报表，支持按 provider、profile、model、project 聚合，并提供调用报表和单次调用事实详情。
- 普通历史恢复提示不再显示易混淆的“已回放 N 条”数量；raw transcript、Core context、visible timeline 等数量仅用于调试和诊断。
- Desktop 主路径不再支持旧 replay 展示协议、旧实时展示通知或缺失 projection 的 raw fallback；缺失 / 非法 projection 会展示协议错误卡。
- App Server 工具展示投影拆出 `threadDisplayToolProjector`，工具 snapshot、分类、状态、耗时、错误归因和主时间线隐藏策略从主投影器中独立出来，继续收敛 UI display reducer 边界。
- App Server 文件展示投影拆出 `threadDisplayFileProjector`，文件 snapshot、搜索引用、路径安全、文本范围、diff 和文件动作从主投影器中独立出来。
- App Server 新增 `ThreadDisplayReducerInputEvent` 统一输入事件层，历史 `AppServerThreadMessage` 和实时 `CoreTurnEvent` 会先标准化成统一展示输入事件，再交给现有 snapshot / patch 输出分支，为后续单一 display reducer 状态机铺路。
- ThreadDisplay 输入事件契约补齐 `orderKey`、`sourceIdentity` 和 `payload`；历史和实时展示事件进入 reducer 前都会先生成顺序、身份和载荷事实，未知输入进入显式 diagnostic，不使用旧路径静默兜底。
- App Server `ThreadDisplayReducer` 统一状态机继续收口：历史 snapshot 和实时 patch 都通过 `ThreadDisplayReducerInputEvent` 进入同一个 reducer 类型，reducer 实例直接维护 snapshot items、pending patch operations、工具 lifecycle 和工具绑定状态，并通过 smoke 固定旧历史 / 实时 reducer 入口不得回归。
- App Server `ThreadDisplayReducer` 内部状态深化为单一 ordered display state：`orderedItemIds` 负责展示顺序，`itemsById` 负责展示事实，`displayIdBySourceIdentity` / `toolLifecycleByToolUseId` 负责身份归并；历史 snapshot 和实时 patch 都从同一份 state 派生。
- ThreadDisplay projector 纯化继续推进：tool / attachment / Desktop 展示侧不再扫描 raw content 猜测工具块或模型输出附件，统一使用 reducer 已确认的 `contentIndex` / `primaryBlock` / 唯一匹配块；assistant 生成图片路径改为在 App Server 进入投影前物化成图片块。
- ThreadDisplay 旧展示分支继续清理：Desktop 缺 projection 的 `thinking_summary` 不再走 raw fallback；Renderer 旧工具生命周期合并入口显式命名为 legacy，并由 smoke 固定 ThreadDisplay 主路径不按 raw `toolUseId` 合并结果。
- MCP Playwright 浏览器工具现在会在 CCR 出站层阻止 `file://` 导航，并提示先启动本地 HTTP 服务后再访问 localhost，避免外部 MCP 长时间卡住。
- 会话恢复的当前模型上下文主路径改为从 ordered transcript events 直接生成 `currentContextMessages`，不再在 `conversationMaterialization.ts` 中调用 `buildConversationChain(...)` 作为隐式兜底；无法匹配来源 `tool_use` 的孤立 `tool_result` 会从当前模型上下文移除并保留诊断。
- ThreadDisplay 协议边界收口：Desktop 主展示权威明确为 `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations`，`messages` 只作为 current-context / legacy 兼容载荷；Desktop main 不再合并 snapshot，counts 仅用于诊断和 telemetry。
- ThreadDisplay 输入协议硬化完成 FODR-01：`ThreadDisplayReducerInputEvent.diagnostics` 成为硬字段，adapter 输出和 reducer 入口增加运行时协议校验，unsupported 输入进入 reducer diagnostics / protocol error card，并由 smoke 固定 fail-fast 行为。
- ThreadDisplay 展示事实层完成 FODR-02：新增 `ThreadDisplayFact` 中间层，历史 / 实时 reducer 路径先解析 message、tool lifecycle、file、attachment、error、system、control、unsupported fact，再生成 state item 或 patch；projector 优先消费 `metadata.displayFact` 限定投影范围。
- ThreadDisplay 单状态机输出统一完成 FODR-03：实时路径先执行 reducer state transition，再导出 patch operation；历史 snapshot 改为 `reducer.toSnapshot(...)` 输出 view；重复 completed tool_use 不再生成 patch，并行工具和乱序 result 继续收敛到同一工具卡。
- ThreadDisplay Desktop 纯消费完成 FODR-04：Desktop main 刷新时直接保存 App Server `displaySnapshot`，不再使用 snapshot merge 防退化补旧项；`smoke:desktop-session-state` 新增历史 snapshot 和实时 patch 最终 `DisplayEvent` 等价的黄金回归。
- ThreadDisplay 黄金回归补强：`smoke:desktop-session-state` 的全量 fixture 覆盖用户图片、assistant 文本、thinking-only、compact、TodoWrite、模型生成图片、并行/乱序工具结果、orphan result、turn error 和 unsupported diagnostic。
- ThreadDisplay 全事件 Ordered Display Reducer 深化阶段收口：permission / compact / control、附件 / 生成物、tool progress / failed / interrupted、unsupported 和 projection error 已进入统一 fact / reducer / golden 覆盖矩阵。
- 更新会话上下文、App Server 会话 API、Desktop 展示、工具卡、通用卡片、协议状态总账和版本路线图文档，统一标注当前权威入口，避免旧 P7 / 旧 Desktop replay 口径继续误导后续实现。
- 继续收敛 P1 展示文档口径：模型输出标准、工具卡契约和通用卡片计划明确区分 App Server 展示事实源与 Desktop 视觉模型，未知结构改为显式诊断展示，不再使用静默 fallback 表述。
- 继续收敛 P2 导航文档：协议状态总账新增会话 / 展示协议阅读顺序，版本路线图明确 ThreadDisplay 收敛属于 `0.5.x` 稳定化范围，架构索引补充上下文 / 展示链路排查入口。
- 新增全事件统一 Ordered Display Reducer 未来设计文档，明确 `orderKey`、`sourceIdentity`、`payload` 的职责边界，以及从当前 ThreadDisplay reducer 演进到唯一 ordered display state 的分阶段路径。
- 新增 ThreadDisplay Ordered Display Reducer goal plan 文档，按 ODR-01 到 ODR-04 拆分输入契约、单一 ordered state、projector 纯化和旧分支清理，作为后续只设计不实现的落地路线。
- 新增 Full Ordered Display Reducer 最终状态机 goal plan，把后续深化拆成 FODR-01 输入协议硬化、FODR-02 DisplayFact 中间事实层、FODR-03 单状态机输出统一和 FODR-04 Desktop 纯消费与黄金回归，并同步更新 ThreadDisplay 设计入口。

### BUG 修复

- 修复上下文压缩后切换会话再恢复时，Core 当前上下文可能回到 compact 前旧消息的问题。
- 修复手动 compact 后立即回读 transcript 时可能读到未 flush 的旧 JSONL，导致实时上下文 token 仍显示压缩前大小的问题。
- 修复手动 compact 后恢复上下文短于实时上下文的问题；compact 后的附件和系统附属消息会跟随摘要进入当前模型上下文。
- 修复手动 compact 完成后顶部“上下文”数字仍显示 compact 前估算，切换会话后才更新的问题；Desktop 状态快照会刷新 runtime context 后再返回。
- 修复历史恢复时 compact 前 UI 可见历史被误裁掉的问题。
- 修复并行工具结果 sibling 或旧 parent leaf 多候选导致恢复失败，并被误显示成 `Session transcript not found` 的问题；物化失败现在保留具体 diagnostic code。
- 修复并行工具结果按返回顺序或 raw content 误绑定，导致工具卡重复、错位或变成 assistant 普通文本的问题。
- 修复权限请求被拒绝后，实时 UI 仍停留在“等待授权”直到刷新才变成失败卡的问题。
- 修复 DeepSeek 等 1M 上下文模型仍按旧 200K 窗口触发自动压缩或顶部显示错误上限的问题。
- 修复模型生成图片结果在普通 assistant 消息中只显示本地路径、不渲染附件卡的问题。
- 修复 `todo_reminder` 等内部附件在 Desktop 主聊天流中被显示成普通“附件”消息的问题。
- 修复 reasoning / thinking-only 消息把隐藏推理内容送入 Desktop patch，可能导致界面卡顿或出现混淆占位的问题；现在仅显示受控系统提示。
- 修复 Desktop 工具进度事件在 `thread/display` 协议路径下绕过工具生命周期合并，残留为“工具进度 · 正在执行”卡的问题。
- 修复 Desktop 较短 `ThreadDisplaySnapshot` 曾由前台合并补旧项、导致前台承担第二套展示归并职责的问题；现在 Desktop 直接消费最新 snapshot，展示项缺失由 App Server reducer / 协议诊断和黄金回归暴露。
- 修复 `thread/display` 协议路径仍可能按 raw `toolUseId` 在 Renderer 侧合并工具结果的问题；协议项现在只按 itemId 更新，工具生命周期绑定交由 App Server snapshot / patch 完成。
- 修复实时 `unsupported` 展示输入已进入 fact 层但未被 reducer 显式消费，可能导致 patch operations 为空值并中断黄金回归的问题；现在会投影为协议错误展示项。
- 修复 Desktop 实时 `thread/display/patch` 的 `update_item` 和 `complete_item` 合并漏掉工具 progress 内容块或错误快照，导致实时展示与历史 snapshot 最终状态不一致的问题。
- 补齐普通图片 / 附件 projection 回归覆盖，固定验证用户上传图片和模型输出图片在历史 snapshot、实时 patch 中都以附件展示，避免再次退化成 `[图片]` 占位或本地路径正文。
- 补齐会话恢复 smoke 覆盖：普通恢复、compact 后恢复、compact 前 UI 历史可见、并行工具、tool_result 乱序、多 legacy leaf 诊断、物化失败 diagnostic、App Server snapshot 和 Desktop display events。
- 新增上下文预算 smoke，固定验证 DeepSeek 1M 和 Codex OAuth 200K 预算口径。

## 0.5.1 - 2026-05-22

### 改动

- 新增只读 `CcrToolRegistry` 第一版，先从现有 `Tool[]` 生成工具中文名、分类、来源、direct/deferred/internal 暴露建议和展示建议，不改变模型协议、App Server 事件协议或 Desktop 展示。
- 新增 `CcrToolAvailability` 第一版，App Server 工具池可集中输出 `Bash`、`Agent`、`GenerateImage`、MCP 工具等不可用原因，后续 ToolSearch 和 Desktop 展示可复用。
- 新增 `CcrToolSearchPolicy` 第一版，`ToolSearch` 搜索候选改为只来自 available 且 deferred 的工具，避免返回 `GenerateImage`、`TodoWrite`、`ToolSearch` 等 direct/internal 工具。
- 新增 App Server 工具池检查脚本与 registry smoke，固定 Windows 下 `PowerShell` 可见、`Bash` / 无 agent definitions 的 `Agent` 被过滤、`GenerateImage` 保持 `alwaysLoad` 的验收基线。
- 抽出 App Server 平台工具过滤 helper，让运行时和检查脚本复用同一套 Windows 过滤逻辑。
- 新增共享工具展示目录 `toolDisplayCatalog`，`toolRegistry` 与 Desktop `toolEvents` 统一读取中文名、分类、`summaryKeys` 摘要 fallback、`detailKeys` 详情裁剪和 `showInMainTimeline` 主时间线建议，工具卡展示口径和注册口径收敛但不改变模型协议。
- 新增 Provider 能力工具快照，`GenerateImage` 的生图能力可统一说明当前来源 provider/model、同供应商数据边界和不可用原因，并在 App Server / Desktop 模型页诊断中展示。
- 新增 `prepare:ripgrep`，按当前平台准备 `vendor/ripgrep/<arch-platform>/rg(.exe)`；桌面打包和 `ci:smoke` 会在构建/验收前执行，避免发布包依赖用户机器预装 `rg`。
- 更新 README 与 MCP 文档入口，补齐 Desktop / CLI 的 MCP 安装、检测、启停、卸载、配置位置、安装清单、锁文件和 `npx` 快速模式边界说明。
- Desktop 侧边栏新增 Skill / Plugin 占位入口，为 `0.6.0` 扩展能力包治理预留导航位置。

### BUG 修复

- 修复 dev / 非 bundled 环境没有随仓库携带 `vendor/ripgrep` 二进制时，`Glob` / ripgrep 链路直接访问缺失的 `dist/.../vendor/ripgrep/.../rg.exe` 并报 `ENOENT` 的问题；内置 ripgrep 不存在时会自动回退到系统 `rg`，系统 `rg` 也不可用时会走 Node 原生文件搜索兜底。
- 新增文件搜索链路 smoke，覆盖内置 `rg` 可用、无内置 `rg` 且无系统 `rg` 时的 `Glob`、`Grep` 和全局搜索 stream 兜底。
- 优化 Doctor 搜索诊断，真实 `rg` 不可用但 Node 原生文件搜索兜底可用时会显示 fallback 状态，而不是只显示 `Not working`。

### 版本线规划

- `0.5.x`：继续收敛多模态、多模型和工具调用相关问题，包括 provider 能力边界、图片/附件展示、历史请求修复、错误诊断、工具权限体验和 MCP 动态工具治理。
- `0.6.0`：进入 Skill、Plugin 等扩展能力包主线，重点处理外部能力发现、安装启用、命名空间、版本和审计。

## 0.5.0 - 2026-05-20

### 新功能

- 完成 P23 多模态输入第一版：模型能力目录、Profile 覆盖、发送前校验、`turn/start` 内容块协议、Core 内容块保存和 provider adapter 图片映射已串通。
- Desktop 输入框支持图片/文件选择与粘贴；图片可生成缩略图、发送后展示、点开预览，小文本文件可受限读取后进入上下文。
- `codex-oauth / gpt-5.5` 已支持真实图片请求；文本模型发送图片会在发送前被拦截，避免静默漏发。
- 新增 OpenAI、Kimi、GLM 与 OpenAI-compatible provider 接入，补齐模型目录、Profile 配置、API Key 管理和 provider probe 入口。
- GLM API 模型目录新增 `glm-4.7`、`glm-4.6v` 和 `glm-4.5-air`，便于直接使用开放平台赠送资源包额度。
- 新增 provider-neutral 图片生成输出链路，支持 OpenAI / Codex OAuth / MiniMax 等生成适配器、会话内生成图片事件和生成产物持久化。
- 新增模型可见 `GenerateImage` 工具，GLM / OpenAI / Codex OAuth 等生图请求可走统一工具入口，不再依赖模型自行猜测文件或命令工具。
- 重做 Desktop 日志页为“日志文件 / 事件列表 / 事件详情”三栏工作台，支持不同日志文件切换、事件化阅读、原始 JSON 查看和搜索。
- 日志页新增轻量实时刷新开关，复用现有日志读取入口，不扩展为告警、统计图或监控面板。

### 改动

- 新增 `CCR 标准 LLM 协议 v0.1` 文档，明确多模型、多 provider、多模态、工具调用和错误展示不以某一家原始协议为标准，而以 CCR 内部标准协议为准。
- 新增 Provider 协议盘点与官方文档对照，明确 OpenAI Responses、OpenAI Chat、Anthropic Messages、Gemini GenerateContent、DeepSeek、MiniMax、OpenRouter 和 Vercel AI Gateway 后续需要对接的协议族、协议面和 probe 矩阵。
- 调整后续标准层开发顺序：先做 `CcrContentBlock` 共享类型，再做发送前历史校验，最后推进 `ErrorSnapshot` 错误分类展示。
- 新增 `CcrContentBlock` 共享类型，LLM、Core、App Server 和 Desktop 展示事件开始复用同一套内容块口径。
- 新增 LLM 历史校验器，OpenAI-compatible / DeepSeek 请求前会按 provider profile 修复缺失工具结果或阻断不支持的工具历史。
- 新增 `ErrorSnapshot` 第一版，Desktop 展示事件可携带统一错误分类、来源、严重级别、可重试状态和脱敏诊断详情。
- 历史恢复和工具展示补齐多模态附件条、代码块复制、工具中断状态和内部合成消息过滤。
- 新增 Provider 工具协议能力声明，DeepSeek / OpenAI-compatible / Anthropic 工具 schema、结果回填、strict、deferred tool search 能力有统一查询入口。
- 为日志页及其它原始数据展示区增加统一复制按钮，便于复制 JSON、日志片段和工具详情。
- 优化上下文压缩后的附件恢复展示，明确标识压缩携带附件并隐藏重复附件通知，避免压缩恢复内容显得像无来源的普通附件消息。
- 扩展 provider、生成输出、会话图片流、Desktop 展示事件和模型能力 smoke，`ci:smoke` 会覆盖更多标准协议回归。
- 工具生图结果发回模型时保持文本摘要，App Server / Desktop 事件保留结构化图片块，复用现有附件缩略图和预览 UI。
- 整理文档结构，将架构、恢复清单、阶段 todo、provider 集成说明和源码证据索引归并到更明确的目录入口。
- 项目级 settings 已统一切换到 `.ccr/settings*.json`，不再运行时兼容读取旧 `.claude/settings*.json`。
- Desktop、App Server、CLI/TUI 文案、worktree 复制、settings sync、权限保护和 sandbox 禁写已同步使用 `.ccr` 项目配置路径。

### BUG 修复

- 修复 OpenAI-compatible / DeepSeek 场景下工具调用中断、缺失工具结果、TodoWrite schema 未常驻导致的会话卡死和参数校验问题。
- 修复 OpenAI-compatible / DeepSeek 历史中延迟或孤立 tool result 可能再次污染请求的问题，发送前会丢弃不合法 tool result 并补齐 synthetic 结果。
- 修复 `ExitPlanMode` 和 `TaskOutput` 异常展示口径，避免不存在的 task id 或权限类工具失败时展示成吓人的通用工具执行失败。
- 隐藏计划确认内部 `.ccr/plans/*.md` 草稿写入卡片，避免计划审批卡下方出现重复的“写入文件”事件。
- 计划确认内部草稿与权限卡改用稳定的计划系列 ID 对齐，避免同一轮多次计划写入或事件顺序变化时串卡。
- 修复 GLM-Image 被普通 chat/SSE 路径调用的问题；Desktop 中文自然生图意图会走同一 `glm-api` 供应商下的 `/images/generations`，`glm-image` 误走聊天路径时会在本地拦截。
- 修复 GLM / OpenAI-compatible 工具调用间空文本 delta 被显示成 `暂无内容` 的问题。
- 修复模型生成图片和工具图片附件展示不一致的问题，GLM URL 图片与本地生成图都会复用同一套缩略图和预览 UI。
- 优化 `GenerateImage` 在当前供应商不支持生图时的反馈，改为提示切换到 GLM API、OpenAI 或 Codex OAuth，而不是暴露底层 provider 异常。
- 优化 Desktop 历史会话入口，历史列表会始终展示当前会话；当前会话不可重复切换，运行中显示“运行中”，其他历史会话在任务完成前显示“需等待”且不可切换。
- 修复 GLM / OpenAI 生图返回下载 URL 时缩略图破图的问题；URL 输出会先由后端下载并持久化为本地生成物，历史里已保存的远程 URL 也会由 Desktop 主进程下载后生成缩略图。
- 优化模型生成图片消息展示，文件名、类型、供应商和保存路径只在图片卡片内展示，避免正文和附件卡重复。
- 修复错误诊断信息过长时撑开聊天宽度的问题，原始诊断块改为宽度受限并在块内滚动。
- 修复生成图片工具卡片重复展示同一段提示词的问题，摘要已包含目标时不再额外显示“目标”元信息。
- 修复历史恢复中内部合成消息被展示的问题，不再显示 `No response requested.`。
- 新增 settings 隔离 smoke，防止项目级 settings 路径后续回退到 `.claude`。

## 0.4.7 - 2026-05

- 修复 Windows 打包态 `CCR.exe` 资源图标仍保留旧图的问题，桌面快捷方式和任务栏现在会使用统一的 CCR 图标。
- 将安装器快捷方式名称固定为 `CCR`，避免继续生成旧的 `CCR Desktop` 快捷方式。
- 调整图标生成脚本，生成 Windows 兼容性更好的 BMP/DIB ICO，并在品牌 smoke 中校验 exe 资源编辑配置。

## 0.4.6 - 2026-05

- 统一产品展示名为 CCR，桌面窗口、安装包、默认会话和发布产物不再使用 CCR Desktop 作为面向用户的名称。
- 统一项目图标来源，安装包、任务栏、标题栏和启动页共用同一套 CCR 品牌图标资产。
- 优化启动页为极简 CCR 图标、状态点和顶部细进度线，并增加最短展示时间，避免启动动画一闪而过。
- 增强桌面品牌 smoke，校验 renderer 图标引用和安装包品牌配置，防止后续图标再次分叉。

## 0.4.5 - 2026-05

- 修复 CCR Desktop 打包安装后窗口过早显示的问题：窗口改为在 renderer 完成加载后显示，并保留启动诊断日志，避免启动时停在白屏。

## 0.4.4 - 2026-05

- 优化 CCR Desktop 启动首屏：窗口等到 renderer 首帧准备好后再显示，避免启动时短暂出现白屏和未初始化布局。
- 增加轻量启动界面作为兜底，在 React/CSS 接管前显示统一的 CCR Desktop 启动画面。

## 0.4.3 - 2026-05

- 新增一级“模型”页面，按“供应商类型 / 连接配置 / 详情”管理 Profile、凭据、模型和连接测试。
- 新增 Profile 优先的 LLM 配置结构：当前选择写入 `current.profileId/current.model`，敏感凭据按 `profileCredentials[profileId]` 存储。
- 新增 `ccr model status/list/set/profile`，TUI `/model` 同步支持 Profile 和模型切换。
- 新增 DeepSeek 官方 API provider，默认模型为 `deepseek-v4-flash`，并支持 `deepseek-v4-pro`。
- 新增 MiniMax 国际版 / 国内版 provider，走 Anthropic Messages 兼容协议，支持 `MiniMax-M2.7` 和 `MiniMax-M2.7-highspeed`。
- 抽出 OpenAI Chat Completions 公共协议适配器，供 DeepSeek 和后续 OpenAI Compatible / 第三方中转复用。
- 抽出 Anthropic Messages 兼容协议适配器，供 MiniMax 和后续 Anthropic-compatible provider 复用。
- 新增模型可用性状态与手动测试连接的 Core / App Server / SDK / Desktop 链路。
- Desktop 顶部拆成“模型切换”和“连接配置切换”两个入口，切换只影响下一轮消息，不自动改写历史会话。
- 每轮消息记录实际使用的 `profileId/provider/apiMode/model/contextWindow` 等元数据，便于审计和排查。
- Desktop 侧边栏引入更明确的图标和悬浮态，后续会继续演进轻量会话侧栏。

## 0.4.2 - 2026-05

- 修复 Desktop GitHub Release 上传超时后的恢复逻辑，重新执行发布脚本会复用已有 release 并补齐缺失资产。
- 强化自动更新发布链路，确保 `latest.yml`、安装器和 `.blockmap` 能稳定对应。
- 统一 Desktop 安装包命名为 `CCR-Desktop-<version>-win-x64.exe`，避免自动更新 metadata 指向不存在的文件。
- 明确 unsigned 安装包发布策略：短期允许未签名发布，并在 release note 中保留 SHA256 校验值。
- 统一 Core 版本和 package 版本口径，避免会话里继续暴露旧的 Claude Code 版本信息。

## 0.4.1 - 2026-05

- 完成 CCR Desktop 自动更新状态机第一版。
- 增加更新检查、下载、重新安装和开发态模拟入口。
- 补充 GitHub Release feed 验证脚本，用于确认远端 `latest.yml` 和安装器资产是否可用。
- 优化 Desktop 设置页，增加自动更新状态展示。

## 0.4.0 - 2026-05

- 发布 CCR Desktop Windows 安装包第一版。
- 新增 Desktop App Server 打包链路，避免安装时释放大量无关文件。
- 增加历史会话弹窗，支持跨工作区分组、搜索和恢复。
- 增加项目级 `.ccr/settings*.json` 隔离方案，避免继续写入 `.claude/settings*.json`。
- 增加权限设置页面，用于查看和修改本地 / 项目 / 用户级工具权限。
- 增加 App Server 会话、权限、上下文、压缩和运行状态相关 smoke。

## 0.3.0 - 2026-05

- 推进 CCR Desktop 原型，接入 App Server、本地工作区、会话启动和基础聊天界面。
- 增加 Desktop 打包、品牌资源、日志和错误可观测相关专项文档。
- 增加 App Server 协议设计和 Desktop 客户端框架选型文档。

## 0.2.0 - 2026-04

- 建立 CCR 自有配置目录 `~/.ccr`。
- 新增内置 LLM Runtime 原型。
- 接入 Codex OAuth provider。
- 保留 Anthropic 兼容边界，用于恢复代码中的旧链路逐步迁移。
- 增加 Playwright MCP 接入和基础 runtime smoke。
