# Claude Code Reforged 宏与构建适配清单

## 1. 文档目标

本文档用于定义 `claude-code-reforged` 在恢复期如何处理：

1. `bun:bundle`
2. `feature('...')`
3. `MACRO.*`
4. 构建期裁剪与入口收敛

它要解决的核心问题是：

**当前源码不是普通的 Node + TypeScript 源码树，而是强依赖原始内部构建系统的产品源码。恢复期必须先补一层构建语义兼容层，后续工程和产品修复才能稳定推进。**

本文档承接：

- [recovery-repair-plan.md](./recovery-repair-plan.md)
- [engineering-skeleton-recovery-checklist.md](./engineering-skeleton-recovery-checklist.md)
- [dependency-recovery-checklist.md](./dependency-recovery-checklist.md)

## 2. 当前基线

## 2.1 当前源码强依赖 `bun:bundle`

源码中大量直接写有：

```ts
import { feature } from 'bun:bundle'
```

这不是普通工具函数调用，而是明显依赖原始发布系统的构建期语义。

直接证据见：

- [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)
- [src/constants/prompts.ts](D:/agent_project/claude-code-reforged/src/constants/prompts.ts)
- [src/bridge/bridgeEnabled.ts](D:/agent_project/claude-code-reforged/src/bridge/bridgeEnabled.ts)

## 2.2 当前源码强依赖 `MACRO.*`

源码中大量直接使用以下全局宏：

1. `MACRO.VERSION`
2. `MACRO.BUILD_TIME`
3. `MACRO.PACKAGE_URL`
4. `MACRO.NATIVE_PACKAGE_URL`
5. `MACRO.FEEDBACK_CHANNEL`
6. `MACRO.ISSUES_EXPLAINER`
7. `MACRO.VERSION_CHANGELOG`

关键使用点示例：

- [src/commands/version.ts](D:/agent_project/claude-code-reforged/src/commands/version.ts)
- [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)
- [src/entrypoints/mcp.ts](D:/agent_project/claude-code-reforged/src/entrypoints/mcp.ts)
- [src/utils/userAgent.ts](D:/agent_project/claude-code-reforged/src/utils/userAgent.ts)
- [src/constants/prompts.ts](D:/agent_project/claude-code-reforged/src/constants/prompts.ts)
- [src/utils/autoUpdater.ts](D:/agent_project/claude-code-reforged/src/utils/autoUpdater.ts)

## 2.3 部分代码要求真正的构建期裁剪，不只是运行时开关

这是当前最重要的信号之一。

[src/bridge/bridgeEnabled.ts](D:/agent_project/claude-code-reforged/src/bridge/bridgeEnabled.ts) 里直接写明：

1. 正向三元写法有利于构建期消除。
2. 负向写法不能可靠消除外部构建中的字符串字面量。

这说明：

- `feature()` 在原始工程中承担的是 **构建期裁剪边界（build-time pruning boundary）**，不是普通运行时布尔开关。

## 2.4 当前没有发现明确的 `MACRO` 全局声明来源

在当前恢复仓内，未检索到明确的：

1. `declare const MACRO`
2. `namespace MACRO`
3. `interface MACRO`

但源码中大量直接使用 `MACRO.*`，这说明：

- 原始工程依赖外部构建系统或全局类型注入来提供 `MACRO`

## 2.5 当前同时存在“直接引用”和“存在性保护”两种写法

例如：

1. 直接引用：
   - [src/commands/version.ts](D:/agent_project/claude-code-reforged/src/commands/version.ts)
   - [src/utils/userAgent.ts](D:/agent_project/claude-code-reforged/src/utils/userAgent.ts)

2. 存在性保护：
   - [src/commands/insights.ts](D:/agent_project/claude-code-reforged/src/commands/insights.ts)
   - [src/utils/sessionStorage.ts](D:/agent_project/claude-code-reforged/src/utils/sessionStorage.ts)
   - [src/utils/doctorDiagnostic.ts](D:/agent_project/claude-code-reforged/src/utils/doctorDiagnostic.ts)

这说明恢复期不能只做一种粗糙替换，而要同时满足：

1. 大多数文件默认能直接拿到 `MACRO`
2. 少数做保护判断的文件不被破坏

## 3. 恢复目标

## 3.1 总目标

恢复一套“面向 Node 18+ 运行时”的兼容构建语义，使源码在没有原始内部打包系统的前提下，仍可：

1. 被 TypeScript 正确解析
2. 被最小构建工具正确处理
3. 通过特性矩阵收敛出恢复期支持范围
4. 为后续最小 CLI 主链恢复服务

## 3.2 非目标

当前阶段不追求：

1. 完全复刻内部 Bun 构建系统
2. 精确复刻所有 build-time DCE 细节
3. 恢复全部 feature flag 的正式发布矩阵
4. 一次性恢复所有平台模式

## 4. 宏与构建适配的总体策略

## 4.1 总体策略

恢复期应采用“三层适配”策略：

1. **语法兼容层**  
   解决 `bun:bundle` 与 `MACRO.*` 在源码层不会立刻报错。

2. **构建语义层**  
   解决 `feature()` 和 `MACRO.*` 在构建阶段如何被替换和裁剪。

3. **恢复期特性矩阵层**  
   解决哪些功能先开、哪些功能先关、哪些功能单独处理。

## 4.2 为什么不能只做运行时 shim

因为只做运行时 shim 会有三个问题：

1. 原本应该被裁掉的入口和模块仍然会被打进构建结果。
2. 某些特性门控字符串会进入外部构建结果，增加恢复噪声和错误路径。
3. `feature()` 相关代码原本依赖构建期收缩，单靠运行时判断会把恢复范围拉得过大。

结论：

- 恢复期必须有**至少半构建期**的处理能力，而不是只在运行时挂个全局变量。

## 5. 适配对象拆分

## 5.1 对象 A：`bun:bundle`

### 当前语义

当前源码主要从 `bun:bundle` 获取：

1. `feature(name)` 能力

### 恢复目标

让源码在恢复期通过一个本地替身模块拿到 `feature()`。

### 恢复原则

1. 语法层面允许替换 `bun:bundle`
2. 行为层面允许把 `feature(name)` 实现为基于静态特性表的布尔读取
3. 构建层面要尽量让常量表达式可被后续 tree-shaking 处理

### 建议落地方式

恢复期建议增加一个本地 shim，例如：

- `src/build/bunBundleShim.ts`

它至少导出：

1. `feature(name: string): boolean`

再通过构建工具 alias：

- `bun:bundle -> src/build/bunBundleShim.ts`

## 5.2 对象 B：`MACRO.*`

### 当前语义

`MACRO.*` 代表构建期注入的产品元信息。

### 当前明确已识别字段

1. `VERSION`
2. `BUILD_TIME`
3. `PACKAGE_URL`
4. `NATIVE_PACKAGE_URL`
5. `FEEDBACK_CHANNEL`
6. `ISSUES_EXPLAINER`
7. `VERSION_CHANGELOG`

### 恢复目标

让恢复期拥有：

1. 一份统一的 `MACRO` 字段清单
2. 一份恢复期默认值
3. 一份全局类型声明

### 建议落地方式

恢复期建议拆成两部分：

#### 1. 类型声明

增加全局声明文件，例如：

- `src/types/global-macro.d.ts`

用于声明：

```ts
declare const MACRO: {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL?: string
  FEEDBACK_CHANNEL?: string
  ISSUES_EXPLAINER?: string
  VERSION_CHANGELOG?: string
}
```

#### 2. 构建注入

通过构建工具 `define` 或注入模块，在构建阶段提供：

- `MACRO.VERSION`
- `MACRO.PACKAGE_URL`
- 其他字段

## 5.3 对象 C：`feature('...')`

### 当前语义

`feature()` 既承担“功能是否存在”的判断，又承担“构建期边界裁剪”的职责。

### 当前已识别的高频 feature flag

1. `KAIROS`
2. `TRANSCRIPT_CLASSIFIER`
3. `TEAMMEM`
4. `BASH_CLASSIFIER`
5. `VOICE_MODE`
6. `COORDINATOR_MODE`
7. `BRIDGE_MODE`
8. `CHICAGO_MCP`
9. `BG_SESSIONS`
10. `TREE_SITTER_BASH`
11. `TREE_SITTER_BASH_SHADOW`
12. `DAEMON`
13. `SELF_HOSTED_RUNNER`
14. `BYOC_ENVIRONMENT_RUNNER`

### 恢复目标

建立一份恢复期特性矩阵，而不是继续让 feature flag 处于不透明状态。

### 建议落地方式

恢复期建议增加一个静态特性表，例如：

- `src/build/featureFlags.ts`

它应至少定义：

1. 核心主链特性
2. 默认关闭特性
3. 安全相关特性
4. 后续再恢复特性

## 6. 恢复期特性矩阵

## 6.1 第一组：核心主链默认开启候选

这一组不是“全部自动开启”，而是优先评估哪些会阻塞主产品恢复。

候选范围：

1. 与普通 CLI 主链直接相关的能力
2. 与 Query / Tool 主链直接相关的能力
3. 与基础状态恢复直接相关的能力

当前原则：

- 这组要最小化，不做功能膨胀

## 6.2 第二组：默认关闭候选

这一组建议在恢复初期显式关闭：

1. `BRIDGE_MODE`
2. `DAEMON`
3. `BG_SESSIONS`
4. `VOICE_MODE`
5. `CHICAGO_MCP`
6. `SELF_HOSTED_RUNNER`
7. `BYOC_ENVIRONMENT_RUNNER`
8. `TEAMMEM`
9. `KAIROS`
10. 其他明显偏平台、实验、外围能力的特性

原因：

1. 这些能力会显著扩大恢复范围
2. 它们大多不影响首轮普通 CLI 产品主链

## 6.3 第三组：安全相关单独处理

下面这组不应简单按“实验特性”粗暴关闭：

1. `TREE_SITTER_BASH`
2. `TREE_SITTER_BASH_SHADOW`
3. `BASH_CLASSIFIER`
4. `POWERSHELL_AUTO_MODE`

原因：

1. 它们与权限链和安全判断有关
2. 如果处理方式不当，可能导致恢复期安全边界进一步变弱

恢复原则：

1. 安全相关特性要么明确 fail-closed
2. 要么单独设计兼容热修路径
3. 不能因为图省事直接静默放宽

## 6.4 第四组：产品增强类后置特性

这组通常不阻塞主链恢复，但会影响体验：

1. `EXPERIMENTAL_SKILL_SEARCH`
2. `TOKEN_BUDGET`
3. `MESSAGE_ACTIONS`
4. `TERMINAL_PANEL`
5. `HISTORY_PICKER`
6. `REACTIVE_COMPACT`

处理原则：

- 主链恢复后再逐步接回

## 7. 入口与构建裁剪策略

## 7.1 当前入口问题

[src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx) 中混合了大量模式：

1. 普通 CLI
2. Chrome/Computer Use MCP
3. bridge / remote-control
4. daemon
5. background sessions
6. environment-runner
7. self-hosted-runner

如果不依赖构建裁剪，而是全部在恢复期同时保留，后果是：

1. 入口体积和依赖面过大
2. 构建报错分散
3. 主链难以被保护出来

## 7.2 恢复期入口原则

恢复期构建应优先保留：

1. 普通 CLI
2. 初始化入口
3. 最小 MCP 入口（可后置）

恢复期构建应优先裁掉或显式关闭：

1. bridge / remote-control
2. daemon
3. background sessions
4. environment runner
5. self-hosted runner
6. Chrome / computer-use

## 7.3 正负写法规则

[src/bridge/bridgeEnabled.ts](D:/agent_project/claude-code-reforged/src/bridge/bridgeEnabled.ts) 已经明确给出一个恢复期很重要的规则：

1. 构建期裁剪更适合正向表达式
2. 负向分支不一定能消掉敏感字符串和外围逻辑

因此恢复期应遵循：

1. 对需要真正裁剪的路径，尽量保留原有正向门控风格
2. 不要在恢复阶段大规模把 `feature()` 改成普通运行时 if 逻辑

## 8. 建议的适配产物

阶段 B 后续建议新增以下文件或概念层：

## 8.1 类型层

1. `src/types/global-macro.d.ts`
2. `src/types/feature-flags.d.ts` 或等价声明

## 8.2 构建语义层

1. `src/build/bunBundleShim.ts`
2. `src/build/featureFlags.ts`
3. `src/build/macroValues.ts`

## 8.3 构建配置层

1. alias：`bun:bundle -> 本地 shim`
2. define：注入 `MACRO.*`
3. 主入口构建矩阵：普通 CLI 优先

## 9. 阶段性执行流程

## 9.1 第 1 轮：定义恢复期 `MACRO` 口径

目标：

1. 列出所有已识别 `MACRO` 字段
2. 给出恢复期默认值
3. 建立全局类型声明

输入：

- 当前源码中的 `MACRO.*` 使用点

输出：

- 恢复期宏清单

状态变化：

`无 MACRO 来源 -> 有统一宏口径`

## 9.2 第 2 轮：建立 `bun:bundle` shim

目标：

1. 让源码能在没有原始 Bun 构建系统时继续被解析
2. 让 `feature()` 在恢复期至少有统一来源

输入：

- `bun:bundle` 使用点

输出：

- 本地 shim
- alias 策略

状态变化：

`源码依赖 bun:bundle -> 源码依赖恢复期替身`

## 9.3 第 3 轮：建立恢复期特性矩阵

目标：

1. 明确哪些特性先开
2. 明确哪些特性先关
3. 明确哪些特性与安全链绑定

输入：

- feature flag 高频清单
- 主入口与外围入口结构

输出：

- 恢复期 feature flag 配置

状态变化：

`feature 状态不透明 -> feature 状态可控`

## 9.4 第 4 轮：让主入口构建范围收敛

目标：

1. 把普通 CLI 主链保护出来
2. 把外围模式从首轮构建里摘出去

输入：

- `src/entrypoints/cli.tsx`

输出：

- 可用于后续内核恢复的主入口构建范围

状态变化：

`全入口混编 -> 主入口收敛`

## 10. 验收标准

宏与构建适配阶段完成时，至少要满足：

1. `MACRO.*` 不再是解析阻塞项。
2. `bun:bundle` 不再是解析阻塞项。
3. 恢复期 feature flag 有明确口径。
4. 主入口构建范围已经收敛，不再被全部外围模式拖住。
5. 安全相关特性有单独策略，不被简单粗暴关闭。

## 11. 结论

`claude-code-reforged` 当前的构建问题，本质上不是“少了一个配置文件”，而是：

1. 缺了原始构建系统提供的宏语义
2. 缺了原始构建系统提供的特性裁剪
3. 缺了恢复期自己的特性矩阵

所以正确的处理方式不是：

- 直接把所有 `feature()` 改掉
- 直接把所有 `MACRO.*` 全局替换成字符串

而是要先建立一层恢复期兼容构建语义：

1. 先定义 `MACRO`
2. 再替代 `bun:bundle`
3. 再建立 feature matrix
4. 最后让主入口收敛

只有这样，后面的最小产品内核恢复才不会在构建层反复返工。
