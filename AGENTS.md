# Claude Code Reforged 项目协作规则（精简版）

目标：减少上下文占用。详细条款已拆分为分册，索引见
[docs/agent-rules/index.md](D:/agent_project/claude-code-reforged/docs/agent-rules/index.md)。

## 1. 角色分工

1. 默认采用“双线程协作”：主线程负责文档与评审，修复线程负责实现与验证。
2. 当用户要求主线程只做评审时，主线程不直接改业务实现文件。

## 2. 子线程交付与失效处理

1. 交付必须有真实代码改动，不接受“仅状态回复”作为完成。
2. 每轮必须提交：改动文件、关键改动点、验证命令与结果、剩余阻塞。
3. 连续两次仅状态回复视为无效线程：关闭并重建，任务收窄到更小文件单元。
4. 子线程生命周期采用“复用优先 + 定期重建”：
   - 同一任务域且近期有有效产出时优先复用旧线程
   - 每完成一个阶段或连续 `3-5` 轮后默认重建线程，避免上下文膨胀

## 3. 等待与中断策略

1. 子线程进入长任务后，主线程默认长等待，不因超时提示提前收工。
2. 网络中断或机器重启后，必须重新核验线程存活、实际改动和验证输出。
3. `wait_agent` 超时不等于失败；无代码结果时按“未完成”处理。
4. 出现以下任一情况时立即重建线程：连续空回包、明显偏航、响应显著变慢、额度或网络异常、任务域切换。
5. 当前 Windows 环境如果 `rg.exe` 返回 `Access is denied`，不要反复尝试同一路径；直接改用 `Get-ChildItem -Recurse | Select-String` 做本地检索。

## 4. 评审标准

1. 默认执行“完整审查本轮所有改动文件”，非抽查。
2. 评审必须基于真实文件与验证输出；无 diff 不给通过口径。
3. 高风险入口（运行时/服务/权限/命令）额外检查：禁止假成功、静默吞错、过宽桥接。

## 5. 专用审查线程

1. 可启用专用审查线程；主线程负责裁决与纠偏。
2. 审查线程偏离范围时先纠偏重派；连续两次偏离再关闭并重建。
3. 未完成逐文件审查前，不得以“子线程口头完成”作为通过依据。
4. 审查线程默认短生命周期，建议每 `1-2` 轮重建一次；修复线程可相对更长。

## 6. 每轮修复闭环

每个文件或清晰切片按固定顺序推进：

1. 每轮开始或中断恢复后，先刷新计划任务，明确“派发 / 等待 / 主线程复核 / 独立审查 / 文档更新”的当前阶段。
2. 抓取当前目标文件的精确报错。
3. 下发给修复线程，只允许其处理指定范围。
4. 修复线程交付后，主线程实读改动并跑定向 `typecheck`。
5. 独立审查线程完整审查本轮改动，主线程裁决 `PASS/FAIL`。
6. 通过后刷新全仓快照、刷新任务队列、更新当前看板，再进入下一目标。
7. 刷新任务队列必须基于最新全仓 `typecheck` 热点重新选择当前主线和下一批候选；不得沿用过期排序。
8. 刷新全仓快照前，必须先生成一份 fresh `typecheck` 输出文件，再基于这份 fresh 快照统计错误数、文件数和热点；不要复用旧 `.codex-typecheck*.txt`，避免被过期日志误导。
9. “当前轮闭环”不等于“项目收口”：只要全仓 `typecheck` 仍未清零，主线程不得用“已完成 / 已收口 / 可以结束主任务”的口径对外结案；只能表述为“当前文件或当前切片已闭环”，并立即切换到下一主线继续推进，除非用户明确要求暂停、转向或接受阶段性停点。
10. 只要下一步明确且不存在外部硬阻塞，本轮不得停在“仅抓报错 / 仅读现场 / 仅分析结论”状态；在任何可能结束当前回合的输出前，主线程至少要推进到以下三种状态之一：
   - 已派发下一修复线程并进入长等待
   - 已完成主线程复核并已派发独立审查线程进入等待
   - 已完成独立审查 `PASS`、已更新 backlog，并已锁定且派发下一个热点
11. “抓完现场但尚未派单”不是合法停点；如果目标文件已锁定、下一动作清晰，就必须在同一轮内继续派单。
12. 只有以下情况才允许停在未派单状态：网络/额度/机器异常、子线程接口异常、用户主动打断、或需要用户做高风险决策。
13. 如果发生了上条中的被迫中断，下一轮恢复时必须先执行固定恢复清单：确认当前主线、读取最新 `.codex-typecheck.txt`、核对 backlog 当前态、检查旧子线程是否仍有效、重新锁定“当前处于派发 / 等待 / 复核 / 审查 / 文档更新”的哪一阶段，再继续推进；不得跳过恢复直接展开新分析。

修复线程不得在未被明确授权时主动更新 `current-repair-backlog.md` 等看板文档；看板由主线程在独立审查结论落地后统一刷新。

若审查失败，先纠偏并回派修复线程返工；不得跳过刷新与文档同步直接切换任务。当前轮未独立审查 `PASS` 前，只能标记为待审查或待刷新，不得提前把看板切到下一轮。

## 7. 文档同步

1. 每轮审查结论后，先更新文档再进入下一轮。
2. 默认同步：
   - [docs/current-repair-backlog.md](D:/agent_project/claude-code-reforged/docs/current-repair-backlog.md)
   - 必要时同步 [docs/recovery-repair-plan.md](D:/agent_project/claude-code-reforged/docs/recovery-repair-plan.md)

## 8. Provider / OAuth / SDK 接入护栏

1. 本节不是替代全局“查询优先、试错其次”规则，而是对本仓库 LLM provider / OAuth / SDK 接入场景的强制细化。
2. 凡是涉及 LLM provider、OAuth、外部 SDK、外部协议、成熟第三方库或陌生运行时行为，无论是新增、改造、修复、排查还是验证，都必须先做资料对照，不得直接凭印象手写；至少对照：
   - 官方文档或官方源码/README
   - 本机已有成熟实现或参考仓库
   - 第三方依赖的源码、类型声明和示例
3. 如果本机已有跑通过的成熟实现，优先复用其调用路径和参数口径；只有在项目边界确实不同的情况下，才允许改走更底层 API，并必须写清楚差异原因。
4. 如果从高层 helper 切到低层 `stream/complete` 等 API，必须逐字段对照入参名称、默认值、传输方式和错误降级行为，并补 smoke 断言防止口径漂移。
5. 真实登录凭据、token、refresh token 和 credential JSON 绝不打印、不贴回复、不写入文档；验证只输出脱敏状态和路径。
6. 这类接入验证失败时，先回到资料对照和实际 payload/transport 差异排查，不得优先猜测网络、代理或环境问题。

## 9. 详细规则入口

按需读取，不要一次性加载全部分册：

1. [01-threading-and-delivery.md](D:/agent_project/claude-code-reforged/docs/agent-rules/01-threading-and-delivery.md)（线程分工、交付、轮换）
2. [02-review-baseline.md](D:/agent_project/claude-code-reforged/docs/agent-rules/02-review-baseline.md)（评审基线、高风险检查）
3. [03-type-narrowing-patterns.md](D:/agent_project/claude-code-reforged/docs/agent-rules/03-type-narrowing-patterns.md)（类型收口与 guard 模式）
4. [04-review-thread-governance.md](D:/agent_project/claude-code-reforged/docs/agent-rules/04-review-thread-governance.md)（审查线程治理与纠偏）
5. [05-retro-and-doc-sync.md](D:/agent_project/claude-code-reforged/docs/agent-rules/05-retro-and-doc-sync.md)（复盘模板与文档同步）
