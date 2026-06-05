# Goal B6：Skill 模块边界和 smoke 收口

## 1. 目标

完成 Skill 内部结构重构后的边界收口，更新文档、清理重复 helper，并固定 smoke group。

## 2. 范围

本阶段做：

- 对照 [CCR Skill 系统整体架构](../architecture/skill-system-architecture.md) 检查模块职责。
- 删除或合并重构后遗留重复 helper。
- 更新 Skill 文档入口和架构文档。
- 固定 Skill internal refactor smoke group 或 release smoke。

本阶段不做：

- 不新增业务能力。
- 不改 Desktop 大布局。
- 不接远端 registry。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-release
npm.cmd run smoke:skill-install-reliability
npm.cmd run smoke:skill-installed-package-inspection
npm.cmd run smoke:skill-capability-catalog
git diff --check
```

## 4. 成功标准

- Skill 模块职责和架构文档一致。
- 重构后没有重复状态判断。
- Skill release smoke 稳定通过。

## 5. 完成记录

2026-06-05 已完成：

- 更新 [CCR Skill 系统整体架构](../architecture/skill-system-architecture.md) 的模块落点表。
- 更新 [CCR Skill 文档入口](../skills/README.md) 的当前实现状态。
- 新增 `smoke:skill-internal-refactor`，覆盖 B1-B6 关键边界。
- 验证通过：`npm.cmd run smoke:skill-internal-refactor`、`npm.cmd run smoke:skill-release`。
