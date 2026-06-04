# Goal S-7：Skill 来源扩展

完成状态：已完成。实现已覆盖本地 zip/tar archive 导入、内置 `ccr-skill-starter` preset 候选、builtin preset 安装成 managed package、检查和修复。

## 1. 目标

S-7 的目标是把 Skill 第一版安装闭环从“已导入目录 / 本地 manifest”扩展到两个确定可控的来源：

```text
local-archive
builtin-preset
```

本阶段明确不做远端 registry。远端 registry 涉及网络、缓存、checksum、签名、信任策略和失败诊断，需要单独恢复设计后再做。

S-7 完成后，用户应能：

- 从本地 zip / tar 包生成 Skill 导入计划。
- 将 archive 解包成受控 imported skill，再进入现有安装计划。
- 在候选列表里看到 CCR 内置 Skill preset。
- 对 builtin preset 生成安装计划、安装记录和运行时 managed package。
- 在 Desktop 管理面和 App Server API 中复用同一套候选来源结果。

## 2. 为什么先做 S-7

当前 Skill 安装闭环已经能跑通：

```text
导入 -> 安装候选 -> 安装计划 -> 用户确认 -> 安装记录 -> Desktop 管理 -> 运行时启用
```

但候选来源仍偏窄：

- `imported-skill` 可以用，但需要用户先准备目录。
- `local-manifest` 可以用，但本质仍指向已导入或本地目录。
- `builtin-preset` 已在 schema 和排序里占位，但没有真实候选提供器。
- `local-archive` 在设计里出现过，但代码入口还没有支持。

S-7 先补本地 archive 和内置 preset，是因为这两个来源不需要公网，不引入 registry 信任模型，适合作为来源扩展的第一步。

## 3. 范围

本阶段做：

- `SkillImportSource.kind` 增加 `local-archive`。
- archive 解包前做基本文件类型、路径穿越和大小限制检查。
- 解包后必须找到唯一有效 `SKILL.md`。
- archive 导入后写入 imported skill 目录和 import marker。
- `CcrSkillInstallSource.kind = builtin-preset` 支持真实候选。
- 新增 builtin preset provider / registry。
- builtin preset 安装时仍生成 managed package、installed record 和 lock record。
- Desktop 候选列表展示 archive 导入结果和 builtin preset。
- smoke 覆盖 archive 导入、preset 候选、preset 安装。

本阶段不做：

- 不做 `remote-registry`。
- 不做网络下载。
- 不做 checksum 强制签名。
- 不做团队共享候选源。
- 不做完整 marketplace。
- 不做 Skill 使用统计和推荐。
- 不改变 `SKILL.md` 标准格式。

## 4. 来源语义

### 4.1 `local-archive`

`local-archive` 是导入来源，不是运行时来源。

建议流程：

```text
用户选择本地 archive
  -> 校验 archive
  -> 解包到临时目录
  -> 发现 SKILL.md
  -> 归一为 CcrSkillPackage
  -> 生成导入计划
  -> 用户确认
  -> 写入 ~/.ccr/skills/imported/<name>/
  -> 后续按 imported-skill 安装
```

不变式：

- archive 不能直接进入运行时。
- archive 不能直接写 installed package。
- archive 解包路径必须限制在临时目录内。
- 多个 `SKILL.md` 时必须显式报错或要求用户选择，不做猜测。
- 导入 marker 必须记录原 archive path 和 archive metadata。

### 4.2 `builtin-preset`

`builtin-preset` 是安装候选来源。

建议流程：

```text
内置 preset registry
  -> 搜索候选
  -> 生成安装 manifest
  -> 用户确认安装
  -> 复制内置 Skill package 到 ~/.ccr/skills/packages/<name>/
  -> 写 installed.json / lock.json
  -> 运行时按 managed skill 加载
```

不变式：

- preset provider 只暴露 CCR 明确声明的内置 Skill。
- preset id 是稳定 ID，不等同于展示名。
- 安装后仍是 managed package，不在运行时特殊分支读取 preset。
- preset package 也要经过同一套安全扫描和 installed inspection。

## 5. 建议代码结构

```text
src/services/skills/archiveImporter.ts
src/services/skills/builtinPresets.ts
src/services/skills/presets/registry.ts
src/services/skills/presets/<preset-id>.ts
scripts/smoke-skill-import-local-archive.mjs
scripts/smoke-skill-install-builtin-preset.mjs
```

现有文件需要接入：

```text
src/services/skills/importSource.ts
src/services/skills/importDiscovery.ts
src/services/skills/importPlanner.ts
src/services/skills/importManager.ts
src/services/skills/installManifest.ts
src/services/skills/installCandidates.ts
src/services/skills/managementService.ts
src/app-server/handlers/skillHandlers.ts
apps/desktop/src/renderer/src/components/pages/SkillsPage.tsx
```

## 6. 迭代拆分

### S-7.1 Archive source schema 与安全边界

目标：

- `SkillImportSourceSchema` 支持 `local-archive`。
- 定义支持的 archive 类型和大小限制。
- 增加路径穿越、空包、多 `SKILL.md`、缺失 `SKILL.md` 的错误分类。

验收：

```powershell
npm.cmd run smoke:skill-import-schema
npm.cmd run typecheck -- --pretty false
```

### S-7.2 Archive 导入计划

目标：

- 解包到临时目录。
- 复用现有 normalizer / resource scanner。
- 生成导入计划和 import marker。
- 用户确认后写入 imported skill 目录。

验收：

```powershell
npm.cmd run smoke:skill-import-local-archive
npm.cmd run smoke:skill-import
```

### S-7.3 Builtin preset provider

目标：

- 新增 builtin preset registry。
- 搜索候选时返回 `builtin-preset`。
- 候选排序、重复 name、已安装状态与 imported/local manifest 一致。

验收：

```powershell
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-builtin-preset
```

### S-7.4 Builtin preset 安装

目标：

- `createCandidateFromManifest` 支持 `builtin-preset`。
- 安装时复制 preset package 到 managed package 目录。
- 写入 installed / lock / owner marker。
- inspection 和 repair 不静默回退到 preset 原目录。

验收：

```powershell
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-runtime-installed-loader
```

### S-7.5 Desktop / 文档收口

目标：

- Desktop 导入入口支持 archive。
- 候选列表能展示 builtin preset。
- 更新 Skill 文档和 CHANGELOG。

验收：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
git diff --check
```

## 7. 成功标准

S-7 完成时：

- 本地 archive 可以经过导入计划进入 imported skill。
- archive 不会绕过用户确认直接安装。
- builtin preset 能出现在安装候选列表。
- builtin preset 能安装成 managed skill。
- preset / imported / local manifest 的候选状态和重复诊断一致。
- 远端 registry 仍保持暂停，不访问网络。

## 8. 验证记录

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-import-schema
npm.cmd run smoke:skill-import-local-archive
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-builtin-preset
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-runtime-installed-loader
git diff --check
```

## 9. 后续入口

S-7 完成后进入 S-8：统一 Skill 运行时 catalog，把 local / dynamic / MCP skill 的冲突诊断收敛到同一入口。
