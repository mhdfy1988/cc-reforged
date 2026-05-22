# 历史会话恢复结构化索引（2026-05-21：工具注册治理）

## 1. 文档目标

这份索引用来承接已经过大的历史会话，避免后续继续压缩或整段读取 195MB JSONL。

| 会话 ID | 本地记录 | 大小 | 覆盖范围 | 恢复状态 |
| --- | --- | --- | --- | --- |
| `019e4064-79d5-78d2-811d-0de72f2f1edf` | `C:\Users\luoji\.codex\sessions\2026\05\19\rollout-2026-05-19T21-19-47-019e4064-79d5-78d2-811d-0de72f2f1edf.jsonl` | 约 195MB / 10507 行 | CCR dev、图片生成展示、多模态工具化、`0.5.0` 发布、工具注册治理、文件搜索链路、`detailKeys/showInMainTimeline` 尾项 | 已抽取并完成当前断点；后续优先看本文件和阶段 todo |

## 2. 当前权威仓库

目标仓库是：

`D:\agent_project\claude-code-reforged`

注意：旧会话 `cwd` 是 `D:\agent_project`，但真实 Git 仓库根目录是 `D:\agent_project\claude-code-reforged`。后续 `apply_patch` 必须使用目标文件绝对路径。

## 3. 最近主线结论

| 结论 | 状态 | 后续动作 |
| --- | --- | --- |
| `0.5.0` 版本已进入发布线，重点覆盖多模态、多模型、工具调用体验 | 已完成 | 后续 `0.5.x` 继续修工具治理、MCP 管理面和体验问题，`0.6` 再进入 Skill / Plugin |
| 工具注册治理前四期最小闭环已完成 | 已完成 | 可进入第 5 期，但建议先补第 4 期尾项 |
| 第 4 期第一轮：共享 `toolDisplayCatalog` 已落地 | 已完成 | `toolRegistry` 和 Desktop `toolEvents` 复用同一份中文名、分类、摘要字段建议 |
| 第 4 期第二轮：`summaryKeys` 已用于部分工具卡摘要 | 已完成 | `TaskOutput`、`WebFetch` 等已能显示中文摘要 |
| 前四期还缺 `detailKeys`、`showInMainTimeline` 和真实 UI 回归 | 已完成本轮恢复 | 已补 smoke、文档和开发窗口非空启动回归 |

## 4. 最后一次明确用户要求

用户问“前四期还有哪些内容需要完成 或者需要补充的”后，结论是：

1. `detailKeys` 还没接入详情区。
2. `showInMainTimeline` 还没成为 UI 过滤依据。
3. 需要启动 CCR dev 做一次真实工具卡 UI 回归。

用户随后说：“先完成这个”。

因此当前任务不是进入第 5 期，而是先补完上述三个尾项。本轮恢复后，这三个尾项已经完成。

## 5. 中断前已经成功落下的改动

中断前已有两处 patch 成功，不能当作未开始：

| 文件 | 已完成内容 |
| --- | --- |
| `apps/desktop/src/renderer/src/components/chat/ToolCard.tsx` | `createToolDetailBlocks` 已导出；调用参数详情改为走 `createToolInputDetail`；当 `snapshot.detailKeys` 命中时标题显示为“关键参数”并只展示命中字段 |
| `apps/desktop/src/renderer/src/domain/displayEvents.ts` | `shouldHideToolFromTimeline` 已优先保留失败工具卡；`snapshot.kind === 'call' && showInMainTimeline === false` 时隐藏主时间线 |

中断前也已经能在当前 diff 里看到：

| 文件 | 相关状态 |
| --- | --- |
| `apps/desktop/src/renderer/src/domain/toolEvents.ts` | `ToolSnapshot` 已包含 `detailKeys` 和 `showInMainTimeline`；`extractToolCallMetadata` 已从 `toolDisplayCatalog` 读取这两个字段 |
| `scripts/smoke-desktop-display-events.mjs` | 已补部分 `GenerateImage / TaskOutput / WebFetch` 分类和摘要断言，但还需要补 `detailKeys` 和 `showInMainTimeline` 的明确断言 |

## 6. 本轮恢复后完成事项

| 顺序 | 任务 | 验收口径 |
| --- | --- | --- |
| 1 | 补 `detailKeys` smoke | 已构造 `TaskOutput` 工具卡，断言 `createToolDetailBlocks` 只展示“关键参数” |
| 2 | 补 `showInMainTimeline` smoke | 已构造 `ToolSearch` 内部工具调用，断言主时间线隐藏；失败状态不被隐藏 |
| 3 | 跑关键验证 | `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:tool-registry` 已通过 |
| 4 | 处理 `typecheck:desktop` | 仍失败，但仅命中既有 `MACRO / Bun / 可选依赖` 错误，没有指向本轮文件 |
| 5 | 启动 CCR dev 做 UI 回归 | 已启动临时 `desktop:dev`，Electron 开发窗口非空渲染；普通浏览器直开 renderer 会因缺少 Electron preload API 报错，不能作为失败依据 |
| 6 | 更新阶段文档和变更记录 | 已同步 `tool-registry-governance-todo.md`、`tool-registry-catalog.md`、`CHANGELOG.md` |

## 7. 当前未完成事项

| 顺序 | 任务 | 下一步 |
| --- | --- | --- |
| 1 | 第 5 期 Provider 能力工具化 | 从 provider 能力边界、工具可用性原因和 UI 可见性继续收敛 |
| 2 | 发布前 build / dist 同步 | 当前还有大量未提交源码和 dist 变更，提交前先按主题分组确认 |

## 8. 当前工作区注意事项

当前仓库有大量未提交改动，包括但不限于：

- 工具注册治理：`src/services/tools/*`、`scripts/smoke-tool-registry.mjs`、`docs/stages/tool-registry-governance-todo.md`
- 文件搜索链路：`src/utils/ripgrep.ts`、`src/utils/nativeFileSearch.ts`、`vendor/ripgrep/`、`scripts/smoke-file-search.mjs`
- Desktop 展示：`apps/desktop/src/renderer/src/domain/toolEvents.ts`、`ToolCard.tsx`、`displayEvents.ts`
- 文档与版本记录：`README*.md`、`docs/README.md`、`CHANGELOG.md`
- 构建产物：`dist/**`

后续不能随手 revert 未确认来源的改动。若要提交，先按主题分组确认范围。

## 9. 建议继续命令

优先从这些命令恢复：

```powershell
git -C 'D:\agent_project\claude-code-reforged' status --short
npm.cmd run typecheck
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:tool-registry
```

如果需要启动开发版，先确认现有端口和进程，再说明验证入口，不要悄悄替换用户当前入口。

## 10. 后续使用规则

1. 新会话从本文件接，不再整段读取 `019e4064-79d5-78d2-811d-0de72f2f1edf` 原始 JSONL。
2. 本轮尾项已完成，后续可以进入第 5 期 Provider 能力工具化。
3. 涉及工具展示的判断，以 `toolDisplayCatalog`、`toolEvents`、`ToolCard`、`displayEvents` 和 smoke 为准。
4. 涉及真实 UI 的判断，必须启动 CCR dev 或使用当前运行入口截图确认。
