# 协作详细规则索引

用途：把项目级长规则按主题拆分，避免上下文一次性加载过大。

默认只读取你当前任务需要的分册：

1. [01-threading-and-delivery.md](D:/agent_project/claude-code-reforged/docs/agent-rules/01-threading-and-delivery.md)  
   主题：子线程分工、交付标准、失效判定、长等待、复用与轮换。  
   何时读：要决定“复用旧线程还是新建线程”时。

2. [02-review-baseline.md](D:/agent_project/claude-code-reforged/docs/agent-rules/02-review-baseline.md)  
   主题：评审前提、完整审查基线、高风险入口检查。  
   何时读：准备做代码评审或裁决 PASS/FAIL 时。

3. [03-type-narrowing-patterns.md](D:/agent_project/claude-code-reforged/docs/agent-rules/03-type-narrowing-patterns.md)  
   主题：类型收口、runtime guard、fail-closed 模式库。  
   何时读：修 `unknown`、联合类型、shim、认证边界报错时。

4. [04-review-thread-governance.md](D:/agent_project/claude-code-reforged/docs/agent-rules/04-review-thread-governance.md)  
   主题：专用审查线程职责、输入要求、偏航纠偏流程、五步修复闭环。  
   何时读：审查线程跑偏、需要重派或重建，或要确认每轮是否可以进入下一目标时。

5. [05-retro-and-doc-sync.md](D:/agent_project/claude-code-reforged/docs/agent-rules/05-retro-and-doc-sync.md)  
   主题：每轮复盘模板、审查后文档同步、全仓快照刷新要求。  
   何时读：一轮修复收束后，要更新 backlog/plan 或刷新任务状态时。

主入口仍是精简版：
[AGENTS.md](D:/agent_project/claude-code-reforged/AGENTS.md)
