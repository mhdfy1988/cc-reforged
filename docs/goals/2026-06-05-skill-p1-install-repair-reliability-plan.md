# Goal：Skill P1 安装与修复可靠性

## 1. 目标

本阶段目标是先处理 Skill 代码审查中已经确认的 P1 可靠性问题：

```text
安装计划允许 force 覆盖
  -> 执行阶段必须真的能覆盖 installer-owned package

修复已安装 Skill
  -> 必须先构建并校验替代包
  -> 再替换现有包
  -> 失败时保留旧包和现有记录
```

完成后，Skill 安装 / 修复链路不能再出现“计划显示可执行，但 apply 必然失败”，也不能出现“修复失败后旧包已经被删除”的状态破坏。

## 2. 为什么先做

当前后续有两个更大的方向：

- Skill 能力目录统一：不只列安装记录，而是列所有能力并显示来源。
- Skill 管理模块重构：复用 MCP 重构经验，减少重复检查逻辑和临时状态快照。

但这两个方向都依赖安装记录、包目录和 lock 状态可信。如果先重构，P1 问题会被包进新结构里，后续排查成本更高。

所以本阶段先止血，只处理会破坏用户已安装 Skill 或让执行阶段和计划阶段不一致的问题。

## 3. 范围

本阶段做：

- 修正 `force: true` 安装计划和执行阶段的语义一致性。
- installer-owned 目标目录存在时，执行阶段必须支持受控替换。
- 非 CCR 管理目录、缺少 owner marker 或 owner marker 不合法时，仍然禁止覆盖。
- 修复流程必须先构建候选包、完成基础校验，再触碰现有 package 目录。
- 修复失败时保留旧 package、installed index 和 lock，不把可用 Skill 破坏成缺包状态。
- 增加回归 smoke，覆盖 force 覆盖、repair 失败保留旧包、repair 成功替换、index / lock 一致性。

本阶段不做：

- 不做 Skill 能力目录统一。
- 不让插件 Skill 进入 Desktop Skill 管理页。
- 不重构整套 Skill service 分层。
- 不改 Desktop 页面视觉。
- 不扩大安全扫描规则。
- 不引入 package tree 全量 checksum；这属于后续完整性增强。

## 4. 不变式

本阶段完成后必须满足：

- 计划阶段允许的操作，执行阶段不能因为同一个目录状态必然失败。
- `force` 只允许覆盖 CCR installer-owned 目录。
- 非 installer-owned 目录绝不删除、覆盖或静默接管。
- 修复失败不能删除旧包。
- 修复失败不能把 installed index / lock 写成“新版本已成功”的样子。
- 没有静默 legacy fallback；失败要明确返回错误和原因。

## 5. 建议处理流程

### 5.1 force 安装

建议流程：

```text
读取目标目录
  -> 校验 owner marker
  -> 构建安装计划
  -> 拷贝候选包到临时目录
  -> 校验临时目录的 SKILL.md / manifest / checksum
  -> 替换目标 package 目录
  -> 写 lock
  -> 写 installed index
```

关键点：

- `installPlanner` 和 `installManager` 必须共享同一套覆盖前置条件。
- 执行阶段不要继续用 `errorOnExist: true, force: false` 直接复制到已存在目标目录。
- Windows 上替换目录可能失败，失败时必须保留可解释错误，不能把 index 先写成成功。

### 5.2 repair 修复

建议流程：

```text
读取 installed record
  -> 从 manifest/source 构建候选包
  -> 安全扫描和基础校验
  -> 拷贝候选包到临时目录
  -> 校验临时目录
  -> 替换现有 package 目录
  -> 更新 lock
  -> 更新 installed index
```

关键点：

- 不允许在构建候选包之前先 `rm(record.packageDir)`。
- 如果 source 路径不存在、manifest 解析失败、安全扫描失败或复制失败，旧包必须仍然可用。
- 如果替换已经开始但失败，需要返回明确错误，并尽量保留旧包或让状态显式进入需人工处理。

## 6. 验收用例

需要补或扩展 smoke，至少覆盖：

- 已存在 installer-owned package，`force: true` 安装可以成功替换。
- 已存在非 installer-owned package，`force: true` 仍然失败且不删除目录。
- repair 的 source 不存在时，旧 package 仍存在，installed index / lock 不被伪装成成功。
- repair 成功时，package、lock、installed index 同步更新。
- apply 失败时没有半写入的 installed index。

建议命令：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-install-plan
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-management-service
git diff --check
```

如果现有 smoke 不覆盖上述场景，本阶段新增一个聚焦脚本：

```powershell
npm.cmd run smoke:skill-install-reliability
```

## 7. 成功标准

本阶段完成时：

- 用户执行 force reinstall 时，计划和实际 apply 结果一致。
- 用户执行 repair 时，失败不会把原本可用的 Skill 删除。
- P1 两个问题都有自动化回归覆盖。
- 代码路径仍然保持小范围修复，没有提前展开 Skill 总重构。
- 后续可以在可信安装状态之上继续设计 Skill 能力目录和 service 重构。

## 8. 后续入口

P1 修完后，再进入 P2 设计：

- 合并 `installInspector` / `installedSkillLoader` 的重复检查逻辑。
- 让 runtime diagnostics 变成按请求生成的诊断，而不是全局旧快照。
- 设计统一 Skill 能力目录，区分 installed record、runtime capability、plugin/bundled/dynamic/MCP 来源。

## 9. 完成记录

状态：已完成。

落地内容：

- `src/services/skills/installPlanner.ts` 允许 `force: true` 的 installed candidate 进入 installable 状态，并继续保留非 force 的已安装冲突。
- `src/services/skills/installManager.ts` 将直接复制改成“临时目录 staging -> owner 校验 -> backup 替换 -> 失败恢复”的受控替换流程。
- `src/services/skills/managementService.ts` 的 repair 不再先删除旧 package，而是先构建候选包并复用 install apply 的受控替换。
- `scripts/smoke-skill-install-reliability.mjs` 覆盖 force 覆盖、非 owner 目录阻断、repair 失败保留旧包、repair 成功替换。
- `package.json` 新增 `smoke:skill-install-reliability`。

验证记录：

```powershell
npm.cmd run build
npm.cmd run smoke:skill-install-reliability
npm.cmd run smoke:skill-install-plan
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-management-service
npm.cmd run typecheck -- --pretty false
git diff --check
```
