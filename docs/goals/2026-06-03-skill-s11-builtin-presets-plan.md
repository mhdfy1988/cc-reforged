# Goal S-11：内置 Skill preset 内容层

完成状态：已完成。

## 1. 目标

S-11 的目标是在 Skill 安装闭环已经完成后，补齐 CCR 自己的第一批内置 Skill preset。

这批内置 Skill 不是为了照搬 Codex / Claude / OpenClaw 的包结构，而是把 CCR 用户最常用、最容易重复出错的工作流做成可安装、可审查、可按需调用的 Skill 包。

第一批建议内置 6 个：

| Goal | 稳定 ID | 展示名 | 作用 |
| --- | --- | --- | --- |
| S-11.1 | `ccr-skill-starter` | Skill 包助手 | 创建、更新、审查 CCR Skill 包 |
| S-11.2 | `skill-install-helper` | Skill 安装助手 | 指导导入、安装、启用、修复、卸载 Skill |
| S-11.3 | `mcp-config-helper` | MCP 配置助手 | 创建和审查 MCP 安装配置 |
| S-11.4 | `bug-debug-helper` | BUG 排查助手 | 按问题驱动方式排查 CCR 本地 BUG |
| S-11.5 | `release-check-helper` | 发布检查助手 | 发布前检查版本、文档、构建、smoke 和打包 |
| S-11.6 | `docs-update-helper` | 文档更新助手 | 做 README、CHANGELOG、goal 和专题文档同步 |

## 2. 设计原则

本阶段必须遵守：

- 以 CCR 标准 Skill 包为准：`SKILL.md` 是唯一必需入口。
- 内置 Skill 包默认只放真正会被 agent 使用的内容。
- 可选资源只使用 `references/`、`scripts/`、`assets/`，不创建 README、快速开始、CHANGELOG 等杂项文件。
- 不把 `agents/openai.yaml` 放进 CCR 自己的内置 preset；它只作为导入 Codex skill 时的兼容元数据。
- 不把安装配置说明塞进 Skill 包内部；安装配置由 CCR 安装管理层维护。
- 不在内置 Skill 正文里直接写容易触发安全扫描误报的敏感词或命令样例；需要表达风险时用中文语义说明。
- 每个 preset 都要走同一套候选、安装计划、安全扫描、安装记录、运行时加载和卸载修复链路。

## 3. 范围

本阶段做：

- 拆分内置 preset 定义，避免 `builtinPresets.ts` 继续膨胀。
- 为每个内置 Skill 补独立 `SKILL.md` 内容。
- 必要时为每个内置 Skill 补少量 `references/`。
- 扩展内置 preset 搜索、安装、安装后 inspection 和修复 smoke。
- 在 Desktop Skill 管理页确认 6 个内置候选展示、安装状态和风险标签正常。
- 更新 README、Skill 文档、CHANGELOG 和 goal README。

本阶段不做：

- 不做远端 Skill registry。
- 不做 GitHub / 网络下载安装。
- 不做 Codex curated skill marketplace。
- 不做自动推荐或使用统计。
- 不把内置 Skill 默认全部安装到用户环境。
- 不绕过用户确认安装。

## 4. 建议代码结构

当前 `src/services/skills/builtinPresets.ts` 已承担 registry、preset 内容和物化逻辑。S-11 建议先做轻量拆分：

```text
src/services/skills/builtinPresets.ts
src/services/skills/builtinPresetDefinitions/skillPackageHelper.ts
src/services/skills/builtinPresetDefinitions/skillInstallHelper.ts
src/services/skills/builtinPresetDefinitions/mcpConfigHelper.ts
src/services/skills/builtinPresetDefinitions/bugDebugHelper.ts
src/services/skills/builtinPresetDefinitions/releaseCheckHelper.ts
src/services/skills/builtinPresetDefinitions/docsUpdateHelper.ts
src/services/skills/builtinPresetDefinitions/registry.ts
```

不变式：

- `builtinPresets.ts` 保持对外 API，不让调用侧大改。
- 每个 preset definition 只导出一个 `BuiltinSkillPreset`。
- `registry.ts` 只负责排序、重复 ID / name 校验和列表聚合。
- 物化到磁盘时仍走现有 `materializeBuiltinSkillPresetPackage`。
- 安装后仍是 managed package，不在运行时为 builtin preset 开特殊分支。

## 5. Goal 拆分

### S-11.1 Skill 包助手

目标：

- 稳定现有 `ccr-skill-starter`。
- 展示名使用 `Skill 包助手`，保留旧 ID 以兼容已安装记录和 smoke。
- 正文只覆盖创建、更新、审查和必要转换，不再照搬 Codex UI 元数据结构。
- 资源只保留审查清单。

迭代：

1. 收缩包结构：只保留 `SKILL.md` 和 `references/checklist.md`。
2. 调整正文：强调 CCR 标准、progressive disclosure、风险审查。
3. 验证安全扫描最高风险仍为 `info`。

验收：

```powershell
npm.cmd run smoke:skill-install-builtin-preset
npm.cmd run smoke:skill-install-candidates
```

### S-11.2 Skill 安装助手

目标：

- 新增 `skill-install-helper`。
- 指导用户完成 Skill 导入、安装、启用 / 禁用、修复、卸载和状态诊断。
- 重点解释“导入”和“安装”的区别：导入是来源归一，安装是 managed package 落账。
- 支持本地目录、本地 archive、已导入 Skill、内置 preset 和本地 manifest。

迭代：

1. 编写 `SKILL.md`：候选搜索、安装计划、确认 token、安装记录、运行时状态。
2. 补 `references/install-flow.md`：导入、安装、修复、卸载的状态流。
3. 补 smoke：搜索并安装 `skill-install-helper`，确认 package resources、origin、风险等级。

验收：

```powershell
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-builtin-presets
```

### S-11.3 MCP 配置助手

目标：

- 新增 `mcp-config-helper`。
- 帮用户创建或审查 MCP 安装配置，而不是直接改 MCP client。
- 覆盖本地 stdio、本地 HTTP、npm 包、远端 HTTP 四类安装配置。
- 说明“当前配置”“安装记录”“常用安装配置”的区别。

迭代：

1. 编写 `SKILL.md`：先判断 MCP 类型，再生成最小安装配置建议。
2. 补 `references/mcp-config-examples.md`：只放短示例，不复制完整 MCP 文档。
3. 补 smoke：候选可搜索、安装后可被 Skill runtime 发现，风险不高于预期。

验收：

```powershell
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:skill-install-builtin-presets
```

### S-11.4 BUG 排查助手

目标：

- 新增 `bug-debug-helper`。
- 固化 CCR 本地 BUG 排查流程：先复述问题、确认入口、限定首轮范围、沿调用链回溯。
- 适用于 UI 与数据不一致、协议错误、构建 / smoke 异常、运行时状态不一致。
- 不替代全局 BUG 调试规则，只把 CCR 项目常见入口和验证方式收进来。

迭代：

1. 编写 `SKILL.md`：问题复述、入口定位、首轮文件范围、调用链回溯、最小修复。
2. 补 `references/ccr-debug-entrypoints.md`：ThreadDisplay、MCP、Skill、Desktop、App Server 常见入口索引。
3. 补 smoke：安装后可搜索、资源列表正确、安全扫描无误报。

验收：

```powershell
npm.cmd run smoke:skill-install-builtin-presets
npm.cmd run smoke:skill-security-scanner
```

### S-11.5 发布检查助手

目标：

- 新增 `release-check-helper`。
- 固定发布前检查顺序：版本号、CHANGELOG、README、typecheck、build、Skill / MCP smoke、npm pack、Desktop release gate。
- 明确 Skill 版本规划：Skill 大批次走 `0.6.x`，不误写成 `0.5.3`。
- 输出发布前问题清单，不自动发布。

迭代：

1. 编写 `SKILL.md`：发布前 checklist 和失败处理顺序。
2. 补 `references/release-gate.md`：当前推荐命令、暂停项、不可跳过项。
3. 补 smoke：安装、运行时可发现、正文可加载。

验收：

```powershell
npm.cmd run smoke:skill-install-builtin-presets
npm.cmd run smoke:desktop-release-gate
```

### S-11.6 文档更新助手

目标：

- 新增 `docs-update-helper`。
- 帮用户在大改后同步 README、CHANGELOG、goal、专题文档和 stale wording。
- 强调“当前已实现 / 暂停 / 后续 backlog”三类状态要分开写。
- 避免把旧版本口径、设计占位或暂停能力写成当前实现。

迭代：

1. 编写 `SKILL.md`：文档审计入口、差异分类、更新顺序。
2. 补 `references/doc-audit-checklist.md`：Skill、MCP、Desktop、release 常见文档清单。
3. 补 smoke：候选可搜索、安装和资源扫描通过。

验收：

```powershell
npm.cmd run smoke:skill-install-builtin-presets
git diff --check -- README.md CHANGELOG.md docs
```

## 6. S-11 Closeout

目标：

- 6 个内置 Skill 都进入候选列表。
- 每个内置 Skill 都能安装、检查、修复、卸载。
- 每个内置 Skill 都能在 runtime catalog 中按 managed skill 出现。
- Desktop Skill 管理页展示名称、说明、风险和安装状态正常。
- 文档和 CHANGELOG 写清楚这是 CCR 内置 preset，不是远端 registry。

验收：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-install-builtin-presets
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-end-to-end
git diff --check
```

## 7. 执行顺序

建议按下面顺序逐个 goal 执行：

```text
S-11.1 Skill 包助手
S-11.2 Skill 安装助手
S-11.3 MCP 配置助手
S-11.4 BUG 排查助手
S-11.5 发布检查助手
S-11.6 文档更新助手
S-11 Closeout
```

其中 S-11.1 先做，是为了固定内置包标准，避免后续 5 个继续复制错误结构。

## 8. 后续 backlog

暂不进入 S-11：

- 远端 Skill registry。
- curated skill marketplace。
- 企业 trust policy。
- Skill 使用统计和推荐。
- 自动把外部 Skill 批量转换成内置 preset。

## 9. 完成记录

状态：已完成。

落地内容：

- `builtinPresets.ts` 保持对外 API，内置 preset 内容拆到 `src/services/skills/builtinPresetDefinitions/`。
- 新增 registry 重复 ID / name 校验。
- `ccr-skill-starter` 收缩为 CCR 自己的 `SKILL.md` + `references/checklist.md`，不再携带 `agents/openai.yaml` 或安装配置说明。
- 新增 `skill-install-helper`、`mcp-config-helper`、`bug-debug-helper`、`release-check-helper` 和 `docs-update-helper`。
- 新增 `smoke:skill-install-builtin-presets`，全量覆盖内置 preset 搜索、安装、检查、缺失修复和安全等级。

验证：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-install-builtin-presets
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-end-to-end
npm.cmd run smoke:desktop-release-gate
git diff --check
```
