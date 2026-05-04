# CCR 工具能力治理修复清单

状态：待启动。

本文档记录 App Server / Desktop 后续需要补齐的工具能力治理专项。它不替代当前 `app-server-todo.md` 的 P21-P24 主线，而是作为横切修复清单，后续可以单独开一轮集中处理。

## 1. 背景

最近真实 Desktop 复测暴露出一个核心问题：模型不是完全不知道该做什么，而是 CCR 暴露给它的工具能力不真实、不完整、不按平台收敛。

典型现象：

- Windows 下暴露了 `Bash`，但当前 App Server 没有可用 POSIX shell，导致 `No suitable shell found`。
- 仓库里有 `PowerShellTool`，但 external 模式默认未启用，导致模型无法真正执行 Windows 命令。
- 当前 App Server 没有真实 `LS` 工具，但提示和 UI 曾误以为可以用 `LS` 列目录。
- 暴露了 `AgentTool`，但 App Server 没有加载 active agent definitions，导致 `general-purpose` 子代理找不到。
- `ToolSearch(select:TodoWrite)` 和 TodoWrite 成功结果曾进入主聊天流，造成控制工具噪声。
- `progress` / `tool_use_summary` 这类工具进度事件仍可能单独生成“工具进度”卡，和原始工具调用卡重复。
- 浏览器工具线已经决定走 Playwright MCP，但生产接入、健康检查和工具暴露策略还没有完全收口。

根因不是单一工具坏了，而是缺少统一的“工具能力治理层”：App Server 在每轮模型调用前，应该根据平台、配置、feature flag、MCP 连接状态、agent definitions、权限模式和工具健康状态生成一份真实可用的工具清单。

## 2. 修复原则

1. 只暴露真实可用能力。
   - 工具源码存在不代表当前会话可用。
   - feature flag 开启不代表依赖、配置、连接和权限都就绪。
   - MCP 配置存在不代表 MCP server 已连接且工具可调用。

2. 工具池必须平台感知。
   - Windows 下默认优先 `PowerShellTool`、高层文件工具和 Node 原生能力。
   - `Bash` 只能在确认 POSIX shell 可用时暴露。
   - 不要让模型把 PowerShell 命令塞进 `Bash` 工具。

3. 文件系统能力优先高层工具。
   - 列目录、读文件、写文件、搜索文件不应默认依赖 shell。
   - 缺少高层能力时，应补工具，而不是靠 prompt 让模型猜命令。

4. 控制型工具使用专门 UI。
   - `TodoWrite`、`AskUserQuestion`、后续可能的计划/控制工具，不应作为普通工具卡刷主聊天流。
   - 控制结果要更新对应浮层、权限卡或状态面板。

5. `ToolSearch` 必须尊重最终工具池。
   - 被平台过滤、健康检查失败、未初始化、控制型隐藏的工具，不应被 ToolSearch 重新暴露出来。

6. MCP 工具必须有健康状态。
   - 至少区分：未配置、已配置未连接、连接中、已连接、工具列表可用、调用失败。
   - Desktop 只能展示真实状态，不应让模型假设浏览器/MCP 已经可用。

7. 权限模型要和工具语义一致。
   - 未来不应长期围绕 `Bash(command)` 做权限。
   - 应逐步抽象到 `ShellExecute(shell, command, cwd)`、`ListDirectory(path)`、`ReadFile(path)`、`WriteFile(path)` 等语义。

8. 工具进度是生命周期更新，不是独立消息。
   - `tool_use`、`progress`、`tool_use_summary`、`tool_result` 应尽量合并到同一张工具卡。
   - 执行中状态复用工具卡右下角的轻量转圈 / 脉冲动效。
   - 完成后同一区域切换为成功、失败、已拒绝、已取消或超时角标。

## 3. 修复任务列表

### TC0 工具现状盘点脚本

目标：建立一个能打印当前 App Server 实际工具池的脚本，避免继续靠猜。

具体内容：

- 打印内置工具、MCP 工具、deferred 工具、alwaysLoad 工具。
- 打印每个工具的 `name`、`category`、`isEnabled()`、`shouldDefer`、`alwaysLoad`、`isReadOnly`。
- 打印平台、`USER_TYPE`、相关 feature/env、是否启用 PowerShell、是否暴露 Bash。
- 打印 agent definitions 数量和 active agent 类型。
- 输出建议落点：`scripts/inspect-app-server-tools.mjs` 或 `scripts/smoke-app-server-tools.mjs`。

验收：

- 在 Windows 本机可以看到 `PowerShell` 是否存在、`Bash` 是否被过滤、`Agent` 是否被隐藏。
- 该脚本可以作为后续工具池修复的回归入口。

### TC1 工具能力注册表

目标：新增统一工具能力治理层，作为 App Server 工具池的单一出口。

建议形态：

```text
src/core/toolCapability/
  capabilityRegistry.ts
  platformGates.ts
  mcpGates.ts
  agentGates.ts
  toolCapabilityTypes.ts
```

核心字段：

- `toolName`：工具名。
- `category`：`shell`、`file`、`mcp`、`browser`、`control`、`agent`、`network`。
- `available`：当前是否真实可用。
- `reason`：不可用原因。
- `platform`：平台约束。
- `source`：`built-in`、`mcp`、`plugin`、`agent`。
- `visibleToModel`：是否暴露给模型。
- `visibleToDesktop`：是否展示给 Desktop。
- `health`：`unknown`、`ready`、`disabled`、`missing_dependency`、`not_connected`、`misconfigured`。

验收：

- `runCoreQueryTurn` 不再直接调用 `assembleToolPool(...)` 后临时 filter，而是通过工具能力治理层拿最终工具池。
- Desktop 设置/MCP 页面后续可以复用同一份能力状态。

### TC2 Windows Shell 策略收口

目标：Windows 下命令执行工具必须真实可用。

当前临时修复：

- Windows App Server 默认启用 `PowerShellTool`。
- Windows App Server 过滤 `Bash`。

后续要补：

- 统一判断 PowerShell 可用性。
- 如需 CMD，评估是否新增 `CmdTool` 或统一到 `ShellExecuteTool`。
- `PowerShellTool` 的权限提示、工具卡、错误分类要完整进入 Desktop。
- 明确 `.cmd` 入口规则：npm/npx/pnpm 优先使用 `.cmd`。

验收：

- 用户要求“查看目录”时，模型能使用 `PowerShell(Get-ChildItem ...)` 或更高层工具完成。
- 不再出现 PowerShell 命令被塞进 `Bash`。

### TC3 高层目录工具

目标：补一个真正的目录查看高层工具，避免列目录依赖 shell。

建议工具名：

- `ListDirectory`
- 或保持兼容命名为 `LS`，但内部用 Node fs 实现。

输入：

```json
{
  "path": "D:\\learn_code",
  "recursive": false,
  "includeHidden": false,
  "limit": 200
}
```

输出：

```json
{
  "path": "D:\\learn_code",
  "entries": [
    {
      "name": "xxx",
      "type": "directory",
      "relativePath": "xxx",
      "sizeBytes": null,
      "modifiedAt": "..."
    }
  ],
  "truncated": false
}
```

边界：

- 默认只列当前层级，不递归扫大目录。
- 工作区外路径需要权限或风险提示。
- UNC 路径要防 NTLM 泄露。

验收：

- Windows/macOS/Linux 都能列目录。
- Desktop 工具卡能展示结构化目录结果。
- 模型不需要为了列目录调用 shell。

### TC4 AgentTool 暴露策略

目标：没有可用 agent definitions 时，不暴露 `AgentTool`；有可用 agent 时，工具描述必须准确。

当前临时修复：

- App Server 没有 active agent definitions 时隐藏 `AgentTool`。

后续要补：

- 决定 App Server 是否加载内置 `general-purpose`、`Explore`、`Plan` 等 agent。
- 如果加载，要复用 TUI 的 agent definitions 加载路径，不能另写一套。
- 如果不加载，系统提示里不能继续暗示模型可以派子代理。
- `ToolSearch` 也不能搜出不可用 Agent。

验收：

- 不再出现 `Agent type 'general-purpose' not found`。
- Agent 能力要么真实可用，要么完全不出现在模型工具池里。

### TC5 MCP 工具健康检查

目标：MCP 工具不再只看配置，而是按健康状态暴露。

状态分类：

- `not_configured`：未配置。
- `configured`：已配置但未连接。
- `starting`：正在启动。
- `connected`：MCP server 已连接。
- `tools_ready`：工具列表已可用。
- `failed`：启动或调用失败。

需要覆盖：

- stdio MCP。
- npx MCP。
- `.ccr/mcp` 本地安装 MCP。
- 远程 HTTP/SSE MCP。

验收：

- `mcp/list` 返回健康状态和失败原因。
- 模型只看到 `tools_ready` 的 MCP 工具。
- Desktop MCP 页面能解释“为什么工具不可用”。

### TC6 Playwright MCP 生产接入

目标：浏览器能力统一走 Playwright MCP，不再回到旧 `WebBrowserTool`。

需要补：

- 支持 npx 启动 Playwright MCP。
- 支持 `.ccr/mcp` 本地安装 Playwright MCP。
- 支持默认配置示例。
- 支持健康检查：浏览器依赖是否安装、server 是否启动、工具是否返回。
- Browser 类工具卡要能展示页面操作、截图、URL、失败原因。

验收：

- MCP 页面能看到 Playwright MCP ready。
- 模型只有在 Playwright MCP ready 后才看到浏览器工具。
- 旧 `WebBrowserTool` 不再触发 require 缺失问题。

### TC7 ToolSearch 与 deferred 工具治理

目标：ToolSearch 搜索结果必须来自最终可用工具池。

需要补：

- ToolSearch 不能搜出已过滤工具。
- ToolSearch 不能把控制型工具作为普通工具展示给用户。
- TodoWrite / AskUserQuestion 等控制工具的搜索、调用、结果都走专用 UI。
- ToolSearch 搜索自身的卡片也要可隐藏或合并，避免“搜索 TodoWrite”刷屏。

验收：

- 不再出现 `搜索: select:TodoWrite` + `工具执行成功` 的普通聊天卡。
- 不可用 `Agent`、`Bash` 不会被 ToolSearch 重新带出来。

### TC8 工具权限语义升级

目标：权限不再长期绑定旧 Claude Code 的 `Bash(command)` 单一模型。

建议方向：

- `ShellExecute(shell, command, cwd)`：明确命令方言。
- `ListDirectory(path)`：目录读取。
- `ReadFile(path)`：文件读取。
- `WriteFile(path, content)`：文件写入。
- `EditFile(path, diff)`：文件编辑。
- `McpCall(server, tool, params)`：MCP 调用。

验收：

- 权限卡能说明“这是 PowerShell 命令 / 目录读取 / MCP 浏览器操作”。
- allow / deny / once / session allow 的规则能按工具语义落地。

### TC9 Desktop 工具能力状态面板

目标：用户能在 Desktop 里看到当前工具能力是否可用。

建议位置：

- 设置页：展示内置工具能力。
- MCP 页：展示 MCP 工具健康。
- 调试折叠区：展示本轮模型实际工具池。

展示字段：

- 工具名。
- 类型。
- 来源。
- 状态。
- 不可用原因。
- 修复建议。

验收：

- 用户不用截图问“为什么它执行这个”，界面就能说明工具池当前状态。

### TC10 工具池回归测试

目标：工具能力治理必须能自动回归。

建议 smoke：

- Windows 下工具池包含 `PowerShell`，不包含 `Bash`。
- 无 agent definitions 时不包含 `Agent`。
- MCP 未连接时不暴露 MCP 工具。
- TodoWrite 控制链路不进入主聊天流。
- PowerShell `Get-ChildItem` 能跑通一个临时目录。
- `ListDirectory` 工具补齐后，列目录优先走高层工具。

验收：

- 接入 `ci:smoke`。
- 每次修改工具池、MCP、权限、Desktop 展示，都能跑固定回归。

### TC11 工具进度事件合并与执行中动效

目标：把“工具进度 / 工具正在执行”从独立聊天卡收敛成原工具卡片的运行状态，避免同一个工具调用出现两张卡。

Codex 对照结论：

- Codex 的 `ExecCommandBeginEvent` / `ExecCommandEndEvent` / `ExecCommandOutputDeltaEvent` 都使用同一个 `call_id`。
- TUI 侧 `ExecCell` 通过稳定 `call_id` 执行 `complete_call` / `append_output`，找不到匹配 ID 时视为真实路由异常，不会合并到“最近运行中的命令”。
- App Server 协议层把 begin/end 映射成同一个 `ThreadItem::CommandExecution { id: call_id }`，前端/历史视图再按这个 `id` upsert。
- CCR 也应采用同类原则：`tool_use`、`progress`、`tool_result` 必须通过确定性的工具调用 ID 关联；`data.taskId` 只能表示本地进程/输出任务，不能作为 UI 生命周期主键。

需要补：

- 盘点 App Server / Core 当前发出的 `progress`、`tool_use_summary`、工具状态更新事件字段。
- 优先按 `toolUseId` / `tool_use_id` 合并到对应工具卡。
- PowerShell 进度详情里的 `data.taskId` 是本地任务输出 ID，只能作为辅助关联字段，不能替代模型工具调用 ID。
- PowerShell / Bash 当前会把进度事件自身的 `toolUseID` 写成 `ps-progress-0` / `bash-progress-0` 这类临时 ID；Core 已经通过 `parentToolUseID` 指回原工具调用，Desktop 必须优先用 `parentToolUseId` 合并。
- 如果进度事件没有 `toolUseId` 或 `parentToolUseId`，记录协议缺口并隐藏孤立进度卡。
- 不使用“最近运行中工具”兜底合并。缺少确定性关联字段时，宁可隐藏该进度卡并记录协议缺口，也不要把进度误合并到错误工具卡。
- 如果 `progress` 早于 `tool_use` 到达，可以先建立临时运行中占位卡，等 `tool_use` 到达后合并。
- 独立“工具进度”卡默认不进入主聊天流；原始进度内容只放到原工具卡的“查看详情”。
- 执行中 UI 复用已有右下角动态转圈 / 脉冲效果，并展示已持续时间。
- 收到 `tool_result` 后停止动效，同一区域切换为成功 / 失败 / 被拒绝 / 已取消角标。

验收：

- PowerShell 工具调用后不再额外出现“工具进度 / 工具正在执行”卡。
- 运行中的工具能在原 PowerShell 工具卡右下角看到动态效果。
- 完成后原卡片右下角显示最终状态，详情里仍可查看进度原始内容。
- display-event fixture 覆盖 `tool_use -> progress -> tool_result`，并断言最终只生成一张可见工具卡。

孤儿工具结果补充：

- 真实复测中出现 `Write` / `写入文件` 调用卡缺失、只剩 `File created successfully...` 工具结果的孤儿结果卡。
- 根因在 Core 流式事件收尾：当 `assistantStream` 仍存在时，`assistant` 最终消息只会用于收尾流式文本，随后直接 `continue`，同一条 assistant 消息里的非文本块（尤其是 `tool_use`）可能被跳过。
- 修复原则：流式文本收尾后，仍必须提取并发出 `nonStreamedAssistantContent(event)`，确保 `tool_use` 先进入 Desktop，后续 `tool_result` 才能按 `toolUseId` 合并。
- 验收：先说一句话再调用 `Write` 的场景，主聊天流应出现一张 `写入文件` 工具卡，并在右下角显示成功；不能只剩单独的 `工具结果`。

多工具调用块补充：

- 真实复测中出现同一轮连续写入两个文件时，前一个 `Write` 有调用卡和结果，后一个写入只显示单独的 `工具结果`。
- 初步判断不是 `FileWriteTool` 写入逻辑问题：`FileWriteTool.mapToolResultToToolResultBlockParam` 已经返回 `tool_use_id`，结果本身带有关联 ID。
- 更可能是 App Server / Desktop 事件颗粒度问题：同一个 assistant item 里如果包含多个 `tool_use` block，Desktop 当前只抽取第一个工具快照，后续 `tool_use` 被跳过；等对应 `tool_result` 到达时，因为没有可合并的调用卡，就退化成孤儿 `工具结果`。
- 修复原则：协议层应把每个 `tool_use` / `tool_result` 作为独立可追踪生命周期事件发出，或前端必须支持单个 completed item 生成多个 display event；无论采用哪层修，都必须保证每个工具调用都有独立 `toolUseId`、独立卡片和可合并结果。
- 不使用“最近一次工具调用”兜底合并。缺失确定性 `toolUseId` 或调用卡时，应记录协议缺口，避免把第二个写入结果误合并到第一个写入卡。
- 验收：构造同一 assistant message 内含两个 `Write` tool_use，并随后返回两个 `tool_result` 的 fixture；最终主聊天流应显示两张写入文件卡，每张右下角各自成功，不出现孤儿 `工具结果`。

## 4. 建议执行顺序

第一批先做阻断性问题：

1. TC0 工具现状盘点脚本。
2. TC1 工具能力注册表第一版。
3. TC2 Windows Shell 策略收口。
4. TC4 AgentTool 暴露策略。
5. TC10 工具池回归测试第一版。
6. TC11 工具进度事件合并与执行中动效。

第二批补产品能力：

1. TC3 高层目录工具。
2. TC7 ToolSearch 与 deferred 工具治理。
3. TC9 Desktop 工具能力状态面板。

第三批补 MCP / 浏览器：

1. TC5 MCP 工具健康检查。
2. TC6 Playwright MCP 生产接入。
3. TC8 工具权限语义升级。

## 5. 当前已做的临时修复

已完成但仍需纳入正式治理：

- Windows App Server 默认启用 `PowerShellTool`。
- Windows App Server 过滤 `Bash`。
- 没有 active agent definitions 时隐藏 `AgentTool`。
- `ToolSearch(select:TodoWrite)` 等控制型前置动作隐藏主聊天流。
- 孤立 TodoWrite 成功结果不再生成普通“工具结果”卡。
- 工具结果已经能按 `toolUseId` 合并到原工具卡，但 `progress` / `tool_use_summary` 仍需继续治理，避免单独生成“工具进度”卡。

这些修复能缓解当前体验，但还不是最终形态。最终应落到统一工具能力治理层，而不是散落在 `runCoreQueryTurn` 和 Desktop 展示层的临时判断里。

## 6. 完成标准

该专项完成时，应满足：

- App Server 每轮模型调用前都有一份真实可解释的工具能力清单。
- 模型不会看到当前平台不可用、依赖缺失、MCP 未连接、agent 未加载的工具。
- Windows 下目录查看和基础命令执行不再走坏掉的 POSIX shell。
- 工具调用、进度和结果在主聊天区表现为同一张生命周期卡。
- 文件、目录、MCP、浏览器、控制型工具都有明确分类和 UI 展示。
- Desktop 能解释工具为什么可用或不可用。
- 工具池治理有 smoke 回归，不再靠人工截图发现。
