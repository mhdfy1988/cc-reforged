# Goal：Skill P2 能力目录、诊断与完整性

## 1. 目标

本阶段目标是处理 Skill 审查中的 P2 语义问题：

```text
Desktop Skill 管理页
  -> 从只列安装记录
  -> 升级为列运行时 Skill 能力目录

runtimeDiagnostics
  -> 从全局上一次运行快照
  -> 改为按当前 workspace / cwd / configHome 计算

lock 完整性
  -> 从只校验 SKILL.md
  -> 扩展到资源文件漂移检测
```

完成后，Skill 管理面看到的是“当前可用能力”而不只是“安装记录”；诊断不再串 workspace；资源漂移不会被 `SKILL.md` checksum 掩盖。

## 2. 为什么独立做

P1 已经先修安装 / 修复的破坏性问题。P2 处理的是“事实口径”问题：

- 用户关心的是当前能用哪些 Skill，而不是只关心哪些包被 CCR 安装过。
- 插件 Skill、内置插件 Skill、动态 Skill、MCP 生成 Skill 已经可能进入运行时，但管理页还看不到。
- 诊断如果来自全局旧快照，Desktop 会展示空的、旧的或别的 workspace 的诊断。
- 只 hash `SKILL.md` 会让 `scripts/`、`references/`、`assets/` 漂移后仍显示一致。

这些问题会直接影响用户对 Skill 管理页的理解，所以先做统一事实层，再做 P3 的结构去重。

## 3. 范围

本阶段做：

- 设计并落地 Skill 能力目录（capability catalog）视图。
- 管理状态返回 installed records，同时返回 runtime capability 列表和来源。
- capability 至少覆盖 managed installed、plugin、bundled、dynamic、MCP 生成 Skill。
- 每个 capability 标明来源、运行时可见性、model/user invocation 状态、关联安装记录。
- `runtimeDiagnostics` 按当前请求上下文计算，不依赖模块级旧快照。
- lock 写入和检查扩展资源树摘要，覆盖 `scripts/`、`references/`、`assets/` 等 package 内容。
- 增加 smoke 覆盖插件/内置/动态能力可见、cwd/configHome 诊断隔离、资源文件漂移。

本阶段不做：

- 不重构 Desktop 页面交互设计。
- 不改变 SkillTool prompt 格式。
- 不改变 MCP 工具命名协议。
- 不做远端 Skill registry。
- 不处理 `installInspector` / `installedSkillLoader` 重复实现；这放到 P3。

## 4. 术语口径

本阶段统一三个概念：

- 安装记录（installed record）：CCR 安装器写入 `installed.json` 的持久化记录。
- 运行时能力（runtime capability）：当前模型或用户入口实际可见的 Skill 能力。
- 能力目录（capability catalog）：管理面消费的统一列表，合并安装记录和运行时能力，并标明来源。

不要再把“已安装列表”直接等同于“Skill 管理页完整列表”。

## 5. 建议处理流程

### 5.1 能力目录

建议流程：

```text
读取 installed records
  -> 构建当前 runtime catalog
  -> 收集 plugin / bundled / dynamic / MCP capability
  -> 用 name/source/ref 关联 installed record
  -> 输出 capability catalog
```

每条 capability 至少包含：

```text
name
displayName
description
sourceKind
sourceLabel
installedRef?
modelInvocable
userInvocable
enabled
runtimeVisible
diagnostics[]
```

来源建议：

```text
managed-installed
plugin
builtin-plugin
bundled
dynamic
mcp
project
user
legacy-command
```

### 5.2 按请求诊断

建议流程：

```text
listSkillManagementState(options)
  -> 使用 options.configHomeDir / cwd 构建 runtime catalog
  -> 返回本次 catalog diagnostics
```

关键点：

- 不直接返回 `getLastSkillRuntimeCatalogDiagnostics()`。
- 如果保留 latest diagnostics，只能作为 debug 辅助，不作为管理页事实来源。
- smoke 需要构造两个不同 configHome，证明诊断不会串。

### 5.3 资源完整性

建议流程：

```text
安装 / 修复 package
  -> 计算 SKILL.md checksum
  -> 计算 packageTree checksum
  -> 写入 lock

检查 installed package
  -> 重新计算 packageTree
  -> 与 lock 比较
  -> 资源漂移时 status = drifted
```

package tree 摘要至少应包含：

- 相对路径。
- 文件大小。
- 文件 sha256。
- 排除 owner marker、lock/index 外部文件和临时 staging/backup 目录。
- 稳定排序，避免平台目录顺序差异。

## 6. 不变式

本阶段完成后必须满足：

- Skill 管理页的能力目录和运行时 catalog 使用同一事实来源。
- installed record 仍然可单独查看，但不再代表全部能力。
- diagnostics 必须和当前请求的 cwd/configHome 对齐。
- 资源文件漂移不能被 `SKILL.md` checksum 掩盖。
- packageTree checksum 不应包含安装器临时目录或外部 index 文件。
- 不引入静默 fallback；诊断缺失要显式暴露。

## 7. 验收用例

需要新增或扩展 smoke，至少覆盖：

- 管理状态能返回 installed records 和 runtime capabilities 两个层次。
- plugin / bundled / dynamic / MCP Skill 能力即使不是 installed record，也能出现在 capability catalog。
- 同名冲突在 capability catalog 中有来源和诊断。
- 两个 configHome / cwd 连续请求时，runtime diagnostics 不串。
- 修改 `scripts/`、`references/` 或 `assets/` 后，安装检查能识别 drifted。
- 只修改无关临时目录不会误判 drifted。

建议命令：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:skill-package-tree-integrity
git diff --check
```

## 8. 成功标准

本阶段完成时：

- Desktop Skill 管理接口不再只返回安装记录视角。
- 插件 Skill、内置插件 Skill、动态 Skill 和 MCP Skill 有能力目录表达。
- runtime diagnostics 不再使用全局旧快照作为管理页事实。
- `scripts/`、`references/`、`assets/` 漂移能被 lock / inspection 发现。
- P3 可以在清晰的数据对象基础上做检查逻辑去重。

## 9. 后续入口

P2 完成后进入 P3：

- 把安装检查和运行时检查的重复逻辑收敛成共享 inspection/value object。
- 管理视图和 runtime activation 分别消费同一个检查结果，而不是各自重新推断。

## 10. 完成记录

状态：已完成。

落地内容：

- `src/skills/skillRuntimeCatalog.ts` 新增 Skill 能力目录输出，能力项包含来源、安装关联、model/user invocation、runtimeVisible 和 diagnostics。
- `src/commands.ts` 新增 `getSkillRuntimeCatalogForCwd()`，用于按当前 cwd 构建本次 runtime catalog，而不是读取全局旧快照。
- `src/services/skills/managementService.ts` 的 `listSkillManagementState()` 返回 `capabilities`，并使用本次 catalog diagnostics 作为 `runtimeDiagnostics`。
- `src/services/skills/packageTreeIntegrity.ts` 新增 package tree sha256 摘要，安装 / 修复写入 lock 的 `checksum.packageTree`。
- 安装检查会比较 `SKILL.md` 和 package tree，`scripts/`、`references/`、`assets/` 等资源漂移会进入 drifted。
- `scripts/smoke-skill-capability-catalog.mjs` 覆盖能力目录来源和 runtimeDiagnostics 不使用 stale latest。
- `scripts/smoke-skill-package-tree-integrity.mjs` 覆盖资源文件漂移检测。

验证记录：

```powershell
npm.cmd run build
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:skill-package-tree-integrity
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-api
npm.cmd run typecheck -- --pretty false
git diff --check
```
