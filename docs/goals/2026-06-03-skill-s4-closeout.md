# Skill S-4 安全扫描与风险提示收口

## 1. 结论

截至 2026-06-03，Skill S-4 已完成设计范围内的安全扫描与风险提示基础能力。

S-4 已把 S-3 安装计划里的临时风险字符串升级为结构化安全链路：

```text
CcrSkillPackage
  -> scanSkillPackage
  -> SkillSecurityScanReport
  -> evaluateSkillSecurityPolicy
  -> SkillSecurityPolicyDecision
  -> SkillInstallPlan / apply / inspect / reporter
```

## 2. 已完成能力

### 2.1 安全模型

已新增：

```text
src/services/skills/securitySchema.ts
```

包括：

- `SkillSecurityFinding`
- `SkillSecurityScanReport`
- `SkillSecurityPolicyDecision`
- severity / category / action / scanned file kind
- summary 统计和 parse / create helper

### 2.2 静态扫描

已新增：

```text
src/services/skills/securityRules.ts
src/services/skills/securityScanner.ts
```

第一版扫描范围：

- `SKILL.md` 正文和 frontmatter。
- `allowed-tools` 高风险工具声明。
- `scripts/`、`references/`、`assets/` 资源文件。
- 可执行扩展名、二进制内容、超限文件、路径逃逸。
- 网络访问、secret / 环境变量、敏感路径、shell 执行、包安装命令。
- OpenClaw `metadata.openclaw.requires` / `install`。

不执行任何脚本，不自动安装任何依赖。

### 2.3 安装计划策略

已新增：

```text
src/services/skills/securityPolicy.ts
```

并接入：

```text
src/services/skills/installCandidates.ts
src/services/skills/installPlanner.ts
```

策略：

- 无风险：`allow`
- `info` / `low`：`warn`
- `medium`：`require-confirmation`
- `high`：默认 `block`，可用 override token 显式放行
- `critical`：直接 `block`，第一版不可 override

### 2.4 Apply 与 Inspect 闭环

已接入：

```text
src/services/skills/installManager.ts
src/services/skills/installInspector.ts
```

行为：

- apply 前重新扫描来源目录，防止 plan 生成后来源变更绕过安全策略。
- high 风险 plan 必须有合法 override token 才能安装。
- inspect installed / drifted package 会返回 `securityReport`。
- missing package、missing `SKILL.md`、missing owner marker、missing lock 等结构异常会生成 `integrity` finding。

### 2.5 风险摘要

已新增：

```text
src/services/skills/securityReporter.ts
```

用于 App Server / Desktop 后续展示：

- 最高风险
- finding 数量
- 策略动作
- 是否允许安装
- 是否需要 override
- 主要 findings
- 人类可读 headline

## 3. Smoke 覆盖

新增：

```text
scripts/smoke-skill-security-schema.mjs
scripts/smoke-skill-security-scanner.mjs
scripts/smoke-skill-security-install-plan.mjs
scripts/smoke-skill-security-apply-inspect.mjs
scripts/smoke-skill-security-reporter.mjs
```

## 4. 验证矩阵

收口时应执行：

```text
npm.cmd run build
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-security-schema
npm.cmd run smoke:skill-security-scanner
npm.cmd run smoke:skill-security-install-plan
npm.cmd run smoke:skill-security-apply-inspect
npm.cmd run smoke:skill-security-reporter
npm.cmd run typecheck
git diff --check
```

## 5. 非目标

这些仍然不是 S-4 范围：

- 不做真实沙箱执行。
- 不做 AI 恶意代码审计。
- 不自动安装 npm / pip / cargo / binary。
- 不执行 OpenClaw install metadata。
- 不做远端 registry 签名验证。
- 不做 Desktop 完整管理页。

## 6. 后续入口

下一阶段进入 S-5：Desktop Skill 管理面。

S-5 应直接消费：

- `SkillSecurityScanReport`
- `SkillSecurityPolicyDecision`
- `SkillSecurityReportDigest`

Desktop 不需要重新解析脚本或自己判断风险，只负责展示、确认、禁用、修复和卸载交互。
