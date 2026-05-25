# Goal: STD-HISTORY-10-5 展示投影单展示项单主语义

## 目标

让展示投影层只处理“一条展示项一个主语义”，不再在一条展示项里猜多个工具块。

App Server 必须在进入展示投影前完成内容块拆分。

## 为什么先做这个

当前展示投影里存在只取第一个工具块的风险。只要一条消息内有多个 `tool_use` / `tool_result`，后续块就可能被忽略。

展示投影应保持稳定、可校验、单语义，不承担多工具解析器职责。

## 第一版范围

1. 审查 `threadDisplayProjection.ts` 工具块提取逻辑。
2. App Server 先拆出单语义 `ThreadDisplayItem`。
3. 展示投影只处理一个主展示语义。
4. TodoWrite 专用投影以单个 `toolUseId` 为主键。
5. schema 校验 `identity.toolUseId`、`identity.contentIndex`、`identity.rawIndex`。

## 明确不做

- 不在 projection 里遍历整条 message 并拆多个工具卡。
- 不保留 raw content fallback 作为正常展示路径。
- 不让 Renderer 修复缺失 projection。

## 验收标准

- [x] 展示投影不会因为只看第一个 block 而丢第二个工具。
- [x] 缺展示投影仍生成协议错误卡，不回退 raw 解析。
- [x] 一个展示投影事件只对应一个主展示语义。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-6 实时增量补丁接入工具生命周期](./2026-05-24-std-history-10-6-realtime-patch-tool-lifecycle.md)。

## 执行结果

状态：已完成。

完成内容：

- `ThreadDisplayProjectionIdentity` 补充 `sourceIndex`、`rawIndex`、`materializedIndex`，并让投影优先保留 App Server 传入的原始 `contentIndex`。
- `threadDisplayProjection.ts` 的 TodoWrite / tool projection 改成只选择一个主语义块，不在投影层拆多工具。
- 工具调用投影会携带 App Server 已经回填到单块内容里的 `result`，避免历史工具卡有内容但投影快照缺结果。
- `threadDisplayProjectionSchema.ts` 补充 `identity.rawIndex` / `materializedIndex` / `sourceIndex` 的运行时校验。
- `scripts/smoke-app-server.mjs` 补充并行工具投影断言，确认投影身份保留原始 `contentIndex/rawIndex`，工具结果进入同一 `toolSnapshot`。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `npm.cmd run smoke:desktop-display-events`：通过。
- `git diff --check`：通过。
