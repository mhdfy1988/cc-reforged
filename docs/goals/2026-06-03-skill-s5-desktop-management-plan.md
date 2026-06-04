# Goal S-5：Desktop Skill 管理面

## 1. 目标

S-5 的目标是把 S-1 到 S-4 已完成的 Skill 服务层能力接到 Desktop，让用户可以在图形界面里查看、导入外部 Skill、安装、查看风险、启用 / 禁用、修复和卸载 Skill。

S-5 负责的是“管理面”和“管理 API”：

```text
Desktop SkillsPage
  -> App Server skill handlers
  -> skill management service
  -> S-2 import / S-3 install / S-4 security
  -> ~/.ccr/skills/*
```

S-5 不负责把 installed package 真正并入模型上下文。运行时是否看到、slash 是否可调用、disabled 是否从提示中消失，放到 S-6 完成。

## 2. 为什么 S-5 独立

当前 Desktop 已有 `SkillsPage.tsx`，但还是占位页：

```text
apps/desktop/src/renderer/src/components/pages/SkillsPage.tsx
```

MCP 管理页已经证明了这类页面的基本形态：

```text
apps/desktop/src/renderer/src/components/pages/McpPage.tsx
src/app-server/handlers/mcpHandlers.ts
src/app-server/protocol.ts
apps/desktop/src/renderer/src/domain/displayTypes.ts
```

Skill 管理需要复用 MCP 的“列表 - 详情 - 候选安装”经验，但不能混进 MCP 页面，因为 Skill 的状态、风险、正文预览、启用语义和运行时接入都不同。

S-5 先解决用户可操作性：

- 用户能看到已安装 Skill。
- 用户能看到可安装候选。
- 用户能导入本地 Skill。
- 用户能创建常用安装配置。
- 用户能看到安全扫描摘要。
- 用户能通过确认计划安装 Skill。
- 用户能写入启用 / 禁用状态。

S-6 再解决运行时消费这些状态。

## 3. 范围

本阶段做：

- 新增 App Server skill management protocol。
- 新增 app-server skill handlers。
- 新增 Desktop `SkillsPage` 的真实管理界面。
- 复用 S-2 本地导入和 Claude command 转换能力。
- 复用 S-3 安装候选、安装计划、apply、inspect。
- 复用 S-4 security report / decision / digest。
- 实现 installed record 的启用 / 禁用、模型调用开关、用户 slash 调用开关写入。
- 实现 installer-owned package 的卸载和基础修复。
- 增加 smoke 覆盖管理 API。
- 增加 Desktop 页面渲染 / 操作路径验证。

本阶段不做：

- 不把 installed packages 接入 `getSkillToolCommands`。
- 不改变模型上下文预算和 SkillTool prompt。
- 不实现远端 registry。
- 不做 marketplace 排名。
- 不执行 OpenClaw install metadata。
- 不做企业策略中心。
- 不做复杂权限审批系统。

## 4. 管理状态

S-5 管理面展示三类对象：

```text
已安装 Skill
  来自 ~/.ccr/skills/installed.json + inspectInstalledSkill

安装候选
  来自 ~/.ccr/skills/imported/*
  来自 ~/.ccr/skills/manifests/*.json

当前可用 Skill
  第一版只展示现有 loader 读到的 skill 摘要
  真正与 installed record 合并由 S-6 完成
```

建议页面统计：

```text
N 个已安装 · M 个候选 · K 个需处理 · R 个高风险
```

## 5. App Server 协议

建议新增协议 schema：

```text
SkillInstallSearchParamsSchema
SkillInstallPlanParamsSchema
SkillInstallApplyParamsSchema
SkillInstallListParamsSchema
SkillInspectParamsSchema
SkillImportPlanParamsSchema
SkillImportApplyParamsSchema
SkillSetEnabledParamsSchema
SkillSetInvocationParamsSchema
SkillUninstallParamsSchema
SkillRepairParamsSchema
```

建议 handler：

```text
src/app-server/handlers/skillHandlers.ts
```

建议 core service 入口：

```text
context.core.skills.searchInstallCandidates()
context.core.skills.planInstall()
context.core.skills.applyInstall()
context.core.skills.listInstalled()
context.core.skills.inspect()
context.core.skills.planImport()
context.core.skills.applyImport()
context.core.skills.setEnabled()
context.core.skills.setInvocation()
context.core.skills.uninstall()
context.core.skills.repair()
```

第一版返回 `Record<string, unknown>` 也可以，但内部服务必须使用 S-2 到 S-4 的结构化类型。

## 6. Desktop 页面结构

现有占位页：

```text
apps/desktop/src/renderer/src/components/pages/SkillsPage.tsx
```

建议改成三栏工作台：

```text
Skill 管理
  顶部：统计、刷新

  左侧：已安装 / 当前可用列表
    - name
    - 状态：enabled / disabled / drifted / missing / invalid
    - 风险摘要

  中间：详情
    - 基本信息
    - 启用状态
    - 模型自动调用开关
    - 用户 slash 调用开关
    - 安装来源
    - security digest
    - SKILL.md 预览
    - resources 列表
    - 操作按钮：启用、禁用、修复、卸载

  右侧：安装
    - 搜索候选
    - 导入 Skill
    - 候选卡片
    - 安装计划确认
```

界面原则：

- 候选卡片只放名称、短描述、来源、状态和风险最高等级。
- 详细写入路径、安全 finding、override token、资源列表放到详情或确认区。
- 不在卡片里堆满标签。
- 危险操作必须有明确确认。
- `卸载` 放详情页，不放候选卡片。

## 7. 用户流程

### 7.1 导入本地 Skill

第 1 轮：

```text
用户点击 导入 Skill
  -> 选择本地目录或 Claude command 文件
  -> App Server 生成 import candidate / plan
  -> Desktop 展示写入目标和转换说明
```

第 2 轮：

```text
用户确认导入
  -> 写入 ~/.ccr/skills/imported/<name>/
  -> 刷新安装候选
```

### 7.2 安装 Skill

第 1 轮：

```text
用户点击候选安装
  -> createSkillInstallPlan
  -> scanSkillPackage
  -> evaluateSkillSecurityPolicy
  -> Desktop 展示计划
```

第 2 轮：

```text
低风险 / 中风险
  -> 用户确认
  -> applySkillInstallPlan

高风险
  -> Desktop 明确显示需要 override
  -> 用户确认 override
  -> applySkillInstallPlan(securityOverrideToken)

critical
  -> 第一版直接阻断
```

### 7.3 启用 / 禁用

S-5 写入 installed record：

```text
enabled = true / false
modelInvocable = true / false
userInvocable = true / false
updatedAt = now
```

S-5 只保证状态写入和页面刷新。

S-6 验证：

```text
enabled = false
  -> 模型 SkillTool prompt 不再看到
  -> slash command 不再看到
```

### 7.4 修复

第一版修复策略：

```text
missing package
  -> 从 manifest.source.path 重新复制

missing SKILL.md
  -> 从来源重新复制

drifted
  -> 重新从来源复制，更新 lock

missing lock
  -> 若 package 和 owner marker 可归一，则重建 lock
```

修复前必须显示计划，不直接写。

### 7.5 卸载

只允许卸载 installer-owned package：

```text
installed record 存在
owner marker 存在
owner marker.packageId 匹配
lock record 匹配或可解释
```

卸载动作：

```text
删除 packages/<name>/
删除 installed.json 记录
删除 lock.json 记录
不删除 imported/
不删除 manifests/
```

## 8. 子 Goal 拆分

### S-5.1 App Server Skill 管理协议

目标：

- 在 `protocol.ts` 中补 Skill 管理 schema。
- 新增 `skillHandlers.ts`。
- 在 router/core 上挂载 skill management entrypoint。

迭代：

1. list / inspect / search / plan / apply 协议。
2. import plan / import apply 协议。
3. enable / disable / invocation toggle 协议。
4. uninstall / repair 协议。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-management-api
npm.cmd run typecheck
```

### S-5.2 Skill 管理服务

目标：

- 新增 `src/services/skills/managementService.ts`。
- 聚合 S-2 / S-3 / S-4，不在 handler 里写业务逻辑。

迭代：

1. `listInstalled()` 返回 inspection + security digest。
2. `searchInstallCandidates()` 返回 candidate + security digest。
3. `planInstall()` / `applyInstall()` 支持 confirmation / override。
4. `setEnabled()` / `setInvocation()` 修改 installed record。
5. `uninstall()` / `repair()` 只处理 installer-owned package。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-management-service
npm.cmd run typecheck
```

### S-5.3 Desktop SkillsPage 三栏管理面

目标：

- 把 `SkillsPage.tsx` 从占位页改为真实管理页。
- 新增 renderer display types。
- 从 `main.tsx` 接入刷新、安装、导入、启用、禁用、修复、卸载动作。

迭代：

1. 左侧 installed/current list。
2. 中间详情、security digest、resources、SKILL.md 预览。
3. 右侧安装候选、搜索和导入 Skill。
4. confirmation dialog 和 override flow。

验收：

```text
npm.cmd run typecheck:desktop
npm.cmd run desktop:build
```

### S-5.4 导入 Skill 与安装候选 UX

目标：

- 提供导入外部 Skill 入口，并把导入结果登记为安装候选。
- 表单只展示必要字段，详细风险和路径放计划确认。
- 不提供手填 manifest 壳的“创建 Skill 安装配置”入口；新建 Skill 由会话里的 `Skill 包助手` / skill creator 生成完整包后再登记为候选。

迭代：

1. 本地 `SKILL.md` 目录导入。
2. Claude command 转换导入。
3. 本地 archive、Codex / OpenClaw Skill 目录导入。
4. 安装计划自动刷新候选。

验收：

```text
npm.cmd run smoke:skill-management-import
npm.cmd run typecheck:desktop
```

### S-5.5 桌面回归与文档收口

目标：

- 补 Desktop smoke 或 Playwright 验证。
- 更新 Skill 设计主文档和 closeout。

验收：

```text
npm.cmd run build
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-management-service
git diff --check
```

## 9. 成功标准

S-5 完成时：

- Desktop `技能` 页面不再是占位。
- 用户能从 Desktop 导入本地 Skill。
- 用户能从候选生成安装计划。
- 用户能看到安全摘要和阻断原因。
- high 风险安装需要显式 override。
- 用户能写入启用 / 禁用 / modelInvocable / userInvocable 状态。
- 用户能对 installer-owned package 做修复和卸载。
- 所有写操作都有确认或明确按钮，不静默写入。

## 10. 后续入口

S-5 完成后进入 S-6：

```text
S-6：Skill 运行时启用治理与 installed package 接入
```

S-6 才验证：

- enabled=false 后模型不再看到 Skill。
- modelInvocable=false 后 SkillTool prompt 不再包含。
- userInvocable=false 后 slash command 不再包含。
- installed packages 能作为运行时 skill 被加载。
