# Goal T：Skill / MCP 发布前测试用例体系

## 1. 目标

本测试专项的目标是在 `0.6.0` 发布前，把 Skill / MCP 当前已经完成的能力固化成可重复验证的测试用例体系。

当前重点不是继续新增功能，而是建立：

```text
自动 smoke -> 负向 / 异常覆盖 -> Desktop 人工验收 -> 发布门禁聚合
```

完成后，Skill / MCP 后续迭代不再只靠临时手测，而是每次发布前都有明确测试入口、覆盖范围和失败诊断。

## 2. 为什么先做测试

MCP 和 Skill 这轮改动跨越了：

- 安装候选。
- manifest 导入和创建。
- 安装计划、确认、记录、修复和卸载。
- managed package 运行时接入。
- SkillTool / slash command / MCP runtime catalog。
- Desktop 管理页面。
- CLI 管理命令。
- 安全扫描和风险提示。

如果没有系统测试，后续发布最容易出问题的地方不是单个函数，而是跨层链路：

- manifest 可以生成，但安装计划没有按预期写入。
- 安装记录存在，但运行时没有真正启用。
- CLI dry-run 正常，但 `--yes` 写入路径或确认 token 错。
- Desktop 页面看起来可用，但保存常用安装配置后候选列表没有刷新。
- MCP / Skill 远端 registry 当前暂停，但错误地出现在可安装候选中。
- hook / shell 风险被保留进 runtime，但安全扫描没有提示。

因此测试专项应优先覆盖端到端链路和负向边界。

## 3. 总体范围

本专项做：

- MCP 安装管理端到端用例。
- Skill 安装管理端到端用例。
- 异常、漂移、安全和暂停能力用例。
- Desktop 关键交互验收用例。
- 发布前测试命令聚合。

本专项不做：

- 不恢复远端 registry。
- 不新增企业 trust policy。
- 不做大规模 UI 自动化框架迁移。
- 不为了测试绕开用户确认、dry-run 或 installer-owned 边界。
- 不把人工本地配置误写成 CCR 安装记录。

## 4. 子 Goal 拆分

### T-1：MCP 端到端测试用例

目标：

- 固化 MCP manifest 导入、创建、安装、接管、修复、卸载和候选搜索的核心路径。
- 覆盖四类安装配置：本地 stdio、本地 HTTP、npm 包、远端 HTTP。
- 明确远端 HTTP 只是连接方式，不等于远端 registry。

建议迭代：

#### T-1.1 MCP manifest fixture 矩阵

输入：

- 本地 stdio manifest。
- 本地 HTTP manifest。
- npm package manifest。
- remote HTTP manifest。

输出：

- fixture 文件或脚本内 fixture。
- schema 校验通过。
- 每类 manifest 都能生成安装计划。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-manifest-builder
npm.cmd run smoke:mcp-manifest-import
```

#### T-1.2 MCP 导入 / 创建 / 保存常用安装配置

输入：

- 从文件导入的 manifest。
- 创建入口生成的 manifest。
- 勾选“保存到常用安装配置”的安装计划。

输出：

- 导入和创建都走同一安装计划确认。
- 保存后进入本地候选目录。
- 候选搜索能查到保存后的配置。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-install-candidates
```

#### T-1.3 MCP 安装 / 状态 / 修复 / 卸载

输入：

- 内置 preset。
- 本地 manifest 候选。
- 已安装记录。
- 漂移或缺失配置。

输出：

- 安装后写入 installer-owned record。
- status 能区分 configured / drifted / missing-config。
- repair 能恢复缺失或漂移配置。
- uninstall 只卸载 installer-owned 配置。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-cli-install
npm.cmd run smoke:mcp-adopt
```

#### T-1.4 MCP runtime 能力可用性

输入：

- 可连接的本地 HTTP MCP。
- 可执行的 stdio MCP。

输出：

- tool list 能进入 MCP runtime。
- tool 调用成功。
- 失败时返回明确诊断，不挂起。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-transport-factory
npm.cmd run smoke:mcp-remote-transport-options
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:mcp-result-processing
```

成功标准：

- MCP 的导入、创建、保存、安装、接管、修复、卸载和 runtime 调用都有 smoke 覆盖。
- 本地候选和内置 preset 的边界清楚。
- remote registry 不进入当前测试路径。

完成记录：

- 状态：已完成。
- 新增 `smoke:mcp-end-to-end`，通过 App Server stdio client 覆盖 MCP manifest 四类 fixture、安装计划、保存常用安装配置、候选刷新、安装、卸载、内置 preset 修复和远端 registry 暂停源。
- MCP 保存常用安装配置从 Desktop 主进程本地写文件收敛到 Core / App Server / client 统一入口：`mcp/install/save-manifest`。
- 已验证 `save-manifest` 会写入临时 `CCR_CONFIG_DIR/mcp/manifests`，并能被 `searchMcpInstalls()` 作为 `local-manifest` 候选重新发现。
- 远端 registry 继续只作为 disabled source 返回，不产生正式候选。
- 验证命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:mcp-end-to-end
npm.cmd run smoke:mcp-manifest-builder
npm.cmd run smoke:mcp-manifest-import
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:mcp-cli-install
npm.cmd run smoke:mcp-adopt
npm.cmd run smoke:mcp-transport-factory
npm.cmd run smoke:mcp-remote-transport-options
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:mcp-result-processing
npm.cmd run smoke:mcp-install-presets
```

### T-2：Skill 端到端测试用例

目标：

- 固化 Skill 从来源发现到 runtime 启用的完整闭环。
- 覆盖本地目录、本地 archive、builtin preset 和 installed managed package。
- 覆盖 Desktop / CLI / runtime 三条入口的一致性。

建议迭代：

#### T-2.1 Skill 来源导入矩阵

输入：

- 本地 skill 目录。
- 本地 zip / tar archive。
- Claude command 转 skill 候选。
- 内置 builtin preset。

输出：

- 全部归一成 `CcrSkillPackage`。
- frontmatter 兼容字段被保留。
- 不支持来源给出明确诊断。

验收命令建议：

```powershell
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-import-local-archive
npm.cmd run smoke:skill-install-builtin-preset
```

#### T-2.2 Skill 安装 / 启用 / 禁用 / 修复 / 卸载

输入：

- 可安装 skill candidate。
- enabled / disabled installed record。
- missing package。
- drifted package。

输出：

- 安装写入 installed record、lock 和 package 目录。
- enabled 决定模型可见性。
- disabled 不进入 SkillTool。
- repair 能恢复缺失 package 或记录。
- uninstall 能删除 installer-owned 安装记录。

验收命令建议：

```powershell
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-api
```

#### T-2.3 Skill runtime 可见性

输入：

- managed installed skill。
- dynamic skill。
- MCP skill。
- local file skill。

输出：

- `SkillRuntimeCatalog` 按优先级统一去重。
- duplicate diagnostics 可查询。
- SkillTool prompt 只包含 enabled / modelInvocable skill。
- slash command 只包含 userInvocable skill。

验收命令建议：

```powershell
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-installed-metadata
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-dynamic-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
```

#### T-2.4 Skill CLI 管理

输入：

- search / import / install / status / inspect / repair / uninstall。
- dry-run。
- `--yes`。
- `--json`。

输出：

- 写入操作默认 dry-run。
- `--yes` 后才应用计划。
- JSON 输出可被脚本断言。
- 错误路径返回稳定 code / message。

验收命令建议：

```powershell
npm.cmd run smoke:skill-cli-search
npm.cmd run smoke:skill-cli-import-install
npm.cmd run smoke:skill-cli-status-repair-uninstall
```

成功标准：

- Skill 的来源、安装、管理、运行时和 CLI 都有自动验证。
- installed managed Skill 和直接文件 Skill 的行为差异被测试固定。
- `hooks`、`shell`、`version`、`paths` 等元数据不会在 runtime 激活时丢失。

完成记录：

- 状态：已完成。
- 新增 `smoke:skill-end-to-end`，通过 App Server stdio client 覆盖 Skill 内置 preset 搜索、本地目录导入、候选搜索、安装计划、安装应用、启用 / 禁用、模型 / 用户调用开关、保存常用安装配置、缺失 package 修复和卸载。
- 已验证保存常用安装配置会写入临时 `CCR_CONFIG_DIR/skills/manifests`，并作为 `local-manifest` 候选重新出现在搜索结果中；manifest 自身继续保留原始来源语义，不做错误改写。
- `smoke:skill-runtime-installed-metadata` 继续固定 `hooks`、`shell`、`version`、`paths` 等 frontmatter 元数据在 managed runtime 中透传。
- `smoke:skill-runtime-catalog-unified` 继续固定 managed / dynamic / MCP / local skill 的统一去重优先级和 duplicate diagnostics。
- CLI 管理路径通过 search / import / install / status / inspect / repair / uninstall smoke 验证，写入操作继续默认 dry-run，显式 `--yes` 后才应用。
- 验证命令：

```powershell
npm.cmd run smoke:skill-end-to-end
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-import-local-archive
npm.cmd run smoke:skill-install-builtin-preset
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-installed-metadata
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-dynamic-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
npm.cmd run smoke:skill-cli-search
npm.cmd run smoke:skill-cli-import-install
npm.cmd run smoke:skill-cli-status-repair-uninstall
```

### T-3：异常、负向和安全测试用例

目标：

- 固化“不应该成功”的边界，避免后续 silent fallback。
- 覆盖 manifest 错误、重复、漂移、安全风险和暂停能力。

建议迭代：

#### T-3.1 Schema 和字段缺失

输入：

- 缺少 name 的 MCP manifest。
- 缺少 command / url 的 MCP manifest。
- 缺少 `SKILL.md` 的 Skill package。
- frontmatter 类型错误。

输出：

- schema 校验失败。
- 失败包含具体字段路径。
- 不生成安装记录。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-manifest-builder
npm.cmd run smoke:skill-import-schema
npm.cmd run smoke:skill-install-schema
```

#### T-3.2 重复和冲突

输入：

- 同名 MCP 候选。
- 同名 Skill。
- local / managed / dynamic / MCP skill 冲突。

输出：

- 候选列表展示冲突信息。
- runtime catalog 按固定优先级选择 winner。
- diagnostics 保留 loser 来源。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:skill-runtime-catalog-unified
```

#### T-3.3 漂移和缺失

输入：

- installed record 存在但 config 缺失。
- config 被人工改动。
- package 目录缺失。
- lock 与 package 不一致。

输出：

- status 显示 drifted / missing。
- repair 给出计划。
- 无法修复时提示原因，不静默成功。

验收命令建议：

```powershell
npm.cmd run smoke:mcp-adopt
npm.cmd run smoke:skill-management-api
```

#### T-3.4 hook / shell 风险

输入：

- Skill frontmatter 带 hook command。
- shell 字段包含可执行入口。
- hook command 访问 HTTP 或 env。

输出：

- 安全扫描报告风险。
- 安装确认能看到风险摘要。
- runtime 透传元数据，但不隐藏风险。

验收命令建议：

```powershell
npm.cmd run smoke:skill-security-scanner
npm.cmd run smoke:skill-security-install-plan
npm.cmd run smoke:skill-security-apply-inspect
```

#### T-3.5 暂停能力不误启用

输入：

- `remote-registry` 来源声明。
- MCP registry 占位。
- Skill registry 占位。

输出：

- registry 不作为正式候选源返回。
- 文档和诊断明确标注暂停。
- 测试固定不能从 registry 直接安装。

成功标准：

- 失败路径有稳定诊断。
- 没有 silent legacy fallback。
- 暂停能力不会被误当成当前已实现能力。

完成记录：

- 状态：已完成。
- 新增 `smoke:skill-mcp-negative-boundaries`，固定 MCP / Skill 远端 registry 的当前暂停边界：MCP 只返回 disabled `remote-registry` source，不产生正式候选；Skill 当前没有 `remote-registry` source / candidate，`remote-registry` import source 会被 schema 拒绝。
- 该脚本同时验证坏 MCP manifest 会进入候选错误诊断，不会生成安装候选。
- schema 负向路径继续由 `smoke:mcp-manifest-builder`、`smoke:skill-import-schema`、`smoke:skill-install-schema` 覆盖。
- 重复和冲突继续由 `smoke:mcp-install-candidates` 与 `smoke:skill-runtime-catalog-unified` 覆盖，固定 duplicate-name 与 runtime winner / loser diagnostics。
- 漂移和缺失继续由 `smoke:mcp-adopt`、`smoke:skill-management-service`、`smoke:skill-cli-status-repair-uninstall` 覆盖。
- hook / shell 风险继续由 `smoke:skill-security-scanner`、`smoke:skill-security-install-plan`、`smoke:skill-security-apply-inspect` 覆盖，安装计划会保留风险摘要和安全 override 边界。
- 验证命令：

```powershell
npm.cmd run smoke:mcp-manifest-builder
npm.cmd run smoke:skill-import-schema
npm.cmd run smoke:skill-install-schema
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:mcp-adopt
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-cli-status-repair-uninstall
npm.cmd run smoke:skill-security-scanner
npm.cmd run smoke:skill-security-install-plan
npm.cmd run smoke:skill-security-apply-inspect
npm.cmd run smoke:skill-mcp-negative-boundaries
```

### T-4：Desktop 交互验收用例

目标：

- 补齐 Desktop 页面层面的关键人工验收用例。
- 第一版以人工 checklist + App Server smoke 为主，不强行引入完整 UI 自动化。

建议迭代：

#### T-4.1 MCP 管理页验收

场景：

- 打开 MCP 管理页。
- 查看内置候选。
- 导入 MCP 安装配置。
- 创建 MCP 安装配置。
- 勾选保存到常用安装配置。
- 安装、修复、卸载。
- 查看当前配置和安装记录状态。

验收点：

- 安装候选列表不重复展示已安装项和已安装记录。
- 卸载入口在详情 / 已安装记录语义清楚。
- 默认用户全局，不展示无意义范围切换。
- 创建表单提交后能自动收起或回到列表状态。

#### T-4.2 Skill 管理页验收

场景：

- 打开 Skill 管理页。
- 查看 installed / candidate / runtime diagnostics。
- 导入本地目录。
- 导入 archive。
- 安装 builtin preset。
- 启用、禁用、修复、卸载。

验收点：

- 风险摘要可见。
- runtime diagnostics 可见但不吓人。
- enabled 状态和 runtime 可见性一致。
- 缺失 package / drifted 状态有明确操作。

#### T-4.3 页面状态和错误卡

场景：

- App Server 返回 schema error。
- 安装计划失败。
- repair 不可用。
- 当前配置和 installed record 不一致。

验收点：

- 错误有明确来源、字段和下一步。
- 不出现空白卡。
- 不出现重复解释文案。
- 不把协议错误伪装成安装成功。

输出：

- 新增 Desktop MCP / Skill 人工验收文档，或者补到 release acceptance runbook 的 Skill / MCP 小节。
- 必要时补轻量 smoke，验证 App Server 对页面所需 API 的 payload 结构。

成功标准：

- 发布前人工验收不再靠临时口述。
- Desktop 页面关键路径有可逐项勾选的用例。
- 自动 smoke 和人工验收边界清楚。

完成记录：

- 状态：已完成。
- 在 `docs/architecture/desktop-release-acceptance-runbook.md` 新增 Skill / MCP 管理页人工验收小节，覆盖 MCP 管理页、Skill 管理页和页面错误卡三组场景。
- 新增 `fixtures:desktop-management-acceptance`，用于生成本地验收 fixture：本地 Skill 目录、Claude command 文件、本地 HTTP MCP manifest、本地 stdio MCP manifest 和 Skill 安装 manifest。
- 验收文档明确自动 smoke 负责协议 / Core 行为，人工验收负责页面状态、按钮位置、确认区、错误卡和文案密度。
- MCP 页面验收固定：用户全局默认、候选不重复、卸载入口在详情 / 已安装语义下、保存常用安装配置后能重新作为本地候选出现。
- Skill 页面验收固定：导入、安装、安全摘要、启用 / 禁用、modelInvocable / userInvocable、修复、卸载、Claude command 转换和本地 manifest 候选。
- 验证命令：

```powershell
npm.cmd run typecheck:desktop
npm.cmd run fixtures:desktop-management-acceptance
npm.cmd run smoke:mcp-end-to-end
npm.cmd run smoke:skill-end-to-end
npm.cmd run smoke:skill-mcp-negative-boundaries
```

### T-5：发布测试门禁聚合

目标：

- 把零散 smoke 收敛成发布前一键或分组命令。
- 让发布流程能明确回答“这版 Skill / MCP 是否可发”。

建议迭代：

#### T-5.1 分组脚本

新增或确认 package scripts：

```powershell
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd run smoke:desktop-release-gate
```

建议含义：

- `smoke:mcp-release`：MCP install / manifest / runtime / CLI 核心路径。
- `smoke:skill-release`：Skill import / install / runtime / security / CLI 核心路径。
- `smoke:desktop-release-gate`：Desktop API payload、发布产物和必要 UI 前置验收。

#### T-5.2 发布前总门禁

建议最终命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd pack --dry-run
```

Desktop 发布前再追加：

```powershell
npm.cmd run desktop:dist
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run smoke:desktop-signing-readiness
npm.cmd run release:desktop:check
```

#### T-5.3 失败诊断规范

要求：

- 每个 release smoke 输出所属领域：MCP / Skill / Desktop。
- 失败时输出 fixture 名称、输入类型和预期状态。
- 涉及本地临时目录时输出路径。
- 涉及 registry 暂停时明确写“暂停能力”，不写成网络失败。

成功标准：

- 发布前不需要人工拼一长串命令。
- release gate 可以在 CI 或本地稳定执行。
- `npm pack --dry-run` 纳入发布前检查。

完成记录：

- 状态：已完成。
- 新增 `scripts/run-release-smoke-group.mjs`，按领域顺序执行发布前 smoke，失败时输出 `group`、`step` 和 exit / error，便于定位。
- 新增 package scripts：

```powershell
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd run smoke:desktop-release-gate
```

- `smoke:mcp-release` 聚合 MCP manifest、候选、CLI、接管、transport、runtime、结果处理和 preset smoke。
- `smoke:skill-release` 聚合 Skill 端到端、来源导入、安装管理、runtime、CLI、安全和 Skill / MCP 负向边界 smoke。
- `smoke:desktop-release-gate` 聚合 Desktop 类型检查、管理页验收 fixture、Desktop display / session / shell cards，以及 Skill / MCP 管理 API 前置链路。
- `docs/architecture/desktop-release-acceptance-runbook.md` 已补正式发布前门禁命令，区分不依赖安装器的 release gate 和生成安装器后的产物门禁。
- 验证中发现 `smoke:desktop-display-events` 仍引用旧的 `formatInstalledRecord` 导出；已在 `McpPage.tsx` 补回该稳定 helper，继续固定 MCP installed record 摘要格式。
- 验证命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd run smoke:desktop-release-gate
npm.cmd pack --dry-run
```

## 5. 推荐执行顺序

建议按下面顺序一个个使用 goal 执行：

1. `T-1`：MCP 端到端测试用例。
2. `T-2`：Skill 端到端测试用例。
3. `T-3`：异常、负向和安全测试用例。
4. `T-4`：Desktop 交互验收用例。
5. `T-5`：发布测试门禁聚合。

这样安排的原因：

- MCP / Skill 自动 smoke 是最硬的发布风险，先补。
- 负向和安全用例会反向固定边界，避免后续为了通过 happy path 牺牲安全。
- Desktop 第一版先做人工验收，不阻塞核心自动门禁。
- 最后再聚合 release gate，避免一开始就把尚未稳定的命令塞进总门禁。

## 6. 当前已有测试资产

当前已经存在不少 smoke，后续 goal 不是从零开始，而是把它们补齐、分类和聚合。

Skill 已有代表性入口：

```powershell
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-installed-metadata
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-security-scanner
npm.cmd run smoke:skill-cli-search
npm.cmd run smoke:skill-cli-import-install
npm.cmd run smoke:skill-cli-status-repair-uninstall
```

MCP 已有代表性入口：

```powershell
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:mcp-manifest-builder
npm.cmd run smoke:mcp-manifest-import
npm.cmd run smoke:mcp-cli-install
npm.cmd run smoke:mcp-adopt
npm.cmd run smoke:mcp-result-processing
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:mcp-transport-factory
npm.cmd run smoke:mcp-remote-transport-options
```

## 7. 成功标准

本测试专项完成时：

- MCP 和 Skill 的主要 happy path 都有自动 smoke。
- 关键负向路径都有明确失败断言。
- Desktop 页面有可执行的人工验收清单。
- 发布前有分组 gate，不再靠手动拼命令。
- 文档明确记录哪些是当前已测能力，哪些是暂停 / backlog。

## 8. 后续入口

测试专项完成后，再进入：

- 提交代码。
- 推送远端。
- 打 `v0.6.0` tag。
- 触发 npm release。
- 生成 Desktop 安装包并走 GitHub Release。
