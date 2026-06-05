# Goal Series：Skill 内部结构重构序列

## 1. 目标

本序列以 [CCR Skill 系统整体架构](../architecture/skill-system-architecture.md) 为架构基线，细化 Skill 模块内部服务分层，避免 `managementService.ts`、`installManager.ts`、runtime loader 和 DTO 拼装继续膨胀。

本序列关注纵向整理：

```text
SkillManagementService
  -> 只做应用编排

InstallTransaction
  -> 只做安装写入事务

InstalledPackageInspection
  -> 只做 package 状态判断

ManagementDto
  -> 只做接口 DTO / digest

SkillCapabilityProvider
  -> 只做 Skill 能力映射

SkillRuntimeAdapter
  -> 只做 package -> Command 运行时转换
```

## 2. 为什么拆成序列

P1/P2/P3 已经修复可靠性、能力目录和检查模型，但当前代码仍有若干“半抽离”状态。拆成 B1-B6 后，可以逐步瘦身、抽事务、抽 DTO、抽 provider、抽 runtime adapter，避免一次大搬家。

## 3. 子 Goal

- [B1 Skill ManagementService 瘦身](./2026-06-05-skill-internal-b1-management-service-thinning.md)
- [B2 InstallTransaction 安装事务抽出](./2026-06-05-skill-internal-b2-install-transaction.md)
- [B3 ManagementDto 展示适配抽出](./2026-06-05-skill-internal-b3-management-dto.md)
- [B4 SkillCapabilityProvider 抽出](./2026-06-05-skill-internal-b4-capability-provider.md)
- [B5 SkillRuntimeAdapter 抽出](./2026-06-05-skill-internal-b5-runtime-adapter.md)
- [B6 Skill 模块边界和 smoke 收口](./2026-06-05-skill-internal-b6-boundary-closeout.md)

## 4. 非目标

- 不改变 Skill 标准格式。
- 不改变 SkillTool prompt 协议。
- 不改变 MCP 工具命名。
- 不实现 Plugin 安装器。
- 不做 Desktop 大改版。

## 5. 成功标准

本序列完成时：

- `managementService.ts` 成为薄编排层。
- 安装写入集中在 transaction 层。
- DTO 转换集中在 DTO 层。
- Skill capability provider 可以接入统一 Capability Catalog。
- installed package 到 Command 的运行时转换有独立 adapter。
- Skill release smoke、build、typecheck 稳定通过。

## 6. 完成记录

2026-06-05 已完成 B1-B6 首轮实现：

- `managementService.ts` 已瘦身为编排层，DTO、capability、持久化 helper 已外移。
- 安装写入集中到 `installTransaction.ts`。
- 管理 DTO 集中到 `managementDtos.ts`。
- Skill 管理 capability 集中到 `services/skills/capabilityProvider.ts`。
- installed package 到 runtime `Command` 的转换集中到 `skills/skillRuntimeAdapter.ts`。
- 新增 `smoke:skill-internal-refactor`，并通过完整 `smoke:skill-release`。
