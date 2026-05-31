# Goal: ThreadDisplay 全事件黄金回归矩阵扩展与最终收口

状态：已完成。

关联文档：

- [ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)
- [ThreadDisplay 全事件输入来源矩阵](./2026-05-31-thread-display-full-ordered-reducer-01-input-source-matrix.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)

## 目标

补齐第二阶段新增展示类型的黄金回归矩阵，并把全事件 Ordered Display Reducer 深化阶段收口。

最终要证明：

```text
history snapshot path
realtime patch path
-> Desktop route / session reducer
-> final DisplayEvent
```

在同类展示语义上等价。

## 为什么最后做

每个小 goal 会新增或确认一类展示语义。最终 closeout 负责把这些覆盖沉淀成可维护矩阵，避免后续继续靠口头记忆判断“有没有覆盖”。

## 范围

黄金回归至少覆盖：

- permission request / allowed / denied / cancelled
- MCP 特殊错误
- tool progress 多次更新
- failed / interrupted 工具生命周期
- 恢复中断态
- 多 attachment
- 多 generated output
- unknown item / unsupported item
- 缺 projection / invalid projection

文档同步至少包括：

- 父 goal 状态和完成记录。
- `thread-display-reducer-contract.md` 的覆盖矩阵。
- 必要的 `CHANGELOG.md` 用户可见口径。
- 后续未完成项列表。

## 非目标

- 不在 closeout 阶段新增大实现。
- 不补不属于第二阶段范围的视觉重构。
- 不用 snapshot / patch 等价 smoke 替代真实边界说明。
- 不删除仍有兼容价值的 legacy 入口，除非已有独立 smoke 覆盖。

## 迭代拆分

### 迭代 1：覆盖缺口复核

汇总 2-1 到 2-4 的矩阵和 smoke，确认哪些类型已经覆盖、哪些仍需补 fixture、哪些明确暂不支持。

输出：最终黄金回归覆盖清单。

### 迭代 2：fixture 补齐

只补第二阶段范围内的缺失 fixture，不在 closeout 阶段新增大实现。

输出：permission、MCP 特殊错误、progress、多附件、多 generated output、unknown / unsupported 等覆盖。

### 迭代 3：文档和状态收口

同步父 goal、architecture、CHANGELOG 和后续未完成项；确认没有 silent fallback 表述回归。

输出：父 goal 已完成、矩阵已更新、验证命令完整通过。

## 验收标准

- 第二阶段新增类型都有 smoke 或明确未覆盖原因。
- 父 goal 状态、矩阵、CHANGELOG 和 architecture 口径一致。
- 未知和非法输入仍是显式诊断，不是 silent fallback。
- 验证命令通过：

```text
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

## 最终覆盖矩阵

| 展示语义 | 覆盖入口 | 验证结论 |
| --- | --- | --- |
| permission request / cancelled | `smoke:thread-display-input-event`、`smoke:app-server` | 权限请求和取消都进入 `ThreadDisplayFact`，实时 patch 只更新同一权限项。 |
| permission allowed / denied | `smoke:app-server` 的 permission respond 断言 | allow / duplicate / missing 已覆盖为权限服务边界；denied 当前不生成独立 ThreadDisplay 展示项，保持显式边界。 |
| compact / control | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | compact started / completed 和内部 control fact 已固定，不回到 Renderer raw fallback。 |
| MCP 特殊错误 | `smoke:desktop-display-events`、`smoke:app-server` | MCP 工具错误按工具错误分类和 App Server MCP 生命周期 smoke 固定；新增异常形状后再补专门 fixture。 |
| tool progress 多次更新 | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | progress 进入 reducer lifecycle state，实时 `update_item` 和最终 snapshot / patch 展示收敛。 |
| failed / interrupted 工具生命周期 | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | failed / interrupted 工具结果绑定原工具卡，并保留错误快照。 |
| 恢复中断态 | `smoke:desktop-session-state` | 终止 turn 会标记运行中工具为 interrupted，不在恢复展示中伪装成功。 |
| 多 attachment / 多 generated output | `smoke:thread-display-input-event`、`smoke:desktop-display-events`、`smoke:desktop-session-state` | 用户附件和模型生成物都在输入 / 投影前物化，Desktop 不从正文路径猜附件。 |
| unknown / unsupported input | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | unsupported 输入显式投影为 protocol error 展示项。 |
| 缺 projection / invalid projection | `smoke:desktop-session-state` | Desktop 对缺失或非法 projection 显示协议错误卡，不走 raw fallback。 |

## 本轮实现

- 扩展 `smoke:desktop-session-state` 全量 golden fixture，新增工具 progress 多次更新、failed、interrupted 场景。
- 修复 Desktop 实时 `thread/display/patch` 消费缺口：可投影的 `update_item` 现在进入同一 ThreadDisplayItem 投影路径，完成态合并会保留 `contentBlocks` 和 `errorSnapshot`，保证 snapshot path 与 realtime patch path 最终 `DisplayEvent` 等价。

## 文档同步

- 父 goal 状态已关闭。
- `thread-display-reducer-contract.md` 已更新第二阶段最终覆盖矩阵。
- `CHANGELOG.md` 已补全事件深化和实时 patch 合并修复口径。

## 后续未完成项

- permission denied 仍属于权限响应服务边界，除非后续 CoreTurnEvent 明确产出独立展示事件，否则不在 ThreadDisplay 内制造伪展示项。
- snip / preserved segment 仍按物化和上下文边界处理；后续如果需要 UI 可见提示，应另立明确输入事件和 unsupported 诊断。
- MCP / provider 新增特殊错误形状时，按真实 raw shape 增加定向 fixture，不在 closeout 阶段预造泛化 fallback。

## 验证记录

已通过：

```text
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
npm.cmd run typecheck
git diff --check
```

## 下一步

ThreadDisplay 全事件 Ordered Display Reducer 深化阶段已关闭。后续只按具体展示类型或 UI 体验另立 goal。
