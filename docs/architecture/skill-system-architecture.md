# CCR Skill 系统整体架构

本文定义 CCR Skill 系统的长期架构边界。它不是阶段 todo，也不记录单轮实现进度；后续 Skill 安装、管理、运行时、插件能力目录和代码重构都应优先对齐这里的分层。

## 1. 目标

Skill 系统需要同时服务三类入口：

- 模型运行时：模型上下文、SkillTool、MCP 生成 Skill。
- 用户入口：slash command、CLI、Desktop Skill 管理页。
- 安装管理：导入、安装、修复、卸载、启用、禁用、完整性检查。

整体架构目标是：

- 管理编排层变薄。
- 安装事务独立。
- installed package 状态判断唯一。
- 能力目录独立。
- 运行时适配独立。
- 管理 DTO 格式化独立。

## 2. 总体分层

```mermaid
flowchart TD
  Desktop["Desktop / App Server / CLI"]
  Management["SkillManagementService\n应用编排层"]
  Planner["InstallPlanner\n安装计划"]
  Transaction["SkillInstallTransaction\n安装事务层"]
  Inspection["InstalledPackageInspection\n包检查层"]
  Capability["SkillCapabilityCatalog\n能力目录层"]
  RuntimeAdapter["SkillRuntimeAdapter\n运行时适配层"]
  RuntimeCatalog["SkillRuntimeCatalog\n运行时优先级与冲突诊断"]
  Dto["SkillManagementDto\n展示适配层"]
  Storage["installed.json / lock.json / packages"]
  Runtime["SkillTool / slash command / model context"]

  Desktop --> Management
  Management --> Planner
  Management --> Transaction
  Management --> Inspection
  Management --> Capability
  Management --> Dto
  Planner --> Transaction
  Transaction --> Storage
  Inspection --> Storage
  Capability --> RuntimeCatalog
  Capability --> Inspection
  RuntimeAdapter --> RuntimeCatalog
  RuntimeAdapter --> Runtime
  Inspection --> RuntimeAdapter
  Dto --> Desktop
```

## 3. 模块职责

当前代码落点：

| 架构层 | 主要模块 |
| --- | --- |
| 应用编排层 | `src/services/skills/managementService.ts` |
| 安装计划层 | `src/services/skills/installPlanner.ts` |
| 安装事务层 | `src/services/skills/installTransaction.ts` |
| 包检查层 | `src/services/skills/installedPackageInspection.ts` |
| 管理 DTO 层 | `src/services/skills/managementDtos.ts` |
| 管理持久化层 | `src/services/skills/managementStore.ts` |
| Skill 能力目录层 | `src/services/skills/capabilityProvider.ts` 和 `src/services/capabilities/skillCapabilityProvider.ts` |
| 运行时适配层 | `src/skills/skillRuntimeAdapter.ts` |
| 运行时排序层 | `src/skills/skillRuntimeCatalog.ts` |

### 3.1 SkillManagementService

应用编排层，对外承接 Desktop / App Server / CLI 请求。

它负责：

- 接收参数。
- 调用安装计划、安装事务、包检查、能力目录和 DTO 适配。
- 返回接口结果。
- 清理必要缓存。

它不负责：

- 不直接替换 package 目录。
- 不直接写 `installed.json` / `lock.json`。
- 不直接判断 `missing` / `drifted` / `invalid`。
- 不直接拼运行时能力目录。
- 不直接把 package 转成 runtime command。

### 3.2 InstallPlanner

安装计划层，负责判断一次安装是否可以执行。

它负责：

- 读取候选包。
- 计算安全策略结果。
- 判断 name conflict、package conflict、force 语义。
- 输出安装计划和确认 token。

它不负责：

- 不写文件。
- 不替换目录。
- 不更新 lock。
- 不做运行时激活判断。

### 3.3 SkillInstallTransaction

安装事务层，负责所有安装型写入。

它负责：

- staging 候选 package。
- 校验 owner marker。
- 替换 package 目录。
- 写 owner marker。
- 写 `installed.json`。
- 写 `lock.json`。
- 失败时快速暴露错误，并尽量恢复旧 package。

它不负责：

- 不决定 UI 怎么显示。
- 不决定 Skill 是否进入模型上下文。
- 不扫描 Desktop 管理页数据。

不变式：

- `installed.json` / `lock.json` 只能由安装事务层写。
- package 目录替换只能由安装事务层做。
- 非 installer-owned 目录不能覆盖、删除或静默接管。

### 3.4 InstalledPackageInspection

包检查层，负责判断 installed package 当前事实。

它负责输出统一状态：

```text
installed
disabled
missing-package
missing-skill-md
missing-owner-marker
missing-lock
drifted
invalid
```

它负责：

- 读取 installed record。
- 读取 lock record。
- 校验 owner marker。
- 校验 package / `SKILL.md` 是否存在。
- 校验 `SKILL.md` checksum。
- 校验 package tree checksum。
- 加载标准化 `CcrSkillPackage`。
- 输出 diagnostics。

它不负责：

- 不写文件。
- 不执行 repair。
- 不决定 UI 卡片文案。
- 不直接输出 runtime command。

不变式：

- installed package 状态只能在这里判断。
- 管理视图和运行时加载必须消费同一个检查结果。
- 其他模块不能重新发明 `missing` / `drifted` / `invalid` 判断。

### 3.5 SkillCapabilityCatalog

能力目录层，负责汇总“当前有哪些 Skill 能力”。

能力来源包括：

```text
managed installed skill
project skill
user skill
plugin skill
builtin plugin skill
bundled skill
dynamic skill
mcp skill
legacy command
```

每条能力至少表达：

```text
name
displayName
description
sourceKind
sourceLabel
installedRef
modelInvocable
userInvocable
enabled
runtimeVisible
hiddenReason
diagnostics
```

它负责：

- 合并 installed records 和 runtime commands。
- 标明来源。
- 标明运行时可见性。
- 标明同名冲突诊断。
- 给 Desktop / CLI / API 提供能力目录事实。

它不负责：

- 不写文件。
- 不替代 installed package inspection。
- 不输出 SkillTool prompt。
- 不做 UI 展示字段裁剪。

### 3.6 SkillRuntimeCatalog

运行时 catalog 层，负责模型和用户入口的运行时优先级。

它负责：

- 对 prompt command 做优先级排序。
- 按 name 去重。
- 输出 duplicate diagnostics。
- 保证 SkillTool 和 slash command 使用同一运行时事实。

它不负责：

- 不读写 installed index。
- 不做 package 完整性检查。
- 不承担 Desktop 管理 DTO。

### 3.7 SkillRuntimeAdapter

运行时适配层，负责把领域对象转成运行时命令。

它负责：

- 将 `InstalledPackageInspection + CcrSkillPackage` 转成 managed `Command`。
- 应用 `SkillActivationPolicy`。
- 分别适配 SkillTool 可见项和 slash command 可见项。

它不负责：

- 不判断 package 是否 drifted。
- 不写管理接口 DTO。
- 不做安装事务。

### 3.8 SkillManagementDto

展示适配层，负责把领域结果转成 Desktop / CLI / API 返回结构。

它负责：

- inspection digest。
- candidate digest。
- plan digest。
- capability digest。
- security digest。
- 字段裁剪和展示摘要。

它不负责：

- 不重新判断状态。
- 不重算 checksum。
- 不调用文件系统写入。

### 3.9 SkillManagementStore

管理持久化层，负责管理操作中的安装记录读写和受控卸载。

它负责：

- 启用 / 调用面更新时写回 installed record。
- installer-owned package 的卸载。
- 常用安装 manifest 保存。
- owner marker 归属校验。
- installed index 查找 helper。

它不负责：

- 不生成安装计划。
- 不替换 package 目录。
- 不计算 package tree checksum。
- 不生成 API 展示 DTO。

## 4. 核心数据对象

### 4.1 CcrSkillInstallManifest

安装配置。描述 Skill 从哪里来、安装到哪里、默认启用状态和信任声明。

### 4.2 CcrSkillInstalledRecord

安装记录。描述 CCR 已安装的 Skill package：

```text
name
scope
manifest
packageDir
skillFilePath
packageOwnerMarkerPath
enabled
modelInvocable
userInvocable
lockKey
```

### 4.3 CcrSkillLockRecord

锁定记录。描述安装时 package 的完整性：

```text
skillMd checksum
packageTree checksum
originVendor
updatedAt
```

### 4.4 InstalledSkillPackageInspection

包检查值对象。它是 installed package 当前状态的权威事实。

### 4.5 SkillRuntimeCapability

能力目录值对象。它是管理面和诊断面看到的 Skill 能力事实。

### 4.6 Command

运行时命令对象。它服务模型和用户调用，不等同于安装记录，也不等同于能力目录。

## 5. 关键流程

### 5.1 安装

```mermaid
sequenceDiagram
  participant UI as Desktop / CLI
  participant MS as SkillManagementService
  participant Planner as InstallPlanner
  participant Tx as SkillInstallTransaction
  participant Inspect as InstalledPackageInspection
  participant DTO as SkillManagementDto

  UI->>MS: planInstall(manifest)
  MS->>Planner: createSkillInstallPlan(candidate)
  Planner-->>MS: SkillInstallPlan
  MS-->>UI: plan DTO

  UI->>MS: applyInstall(plan confirmation)
  MS->>Tx: apply plan
  Tx->>Tx: stage / owner check / replace / write index / write lock
  Tx-->>MS: install result
  MS->>Inspect: inspect installed package
  Inspect-->>MS: inspection
  MS->>DTO: format result
  DTO-->>UI: management result
```

### 5.2 修复

```text
ManagementService
  -> InstalledPackageInspection
  -> create candidate from manifest
  -> InstallPlanner(force)
  -> SkillInstallTransaction
  -> InstalledPackageInspection
  -> SkillManagementDto
```

修复不允许先删除旧 package。必须先构建候选包，再替换。

### 5.3 管理页列表

```text
ManagementService
  -> list InstalledPackageInspection
  -> build SkillRuntimeCatalog for current cwd
  -> build SkillCapabilityCatalog
  -> SkillManagementDto
```

管理页必须同时返回：

- 安装记录视图：`installed`
- 能力目录视图：`capabilities`

`installed` 不代表全部能力。

### 5.4 运行时加载

```text
InstalledPackageInspection
  -> SkillActivationPolicy
  -> SkillRuntimeAdapter
  -> SkillRuntimeCatalog
  -> SkillTool / slash command
```

运行时不直接读写管理 DTO。

## 6. 来源优先级

运行时同名 Skill 的建议优先级：

```text
policy
project
user
managed installed
plugin
bundled
dynamic
mcp
legacy command
```

同名冲突不能静默吞掉，必须进入 diagnostics。

## 7. 完整性规则

CCR installed package 的完整性由两层 checksum 组成：

- `skillMd`：`SKILL.md` 文件 checksum。
- `packageTree`：package 内资源树 checksum。

package tree checksum 应覆盖：

- `SKILL.md`
- `scripts/`
- `references/`
- `assets/`
- 其他 package 内普通文件

package tree checksum 不应覆盖：

- `.ccr-skill-package.json`
- `installed.json`
- `lock.json`
- 安装器临时 staging / backup 目录

资源漂移时，检查状态必须为 `drifted`。

## 8. 模块边界不变式

- 安装事务层是唯一写入层。
- 包检查层是 installed package 状态唯一权威。
- 能力目录层只合并事实，不写文件。
- 运行时适配层只服务模型和用户调用。
- DTO 层只格式化，不重新判断业务状态。
- 所有 fallback 必须显式命名、有诊断、有测试；禁止静默回到旧逻辑。
- 内部流转优先使用明确类型，不传半结构化 `Record<string, unknown>`。

## 9. 目录落点

建议长期目录形态：

```text
src/services/skills/
  managementService.ts
  installPlanner.ts
  installManager.ts
  installTransaction.ts
  installManifest.ts
  installCandidates.ts
  installedPackageInspection.ts
  packageTreeIntegrity.ts
  capabilityProvider.ts
  managementDtos.ts
  managementStore.ts
  securityScanner.ts
  securityPolicy.ts

src/skills/
  installedSkillLoader.ts
  skillActivationPolicy.ts
  skillRuntimeAdapter.ts
  skillRuntimeCatalog.ts
```

说明：

- `src/services/skills/` 偏管理、安装、持久化和领域服务。
- `src/skills/` 偏模型运行时、prompt command、SkillTool 和 slash command。
- 如果一个模块既写文件又返回 UI DTO，说明边界已经混乱，应拆开。

## 10. 后续重构判定标准

后续重构 Skill 代码时，先判断改动属于哪一层：

- 改安装写入：进入安装事务层。
- 改 installed package 状态：进入包检查层。
- 改管理页列什么能力：进入能力目录层。
- 改模型可见或 slash 可见：进入运行时适配层。
- 改接口返回字段：进入 DTO 层。

如果一次改动跨三层以上，应先写 goal 或方案，不直接开改。

## 11. 验证入口

Skill 内部分层重构固定 smoke：

```powershell
npm.cmd run smoke:skill-internal-refactor
```

发布前 Skill 全量回归：

```powershell
npm.cmd run smoke:skill-release
```
