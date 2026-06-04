# Skill S-1 到 S-3 基础阶段收口核验

## 1. 结论

截至 2026-06-02，Skill 基础三阶段已经完成到设计范围内的可验收状态：

- S-1 已完成标准领域模型、运行时 schema、frontmatter 归一、`CcrSkillPackage -> PromptCommand` 适配、`SkillCatalog` 和现有 loader 最小接入。
- S-2 已完成本地 skill、Codex / OpenClaw 兼容目录、Claude command 转换、导入计划、确认 token 和 imported 写入。
- S-3 已完成安装 manifest、installed / lock 记录、安装候选、安装计划、确认安装、owner marker、list / inspect / drift 检查。

基础链路现在是：

```text
外部来源
  -> S-2 导入 / 转换
  -> ~/.ccr/skills/imported/<name>/
  -> S-3 安装候选 / 安装计划 / 用户确认
  -> ~/.ccr/skills/packages/<name>/
  -> ~/.ccr/skills/installed.json + lock.json
  -> S-1 CcrSkillPackage 归一
  -> SkillCommandAdapter
  -> PromptCommand / SkillTool
```

## 2. 已落地文件

### 2.1 S-1

```text
src/skills/model.ts
src/skills/packageSchema.ts
src/skills/sourceTypes.ts
src/skills/normalizeSkillPackage.ts
src/skills/skillCatalog.ts
src/skills/skillCommandAdapter.ts
src/skills/skillResourceScanner.ts
src/skills/skillCompatibility.ts
src/skills/loadSkillsDir.ts
scripts/smoke-skill-foundation.mjs
```

### 2.2 S-2

```text
src/services/skills/importSource.ts
src/services/skills/importPaths.ts
src/services/skills/importDiscovery.ts
src/services/skills/importConverter.ts
src/services/skills/importPlanner.ts
src/services/skills/importManager.ts
scripts/smoke-skill-import-schema.mjs
scripts/smoke-skill-import-local-discovery.mjs
scripts/smoke-skill-import-compatible-discovery.mjs
scripts/smoke-skill-import-command-conversion.mjs
scripts/smoke-skill-import.mjs
```

### 2.3 S-3

```text
src/services/skills/installPaths.ts
src/services/skills/installManifest.ts
src/services/skills/installCandidates.ts
src/services/skills/installPlanner.ts
src/services/skills/installManager.ts
src/services/skills/installInspector.ts
scripts/smoke-skill-install-schema.mjs
scripts/smoke-skill-install-candidates.mjs
scripts/smoke-skill-install-plan.mjs
scripts/smoke-skill-install-apply.mjs
scripts/smoke-skill-install-inspector.mjs
```

## 3. 本次核验命令

```text
npm.cmd run build
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-import-schema
npm.cmd run smoke:skill-import-local-discovery
npm.cmd run smoke:skill-import-compatible-discovery
npm.cmd run smoke:skill-import-command-conversion
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-install-schema
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-plan
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run typecheck
git diff --check
```

结果：全部通过。

## 4. 明确未纳入 S-1 到 S-3 的事项

这些不是 S-1 到 S-3 的遗漏，而是后续阶段范围：

- S-4：安全扫描与风险提示。当前 S-2 / S-3 只保留风险摘要和安装计划提示，不做高级阻断。
- S-5：Desktop Skill 管理页。当前已有服务层，不做完整前台安装、启用、禁用、修复、卸载界面。
- 远端 registry / marketplace。当前只做本地导入、manifest 候选和安装账本。
- 自动执行依赖安装。OpenClaw `install` 元数据不会自动执行，后续只能进入显式计划。
- 完整卸载实现。S-3 已建立 installer-owned package 边界和诊断能力，实际卸载动作留到管理阶段实现。
- 启用 / 禁用交互。S-3 installed record 已有状态字段，实际切换入口留到后续管理面。

## 5. 后续入口

下一阶段应从 S-4 开始，把 S-3 安装计划中的风险摘要升级成正式静态扫描、风险等级和阻断策略。
