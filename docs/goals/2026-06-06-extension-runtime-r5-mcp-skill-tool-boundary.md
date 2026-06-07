# Goal：R5 MCP Skill 与 MCP Tool 边界闭环

## 1. 当前状态

状态：已完成（2026-06-06）。

完成事实：

- Capability Catalog 已区分 `mcp-server`、`mcp-tool`、`mcp-resource`、`mcp-prompt` 和 `skill`。
- 普通 MCP prompt 不会进入 `SkillTool`；`SkillTool` 只接收 `loadedFrom === 'mcp'` 的 MCP Skill。
- MCP tool 继续走 tool schema，MCP resource 继续走资源读取路径。
- `fetchMcpSkillsForClient()` 按 Draft SEP-2640 Skill resources 读取并校验 MCP Skill。
- server 不可用状态统一传播到 resource、prompt、tool 和 Skill child。
- MCP tool 与 MCP Skill 使用不同 kind 和冲突键，分别诊断。

## 2. 目标

确定并实现 MCP 四类能力的独立运行路径；如果当前协议无法可靠提供 MCP Skill，则显式关闭 MCP Skill 获取入口并保留清晰诊断，不用 MCP prompt 冒充 Skill。

```text
MCP tool
  -> tool schema

MCP resource
  -> resource list/read 或 attachment

MCP prompt
  -> MCP prompt command

MCP Skill
  -> 明确的 Skill 声明
  -> loadedFrom=mcp 的 Skill command
  -> ContextInjectionPlanner / SkillDiscovery / SkillTool
```

## 3. 关键决策

实现前必须先冻结 MCP Skill 来源契约：

- 来源是标准 MCP 能力、扩展字段、资源约定，还是 CCR 自定义 manifest。
- Skill identity 如何包含 server、Skill 名称和版本。
- `SKILL.md` 正文、资源目录和安全边界如何取得。
- server 断开、重连、重启后缓存如何失效。

如果没有可靠契约，本 Goal 的正确结果是：

- 删除不可达的伪实现或保留显式 unavailable adapter。
- Capability Catalog 输出明确诊断。
- 文档和 UI 不宣称 MCP Skill 已可用。

## 4. 实施范围

### R5.1 MCP 能力分类适配

- 固化 server、tool、resource、prompt、Skill 的 identity 和 parent relation。
- 普通 MCP prompt 始终保持 `mcp-prompt`，不自动转换为 Skill。
- MCP Skill 始终保持 `kind=skill`、`source.kind=mcp`、`parentMcpServerName`。

### R5.2 MCP Skill 获取与缓存

- 按冻结后的来源契约实现 `fetchMcpSkillsForClient()`，或明确关闭该入口。
- 缓存 key 必须包含 server identity，不能只按 Skill 名称。
- server 重启、断开或能力列表变化时必须使缓存失效。

### R5.3 父子运行时状态

- MCP server 不可用时，child capability 增加 `mcp-server-unavailable`。
- child 状态恢复必须来自 server 当前事实，不使用静默旧缓存。
- MCP Skill 不可用不能影响普通 MCP tool；反向也一样。

### R5.4 调用边界

- MCP Skill 进入 Skill planner、discovery 和 `SkillTool`。
- MCP tool 只进入 tool pool。
- MCP prompt 只走 prompt command。
- MCP resource 只走资源读取或 attachment。

## 5. 不变式

- Skill、Tool、Prompt、Resource 不能因来源同为 MCP 而合并调用语义。
- MCP prompt 不能作为 MCP Skill 的 fallback。
- MCP Skill 获取失败不能回退成普通 prompt。
- MCP server unavailable 必须显式诊断，不能继续使用 stale child capability。
- Plugin 提供的 MCP server 仍由 R6 负责关联到 parent Plugin。

## 6. 非目标

- 不重写 MCP 安装事务。
- 不改变普通 MCP tool 命名规则。
- 不在本阶段改造 Desktop 管理页。
- 不把所有 MCP prompt 自动变成 Skill。

## 7. 验收标准

- MCP 四类能力有独立 identity、来源、父子关系和调用适配。
- MCP Skill 来源契约已写入架构文档；若未实现，则入口和诊断明确为 unavailable。
- 普通 MCP prompt 无法通过 `SkillTool` 被猜名调用。
- MCP server 断开时，child capability 状态同步变为不可用并带原因。
- MCP server 恢复时，child capability 从当前 discovery 结果恢复，不读取 stale snapshot。
- MCP Skill 失败不影响 MCP tool，MCP tool 失败不伪装成 Skill 失败。
- MCP tool 和 MCP Skill 的同名冲突分别诊断，不静默覆盖。

## 8. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:capability-api
npm.cmd run smoke:capability-catalog-core
npm.cmd run smoke:extension-runtime-visibility
git diff --check
```

需要新增或扩展的 smoke：

- 普通 MCP prompt 不进入 SkillTool。
- MCP Skill 获取成功或显式 unavailable。
- MCP server 状态向 child capability 传播。
- MCP Skill 与 MCP tool 互不串路。

## 9. 完成后下一步

进入 [R6 Plugin 能力合集关系贯穿](./2026-06-06-extension-runtime-r6-plugin-bundle-relations.md)。

## 10. 完成记录

- 冻结实验性来源契约：CCR 按 Draft SEP-2640 通过 MCP Resources 读取可选 `skill://index.json` 和 `skill:///.../SKILL.md`。
- MCP Skill 转为 `loadedFrom=mcp` 的 prompt command，并保留 server、URI、version 和 Plugin 来源。
- 普通 MCP Prompt 保持 `mcp-prompt`，不会作为 SkillTool fallback。
- MCP Skill 获取失败只记录子能力诊断，不阻断同一 server 的 Tool、Resource 和 Prompt。
- server 断开、重启和列表变化会按 server identity 使 Skill cache 失效。
- 已补 `smoke:mcp-skill-resource-adapter` 和负边界回归。
