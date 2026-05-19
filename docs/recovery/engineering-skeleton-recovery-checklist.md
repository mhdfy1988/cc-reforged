# Claude Code Reforged 工程骨架恢复清单

## 1. 文档目标

本文档是 [recovery-repair-plan.md](./recovery-repair-plan.md) 的下一层执行文档，专门回答下面这个问题：

**在不先动大规模业务逻辑的前提下，如何把 `claude-code-reforged` 缺失的工程骨架补回来，让它具备最小可构建、可校验、可继续修复的基础。**

这份文档聚焦的是：

1. 构建链和运行链如何拆分。
2. 缺了哪些工程元信息。
3. 宏、路径别名、依赖、生成文件、入口裁剪分别怎么处理。
4. 阶段 B 做到什么程度才算完成。

## 2. 基线判断

## 2.1 当前不是普通源码仓

当前仓库虽然源码量大，但工程骨架明显缺失。

直接证据：

1. [package.json](D:/agent_project/claude-code-reforged/package.json) 几乎没有正常依赖。
2. [bun.lock](D:/agent_project/claude-code-reforged/bun.lock) 也是近乎空白，只保留了可选 `sharp` 包信息。
3. 根目录未发现常规 `tsconfig`、测试配置、lint 配置等工程文件。

这意味着：

- 当前问题首先是“工程恢复问题”，不是“业务代码不够”。

## 2.2 源码强依赖构建期宏与特性裁剪

已确认的构建期特征：

1. 大量文件直接 `import { feature } from 'bun:bundle'`
2. 大量文件使用 `MACRO.VERSION`、`MACRO.PACKAGE_URL`、`MACRO.BUILD_TIME` 等宏
3. 源码中存在非常多 feature flag

已确认的高频 feature flag 包括：

- `KAIROS`
- `TRANSCRIPT_CLASSIFIER`
- `TEAMMEM`
- `BASH_CLASSIFIER`
- `VOICE_MODE`
- `COORDINATOR_MODE`
- `BRIDGE_MODE`
- `CHICAGO_MCP`
- `BG_SESSIONS`
- `TREE_SITTER_BASH`
- `TREE_SITTER_BASH_SHADOW`
- `DAEMON`
- `SELF_HOSTED_RUNNER`
- `BYOC_ENVIRONMENT_RUNNER`

说明：

原始产品不是“运行时 if 判断很多”那么简单，而是依赖构建期裁剪来收敛发布产物。

## 2.3 源码强依赖 `src/*` 路径别名

静态扫描结果显示，全仓至少有 `1066` 处 `src/...` 别名导入。

这意味着：

1. 必须恢复路径别名配置。
2. 不能只靠相对路径凑合。
3. TypeScript、打包器、运行时解析三层都要统一。

## 2.4 外部依赖量远大于 package.json 所示

静态扫描得到的高频第三方依赖包括：

- `react`
- `react/compiler-runtime`
- `zod/v4`
- `axios`
- `chalk`
- `figures`
- `execa`
- `strip-ansi`
- `usehooks-ts`
- `chokidar`
- `lru-cache`
- `fuse.js`
- `diff`
- `marked`
- `qrcode`
- `ignore`
- `ws`
- `@anthropic-ai/sdk`
- `@modelcontextprotocol/sdk`
- `@opentelemetry/*`

这说明：

- 依赖恢复不能靠现有 `package.json`，必须重新建依赖清单。

## 2.5 运行目标和构建目标不是一回事

当前源码同时给出两个强信号：

1. [package.json](D:/agent_project/claude-code-reforged/package.json) 指明运行时目标是 `node >= 18`
2. 代码又广泛使用 `bun:bundle` 和构建期宏

因此应明确区分：

- **运行时目标（Runtime）**：Node 18+ CLI 产品
- **构建时目标（Build）**：需要一层能模拟原始宏与特性裁剪的构建链

这两个目标不能混成一个动作。

## 3. 阶段 B 的目标定义

## 3.1 目标

阶段 B 的目标不是“让完整产品运行”，而是让项目具备如下能力：

1. 能明确安装和锁定一套最小依赖。
2. 能让核心源码通过最小静态校验。
3. 能为主入口建立可控的宏替身和特性配置。
4. 能为后续阶段的最小运行入口提供稳定工程底座。

## 3.2 非目标

阶段 B 默认不追求：

1. 全仓零报错类型通过。
2. 所有 feature flag 都恢复。
3. 所有入口模式都可构建。
4. 所有原生依赖都可运行。

## 4. 工程恢复的总体策略

## 4.1 总体策略

工程恢复建议拆成五条并行但有先后顺序的子线：

1. 运行时基线定义
2. 构建期宏与特性适配
3. 路径别名与模块解析恢复
4. 依赖清单恢复
5. 生成物与缺失脚本兜底

## 4.2 为什么这么拆

因为当前仓库的主要风险不是单点报错，而是边界不清：

1. 哪些能力属于运行时必须有。
2. 哪些能力属于构建时才需要处理。
3. 哪些文件是源码，哪些原本应由生成脚本产出。
4. 哪些模式应在首轮构建中直接排除。

先拆清楚，后面的修复才不会互相打架。

## 5. 运行时与构建时的分离方案

## 5.1 运行时目标

运行时统一定义为：

- Node 18+ 的 ESM CLI 产品

原因：

1. [package.json](D:/agent_project/claude-code-reforged/package.json) 已明确 `engines.node >= 18`
2. 用户最终需要的是可用 CLI，而不是 Bun 专属开发仓

## 5.2 构建时目标

构建时统一定义为：

- 一套能兼容 `bun:bundle` 风格宏和 `MACRO.*` 常量的恢复型构建链

原因：

1. 源码大量依赖 `feature()` 的构建期裁剪语义
2. 如果不做这一层，运行时会直接暴露大量原本应被裁掉的路径

## 5.3 关键不变式

1. 运行时始终以 Node 为主，不把 Bun 当成最终用户运行依赖。
2. 构建时允许通过 shim、alias、define 等方式恢复原始宏语义。
3. feature flag 在恢复阶段默认采取“保守关闭”策略，除非该特性是核心主链必须能力。

## 6. 具体恢复清单

## 6.1 清单 A：建立最小工程目录与配置文件

### 目标

建立项目可识别的最小工程骨架。

### 需要补的对象

1. `tsconfig.base.json`
2. `tsconfig.build.json`
3. `tsconfig.typecheck.json`
4. 最小构建脚本目录
5. 最小校验脚本目录

### 为什么必须先补

因为没有统一工程配置，下面这些问题都无从落地：

1. `src/*` 别名
2. `.js` 扩展导入
3. JSX / TSX 处理
4. ESM 输出
5. 入口裁剪

### 验收标准

至少能让核心入口与核心模块进入同一套 TypeScript 解析语境。

## 6.2 清单 B：恢复路径别名与模块解析

### 目标

恢复 `src/*` 别名和当前源码使用的导入风格。

### 已确认事实

全仓至少 `1066` 处 `src/...` 导入。

### 需要处理的问题

1. `src/*` 别名的 TypeScript 配置
2. 构建工具对 `src/*` 的解析
3. 运行时对 `src/*` 的落地产物解析
4. `.js` 扩展导入与 TS 源文件的兼容

### 处理原则

1. 不大规模改源码导入路径。
2. 优先恢复工程配置来兼容现有源码。
3. 源码中的 `.js` 扩展导入默认视为原始 ESM 构建链的一部分，不轻易批量替换。

### 验收标准

核心主链文件可被同一套配置正确解析。

## 6.3 清单 C：恢复 `bun:bundle` 与 `MACRO.*` 宏语义

### 目标

补上一层恢复型宏适配，让源码在没有原始内部构建系统的情况下仍可继续推进。

### 已确认事实

源码大量出现：

1. `import { feature } from 'bun:bundle'`
2. `MACRO.VERSION`
3. `MACRO.PACKAGE_URL`
4. `MACRO.BUILD_TIME`
5. 其他产品元信息宏

### 需要恢复的能力

1. `feature(name)` 的替身
2. `MACRO.*` 常量注入
3. 恢复期特性矩阵

### 恢复原则

1. 默认关闭高复杂度和外围模式特性。
2. 默认显式开启核心主链必须特性。
3. 安全相关特性如果暂未恢复，应采用 fail-closed，而不是静默放开。

### 第一批建议的特性分组

#### 核心主链候选

- 与普通 CLI、Query、Tool、基础状态相关的最小集合

#### 默认关闭候选

- `BRIDGE_MODE`
- `DAEMON`
- `BG_SESSIONS`
- `CHICAGO_MCP`
- `SELF_HOSTED_RUNNER`
- `BYOC_ENVIRONMENT_RUNNER`
- `VOICE_MODE`
- `TEAMMEM`
- `KAIROS`
- 其他明显偏平台、外围、实验性能力

#### 单独处理候选

- `TREE_SITTER_BASH`
- `TREE_SITTER_BASH_SHADOW`
- `POWERSHELL_AUTO_MODE`

这一组与权限链相关，不应简单粗暴地按普通实验特性处理。

### 验收标准

1. 核心源码能在宏适配存在的前提下进入静态校验。
2. 特性矩阵有文档化口径，不再靠默认猜。

## 6.4 清单 D：恢复依赖清单

### 目标

将当前仓库缺失的外部依赖恢复为一份“最小可用、可安装、可锁定”的依赖集合。

### 当前已识别的依赖分层

#### 核心运行时依赖

- `react`
- `react/compiler-runtime`
- `zod/v4`
- `axios`
- `chalk`
- `figures`
- `strip-ansi`
- `diff`
- `ignore`
- `fuse.js`
- `lru-cache`
- `chokidar`
- `ws`
- `execa`

#### Claude / MCP / 协议相关依赖

- `@anthropic-ai/sdk`
- `@modelcontextprotocol/sdk`

#### 观测与遥测相关依赖

- `@opentelemetry/api`
- `@opentelemetry/api-logs`
- `@opentelemetry/sdk-logs`
- `@opentelemetry/sdk-metrics`
- `@opentelemetry/sdk-trace-base`

#### 平台和可选依赖

- `sharp` 平台包
- 原生扩展相关依赖
- `@ant/computer-use-mcp`
- 其他明显平台专用依赖

### 恢复顺序

第 1 轮：

1. 只恢复核心主链必需依赖。
2. 可选平台包暂不拉全。

第 2 轮：

1. 再恢复 MCP、插件、遥测等第二层能力。

第 3 轮：

1. 最后恢复 bridge / daemon / 原生平台能力所需依赖。

### 关键原则

1. 先做最小依赖集，不做一次性全量补齐。
2. 明确区分：
   - 必需依赖
   - 可选依赖
   - 平台专用依赖
   - 暂缓依赖

### 验收标准

1. 能安装最小依赖集。
2. 不再依赖空的 `package.json` 去猜运行边界。

## 6.5 清单 E：恢复生成物和缺失脚本

### 目标

识别哪些文件是源码，哪些原本是脚本生成的产物，并为缺失生成链提供兜底方案。

### 当前已确认的信号

[src/entrypoints/sdk/coreSchemas.ts](D:/agent_project/claude-code-reforged/src/entrypoints/sdk/coreSchemas.ts) 注释中明确提到：

- `scripts/generate-sdk-types.ts`

但当前仓库里并没有完整的 `scripts/` 生成链。

### 需要做的事

1. 列出所有带有“generated / schema / type generation”信号的文件。
2. 判断它们是：
   - 已恢复完成的生成物
   - 缺脚本但可直接继续使用的静态产物
   - 必须重新生成的关键产物

### 处理原则

1. 首轮优先“保留现有产物可用性”，不先追求完整重建原始生成流程。
2. 对后续会频繁变化的 schema/type，再逐步补生成脚本。

### 验收标准

生成物是否有来源说明和继续使用策略，不再处于“看起来像源码但不确定是不是源码”的状态。

## 6.6 清单 F：恢复 vendor 与原生依赖边界

### 目标

明确 `vendor/` 中哪些内容属于可直接继续使用的源码，哪些仍然依赖外部原生模块。

### 当前已确认的 vendor 内容

- [vendor/audio-capture-src/index.ts](D:/agent_project/claude-code-reforged/vendor/audio-capture-src/index.ts)
- [vendor/image-processor-src/index.ts](D:/agent_project/claude-code-reforged/vendor/image-processor-src/index.ts)
- [vendor/modifiers-napi-src/index.ts](D:/agent_project/claude-code-reforged/vendor/modifiers-napi-src/index.ts)
- [vendor/url-handler-src/index.ts](D:/agent_project/claude-code-reforged/vendor/url-handler-src/index.ts)

### 当前判断

这些文件更像“vendor 源码占位层”，不代表原生能力已经在当前仓库中完整恢复。

### 处理原则

1. 首轮只确认引用边界。
2. 不把这类平台原生能力纳入首轮构建成功标准。

### 验收标准

核心主链不再被 vendor / 原生依赖拖住。

## 6.7 清单 G：定义恢复期入口矩阵

### 目标

明确哪些入口在阶段 B 必须支持，哪些入口应直接排除。

### 必须优先支持的入口

1. 普通 CLI 主入口
2. 初始化入口
3. 最小 Query / Tool 主链相关入口

### 可以暂缓的入口

1. `mcp` 独立入口
2. `remote-control / bridge`
3. `daemon`
4. `ps/logs/attach/kill`
5. `environment-runner`
6. `self-hosted-runner`
7. `chrome / computer-use`

### 处理原则

1. 入口矩阵必须文档化。
2. 未进入首轮支持范围的入口，允许在构建阶段显式 stub 或关闭。

### 验收标准

工程恢复阶段不再因为边缘入口阻塞主入口。

## 7. 阶段 B 的具体执行流程

## 7.1 第 1 轮：建立最小工程语境

本轮目标：

1. 补 `tsconfig` 系列文件。
2. 明确 `src/*` 别名。
3. 明确 ESM 与 `.js` 导入策略。
4. 明确首轮主入口集合。

输入：

- 当前恢复源码树

输出：

- 可解释当前源码的最小工程配置

状态变化：

`无统一工程语境 -> 有统一工程语境`

## 7.2 第 2 轮：建立宏与特性适配层

本轮目标：

1. 建立 `bun:bundle` 的替身或别名策略。
2. 建立 `MACRO.*` 注入策略。
3. 定义恢复期特性矩阵。

输入：

- feature flag 清单
- `MACRO.*` 使用点

输出：

- 可控的恢复期构建语义

状态变化：

`源码依赖内部构建系统 -> 源码依赖恢复期兼容构建系统`

## 7.3 第 3 轮：恢复最小依赖图

本轮目标：

1. 恢复核心运行依赖。
2. 将依赖按层次入库。
3. 让核心主链具备静态解析条件。

输入：

- import 扫描结果

输出：

- 最小依赖清单

状态变化：

`空壳 package 信息 -> 可安装的最小依赖集`

## 7.4 第 4 轮：识别生成物与 vendor 边界

本轮目标：

1. 确认哪些文件直接可用。
2. 确认哪些文件需要脚本或后续补链。
3. 将 vendor / 原生能力从主链中剥离。

输入：

- SDK schema 相关文件
- vendor 目录

输出：

- 生成物清单
- vendor 边界清单

状态变化：

`源码边界不清 -> 工程边界清晰`

## 8. 阶段 B 的验收标准

阶段 B 完成时，至少要满足：

1. 项目有明确的 TypeScript 工程配置。
2. `src/*` 别名和 `.js` 导入语义有统一口径。
3. `bun:bundle` 与 `MACRO.*` 不再是无解阻塞项。
4. 有一份最小依赖清单，而不是继续依赖空的 `package.json`。
5. 已明确首轮支持入口与暂缓入口。
6. 已明确生成物和 vendor 的处理边界。

## 9. 阶段 B 完成后的下一步

阶段 B 完成后，下一步应直接进入：

**阶段 C：最小产品内核恢复**

届时应围绕以下主链推进：

1. [src/entrypoints/init.ts](D:/agent_project/claude-code-reforged/src/entrypoints/init.ts)
2. [src/query.ts](D:/agent_project/claude-code-reforged/src/query.ts)
3. [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts)
4. [src/Tool.ts](D:/agent_project/claude-code-reforged/src/Tool.ts)
5. [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts)

## 10. 结论

`claude-code-reforged` 当前最缺的不是业务代码，而是工程骨架。

因此阶段 B 的正确目标不是“尽快把所有代码跑起来”，而是：

1. 明确运行时与构建时的边界。
2. 恢复路径、宏、依赖和生成物这四类基础设施。
3. 用最小支持范围把主入口保护出来。

只有这层骨架补稳，后面的主链恢复才不会边修边散。
