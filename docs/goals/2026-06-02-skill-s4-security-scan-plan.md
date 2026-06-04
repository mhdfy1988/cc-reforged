# Goal S-4：Skill 安全扫描与风险提示

## 1. 目标

S-4 的目标是把 S-3 安装计划里的粗略风险摘要升级成正式的安全扫描报告和策略判定，让第三方 Skill 在安装前、安装后和漂移后都能被明确评估。

S-4 不追求“绝对安全”，而是建立第一版可解释、可复验、可扩展的安全边界：

```text
Skill 包 / 安装候选 / 已安装记录
  -> SkillSecurityScanner
  -> SkillSecurityScanReport
  -> SkillSecurityPolicyDecision
  -> 安装计划风险区 / App Server 结果 / 后续 Desktop 详情
```

核心目标：

- 对 `SKILL.md`、frontmatter、资源目录和脚本文件做轻量静态扫描。
- 输出结构化风险项，不只给字符串提示。
- 按策略把风险分成允许、提示、要求确认、阻断。
- 把扫描报告接入 S-3 安装计划，不再只依赖 `collectPackageRisks()` 的临时摘要。
- 为后续 Desktop 管理页展示风险、重新扫描、修复建议提供统一数据。

## 2. 为什么 S-4 独立

S-1 到 S-3 已经解决了“能不能标准化、能不能导入、能不能安装和记录”。但第三方 Skill 默认是不可信资产，存在几类问题：

- `SKILL.md` 可能诱导模型读取敏感文件、执行 shell 或外发数据。
- `scripts/` 可能包含 `.ps1`、`.bat`、`.cmd`、`.sh`、`.js`、`.py` 等可执行内容。
- OpenClaw `metadata.openclaw.install` 可能声明安装步骤，但 CCR 不能自动执行。
- `allowed-tools`、路径、环境变量、网络访问等能力可能扩大运行风险。
- installed package 发生 drift 后，S-3 能发现变更，但不能解释变更风险。

如果把安全扫描塞进 S-3 安装写入逻辑，会让安装计划、账本写入和安全策略耦合在一起。S-4 单独做，可以让 S-3 继续只负责 lifecycle，S-4 负责风险解释和策略判定。

## 3. 范围

本阶段做：

- 定义 `SkillSecurityScanReport`、`SkillSecurityFinding`、`SkillSecurityPolicyDecision`。
- 定义风险等级、风险分类、策略动作和确认要求。
- 扫描 `SKILL.md` 正文和 frontmatter。
- 扫描 `scripts/`、`references/`、`assets/` 中的可执行文件、二进制文件和路径异常。
- 检测常见网络访问、环境变量读取、secret 关键词、shell 执行、包安装命令、路径逃逸。
- 识别 OpenClaw `metadata.openclaw.requires` / `install`，只转成风险项，不自动执行。
- 把扫描报告接进 S-3 `SkillInstallPlan`。
- 高危项默认让安装计划不可直接安装，必须显式 override 或后续策略放行。
- 增加 smoke 覆盖安全模型、扫描规则、安装计划策略和 drift 后重新扫描。

本阶段不做：

- 不做完整 Desktop Skill 管理页。
- 不做真实沙箱执行。
- 不自动安装 npm / pip / cargo / binary。
- 不执行 OpenClaw installer metadata。
- 不做远端 registry 签名和供应链验证。
- 不做企业策略中心。
- 不做恶意代码深度分析或 AI 审计。
- 不把扫描结果写入标准 `SKILL.md`。

## 4. 第一版安全模型

建议新增：

```text
src/services/skills/securitySchema.ts
src/services/skills/securityScanner.ts
src/services/skills/securityRules.ts
src/services/skills/securityPolicy.ts
src/services/skills/securityReporter.ts
```

说明：

- `securitySchema.ts`：运行时校验 schema 和领域类型。
- `securityScanner.ts`：扫描入口，负责读取 package 和聚合规则结果。
- `securityRules.ts`：确定性规则集合，不访问全局状态。
- `securityPolicy.ts`：把 findings 映射成允许、警告、确认或阻断。
- `securityReporter.ts`：把结构化报告压缩成人类可读摘要，供 App Server / Desktop 使用。

### 4.1 风险等级

```ts
type SkillSecuritySeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
```

建议语义：

| 等级 | 语义 | 默认动作 |
| --- | --- | --- |
| `info` | 信息提示，不影响安装 | allow |
| `low` | 普通注意项 | warn |
| `medium` | 需要用户知道并确认 | require-confirmation |
| `high` | 高风险，默认阻断，允许显式 override | block |
| `critical` | 极高风险，第一版直接阻断 | block |

### 4.2 风险分类

```ts
type SkillSecurityCategory =
  | 'executable-content'
  | 'shell-command'
  | 'network-access'
  | 'secret-access'
  | 'filesystem-access'
  | 'package-install'
  | 'tool-permission'
  | 'path-escape'
  | 'binary-content'
  | 'openclaw-metadata'
  | 'integrity'
  | 'unknown'
```

分类不是为了吓用户，而是让 UI 和后续策略可以按类别过滤、汇总和解释。

### 4.3 Finding

```ts
type SkillSecurityFinding = {
  schemaVersion: 1
  id: string
  ruleId: string
  severity: SkillSecuritySeverity
  category: SkillSecurityCategory
  title: string
  message: string
  filePath: string | null
  relativePath: string | null
  line: number | null
  evidence: string | null
  recommendation: string
}
```

不变式：

- `evidence` 只能放短片段，不能把整段脚本或长文件塞进报告。
- `filePath` 可以是绝对路径，`relativePath` 必须限制在 package 根目录内。
- 规则命中必须可复验，同一输入稳定输出同一组 finding。
- 扫描失败本身也要变成 finding，不能静默忽略。

### 4.4 Scan Report

```ts
type SkillSecurityScanReport = {
  schemaVersion: 1
  packageId: string
  skillName: string
  scannedAt: string
  packageDir: string
  source: 'candidate' | 'installed' | 'drifted'
  summary: {
    highestSeverity: SkillSecuritySeverity
    totalFindings: number
    bySeverity: Record<SkillSecuritySeverity, number>
    byCategory: Record<SkillSecurityCategory, number>
  }
  findings: SkillSecurityFinding[]
  scannedFiles: Array<{
    relativePath: string
    kind: 'skill-md' | 'script' | 'reference' | 'asset' | 'metadata' | 'unknown'
    sizeBytes: number
    skipped: boolean
    skipReason?: string
  }>
}
```

### 4.5 Policy Decision

```ts
type SkillSecurityPolicyDecision = {
  schemaVersion: 1
  installAllowed: boolean
  action: 'allow' | 'warn' | 'require-confirmation' | 'block'
  requiresOverride: boolean
  overrideToken?: string
  reasons: string[]
  report: SkillSecurityScanReport
}
```

默认策略：

- 无 finding：`allow`。
- 只有 `info` / `low`：`warn`，安装计划仍可执行。
- 存在 `medium`：`require-confirmation`，安装计划需要额外确认。
- 存在 `high`：`block`，第一版要求显式 override token。
- 存在 `critical`：`block`，第一版不提供 override。

## 5. 扫描规则

### 5.1 `SKILL.md` 正文与 frontmatter

扫描内容：

- `allowed-tools` 是否包含高风险工具。
- `disable-model-invocation` / `user-invocable` 状态只记录，不作为风险。
- 正文是否出现读取敏感路径的指令，例如 `.ssh`、`.env`、`AppData`、`id_rsa`。
- 正文是否诱导外发内容，例如 `curl`、`Invoke-WebRequest`、`fetch`、`http://`、`https://`。
- 正文是否要求安装或执行命令，例如 `npm install`、`pip install`、`powershell`、`cmd.exe`、`bash`。

注意：

- 正文命中只说明“存在风险意图”，不能等同于实际执行。
- 第一版用确定性关键词和正则，不引入模型审计。

### 5.2 资源目录

扫描目录：

```text
scripts/
references/
assets/
```

规则：

- 可执行扩展名命中 `medium` 或 `high`。
- 脚本中出现网络访问、secret 读取、包安装命令、进程启动命中更高等级。
- 二进制文件或不可读取文件命中 `medium`。
- 文件大小超过阈值时跳过正文扫描，但记录 skipped finding。
- 相对路径逃逸 package 根目录命中 `critical`。

建议第一版阈值：

```text
单文件文本扫描上限：256KB
单个 skill 扫描文件数量上限：200
单次扫描总字节上限：2MB
```

超过阈值不自动失败，但必须产生 `skipped` 信息和 `medium` 级提示。

### 5.3 OpenClaw metadata

OpenClaw 常见字段：

```yaml
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["API_KEY"]
    install:
      - kind: node
        package: "@example/skill-tool"
```

CCR 第一版处理：

- `requires.bins` 生成依赖提示。
- `requires.env` 生成 secret / env 风险。
- `install` 生成 `package-install` 风险。
- 不自动执行任何 install 步骤。

## 6. 流程设计

### 6.1 安装前扫描

第 1 轮：用户从 imported 或 manifest 看到安装候选。

```text
SkillInstallCandidate
  -> loadSkillPackageFromDir
  -> scanSkillPackage
  -> evaluateSkillSecurityPolicy
  -> createSkillInstallPlan
```

输出：

- `plan.securityReport`
- `plan.securityDecision`
- `plan.risks` 继续保留摘要，但由 report 派生。

状态变化：

- `allow` / `warn`：`plan.installable = true`。
- `require-confirmation`：`plan.installable = true`，但 confirmation message 要包含风险确认。
- `block`：`plan.installable = false`，除非调用方传入合法 override。

### 6.2 安装时校验

第 2 轮：用户确认安装。

```text
SkillInstallPlan + confirmationToken
  -> 校验 plan confirmation
  -> 如 requiresOverride，校验 security override token
  -> applySkillInstallPlan
```

不变式：

- 安装前扫描结果不能被静默绕过。
- 如果 package 在计划后发生变化，apply 前应重新扫描或至少比较 `SKILL.md` checksum。
- S-4 第一版可以先在 plan 侧扫描；apply 前重扫作为后续增强或子迭代完成。

### 6.3 安装后 / drift 后扫描

第 3 轮：已安装 skill 被 inspect。

```text
inspectInstalledSkill
  -> status installed / drifted
  -> scan installed package
  -> 返回 inspection.securityReport
```

状态变化：

- `installed + high risk` 不自动禁用，但报告要明确。
- `drifted + high risk` 后续 S-5 可以提示修复或禁用。
- `missing-*` 状态不做正文扫描，只返回结构异常 finding。

## 7. 与 S-3 的接入边界

S-3 已有：

```text
installCandidates.ts
installPlanner.ts
installManager.ts
installInspector.ts
```

S-4 不直接替换这些模块，而是增加安全层：

```text
installCandidates
  -> packagePreview
  -> securityScanner

installPlanner
  -> securityPolicy
  -> plan.securityDecision

installInspector
  -> securityScanner
  -> inspection.securityReport
```

需要调整的类型：

- `SkillInstallCandidate` 增加 `securityReport` 或 `securitySummary`。
- `SkillInstallPlan` 增加 `securityReport`、`securityDecision`、`overrideRequired`。
- `InstalledSkillInspection` 增加可选 `securityReport`。

第一版不要求把扫描报告持久化到 `installed.json` / `lock.json`。原因：

- 报告是派生数据，可以重扫。
- 持久化会引入过期问题。
- 后续如需缓存，应写入 `~/.ccr/skills/cache/`，并用 package checksum 做失效键。

## 8. 子 Goal 拆分

### S-4.1 安全模型、schema 与报告结构

目标：

- 新增 `securitySchema.ts`。
- 定义 severity、category、finding、report、policy decision。
- 提供 parse / summarize helper。

迭代：

1. 定义类型和 zod schema。
2. 补 summary 计算函数。
3. 补 smoke：合法报告、非法等级、summary 统计。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-security-schema
npm.cmd run typecheck
```

### S-4.2 静态扫描规则第一版

目标：

- 新增 `securityRules.ts`、`securityScanner.ts`。
- 支持扫描 `SKILL.md`、frontmatter、资源目录。
- 支持文件大小、文件数量、路径逃逸保护。

迭代：

1. 扫描 `SKILL.md` 正文和 frontmatter。
2. 扫描 `scripts/` 可执行文件和常见命令。
3. 扫描 `references/` / `assets/` 的二进制和异常大小。
4. 处理 OpenClaw metadata 风险。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-security-scanner
npm.cmd run typecheck
```

### S-4.3 安装计划安全策略接入

目标：

- 新增 `securityPolicy.ts`。
- `createSkillInstallPlan` 接收扫描报告和策略决策。
- 安装计划根据风险决定 allow / warn / require-confirmation / block。

迭代：

1. 把现有 `collectPackageRisks()` 迁移为 security report 派生摘要。
2. `medium` 风险要求确认。
3. `high` 风险默认阻断并生成 override token。
4. `critical` 风险直接阻断。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-security-install-plan
npm.cmd run smoke:skill-install-plan
npm.cmd run typecheck
```

### S-4.4 Apply 与 Inspect 安全闭环

目标：

- apply 安装时校验安全策略，不允许绕过 plan。
- inspect installed / drifted package 时返回安全扫描结果。

迭代：

1. apply 校验 `requiresOverride` 和 override token。
2. apply 前最小重验 `SKILL.md` checksum 或重扫。
3. inspector 对 installed / drifted 状态附加 security report。
4. missing package / missing lock 等结构异常转成 integrity finding。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-security-apply-inspect
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run typecheck
```

### S-4.5 风险摘要、文档与回归矩阵

目标：

- 新增 `securityReporter.ts`。
- 为 App Server / Desktop 输出简洁风险摘要。
- 更新 Skill 主设计文档、S-4 closeout 和 smoke 矩阵。

迭代：

1. 报告摘要函数：最高等级、数量、主要原因、建议动作。
2. 文档补充风险等级和 UI 展示口径。
3. 全量 S-1 到 S-4 smoke 回归。

验收：

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
npm.cmd run typecheck
git diff --check
```

## 9. 成功标准

S-4 完成时必须满足：

- 安装候选能生成结构化 security report。
- 安装计划能根据 policy decision 改变可安装状态。
- 高危风险不会被静默忽略。
- OpenClaw `install` metadata 不会被执行，只会变成风险项。
- 已安装 skill inspect 能附带安全报告。
- drift 后能重新解释风险，而不是只说 checksum 不一致。
- 所有新增扫描规则都有 smoke 覆盖。

## 10. 后续阶段接口

S-4 完成后，S-5 Desktop 管理面可以直接消费：

- `SkillSecurityScanReport`
- `SkillSecurityPolicyDecision`
- `securityReporter` 输出的短摘要

S-5 不需要重新解析脚本或自己判断风险，只负责展示、确认、禁用、修复和卸载交互。
