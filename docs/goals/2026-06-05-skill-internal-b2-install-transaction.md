# Goal B2：InstallTransaction 安装事务抽出

## 1. 目标

把 staging、backup、replace、owner marker、installed index 和 lock 写入从 `installManager.ts` 抽到独立安装事务层。

## 2. 范围

本阶段做：

- 新增 `src/services/skills/installTransaction.ts`。
- 迁移 package 目录受控替换逻辑。
- 迁移 owner marker 写入。
- 迁移 installed index / lock 写入事务边界。
- `installManager.ts` 只负责计划 apply 编排和结果构造。

本阶段不做：

- 不改变 install plan 语义。
- 不改变 repair 入口行为。
- 不改变 lock schema。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-install-reliability
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-management-service
git diff --check
```

## 4. 成功标准

- 文件写入事务只有一个明确模块。
- P1 force / repair 可靠性 smoke 仍通过。
- 非 owner 目录仍不能覆盖。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/skills/installTransaction.ts`。
- package staging / replace、owner marker、installed index 和 lock index 写入已进入事务层。
- 验证通过：`npm.cmd run smoke:skill-install-reliability`、`npm.cmd run smoke:skill-install-apply`、`npm.cmd run smoke:skill-release`。
