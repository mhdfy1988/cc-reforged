# CCR Skill 标准兼容与安装管理设计

## 1. 目标

CCR 后续需要把 Skill 从“可以加载和调用的 prompt command”推进到“可导入、可安装、可启用、可审计、可卸载的外部能力包”。这份文档定义第一版设计口径：

- 以 `SKILL.md` 作为主标准。
- 兼容 Claude Code、OpenAI Codex 和 OpenClaw 的常见 skill 布局。
- 保留 CCR 当前 `Command` / `SkillTool` 运行链路，不推倒重写。
- 新增统一的 skill package 模型，把外部格式归一后再进入运行时。
- 复用 MCP 安装管理的经验，形成 `候选 -> 计划 -> 用户确认 -> 安装记录 -> 启用 / 禁用 -> 修复 / 卸载` 闭环。

## 2. 当前 CCR 实现

当前 CCR 已经具备 skill 运行时基础。S-1 到 S-10 已把标准模型、导入转换、安装记录账本、安全扫描、Desktop 管理面、CLI 管理入口、installed package 运行时接入、来源扩展、runtime catalog 统一和发布前 closeout 落到服务层、App Server、CLI、运行时 loader、文档与 smoke 验证。

### 2.1 已有能力

`src/skills/loadSkillsDir.ts` 当前负责从多个来源读取 skill，并把它们转成 `PromptCommand`：

- 项目 skill：`.claude/skills/<name>/SKILL.md`
- 用户 skill：`~/.claude/skills/<name>/SKILL.md`
- managed skill
- bundled skill
- plugin skill
- MCP skill
- 旧 `.claude/commands/*.md` 兼容入口

解析字段包括：

- `name`
- `description`
- `allowed-tools`
- `argument-hint`
- `arguments`
- `when_to_use`
- `version`
- `model`
- `disable-model-invocation`
- `user-invocable`
- `hooks`
- `context: fork`
- `agent`
- `effort`
- `shell`
- `paths`

`src/tools/SkillTool/prompt.ts` 会把可用 skill 以摘要形式暴露给模型。模型看到的是 `skill name + description + whenToUse`，不是完整正文。

`src/tools/SkillTool/SkillTool.ts` 在模型调用 Skill 工具时找到对应 command，并通过 `getPromptForCommand` 加载 skill 正文。

`src/utils/processUserInput/processSlashCommand.tsx` 最终把渲染后的 prompt command 内容放进模型可见消息，并带上 allowed tools、model、effort 等运行约束。

### 2.2 阶段状态

本文最初设计时缺少的是安装管理层和安装后运行时治理。当前阶段状态如下：

- 已有稳定的本地 skill candidate 搜索 / 导入源。
- 已有 `CcrSkillInstallManifest`。
- 已有受控安装计划和确认 token。
- 已有 `~/.ccr/skills/installed.json` / `lock.json`。
- 已有安装前静态风险扫描。
- 已有 Desktop 的 skill 安装、导入、启用、禁用、卸载、修复界面。
- 已有 installed managed skill runtime loader。
- 已有 runtime activation policy，支持 `enabled` / `modelInvocable` / `userInvocable` 生效。
- 已有 runtime catalog 冲突优先级和 diagnostics。
- runtime catalog 已覆盖 local、managed、plugin、bundled、dynamic、MCP 和 legacy command 的统一排序与 duplicate diagnostics。
- 已有 `ccr skill search/import/install/status/inspect/repair/uninstall` CLI 管理入口，写入操作默认 dry-run，显式 `--yes` 后才执行。
- 已有 installed managed skill 的 `hooks` / `shell` / `version` / `paths` 运行时等价透传，并已把 hook command / HTTP / env 风险纳入安全扫描。
- `src/services/skillSearch/` 仍是实验 / 占位状态，不能作为正式安装管理依据。

截至 2026-06-03，S-1 到 S-10 已补齐第一版闭环能力：

```text
已完成：标准模型、运行时归一、导入治理、安装计划、安装记录、安装诊断、安全扫描、Desktop 管理面、CLI 管理入口、受控修复 / 卸载、installed package 运行时接入、启用状态运行时生效、hooks / shell managed runtime 等价透传、local-archive 导入、builtin-preset 候选和安装、第一批 CCR 内置 Skill preset、dynamic / MCP runtime catalog 统一、Skill / MCP 发布前 closeout
下一批：企业 trust policy、Skill 使用统计和推荐、远端 registry 单独恢复设计
暂停项：远端 registry 已暂停，后续单独排期；企业 trust policy、Skill 使用统计和推荐仍未进入当前实现序列
```

阶段收口核验记录见：

```text
docs/goals/2026-06-02-skill-s1-s3-closeout.md
docs/goals/2026-06-03-skill-s4-closeout.md
docs/goals/2026-06-03-skill-s5-closeout.md
docs/goals/2026-06-03-skill-s6-closeout.md
docs/goals/2026-06-03-skill-hooks-shell-runtime-security-plan.md
```

后续执行文档见：

```text
docs/goals/2026-06-03-skill-s7-source-expansion-plan.md
docs/goals/2026-06-03-skill-s8-runtime-catalog-unification-plan.md
docs/goals/2026-06-03-skill-s9-cli-management-plan.md
docs/goals/2026-06-03-skill-mcp-s10-closeout-plan.md
```

## 3. 标准 Skill 格式

CCR 第一版以 Agent Skills 风格的 `SKILL.md` 作为标准。

最小目录：

```text
my-skill/
  SKILL.md
```

推荐目录：

```text
my-skill/
  SKILL.md
  scripts/
  references/
  assets/
```

`SKILL.md` 最小格式：

```md
---
name: my-skill
description: 什么时候应该使用这个 skill
---

这里写给 agent 的具体操作说明。
```

### 3.1 必填字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 稳定 ID。推荐小写、数字、短横线。 |
| `description` | string | 触发描述。模型主要靠它判断什么时候使用。 |
| Markdown body | string | 实际指令正文。只有命中或显式调用时再加载。 |

### 3.2 可选资源目录

| 目录 | 语义 | 加载策略 |
| --- | --- | --- |
| `scripts/` | 可执行脚本，适合稳定、可重复、确定性强的任务 | 不自动塞进上下文；skill 正文说明何时运行或读取 |
| `references/` | 参考资料、长文档、协议、示例说明 | 按需读取；正文应说明搜索或读取方式 |
| `assets/` | 模板、图片、字体、样例文件、输出资源 | 按需复制、读取或引用，不作为默认上下文 |

### 3.3 不变式

- `SKILL.md` 是唯一必需入口。
- `description` 是触发主依据，必须写清楚适用场景。
- 正文应保持精炼；详细资料放 `references/`。
- 支持文件必须通过相对路径从 skill 根目录解析。
- 不允许路径逃逸到 skill 根目录之外。
- 安装来源和安装记录不写进标准 `SKILL.md`，由 CCR 安装管理层维护。

## 4. 兼容矩阵

### 4.1 Claude Code Skill

常见路径：

```text
.claude/skills/<name>/SKILL.md
~/.claude/skills/<name>/SKILL.md
<plugin>/skills/<name>/SKILL.md
```

兼容策略：

- 直接读取 `SKILL.md`。
- 支持现有 Claude / CCR frontmatter 字段。
- plugin skill 进入命名空间：`pluginName:skillName`。
- `allowed-tools` 作为权限预授权提示和运行时权限输入处理，但不替代用户 / 项目权限策略。

### 4.2 Claude Commands

旧格式：

```text
.claude/commands/foo.md
```

这不是标准 skill。它是旧自定义命令文件，会创建 `/foo` 入口。

兼容策略：

- 不把 `.claude/commands/foo.md` 当作标准 skill 包。
- 提供“转换为 skill”的导入能力：

```text
.claude/commands/foo.md
  -> .ccr/imported-skills/foo/SKILL.md
```

转换规则：

- 文件名作为 `name`。
- 原 frontmatter 尽量保留。
- 如果没有 `description`，从正文第一段生成短描述。
- 正文原样迁移。
- 迁移后的 skill 默认 `user-invocable: true`。
- 如果该 command 明显依赖 slash 参数，保留 `$ARGUMENTS` 或追加参数说明。

### 4.3 OpenAI Codex Skill

常见路径：

```text
.codex/skills/<name>/SKILL.md
~/.codex/skills/<name>/SKILL.md
```

Codex 常见附加文件：

```text
agents/openai.yaml
```

`agents/openai.yaml` 是 UI / interface 元数据，不是标准正文。常见字段：

```yaml
interface:
  display_name: "Image Gen"
  short_description: "Generate or edit images for websites, games, and more"
  icon_small: "./assets/imagegen-small.svg"
  icon_large: "./assets/imagegen.png"
  brand_color: "#000000"
  default_prompt: "Use $imagegen to make or edit an image for this project."
```

兼容策略：

- `SKILL.md` 直接兼容。
- `agents/openai.yaml` 可选读取，用于 Desktop 展示名、短描述、图标和默认 prompt。
- 不要求所有 skill 必须提供 `agents/openai.yaml`。
- 如果 `openai.yaml` 和 `SKILL.md` 冲突，运行时以 `SKILL.md` 的 `name` / `description` 为准；UI 可展示 `display_name` / `short_description`。

### 4.4 OpenClaw Skill

常见路径：

```text
skills/<name>/SKILL.md
.agents/skills/<name>/SKILL.md
~/.agents/skills/<name>/SKILL.md
~/.openclaw/skills/<name>/SKILL.md
```

OpenClaw 常见扩展：

```yaml
metadata:
  openclaw:
    skillKey: image-lab
    homepage: https://example.com
    requires:
      bins: ["node"]
      env: ["API_KEY"]
    install:
      - kind: node
        package: "@example/skill-tool"
```

兼容策略：

- `SKILL.md` 直接兼容。
- `metadata.openclaw.*` 保留进 `compatibility.rawFrontmatter`。
- `requires` 可以进入 CCR 的风险 / 依赖提示。
- `install` 不自动执行；需要转换成 CCR 安装计划并要求用户确认。
- OpenClaw agent allowlist 不直接复用；CCR 后续使用自己的启用 / 禁用和 Profile / workspace 过滤规则。

## 5. CCR 内部模型

外部格式进入 CCR 后，应统一归一成 `CcrSkillPackage`。

```ts
type CcrSkillPackage = {
  schemaVersion: 1
  id: string
  name: string
  displayName?: string
  description: string
  bodyPath: string
  baseDir: string
  source:
    | 'user'
    | 'project'
    | 'managed'
    | 'plugin'
    | 'bundled'
    | 'imported'
    | 'mcp'
  origin: {
    vendor: 'agent-skills' | 'claude' | 'codex' | 'openclaw' | 'ccr' | 'unknown'
    sourcePath: string
    importedFrom?: string
  }
  resources: {
    scripts: string[]
    references: string[]
    assets: string[]
  }
  interface?: {
    shortDescription?: string
    iconSmall?: string
    iconLarge?: string
    brandColor?: string
    defaultPrompt?: string
  }
  invocation: {
    modelInvocable: boolean
    userInvocable: boolean
    context: 'inline' | 'fork'
    allowedTools: string[]
    argumentHint?: string
    argumentNames: string[]
    model?: string
    effort?: string | number
    agent?: string
  }
  compatibility: {
    rawFrontmatter: Record<string, unknown>
    openaiYaml?: Record<string, unknown>
    warnings: string[]
  }
}
```

### 5.1 和 Command 的关系

`CcrSkillPackage` 是领域模型，`Command` 是运行适配。

第一版不推翻当前链路：

```text
CcrSkillPackage
  -> SkillRuntimeAdapter
  -> PromptCommand
  -> SkillTool / slash command
```

这样可以保留现有 `SkillTool`、权限、fork agent、slash command、telemetry 和 hooks 逻辑，同时逐步把 skill 加载和安装管理从 `Command` 概念里抽出来。

## 6. 上下文链路

CCR 应继续保持“摘要先行，正文按需加载”的策略。

### 6.1 可用 skill 摘要

模型默认只看到：

```text
- skill-name: description - when_to_use
```

摘要来源：

- `name`
- `description`
- `when_to_use`
- `interface.shortDescription` 可作为 UI 文案，不替代触发描述

预算策略：

- 继续保留上下文窗口百分比预算。
- 单条描述设置硬上限。
- 超预算时优先保留 bundled / managed / 当前 workspace 显式启用项。
- 不把 `SKILL.md` 正文、references、scripts 内容提前塞进上下文。

### 6.2 正文加载

触发方式：

- 模型调用 `Skill` 工具。
- 用户显式 `/skill-name`。
- Desktop 未来从 skill 详情页发起默认 prompt。

加载结果：

```text
<command-name>skill-name</command-name>
Base directory for this skill: <baseDir>

<SKILL.md rendered body>
```

注意：

- 正文进入当前会话后会影响后续轮次。
- 如果发生 compaction，必须保留已调用 skill 的摘要或重建提示。
- 支持文件仍按需读取，不随正文自动展开。

## 7. 安装管理设计

Skill 安装管理应复用 MCP 已经验证过的治理形态。

### 7.1 用户目录

建议布局：

```text
~/.ccr/
  skills/
    installed.json
    lock.json
    packages/
    manifests/
    imported/
    cache/
```

| 路径 | 用途 |
| --- | --- |
| `~/.ccr/skills/packages/` | CCR installer-owned skill 包目录 |
| `~/.ccr/skills/imported/` | 从 Claude command、Codex/OpenClaw 目录导入并复制后的 skill |
| `~/.ccr/skills/manifests/` | 用户保存的常用 skill 安装配置 |
| `~/.ccr/skills/installed.json` | CCR 受控 skill 安装记录 |
| `~/.ccr/skills/lock.json` | 安装锁定记录，保存来源、版本、checksum 和归属 |
| `~/.ccr/skills/cache/` | 可删除缓存 |

### 7.2 安装来源

第一版支持：

| 来源 | 说明 |
| --- | --- |
| `local-skill-dir` | 本地已有 skill 目录，包含 `SKILL.md` |
| `local-archive` | 本地 zip/tar 包，解压后必须包含 `SKILL.md` |
| `claude-command` | `.claude/commands/foo.md`，导入时转换成 `SKILL.md` |
| `codex-skill-dir` | `.codex/skills/<name>/SKILL.md` |
| `openclaw-skill-dir` | `skills/<name>/SKILL.md` 或 `.agents/skills/<name>/SKILL.md` |
| `builtin-preset` | CCR 内置 skill |
| `remote-registry` | 已暂停的后续远端 registry，不进入当前实现序列 |

当前第一批 CCR 内置 Skill preset：

| preset id | 展示名 | 说明 |
| --- | --- | --- |
| `skill-package-helper` | Skill 包助手 | 创建、更新、审查标准 Skill 包 |
| `skill-install-helper` | Skill 安装助手 | 导入、安装、启用、检查、修复和卸载 Skill |
| `mcp-config-helper` | MCP 配置助手 | 创建或审查 MCP 安装配置 |
| `bug-debug-helper` | BUG 排查助手 | 按问题驱动方式排查项目 BUG、回归、报错和验证异常 |
| `release-check-helper` | 发布检查助手 | 发布前核对版本、文档、build、smoke、打包命令和产物 |
| `docs-update-helper` | 文档更新助手 | 同步 README、CHANGELOG、goal、Skill/MCP 专题文档和架构说明 |

### 7.2.1 Codex 用户 Skill 复用口径

内置 preset 的标准入口是 `SKILL.md`，因此其中一部分可以直接作为 Codex 用户 Skill 复用。复用目标是让同一套工作流知识在 CCR 和 Codex 中保持一致，而不是把 CCR 安装账本同步到 Codex。

当前推荐可复用到 Codex 的通用型 preset：

| Skill | Codex 复用价值 | CCR 专用资料处理 |
| --- | --- | --- |
| `bug-debug-helper` | 通用 BUG 排查、回归定位、构建或 UI 异常处理 | CCR 入口索引放在 `references/`，只有目标项目是 CCR 时读取 |
| `docs-update-helper` | 功能大改、阶段收口、发布前文档同步 | CCR 文档审计清单放在 `references/`，其他项目用自己的文档入口 |
| `release-check-helper` | 发布前版本、验证命令、打包产物检查 | CCR release gate 放在 `references/`，其他项目用自己的 scripts 和 CI |

复制到 Codex 时建议目录形态：

```text
~/.codex/skills/<name>/
  SKILL.md
  references/
  agents/
    openai.yaml
```

不要复制 `.ccr-skill-package.json`、`.ccr-builtin-skill-preset.json`、`installed.json`、`lock.json` 或 owner marker。这些文件只属于 CCR 安装管理层，不是 Codex Skill 标准的一部分。

Codex 的可用 Skill 列表通常在线程上下文创建时注入。把上述 preset 复制到 `~/.codex/skills/<name>/` 后，应通过新建 Codex 线程验证它们是否出现在 Available skills 中；继续旧线程，或重启应用后恢复旧线程，可能仍沿用旧的 Skill 注入清单。旧线程里即使可以手动读取 `SKILL.md` 文件，也不能视为系统级自动 Skill 已刷新。

`agents/openai.yaml` 只写 Codex UI 元数据，例如 `display_name`、`short_description` 和 `default_prompt`。不要把安装来源、风险扫描结果、CCR package 记录或 lock 信息写进 `openai.yaml`。

### 7.3 安装清单

CCR 自己的安装 manifest 不写进标准 `SKILL.md`。建议单独定义：

```ts
type CcrSkillInstallManifest = {
  schemaVersion: 1
  name: string
  displayName?: string
  description?: string
  source:
    | { kind: 'local-skill-dir'; path: string }
    | { kind: 'local-archive'; path: string; checksum?: Checksum }
    | { kind: 'claude-command'; path: string }
    | { kind: 'codex-skill-dir'; path: string }
    | { kind: 'openclaw-skill-dir'; path: string }
    | { kind: 'builtin-preset'; presetId: string }
    | { kind: 'remote-registry'; url: string; checksum?: Checksum } // 暂停项，当前不作为正式候选来源
  targetScope: 'user' | 'project'
  trust: {
    thirdParty: boolean
    executableContent: boolean
    networkDeclared: boolean
    secretsDeclared: string[]
  }
  compatibility?: {
    vendor?: 'claude' | 'codex' | 'openclaw' | 'unknown'
    convertCommand?: boolean
  }
}
```

### 7.4 安装计划

用户点击安装前，必须先生成计划：

```text
候选 skill
  -> 解析 SKILL.md
  -> 识别来源 / vendor
  -> 静态扫描
  -> 计算写入位置
  -> 检查同名冲突
  -> 生成安装计划
  -> 用户确认
  -> 写入 packages/imported
  -> 写 installed.json / lock.json
  -> 刷新 skill cache
```

安装计划必须展示：

- skill 名称和描述
- 来源路径 / URL
- vendor 识别结果
- 目标写入路径
- 是否包含脚本
- 是否包含可执行文件
- 是否声明环境变量 / secret
- 是否声明网络能力
- 是否和已有 skill 同名
- 安装后是否默认启用
- 是否会暴露给模型自动调用

### 7.5 启用 / 禁用

安装和启用是两件事。

建议状态：

```text
installed + enabled
installed + disabled
installed + modelInvocationDisabled
installed + userInvocationDisabled
missing-files
drifted
invalid
```

启用控制不应该靠删除文件实现，应写入 CCR 配置或安装记录。

### 7.6 卸载 / 修复

只允许卸载 CCR installer-owned 的 skill。

卸载条件：

- 存在 installed record。
- package 目录有 owner marker。
- lock 记录匹配。

修复场景：

- `SKILL.md` 缺失。
- package 目录缺失。
- lock 和 installed record 不一致。
- 用户修改了 installed skill，导致 checksum 漂移。

修复策略：

- 本地来源：重新复制或提示来源不可用。
- 远端来源：重新下载，必须校验 checksum 或提示风险。
- command 转换来源：重新生成 `SKILL.md`。

## 8. 安全与审计

第三方 skill 默认是不可信资产。安装前至少做轻量扫描。

### 8.1 扫描范围

第一版扫描：

- `SKILL.md`
- `SKILL.md` frontmatter 中的 `hooks`
- `scripts/`
- 可执行扩展名文件
- shell / js / ts / py / ps1 / bat / cmd

### 8.2 风险项

需要提示或阻断：

- shell 执行
- hook command / HTTP 回调 / HTTP header 环境变量引用
- 动态代码执行
- 读取环境变量
- 读取敏感路径
- 网络发送
- 大段混淆内容
- 路径逃逸
- 压缩包解压穿越
- 可疑二进制

### 8.3 执行原则

- 安装时不自动执行 skill 内脚本。
- OpenClaw `metadata.openclaw.install` 不能自动执行，只能转成 CCR 安装计划。
- `allowed-tools` 不能静默扩大用户权限，必须经过 CCR 权限系统。
- 项目 skill 涉及工具预授权时，需要 workspace trust 或显式确认。

## 9. Desktop 体验

第一版 Desktop 可以复用 MCP 页面经验，但不要混在 MCP 页面里。

建议页面结构：

```text
Skill 管理
  左侧：已安装 / 当前可用 skill
  中间：详情、正文预览、资源、风险、启用状态
  右侧：安装候选 / 导入外部 Skill
```

安装区入口：

- 导入 Skill
- 从 Claude command 转换
- 搜索内置 / 常用安装配置

不在管理页单独提供“创建 Skill 安装配置”表单。新建 Skill 应走会话里的 `Skill 包助手` / skill creator 生成完整 `SKILL.md` 包；CCR 后续再把生成结果登记为安装候选，而不是要求用户手填 manifest 壳。

详情页操作：

- 启用 / 禁用
- 允许 / 禁止模型自动调用
- 允许 / 禁止用户 slash 调用
- 预览 `SKILL.md`
- 查看资源文件
- 查看扫描结果
- 修复
- 卸载

候选卡片只展示必要内容：

- display name / name
- 短描述
- 来源
- 状态：可安装、已安装、配置漂移、重复名称、无效
- 安装按钮

详细风险和写入路径放确认弹窗或详情页，不在候选卡片里堆满标签。

### 9.1 安装确认弹窗口径

安装确认弹窗不是 manifest 调试器。它的目标是让用户在确认前快速理解三件事：这个 Skill 是什么、确认后会发生什么、是否存在需要注意的风险。

推荐结构：

1. 顶部展示动作标题、Skill 名称和安装位置。
2. 如果 Skill 有较长 `description` 或展示说明，单独放在摘要块里；不要把说明和安全、写入路径混在同一段。
3. 主确认区只放“安全扫描”和“确认后会做这些事”。风险、发现项、override 状态必须来自安装计划，不在前台重新推断。
4. 写入路径、来源类型、风险动作、文件数量、lock 记录等放入折叠的“技术细节”。
5. 候选卡片只保留名称、短描述、来源和安装入口，避免把确认弹窗里的路径和审计信息提前堆到列表里。

说明文案要使用面向用户的动作描述，例如“安装到用户全局 Skill 目录”“复制 Skill 包内容”“写入安装记录”“记录锁定信息，方便后续检查和修复”。绝对路径和 owner marker 这类实现细节进入技术细节，不作为主说明。

内置 Skill preset 的文案默认写成跨项目通用能力。只有当目标项目明确是 CCR 时，才在正文或参考资料里提 CCR 专用路径、smoke、发布检查清单；不要把 `description` 写成 CCR 项目专属用语。

## 10. 迭代计划

### 10.1 Goal S-1：标准模型与加载归一

[实施拆分文档](../goals/2026-06-02-skill-s1-standard-model-plan.md) 已单独沉淀，后续执行按 S-1.1 到 S-1.5 顺序推进。

目标：

- 新增 `CcrSkillPackage` 模型。
- 从现有 `Command` 加载中抽出 skill 归一层。
- 继续适配现有 `Command` / `SkillTool`，不改变用户可见行为。

验收：

- 现有用户 / 项目 / managed `.claude/skills` 通过 `CcrSkillPackage -> Command adapter` 仍能调用。
- legacy `.claude/commands/*.md` 通过 `source = "legacy-command"` 仍能调用。
- 新模型能输出统一 source、baseDir、resources、invocation。
- normalizer / schema / adapter / catalog 有正式 smoke 覆盖。
- bundled / plugin / MCP 三类来源不在 S-1 静默硬接；它们作为后续 S-2 / S-3 显式接入点记录。

S-1 closeout 记录见：

```text
docs/goals/2026-06-02-skill-s1-closeout.md
```

### 10.2 Goal S-2：本地导入与转换

[详细实施拆分文档](../goals/2026-06-02-skill-s2-import-conversion-plan.md) 已单独沉淀，后续执行按 S-2.1 到 S-2.5 顺序推进。

目标：

- 支持导入本地 `SKILL.md` 目录。
- 支持导入 `.codex/skills` 和 OpenClaw skill 目录。
- 支持把 `.claude/commands/foo.md` 转换成标准 skill。
- 导入后写入 `~/.ccr/skills/imported/`，不修改原始来源。
- 导入结果能重新归一为 `CcrSkillPackage`。

验收：

- 导入后进入 `~/.ccr/skills/imported/`。
- 同名冲突可提示。
- 转换结果包含合法 `SKILL.md`。
- 不写 `installed.json` / `lock.json`，生命周期治理留给 S-3。

拆分：

1. S-2.1 导入模型、路径和 schema。
2. S-2.2 本地 `SKILL.md` 目录候选发现。
3. S-2.3 Codex / OpenClaw 兼容读取。
4. S-2.4 Claude command 转换。
5. S-2.5 导入计划、确认和写入 imported。

### 10.3 Goal S-3：安装计划与记录

[详细实施拆分文档](../goals/2026-06-02-skill-s3-install-record-plan.md) 已单独沉淀，后续执行按 S-3.1 到 S-3.5 顺序推进。

S-1 到 S-3 的整体核验记录见：

```text
docs/goals/2026-06-02-skill-s1-s3-closeout.md
```

目标：

- 定义 `CcrSkillInstallManifest`。
- 实现 candidate / plan / apply。
- 写入 `installed.json` 和 `lock.json`。
- 写入 installer-owned package 目录和 owner marker。
- 支持 list / inspect / drift 检查。

验收：

- 安装前必须确认。
- 安装后可以 list / inspect。
- 只对 installer-owned skill 提供卸载。
- 未确认 token 时拒绝写入。
- 重复安装默认拒绝。
- package 缺失、owner marker 缺失、checksum 漂移能被检测。

拆分：

1. S-3.1 Manifest、记录与路径 schema。
2. S-3.2 Imported 候选与 manifest 候选。
3. S-3.3 安装计划与冲突检查。
4. S-3.4 Apply 安装、installed 和 lock 写入。
5. S-3.5 List / Inspect / Drift。

### 10.4 Goal S-4：安全扫描与风险提示

[详细实施拆分文档](../goals/2026-06-02-skill-s4-security-scan-plan.md) 已单独沉淀，后续执行按 S-4.1 到 S-4.5 顺序推进。

收口记录见：

```text
docs/goals/2026-06-03-skill-s4-closeout.md
```

目标：

- 对 skill 包做轻量静态扫描。
- 安装计划展示风险。
- 高危项默认阻断或要求显式 override。

验收：

- 可检测脚本、环境变量读取、网络发送和路径逃逸。
- 风险展示在 Desktop / App Server 结果里。

拆分：

1. S-4.1 安全模型、schema 与报告结构。
2. S-4.2 静态扫描规则第一版。
3. S-4.3 安装计划安全策略接入。
4. S-4.4 Apply 与 Inspect 安全闭环。
5. S-4.5 风险摘要、文档与回归矩阵。

### 10.5 Goal S-5：Desktop 管理面

[详细实施拆分文档](../goals/2026-06-03-skill-s5-desktop-management-plan.md) 已单独沉淀，S-5.1 到 S-5.5 已完成。收口记录见：

```text
docs/goals/2026-06-03-skill-s5-closeout.md
```

目标：

- 新增 Skill 管理页。
- 展示已安装、安装候选、详情和安全摘要。
- 支持导入、安装、启用 / 禁用状态写入、修复、卸载。

验收：

- 用户能通过 Desktop 导入一个本地 skill。
- 用户能从候选生成安装计划并确认安装。
- 用户能看到安全摘要和 override 要求。
- 用户能写入启用 / 禁用 / modelInvocable / userInvocable 状态。
- 用户能对 installer-owned package 做修复和卸载。

拆分：

1. S-5.1 App Server Skill 管理协议。（已完成）
2. S-5.2 Skill 管理服务。（已完成）
3. S-5.3 Desktop SkillsPage 三栏管理面。（已完成）
4. S-5.4 导入 Skill 与安装候选 UX。（已完成）
5. S-5.5 桌面回归与文档收口。（已完成）

### 10.6 Goal S-6：运行时启用治理与 installed package 接入

[详细实施拆分文档](../goals/2026-06-03-skill-s6-runtime-activation-plan.md) 已单独沉淀，S-6.1 到 S-6.5 已完成。收口记录见：

```text
docs/goals/2026-06-03-skill-s6-closeout.md
```

目标：

- 把 `~/.ccr/skills/packages/<name>/` 接入运行时 Skill loader。
- 让 installed record 的 `enabled` / `modelInvocable` / `userInvocable` 生效。
- 让 disabled、drifted、missing、invalid 不进入模型上下文。
- 明确 installed skill 和项目 / 用户 / bundled / plugin / MCP skill 的冲突优先级。

验收：

- 用户能通过 Desktop 安装的 Skill 在运行时可用。
- 用户禁用 Skill 后，模型 SkillTool prompt 不再看到它。
- `modelInvocable=false` 后，模型自动调用列表不再包含它。
- `userInvocable=false` 后，slash command 不再包含它。
- drifted / missing / invalid installed skill 进入 diagnostics，不静默 fallback。

拆分：

1. S-6.1 InstalledSkillRuntimeLoader。（已完成）
2. S-6.2 激活策略。（已完成）
3. S-6.3 Runtime Catalog 合并与冲突诊断。（已完成）
4. S-6.4 SkillTool / slash command 接入。（已完成）
5. S-6.5 缓存、变更检测与文档收口。（已完成）

### 10.7 Goal H：hooks / shell 运行时等价与安全收口

[详细实施拆分文档](../goals/2026-06-03-skill-hooks-shell-runtime-security-plan.md) 已单独沉淀，本阶段补齐 S-6 收口后发现的 managed installed Skill 等价性缺口。

目标：

- installed managed Skill 转 `PromptCommand` 时重新解析并透传 `hooks` / `shell` / `version` / `paths`。
- installed managed Skill 的正文内联 shell 命令尊重 `shell: powershell` 等 frontmatter。
- 安装前安全扫描识别 hook command、HTTP URL、HTTP headers 环境变量引用和 `allowedEnvVars`。

验收：

- `smoke:skill-runtime-installed-metadata` 覆盖 managed installed Skill 的 hooks / shell / version / paths。
- `smoke:skill-security-scanner` 覆盖 hook command / HTTP / env 风险。
- 文档不再把 hooks / shell 运行时等价性列为未完成项。

## 11. 第一版边界

第一版暂不做：

- 远端公开 registry 发布 / 审核系统；该能力已暂停，后续单独评估 registry URL、index schema、checksum、缓存和信任策略。
- 自动执行 OpenClaw installer metadata。
- 多租户企业策略。
- Skill marketplace 排名和评分。
- 跨设备同步。
- 自动把所有 Claude / Codex / OpenClaw 目录全量迁移。

第一版先做：

- 本地标准兼容。
- 受控导入。
- 安装记录。
- 安全提示。
- Desktop 基础管理。
- 运行时启用治理。
- 现有 SkillTool 链路保持稳定。

## 12. 结论

CCR 的 Skill 标准应以 `SKILL.md` 为核心：

```text
标准 = SKILL.md + name + description + Markdown body
兼容 = Claude / Codex / OpenClaw 扩展字段
管理 = CCR 自己的 install manifest 和 installed / lock 记录
运行 = CcrSkillPackage -> Command adapter -> SkillTool
上下文 = 摘要先行，正文按需加载
```

这样可以同时满足三件事：

- 外部生态 skill 拿来能用。
- CCR 自己的安装管理不污染标准格式。
- 现有运行时链路不被大改打断。
