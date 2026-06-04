# Goal S-3：Skill 安装计划与记录

## 1. 目标

S-3 的目标是把 S-2 已经导入到 CCR 管理目录的 skill，推进成“可记录、可检查、可追踪、可卸载边界明确”的受控安装项。

S-2 解决的是：

```text
外部来源 -> ~/.ccr/skills/imported/<name>/SKILL.md
```

S-3 解决的是：

```text
导入结果 / 安装清单
  -> SkillInstallCandidate
  -> SkillInstallPlan
  -> 用户确认
  -> ~/.ccr/skills/packages/<name>/
  -> ~/.ccr/skills/installed.json
  -> ~/.ccr/skills/lock.json
  -> 可被后续 loader / Desktop / 安全扫描稳定治理
```

这一阶段要建立安装管理的“事实账本”，但不急着做完整 Desktop 页面和高级安全阻断。

## 2. 为什么 S-3 必须独立

导入和安装如果混在一起，会产生几个问题：

- 用户只是想把外部 skill 转成 CCR 标准包时，不一定希望立刻启用。
- `~/.ccr/skills/imported/` 是导入副本，不适合直接承担 owner marker、lock、drift 检查和卸载语义。
- 同一个 imported skill 后续可能被重新安装、修复或迁移，必须有 installed record 和 lock record。
- 后续 Desktop 管理页、启用 / 禁用、卸载 / 修复、安全扫描都需要一个稳定的安装记录入口。

所以 S-3 把“安装”定义为一条明确 lifecycle：

```text
候选 -> 计划 -> 确认 -> 写 package -> 写 installed -> 写 lock -> inspect / drift
```

## 3. 范围

本阶段做：

- 定义 `CcrSkillInstallManifest`。
- 定义 `installed.json` 和 `lock.json` 的记录结构。
- 定义 installer-owned package 目录和 owner marker。
- 从 S-2 imported skill 生成安装候选。
- 从本地 manifest 生成安装候选。
- 生成安装计划，展示写入位置、冲突、风险、启用默认值。
- 用户确认后写入 `~/.ccr/skills/packages/<name>/`。
- 写入 `installed.json` / `lock.json`。
- 安装后能 list / inspect。
- 能检测 package 缺失、`SKILL.md` 缺失、checksum 漂移、installed / lock 不一致。
- 增加 smoke 覆盖 install / duplicate / unconfirmed / drift。

本阶段不做：

- 不做远端 registry 下载。
- 不做 marketplace 排名。
- 不做完整 Desktop Skill 管理页。
- 不做高级安全扫描阻断；S-4 负责。
- 不自动执行 OpenClaw install metadata。
- 不自动安装 npm / pip / 二进制。
- 不把非 CCR owner marker 的目录当作可卸载对象。
- 不把 installed record 写入标准 `SKILL.md`。

## 4. 目录与文件

S-3 使用：

```text
~/.ccr/
  skills/
    imported/
      <name>/
        SKILL.md
        .ccr-skill-import.json
    packages/
      <name>/
        SKILL.md
        scripts/
        references/
        assets/
        .ccr-skill-package.json
    manifests/
      <name>.json
    installed.json
    lock.json
```

### 4.1 `packages/`

`packages/` 是 installer-owned 目录。

只有满足以下条件的目录才允许被 S-3 卸载 / 覆盖：

- installed record 存在。
- package 目录存在。
- package 目录内存在 `.ccr-skill-package.json`。
- owner marker 的 name / packageId / installed record 能对上。

### 4.2 `.ccr-skill-package.json`

owner marker 建议结构：

```ts
type CcrSkillPackageOwnerMarker = {
  schemaVersion: 1
  packageId: string
  name: string
  installedAt: string
  source: CcrSkillInstallManifest['source']
  owner: 'ccr-skill-installer'
}
```

这个 marker 的作用是证明 `packages/<name>/` 是 CCR installer 管理的目录。

### 4.3 `installed.json`

建议结构：

```ts
type CcrSkillInstalledIndex = {
  schemaVersion: 1
  installed: Record<string, CcrSkillInstalledRecord>
}

type CcrSkillInstalledRecord = {
  schemaVersion: 1
  name: string
  scope: 'user' | 'project'
  installedAt: string
  updatedAt: string
  manifest: CcrSkillInstallManifest
  packageDir: string
  skillFilePath: string
  packageOwnerMarkerPath: string
  enabled: boolean
  modelInvocable: boolean
  userInvocable: boolean
  lockKey: string
}
```

说明：

- 第一版默认 `scope = "user"`。
- `enabled` 是安装层开关，不删除文件。
- `modelInvocable` / `userInvocable` 是安装管理覆盖项，后续 loader 接入时再应用。
- `lockKey` 用于对应 `lock.json`。

### 4.4 `lock.json`

建议结构：

```ts
type CcrSkillLockIndex = {
  schemaVersion: 1
  locks: Record<string, CcrSkillLockRecord>
}

type CcrSkillLockRecord = {
  name: string
  scope: 'user' | 'project'
  sourceKind: CcrSkillInstallManifest['source']['kind']
  packageDir: string
  skillFilePath: string
  checksum: {
    algorithm: 'sha256'
    skillMd: string
    packageTree?: string
  }
  originVendor: 'agent-skills' | 'claude' | 'codex' | 'openclaw' | 'ccr' | 'unknown'
  updatedAt: string
}
```

`lock.json` 是 drift 检查的依据。

## 5. 安装清单

`CcrSkillInstallManifest` 是 CCR 自己的安装清单，不写入标准 `SKILL.md`。

第一版建议：

```ts
type CcrSkillInstallManifest = {
  schemaVersion: 1
  name: string
  displayName?: string
  description?: string
  version?: string
  source:
    | { kind: 'imported-skill'; path: string; importMarkerPath?: string }
    | { kind: 'local-manifest'; path: string }
    | { kind: 'builtin-preset'; presetId: string }
  targetScope: 'user' | 'project'
  defaults: {
    enabled: boolean
    modelInvocable: boolean
    userInvocable: boolean
  }
  trust: {
    thirdParty: boolean
    executableContent: boolean
    networkDeclared: boolean
    secretsDeclared: string[]
  }
  compatibility?: {
    vendor?: 'agent-skills' | 'claude' | 'codex' | 'openclaw' | 'unknown'
    convertedFromCommand?: boolean
  }
}
```

第一版落地顺序：

- 必做：`imported-skill`。
- 可做：`local-manifest`，读取 `~/.ccr/skills/manifests/*.json` 进入候选。
- 预留：`builtin-preset`，等 bundled skill 归一时再接。

## 6. 候选、计划和结果

### 6.1 安装候选

```ts
type SkillInstallCandidate = {
  candidateId: string
  sourceType: 'imported-skill' | 'local-manifest' | 'builtin-preset'
  sourceLabel: string
  originPath: string | null
  state: 'available' | 'installed' | 'duplicate-name' | 'invalid'
  stateMessage: string
  manifest: CcrSkillInstallManifest
  packagePreview: CcrSkillPackage
  displayName: string
  description: string
  trusted: boolean
  risks: string[]
}
```

候选来源：

- `~/.ccr/skills/imported/*/SKILL.md`
- `~/.ccr/skills/manifests/*.json`
- 后续 builtin preset

### 6.2 安装计划

```ts
type SkillInstallPlan = {
  schemaVersion: 1
  planId: string
  name: string
  scope: 'user' | 'project'
  installable: boolean
  force: boolean
  manifest: CcrSkillInstallManifest
  packagePreview: {
    name: string
    description: string
    originVendor: string
    resources: {
      scripts: number
      references: number
      assets: number
    }
  }
  writes: Array<{
    kind: 'package' | 'owner-marker' | 'installed-index' | 'lockfile'
    path: string
    mode: 'copy' | 'write' | 'record'
  }>
  conflicts: Array<{
    kind: 'already-installed' | 'package-exists' | 'name-conflict'
    message: string
  }>
  risks: string[]
  requiresConfirmation: true
  confirmation: {
    token: string
    message: string
  }
}
```

### 6.3 安装结果

```ts
type SkillInstallResult = {
  schemaVersion: 1
  name: string
  scope: 'user' | 'project'
  packageDir: string
  installedRecord: CcrSkillInstalledRecord
  lockRecord: CcrSkillLockRecord
  package: CcrSkillPackage
  warnings: string[]
}
```

安装完成后必须重新从 `packages/<name>/SKILL.md` 读取并归一，不能直接相信候选阶段对象。

## 7. 具体流程

### 7.1 从 imported skill 安装

输入：

```text
~/.ccr/skills/imported/foo/
  SKILL.md
  .ccr-skill-import.json
```

流程：

1. 枚举 imported 目录。
2. 读取 `SKILL.md` 和 `.ccr-skill-import.json`。
3. 走 S-1 normalizer 得到 `CcrSkillPackage` 预览。
4. 构造 `CcrSkillInstallManifest`。
5. 检查 installed / lock / packages 冲突。
6. 生成安装计划。
7. 用户确认。
8. 复制 imported 目录到 `packages/<name>/`。
9. 写 `.ccr-skill-package.json`。
10. 写 `installed.json`。
11. 写 `lock.json`。
12. 重新读取 package 目录并归一。

### 7.2 从 local manifest 安装

输入：

```text
~/.ccr/skills/manifests/foo.json
```

流程：

1. 读取 manifest。
2. 校验 schema。
3. 根据 manifest source 读取目标 skill。
4. 生成候选和安装计划。

第一版 local manifest 可以只支持 `source.kind = "imported-skill"`，避免同时打开远端下载和本地任意目录安装。

### 7.3 重复安装

默认策略：

- 如果 `installed.json` 已有同名记录，计划 `installable = false`。
- 如果 `packages/<name>/` 已存在但无 owner marker，计划 `installable = false`。
- 如果 `packages/<name>/` 已存在且 owner marker 匹配，第一版仍默认拒绝，后续 `force` 才允许覆盖。

## 8. Inspect 与 Drift

S-3 需要提供安装状态检查能力。

### 8.1 状态枚举

```ts
type SkillInstallStatus =
  | 'installed'
  | 'disabled'
  | 'missing-package'
  | 'missing-skill-md'
  | 'missing-owner-marker'
  | 'missing-lock'
  | 'drifted'
  | 'invalid'
```

### 8.2 drift 检查

检查项：

- `installed.json` 记录存在。
- `lock.json` 对应记录存在。
- `packageDir` 存在。
- `SKILL.md` 存在。
- owner marker 存在且匹配。
- 当前 `SKILL.md` checksum 与 lock 一致。
- 当前 package 能归一成 `CcrSkillPackage`。

S-3 只做检测和结果返回，不自动修复。修复可以在后续 S-3 closeout 或 S-5 Desktop 管理中做。

## 9. 安全与权限边界

S-3 不执行 skill 内脚本。

安装阶段可以记录风险：

- 包含 `scripts/`。
- 包含 `.ps1` / `.bat` / `.cmd` / `.sh` / `.js` / `.ts` / `.py`。
- manifest 声明第三方来源。
- manifest 声明 network / secrets。
- OpenClaw import marker 显示转换来源。

但高危阻断策略放到 S-4。

第一版默认：

- `targetScope = "user"`。
- `enabled = true`。
- `modelInvocable` / `userInvocable` 继承 skill package。
- 不静默扩大 `allowed-tools` 权限。

## 10. 代码结构设计

建议继续放在：

```text
src/services/skills/
  installManifest.ts
  installPaths.ts
  installInventory.ts
  installCandidates.ts
  installPlanner.ts
  installManager.ts
  installInspector.ts
```

### 10.1 `installManifest.ts`

职责：

- 定义 `CcrSkillInstallManifest` schema。
- 定义 installed / lock / owner marker schema。
- 提供 manifest summary。

### 10.2 `installPaths.ts`

职责：

- 计算 `packages/`、`installed.json`、`lock.json`。
- 计算 package dir、owner marker path。

### 10.3 `installCandidates.ts`

职责：

- 从 imported 目录生成候选。
- 从 manifests 目录生成候选。
- 给候选打 installed / duplicate / invalid 状态。

### 10.4 `installPlanner.ts`

职责：

- candidate -> plan。
- 检查 installed / package / name 冲突。
- 生成确认 token。

### 10.5 `installManager.ts`

职责：

- 校验确认 token。
- 复制 package。
- 写 owner marker。
- 原子更新 installed / lock。
- 安装后重新读取 package 并归一。

### 10.6 `installInspector.ts`

职责：

- list installed records。
- inspect 单个 installed record。
- drift 检查。

## 11. 小 Goal 拆分

S-3 建议拆成 5 个小 goal。

### S-3.1 Manifest、记录与路径 schema

目标：

- 定义 `CcrSkillInstallManifest`。
- 定义 installed / lock / owner marker schema。
- 定义 package 路径 helper。

验收：

- `smoke:skill-install-schema` 覆盖合法 / 非法 manifest。
- typecheck 通过。

### S-3.2 Imported 候选与 manifest 候选

目标：

- 从 `~/.ccr/skills/imported/*` 生成 install candidate。
- 从 `~/.ccr/skills/manifests/*.json` 生成 install candidate。
- 候选能带 `CcrSkillPackage` preview。

验收：

- smoke 覆盖 imported candidate。
- smoke 覆盖 local manifest candidate。
- invalid candidate 有明确错误。

### S-3.3 安装计划与冲突检查

目标：

- candidate -> install plan。
- 检查 already-installed、package-exists、name-conflict。
- 生成确认 token。

验收：

- 未确认不能 apply。
- 已安装同名默认拒绝。
- 非 owner package 目录默认拒绝。

### S-3.4 Apply 安装、installed 和 lock 写入

目标：

- 确认后复制到 `packages/<name>/`。
- 写 `.ccr-skill-package.json`。
- 写 `installed.json`。
- 写 `lock.json`。
- 安装后重新归一。

验收：

- smoke 覆盖从 imported 安装。
- installed / lock 内容可回读。
- checksum 可校验。

### S-3.5 List / Inspect / Drift

目标：

- list installed。
- inspect 单个 skill。
- 检测 missing package、missing owner marker、missing lock、drifted。

验收：

- smoke 覆盖正常 installed。
- smoke 覆盖 `SKILL.md` 修改后的 drifted。
- smoke 覆盖 package 缺失。

## 12. 总体验收

S-3 完成时必须满足：

- 可以从 S-2 imported skill 生成安装候选。
- 可以生成安装计划并要求确认。
- 确认后可以写入 `packages/`、`installed.json`、`lock.json`。
- package 目录必须有 owner marker。
- 安装后能重新归一为 `CcrSkillPackage`。
- 未确认 token 时拒绝写入。
- 重复安装默认拒绝。
- 非 owner package 不允许覆盖 / 卸载。
- list / inspect / drift 检查可用。
- S-3 不执行 skill 脚本，不写标准 `SKILL.md` 内部元数据。

## 13. 完成后下一步

S-3 完成后进入 S-4：Skill 安全扫描与风险提示。

S-4 才开始处理：

- 高危脚本阻断。
- 网络 / secret / shell 行为更细粒度扫描。
- 安装计划中的风险分级。
- Desktop / App Server 风险展示。
