# Goal：Skill P3 检查模型收敛

## 1. 目标

本阶段目标是处理 Skill 审查中的 P3 结构问题：

```text
installInspector
  -> 管理视图检查 installed package

installedSkillLoader
  -> 运行时加载 installed package 并再次判断状态

两边都读取 installed index / lock / owner marker
两边都判断 missing / drifted / disabled / invalid
```

完成后，安装检查和运行时检查共享同一个检查结果对象，再由管理视图和运行时激活策略分别适配。

## 2. 为什么放在 P3

P3 是结构收敛，不是第一优先级的用户破坏性 BUG：

- P1 先保证安装 / 修复不会破坏现有包。
- P2 先统一“管理页到底列什么”和“诊断事实从哪里来”。
- P3 再把重复检查逻辑收敛，避免在事实口径还没稳定前抽象过早。

如果先做 P3，容易把两个还没统一的语义强行抽象在一起，反而让后续 P2 改动更痛。

## 3. 范围

本阶段做：

- 设计共享的 installed package inspection value object。
- `installInspector` 改为消费共享检查结果，负责管理视图摘要。
- `installedSkillLoader` 改为消费共享检查结果，负责运行时加载和 activation。
- missing / drifted / disabled / invalid 等状态只在共享检查层定义一次。
- owner marker、lock、installed index、checksum/packageTree 的读取与错误归一只实现一次。
- 增加 smoke 覆盖管理检查和运行时加载对同一状态的判断一致。

本阶段不做：

- 不重新设计 Skill capability catalog；那是 P2。
- 不改变安装 / 修复 apply 流程；那是 P1。
- 不新增安全扫描策略。
- 不改变 Desktop 页面布局。
- 不改变 SkillTool prompt 或 slash command 入口。

## 4. 建议模型

建议新增共享模型：

```text
InstalledSkillPackageInspection
```

核心字段：

```text
lockKey
name
scope
record
lockRecord?
packageDir
skillFilePath
ownerMarker?
status
integrity
activation
diagnostics[]
```

状态建议集中定义：

```text
installed
disabled
missing-package
missing-skill-md
missing-owner-marker
missing-lock
drifted
invalid
```

完整性字段：

```text
skillMdChecksum
packageTreeChecksum?
expectedSkillMdChecksum
expectedPackageTreeChecksum?
```

激活字段：

```text
enabled
modelInvocable
userInvocable
runtimeVisible
runtimeHiddenReason?
```

## 5. 建议代码结构

建议把共享检查逻辑放到独立模块：

```text
src/services/skills/installedPackageInspection.ts
```

职责：

- 读取 installed record 对应的 lock。
- 校验 owner marker。
- 校验 package / `SKILL.md` 是否存在。
- 校验 checksum / packageTree。
- 输出稳定状态和 diagnostics。

`installInspector.ts` 职责收窄为：

```text
list installed records
  -> 调用 inspectInstalledSkillPackage
  -> 转成管理页 inspection DTO
```

`installedSkillLoader.ts` 职责收窄为：

```text
list installed records
  -> 调用 inspectInstalledSkillPackage
  -> 对 runtimeVisible 的 package 加载 Skill
  -> 输出 runtime diagnostics
```

## 6. 不变式

本阶段完成后必须满足：

- 同一个 installed package 状态只在一个地方判断。
- 管理视图和运行时加载看到同样的 missing / drifted / invalid 结论。
- 运行时可以在共享检查结果上追加 runtime-specific diagnostics，但不能重新发明状态。
- 管理视图可以在共享检查结果上追加 UI digest，但不能重新发明状态。
- 检查逻辑不能静默跳过错误；解析失败、marker 不合法、lock 缺失都要进入 diagnostics。

## 7. 迁移步骤

### P3.1 抽出共享检查对象

目标：

- 新增 `installedPackageInspection.ts`。
- 先复制最小必要读取逻辑，保持现有外部行为不变。
- 写 smoke 固定 status 矩阵。

验收：

```powershell
npm.cmd run smoke:skill-installed-package-inspection
npm.cmd run typecheck -- --pretty false
```

### P3.2 管理视图接入

目标：

- `installInspector.ts` 消费共享检查结果。
- 管理页 DTO 字段保持兼容。
- 删除管理视图内部重复的 owner/lock/checksum 推断。

验收：

```powershell
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-service
```

### P3.3 运行时 loader 接入

目标：

- `installedSkillLoader.ts` 消费共享检查结果。
- runtime activation 只根据共享状态和 invocation flags 过滤。
- 删除运行时 loader 内重复的 status 推断。

验收：

```powershell
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-activation-policy
npm.cmd run smoke:skill-runtime-catalog
```

### P3.4 收口

目标：

- 删除重复 helper。
- 固定管理视图和运行时对同一 fixture 的一致性 smoke。
- 更新相关文档。

验收：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-installed-package-inspection
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-management-service
git diff --check
```

## 8. 成功标准

P3 完成时：

- `installInspector` 和 `installedSkillLoader` 不再各自实现同一套 installed package 状态判断。
- missing / drifted / disabled / invalid 状态只有一个权威定义。
- 管理视图和运行时 loader 对同一 fixture 的判断一致。
- 后续新增 packageTree、owner marker 或 lock 字段时，只需要改共享检查层。

## 9. 后续入口

P3 完成后，可以继续考虑更大的 Skill service 分层：

- 安装事务层。
- 能力目录查询层。
- 管理 DTO 适配层。
- 运行时 activation 适配层。

这些属于后续重构，不在 P3 内一次性展开。

## 10. 完成记录

状态：已完成。

落地内容：

- `src/services/skills/installedPackageInspection.ts` 成为 installed package 状态判断的共享检查层。
- `src/services/skills/installInspector.ts` 改为管理视图 DTO 适配层，复用共享 inspection，再补 security digest。
- `src/skills/installedSkillLoader.ts` 改为运行时适配层，复用共享 inspection，再应用 activation policy。
- missing / drifted / disabled / invalid 等状态只在共享检查层集中判断。
- `scripts/smoke-skill-installed-package-inspection.mjs` 覆盖管理检查、运行时检查和共享检查对同一 fixture 的状态一致性。

验证记录：

```powershell
npm.cmd run build
npm.cmd run smoke:skill-installed-package-inspection
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-management-service
npm.cmd run typecheck -- --pretty false
git diff --check
```
