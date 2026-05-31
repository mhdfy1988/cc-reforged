# Goal: STD-HISTORY-16-0 ThreadDisplayReducerInputEvent

## 目标

启动真正单一 `display reducer` 状态机的第一步：先建立统一展示输入事件层。

本 goal 只负责把历史 `AppServerThreadMessage` 和实时 `CoreTurnEvent` 标准化为同一种 `ThreadDisplayReducerInputEvent`，并用 smoke 确认它覆盖当前历史 / 实时展示用例。

## 为什么先做这一层

上一轮 `STD-HISTORY-15-0` 已经完成工具 / 文件 projector 拆分，并明确当前还没有真正单一状态机：

- 历史 snapshot 仍从 `reduceThreadMessagesToDisplayItems(...)` 处理 `AppServerThreadMessage[]`。
- 实时 patch 仍从 `reduceCoreEventDisplayPatchOperations(...)` 处理 `CoreTurnEvent`。
- 两条路径只是通过 `createThreadDisplayReducer(...)` facade 聚到同一个入口，还没有共享同一种 ordered display input。

如果直接合并 reducer，很容易把历史语义、实时 patch 语义和工具生命周期状态一起搅乱。

所以本 goal 先只做输入层，不改输出行为。

## 范围

### 1. 定义统一输入事件

新增 `ThreadDisplayReducerInputEvent`，表达展示 reducer 真正关心的有序输入事实。

第一版应至少覆盖：

- 来源：`history` / `realtime`
- 事件类型：消息、item started、item completed、权限请求 / 取消、工具生命周期相关事件、系统类展示事件
- `threadId`
- `sessionId`
- `turnId`
- `itemId`
- source index / materialized index / content index
- 标准化后的 content blocks 或 Core event payload
- 原始输入引用，仅用于诊断，不作为 Renderer fallback

### 2. 历史 adapter

新增历史 adapter：

```ts
AppServerThreadMessage -> ThreadDisplayReducerInputEvent
```

要求：

- 保留当前历史 ordered 顺序。
- 保留现有 identity 字段。
- 不重新解释 Renderer 展示协议。
- 不改变 `currentContextMessages`。
- 不改变 `buildThreadDisplaySnapshot(...)` 输出行为。

### 3. 实时 adapter

新增实时 adapter：

```ts
CoreTurnEvent -> ThreadDisplayReducerInputEvent
```

要求：

- 覆盖当前 `item_started`、`item_completed`、permission、工具生命周期 patch 等实时展示用例。
- 保留 `CoreTurnEvent` 原始事件用于诊断。
- 不改变现有 `buildThreadDisplayPatch(...)` 输出行为。

### 4. 验证输入层覆盖

补或复用 smoke，确认：

- 历史 adapter 产出的 input event 可以覆盖当前 snapshot smoke 用例。
- 实时 adapter 产出的 input event 可以覆盖当前 patch smoke 用例。
- 本 goal 不改变 snapshot / patch 最终输出。

## 明确不做

- 不把 `reduceThreadMessagesToDisplayItems(...)` 和 `reduceCoreEventDisplayPatchOperations(...)` 合并。
- 不删除旧 reducer 分支。
- 不改 Desktop Renderer 协议。
- 不改工具 / 文件 / 附件 / 错误 projector 行为。
- 不引入 silent legacy fallback。
- 不在 adapter 失败时静默回退旧逻辑。

## 不变式

1. `ThreadDisplayReducerInputEvent` 是 App Server 内部 reducer 输入，不是 Renderer 协议。
2. Renderer 仍只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。
3. adapter 只能做标准化和 identity 补齐，不能新增展示语义分叉。
4. 历史和实时输入必须保留可追溯 source identity，便于后续状态机按同一顺序处理。
5. 本 goal 完成后，用户可见 UI 行为必须不变。
6. 没有 silent legacy fallback；如果 adapter 无法表达某类事件，应显式诊断，而不是偷偷走旧语义。

## 验收标准

- [x] 新增 `ThreadDisplayReducerInputEvent` 类型。
- [x] 新增历史 adapter，并覆盖当前历史 snapshot 用例。
- [x] 新增实时 adapter，并覆盖当前实时 patch 用例。
- [x] `createThreadDisplayReducer(...)` 可观察到或可测试统一 input event，但最终输出仍保持不变。
- [x] smoke 固定“输入层覆盖但输出不变”的回归。
- [x] 文档和 CHANGELOG 更新。
- [x] `typecheck`、`typecheck:desktop`、`build`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 通过。

## 当前状态

状态：完成。

当前指针：本 goal 已收口。下一轮进入“单一 display reducer 状态机第一版”。

已完成：

- 新增 `ThreadDisplayReducerInputEvent`、历史输入事件、实时输入事件和 source identity 类型。
- 新增历史 adapter：`AppServerThreadMessage -> ThreadDisplayReducerInputEvent`。
- 新增实时 adapter：`CoreTurnEvent -> ThreadDisplayReducerInputEvent`。
- `createThreadDisplayReducer(...)` facade 已先生成统一 input event，再交给现有输出分支，确保输入层可观察 / 可测试。
- 新增 `smoke:thread-display-input-event`，覆盖历史 adapter、实时 adapter、历史 snapshot 输出和实时 patch 输出。
- 本 goal 未合并 `reduceThreadMessagesToDisplayItems(...)` / `reduceCoreEventDisplayPatchOperations(...)`，未改变 Renderer 协议。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
git diff --check
```
