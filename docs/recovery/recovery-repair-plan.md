# Claude Code Reforged 恢复版修复总表

## 1. 文档目标

本文档用于定义 `claude-code-reforged` 的恢复目标、修复边界、阶段顺序和验收口径。

当前执行顺序和实时 TODO 清单见：

- [current-repair-backlog.md](../stages/current-repair-backlog.md)

它解决的不是“某个单点 bug 怎么修”，而是下面四个更核心的问题：

1. 这份从 sourcemap 恢复出来的源码，哪些部分是真正可用的产品内核。
2. 哪些问题属于“工程骨架缺失”，哪些问题属于“业务逻辑损坏”。
3. 修复顺序应该如何安排，才能先恢复成可用产品，而不是陷入全量追平。
4. 每个阶段做完之后，系统状态应该从哪里推进到哪里。

## 2. 当前基线结论

### 2.1 仓库性质

当前仓库不是官方完整开发仓，而是一份基于 `@anthropic-ai/claude-code@2.1.88` 的 `cli.js.map` 恢复出来的源码树。

直接证据：

- 顶层说明见 [README.md](D:/agent_project/claude-code-reforged/README.md)
- 包信息见 [package.json](D:/agent_project/claude-code-reforged/package.json)

### 2.2 当前源码的真实状态

这份仓库的特点不是“代码太少”，而是“产品主体在，工程外壳不完整”。

已经确认的事实：

1. 核心产品源码大量存在，尤其是：
   - 入口与初始化
   - 查询主循环
   - 工具契约与执行
   - 权限体系
   - 状态与会话
   - MCP 与插件相关逻辑

2. 顶层工程信息明显不完整：
   - [package.json](D:/agent_project/claude-code-reforged/package.json) 基本没有正常依赖清单
   - 根目录未发现常规 `tsconfig`、测试配置、lint 配置等工程文件
   - 代码中广泛存在 `feature('...')`、`MACRO.VERSION`、`bun:bundle` 这类构建期宏和裁剪逻辑

3. 这说明它不能按普通 TypeScript 仓库处理，不能走“装依赖 -> 直接构建 -> 逐个报错修”的常规路径。

### 2.3 当前值得保留的产品主链

根据已审查源码，最值得作为恢复基础的产品主链如下：

1. 初始化：
   - [src/entrypoints/init.ts](D:/agent_project/claude-code-reforged/src/entrypoints/init.ts)

2. CLI 入口：
   - [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)
   - [src/main.tsx](D:/agent_project/claude-code-reforged/src/main.tsx)

3. 查询与回合引擎：
   - [src/query.ts](D:/agent_project/claude-code-reforged/src/query.ts)
   - [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts)
   - [src/context.ts](D:/agent_project/claude-code-reforged/src/context.ts)

4. 工具契约与执行：
   - [src/Tool.ts](D:/agent_project/claude-code-reforged/src/Tool.ts)
   - [src/tools.ts](D:/agent_project/claude-code-reforged/src/tools.ts)
   - [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts)
   - [src/services/tools/toolOrchestration.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolOrchestration.ts)

5. 状态与应用态：
   - [src/bootstrap/state.ts](D:/agent_project/claude-code-reforged/src/bootstrap/state.ts)
   - [src/state/AppStateStore.ts](D:/agent_project/claude-code-reforged/src/state/AppStateStore.ts)
   - [src/state/store.ts](D:/agent_project/claude-code-reforged/src/state/store.ts)

6. 权限与安全：
   - [src/utils/permissions/permissionSetup.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/permissionSetup.ts)
   - [src/tools/BashTool/bashPermissions.ts](D:/agent_project/claude-code-reforged/src/tools/BashTool/bashPermissions.ts)
   - [src/utils/bash/parser.ts](D:/agent_project/claude-code-reforged/src/utils/bash/parser.ts)

7. MCP 能力：
   - [src/services/mcp/client.ts](D:/agent_project/claude-code-reforged/src/services/mcp/client.ts)
   - [src/entrypoints/mcp.ts](D:/agent_project/claude-code-reforged/src/entrypoints/mcp.ts)

## 3. 修复总目标

### 3.1 目标

将 `claude-code-reforged` 恢复为一个“可持续使用的 Claude Code 产品核”，而不是追求立刻追平所有外围模式。

### 3.2 更具体的产品目标

最终目标不是“代码能编译”，而是至少满足下面几项能力：

1. CLI 可启动。
2. 能建立会话并完成一轮真实查询。
3. 能读写文件、搜索代码、执行基础 shell/powershell 命令。
4. 权限规则有效，不能出现高风险降级执行。
5. 会话、消息、工具结果、compact 等主链状态基本可用。
6. 后续可在此基础上继续恢复 MCP、插件和更多高级模式。

### 3.3 非目标

当前阶段默认不追求以下事项一次到位：

1. 所有 feature flag 下的全部功能都恢复。
2. `remote-control / bridge / daemon / background sessions` 全线恢复。
3. 所有原生扩展、浏览器桥接、computer-use 相关能力立即可用。
4. 复刻官方发布工程的全部内部基础设施。

## 4. 为什么选择这条修复路线

### 4.1 不选“直接全量构建修错”的原因

因为这条路会被三类问题同时拖住：

1. 顶层工程文件缺失。
2. 大量构建期宏和特性裁剪尚未恢复。
3. 入口模式过多，产品面太大。

结果会是：

- 报错很多，但无法区分哪些是核心问题，哪些是外围问题。
- 会花大量时间在非主链能力上打转。
- 很难尽快拿到一个“真的能用”的产品版本。

### 4.2 为什么先恢复产品内核

因为当前仓库最完整、最有价值的就是产品内核：

1. 查询主循环还在。
2. 工具契约和执行层还在。
3. 权限和状态体系还在。
4. CLI/TUI 虽然大，但主干逻辑仍可识别。

先救活产品内核，后面无论是恢复 `claude-code-reforged` 本身，还是反向沉淀到 `agent-foundry`，都会更稳。

## 5. 修复原则

### 5.1 总体原则

1. 先恢复主链，再恢复外围。
2. 先恢复工程骨架，再恢复完整产品面。
3. 先确保权限 fail-closed，再追求运行顺滑。
4. 先完成单轮可用，再扩到长会话和复杂模式。

### 5.2 关键不变式

1. 高风险命令不能因为恢复过程而降低安全边界。
2. `session / thread / turn / tool_result` 的配对关系必须保持一致。
3. 核心对象模型一旦确定，后续补模块要尽量复用，不要反复换口径。
4. 入口再多，真正优先恢复的仍然是普通 CLI 主链。

## 6. 当前问题分层

## 6.1 工程骨架问题

表现：

1. 依赖信息明显缺失。
2. 顶层工程配置缺失。
3. 构建期宏尚未恢复。
4. 源码采用 `.js` 扩展的 TS 风格导入，说明原始编译链有明确约定。

结论：

这部分属于“工程恢复问题”，不是业务 bug。

## 6.2 入口与模式过多

主要体现在 [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)。

当前入口里至少混合了：

1. 普通 CLI
2. MCP 服务器入口
3. bridge / remote-control
4. daemon
5. background sessions
6. environment runner
7. self-hosted runner
8. Chrome / computer-use 相关入口

结论：

当前阶段不能把这些模式作为同一优先级修复。

## 6.3 查询主循环复杂但完整

[src/query.ts](D:/agent_project/claude-code-reforged/src/query.ts) 和 [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts) 展示出的不是“残片”，而是完整的产品内核：

1. 回合状态推进
2. 用户输入处理
3. 工具调用与结果回写
4. compact / memory / usage / hooks
5. SDK 兼容消息输出

结论：

这里应当作为恢复工作的核心锚点。

## 6.4 工具面太大

[src/tools.ts](D:/agent_project/claude-code-reforged/src/tools.ts) 中注册的工具非常多，包括：

1. 文件工具
2. Bash / PowerShell
3. 搜索工具
4. MCP 资源工具
5. Agent / Team / Worktree 工具
6. AskUser / Todo / WebFetch 等产品工具

结论：

需要先恢复最核心的一小组工具，而不是全量恢复。

## 6.5 权限问题必须前置处理

已知明确风险点：

- [src/tools/BashTool/bashPermissions.ts](D:/agent_project/claude-code-reforged/src/tools/BashTool/bashPermissions.ts)

当前 `2.1.88` 恢复版里，存在“复杂复合命令超过上限时，`deny` 降级为 `ask`”的问题。

这意味着：

1. 权限体系不能留到最后再补。
2. 恢复过程中至少要先做 fail-closed 热修。

相关缺陷记录见：

- [claude-code-bash-deny-bypass.md](D:/agent_project/docs/07-quality/security-findings/claude-code-bash-deny-bypass.md)

## 6.6 状态和会话体系是重资产

[src/bootstrap/state.ts](D:/agent_project/claude-code-reforged/src/bootstrap/state.ts) 很大，说明很多全局运行状态都收在这里；而 [src/state/AppStateStore.ts](D:/agent_project/claude-code-reforged/src/state/AppStateStore.ts) 里又维护了 UI / MCP / 插件 / 任务 / 通知等应用态。

结论：

状态恢复不是单纯“把一个 store 跑起来”，而是要分层：

1. 先恢复最小运行态。
2. 再恢复交互态。
3. 最后恢复平台态。

## 7. 阶段性修复方案

## 7.1 阶段 A：恢复基线冻结

### 目标

把当前恢复树变成一个可执行的修复对象。

### 为什么先做这一阶段

如果没有明确基线，后续每改一处都会出现下面的问题：

1. 不知道是在修恢复损坏，还是在改产品逻辑。
2. 不知道哪些模式已经确认不在当前范围。
3. 不知道哪些模块属于“后面再追”的能力。

### 具体流程

第 1 轮：

1. 确认主入口、初始化链、查询主链、状态链、权限链、MCP 链。
2. 列出当前顶层缺失的工程资产。
3. 列出当前明确已知的高风险问题。

第 2 轮：

1. 形成模块优先级。
2. 形成“先做 / 暂缓 / 不做”的边界清单。

### 关键输入输出

输入：

- 当前恢复源码树
- 已有安全缺陷记录

输出：

- 本文档
- 后续阶段的执行顺序

### 状态变化

`恢复快照 -> 可审计基线`

### 边界

这一阶段不追求运行成功。

## 7.2 阶段 B：工程骨架恢复

### 目标

恢复最小可构建、可静态检查的工程底座。

### 为什么这一阶段必须独立

因为当前主要问题不是业务逻辑损坏，而是工程元信息缺失。

### 具体流程

第 1 轮：

1. 补依赖清单。
2. 补最小 `tsconfig` 与路径别名。
3. 补 `feature()` / `MACRO.VERSION` 相关宏适配。

第 2 轮：

1. 处理 `.js` 扩展导入与编译链匹配问题。
2. 建立最小构建脚本。
3. 先做到能跑静态类型检查和局部编译。

### 关键输入输出

输入：

- 源码 import 图
- 入口中的构建宏使用方式

输出：

- 最小工程配置
- 依赖锁定方案
- 宏适配方案

### 状态变化

`可审计基线 -> 可构建骨架`

### 边界

不在这一阶段强求所有入口都能构建。

## 7.3 阶段 C：最小产品内核恢复

### 目标

先把真正的 Claude Code 产品核救活。

### 为什么先恢复内核而不是完整 TUI

因为 Query 和 Tool 主链决定了产品是不是“能干活”，而完整 TUI 决定的是“看起来像不像原产品”。

### 具体流程

第 1 轮：

1. 跑通初始化。
2. 建立最小 session / turn。
3. 跑通一轮 query，不带复杂工具。

第 2 轮：

1. 接上最小工具调用。
2. 让工具结果回写消息链。
3. 形成 headless 或瘦 CLI 的可运行闭环。

### 关键输入输出

输入：

- [src/entrypoints/init.ts](D:/agent_project/claude-code-reforged/src/entrypoints/init.ts)
- [src/query.ts](D:/agent_project/claude-code-reforged/src/query.ts)
- [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts)
- [src/context.ts](D:/agent_project/claude-code-reforged/src/context.ts)

输出：

- 能完成最小一轮交互的运行入口

### 状态变化

`可构建骨架 -> 可运行内核`

### 边界

当前阶段优先普通主链，不先恢复复杂模式。

## 7.4 阶段 D：核心 coding 能力恢复

### 目标

恢复最有价值的一批工具，让产品真正可用于编码任务。

### 工具优先级

第一优先级：

1. 文件读取
2. 文件编辑
3. 文件写入
4. 搜索 / Glob / Grep
5. Bash
6. PowerShell
7. Todo

第二优先级：

1. WebFetch
2. MCP 资源读取
3. 其他工具型增强能力

### 具体流程

第 1 轮：

1. 恢复核心工具注册。
2. 打通工具参数校验与调用。
3. 恢复工具结果写回与消息映射。

第 2 轮：

1. 验证多次工具调用。
2. 验证串行 / 并行调度。
3. 验证错误和中断处理。

### 关键输入输出

输入：

- [src/tools.ts](D:/agent_project/claude-code-reforged/src/tools.ts)
- [src/Tool.ts](D:/agent_project/claude-code-reforged/src/Tool.ts)
- [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts)
- [src/services/tools/toolOrchestration.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolOrchestration.ts)

输出：

- 可完成真实 coding task 的工具主链

### 状态变化

`可运行内核 -> 可完成真实任务`

### 边界

不追全工具面，只恢复“最常用且最能体现产品价值”的那组。

## 7.5 阶段 E：权限、状态与恢复链收口

### 目标

把系统从“能跑”推进到“能安全持续使用”。

### 为什么这一阶段要尽早做

因为权限和状态如果不稳，产品越能跑，风险越大。

### 具体流程

第 1 轮：

1. 修 `deny -> ask` 降级问题，先做 fail-closed 热修。
2. 核对 Bash / PowerShell 权限链。
3. 核对工具结果与消息配对。

第 2 轮：

1. 恢复更完整的 session / history / compact 行为。
2. 修会话恢复和异常中断恢复。
3. 逐步接回更严格的权限判定逻辑。

### 关键输入输出

输入：

- [src/utils/permissions/permissionSetup.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/permissionSetup.ts)
- [src/tools/BashTool/bashPermissions.ts](D:/agent_project/claude-code-reforged/src/tools/BashTool/bashPermissions.ts)
- [src/bootstrap/state.ts](D:/agent_project/claude-code-reforged/src/bootstrap/state.ts)
- [src/state/AppStateStore.ts](D:/agent_project/claude-code-reforged/src/state/AppStateStore.ts)

输出：

- 安全边界可控的主产品版本

### 状态变化

`可完成真实任务 -> 可持续使用`

### 边界

安全问题和状态恢复问题默认一起推进，不拆开。

## 7.6 阶段 F：CLI / TUI 产品面恢复

### 目标

恢复面向用户的普通 CLI 产品体验。

### 具体流程

第 1 轮：

1. 先恢复普通命令入口和最基本交互界面。
2. 处理启动流程、帮助信息、错误提示。
3. 让最常见命令流可用。

第 2 轮：

1. 恢复 history、compact、部分 slash commands。
2. 恢复状态栏、简报类 UI 能力。
3. 优化可用性细节。

### 关键输入输出

输入：

- [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)
- [src/main.tsx](D:/agent_project/claude-code-reforged/src/main.tsx)
- `src/components/*`
- `src/commands/*`

输出：

- 正常面向用户的 CLI 产品壳

### 状态变化

`可持续使用 -> 可交付 CLI 产品`

### 边界

当前阶段默认只优先普通 CLI，不优先桥接模式和平台模式。

## 7.7 阶段 G：外围能力分批恢复

### 目标

在核心产品稳定后，再分批追回外围能力。

### 第一批恢复对象

1. MCP 基础连接与工具能力
2. 插件加载
3. skills 相关能力

### 第二批恢复对象

1. bridge / remote-control
2. daemon
3. background sessions
4. environment runner
5. self-hosted runner
6. chrome / computer-use

### 为什么要分两批

因为第一批直接增强主产品能力，第二批则明显更偏平台和外围模式。

### 关键输入输出

输入：

- [src/services/mcp/client.ts](D:/agent_project/claude-code-reforged/src/services/mcp/client.ts)
- [src/entrypoints/mcp.ts](D:/agent_project/claude-code-reforged/src/entrypoints/mcp.ts)
- `src/plugins/*`
- `src/skills/*`
- `src/bridge/*`
- `src/daemon/*`

输出：

- 分阶段扩展后的完整产品能力

### 状态变化

`可交付 CLI 产品 -> 较完整的产品版本`

## 8. 优先级总表

| 优先级 | 模块 | 当前判断 | 修复目标 | 备注 |
| --- | --- | --- | --- | --- |
| P0 | 工程骨架 | 缺失严重 | 建立可构建底座 | 不先补这个，后面难推进 |
| P0 | Query / QueryEngine | 主体完整 | 作为最小产品内核恢复 | 恢复主轴 |
| P0 | 工具执行链 | 主体完整 | 打通最小工具闭环 | coding 能力核心 |
| P0 | 权限体系 | 存在高风险问题 | 先做 fail-closed 修复 | 不能后置 |
| P1 | 状态 / session / history | 主体完整但复杂 | 恢复连续使用能力 | 与权限一起收口 |
| P1 | 普通 CLI / TUI | 可恢复但体量大 | 补回普通用户入口 | 不先追全部模式 |
| P1 | MCP 基础能力 | 主体较完整 | 第二阶段接回 | 有较高价值 |
| P2 | 插件 / skills | 可恢复 | 核心稳定后恢复 | 价值高但可后置 |
| P3 | bridge / daemon / bg sessions | 平台特征重 | 主产品稳定后再做 | 范围大、复杂度高 |
| P3 | Chrome / computer-use 等 | 外围能力 | 最后恢复 | 不影响主产品首版 |

## 9. 阶段验收标准

## 9.1 阶段 B 验收

满足以下条件：

1. 依赖安装不再是盲装。
2. 工程配置和宏替身具备最小闭环。
3. 至少能对核心入口进行静态校验或局部编译。

## 9.2 阶段 C 验收

满足以下条件：

1. 程序可启动。
2. 能进入一轮最小 query。
3. 能输出文本结果或完成最小工具调用。

## 9.3 阶段 D 验收

满足以下条件：

1. 文件读写和搜索工具可用。
2. Bash / PowerShell 至少一类可稳定执行。
3. 能完成一次真实编码任务。

## 9.4 阶段 E 验收

满足以下条件：

1. 已知高风险权限降级问题被封堵。
2. session / tool result / history 的基本一致性成立。
3. 异常场景下不会静默越权继续执行。

## 9.5 阶段 F 验收

满足以下条件：

1. 普通 CLI 使用路径顺畅。
2. 基本交互体验可接受。
3. 常见命令和错误场景有清晰反馈。

## 10. 当前建议的落地顺序

当前建议严格按下面顺序推进：

1. 基线冻结
2. 工程骨架恢复
3. 最小产品内核恢复
4. 核心 coding 工具恢复
5. 权限与状态收口
6. 普通 CLI / TUI 恢复
7. MCP / 插件 / skills
8. bridge / daemon / background / 其他外围模式

## 11. 下一步动作

本文档完成后，下一步应直接进入：

**阶段 B：工程骨架恢复清单**

这一步要产出的不是抽象讨论，而是两份明确清单：

1. 依赖恢复清单
2. 构建与宏适配清单

## 12. 结论

`claude-code-reforged` 不是一个“残缺到无法继续”的仓库，而是一个“产品主核仍然很完整、但工程外壳缺失明显”的恢复版仓库。

正确的修复方向不是立刻追求和官方原始发布工程完全一致，而是：

1. 先恢复工程骨架。
2. 先救活普通产品主链。
3. 先做安全收口。
4. 再逐步追回外围模式。

只要顺序不乱，这个项目完全有机会从恢复版推进成一个真正可用的产品。
