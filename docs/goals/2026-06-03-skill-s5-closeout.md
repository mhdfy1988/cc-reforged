# Goal S-5：Desktop Skill 管理面收口

## 1. 结论

S-5 已完成。CCR 现在已经把 S-1 到 S-4 的 Skill 标准模型、导入转换、安装记录和安全扫描能力接到 Desktop 管理面。

本阶段完成的是“管理面”和“管理 API”：

```text
Desktop SkillsPage
  -> App Server skill handlers
  -> Skill management service
  -> S-2 import / S-3 install / S-4 security
  -> ~/.ccr/skills/*
```

S-5 不改变运行时 Skill 上下文。安装后的 skill 是否进入 `SkillTool` prompt、slash command 和模型可见列表，仍由 S-6 完成。

## 2. 完成内容

### 2.1 App Server 管理协议

新增 Skill 管理协议、handlers、router 和 stdio client 方法，覆盖：

- 已安装列表：`skill/install/list`
- 详情检查：`skill/inspect`
- 候选搜索：`skill/install/search`
- 安装计划：`skill/install/plan`
- 确认安装：`skill/install/apply`
- 导入计划：`skill/import/plan`
- 确认导入：`skill/import/apply`
- 启用状态：`skill/state/enabled`
- 调用开关：`skill/state/invocation`
- 卸载：`skill/install/uninstall`
- 修复：`skill/install/repair`
- 保存常用安装配置：`skill/install/save-manifest`

主要代码入口：

```text
src/app-server/protocol.ts
src/app-server/handlers/skillHandlers.ts
src/app-server/router.ts
src/app-server/client/stdioAppServerClient.ts
src/core/skillCore.ts
src/core/ccrCore.ts
```

### 2.2 Skill 管理服务

新增统一服务：

```text
src/services/skills/managementService.ts
```

该服务聚合已有阶段能力：

- S-2：`discoverSkillImportCandidate` / `createSkillImportPlan` / `applySkillImportPlan`
- S-3：安装候选、安装计划、安装 apply、list / inspect、manifest 保存
- S-4：安全扫描、风险摘要、安装阻断和 override

handler 不直接写业务逻辑，Desktop 也不直接操作 `~/.ccr/skills/*` 文件。

### 2.3 Desktop 管理页

`apps/desktop/src/renderer/src/components/pages/SkillsPage.tsx` 已从占位页改为三栏管理面：

- 左侧：已安装 skill 列表、状态、风险等级。
- 中间：详情、启用状态、模型自动调用开关、用户 slash 调用开关、安全摘要、资源列表、`SKILL.md` 预览、修复和卸载。
- 右侧：安装候选、搜索、导入 Skill、安装计划确认。

相关接入：

```text
apps/desktop/src/main/index.ts
apps/desktop/src/preload/index.ts
apps/desktop/src/renderer/src/main.tsx
apps/desktop/src/renderer/src/domain/displayTypes.ts
apps/desktop/src/renderer/src/styles.css
```

### 2.4 导入 Skill 与安装候选

Desktop 第一版保留一个用户主入口：

- 导入 Skill：支持本地 `SKILL.md` 目录、本地 archive、Codex / OpenClaw Skill 目录和 Claude command 文件转换。

不在 Skill 管理页提供“创建 Skill 安装配置”表单。新建 Skill 应由会话里的 `Skill 包助手` / skill creator 生成完整 `SKILL.md` 包，生成结果再进入候选登记链路；页面只负责导入外部 Skill、展示候选和安装确认。

安装计划确认区支持：

- 查看写入目标。
- 查看安全风险。
- 高风险显式 override。
- 选择是否“保存到常用安装配置”。

## 3. 验证

本阶段已执行并通过：

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-import
npm.cmd run desktop:build
```

验证覆盖：

- service 直连管理闭环。
- App Server stdio client 管理闭环。
- 本地目录导入和 Claude command 转换导入。
- 候选搜索、安装计划、确认安装。
- 启用 / 禁用、modelInvocable / userInvocable 写入。
- 常用安装配置保存。
- installer-owned package 修复和卸载。
- Desktop main / preload / renderer 生产打包。

## 4. 边界

S-5 只保证管理状态能写入，页面能展示，App Server API 能调用。

仍未在本阶段完成：

- installed package 接入运行时 loader。
- `enabled=false` 后从模型上下文隐藏。
- `modelInvocable=false` 后从 `SkillTool` prompt 隐藏。
- `userInvocable=false` 后从 slash command 隐藏。
- drifted / missing / invalid installed skill 的运行时诊断和 gating。

这些内容进入 S-6：

```text
docs/goals/2026-06-03-skill-s6-runtime-activation-plan.md
```

## 5. 下一步

下一阶段按 S-6.1 到 S-6.5 依次推进：

1. InstalledSkillRuntimeLoader。
2. 激活策略。
3. Runtime Catalog 合并与冲突诊断。
4. SkillTool / slash command 接入。
5. 缓存、变更检测与文档收口。
