# CCR 当前交接文档（2026-05-08）

## 1. 交接目的

这份文档用于把旧线程 `019d659d-ed5c-76d2-ac1c-4ca52ac5af74` 的长期上下文迁移到一个可执行的当前态交接包。旧线程原始 session 约 1.70GB，包含大量工具调用、子线程通知、图片输出和历史讨论，不建议新线程继续读取原始 jsonl 作为主上下文。

新线程应优先读取本文件、`docs/stages/app-server-todo.md`、当前 `git status` 和相关源码文件，然后继续当前 todo。

## 2. 当前仓库

- 仓库路径：`D:\agent_project\claude-code-reforged`
- 当前主线：CCR App Server + Desktop 客户端产品化
- 当前 todo 文档：`docs/stages/app-server-todo.md`
- 当前专项补充文档：`docs/stages/desktop-interaction-cards-todo.md`
- 文档入口：`docs/README.md`

## 3. 当前主线状态

`docs/stages/app-server-todo.md` 当前显示：

- P0 到 P21 已完成。
- P22 结构化输出与 JSON/Schema 视图已撤回，后续按具体场景重新设计。
- P23 多模态输入/输出、附件上传与预览正在进行。
- P24 错误分类、限流与拒答状态治理待开始。
- P25 原生上下文链路恢复与短期记忆治理已完成。
- P26 上下文、压缩与记忆能力 App Server 桥接已完成。

当前指针：

- 进行中：P23 多模态输入/输出、附件上传与预览。
- 当前正在做：P23-1 现有附件入口、上传草稿和消息发送链路盘点。
- 完成后下一项：P23-2 多模态输入协议与 Core user message 映射设计。

## 4. P23 第一版边界

P23 的核心不是只做 UI 预览，而是让附件真正进入发送协议、Core 消息和模型输入，并且明确每类附件的预览策略和发送策略。

第一版优先完成：

- 图片 `png/jpg/jpeg/webp`：缩略图、放大、复制路径、打开文件；provider 支持视觉输入时转 image block，不支持时给清晰 fallback。
- 截图 / browser 输出图片：可预览，可作为 image block 或工具输出媒体展示。
- 小文本文件：可预览、截断、作为文本附件进入上下文。
- 大文本文件：默认需要确认，优先片段、摘要或引用，不能全文无保护内联。
- 普通二进制 / 压缩包：默认只传元信息或阻断，不进入上下文。
- PDF / Office / 音频 / 视频：第一版先做占位和路线，不承诺完整解析、播放器或 provider 原生输入。

关键不变式：

- `previewPolicy` 和 `sendPolicy` 必须分开建模。
- renderer 不能直接读取本地文件或长期持有大内容。
- 大文件、大二进制、工作区外文件和 provider 不支持多模态时必须有明确 fallback。
- 历史恢复、transcript、compact 后不能丢附件元信息。

## 5. 当前工作区状态

当前工作区是脏工作区，不能重置、不能清理未确认文件。新增线程开始前应先运行：

```powershell
git status --short
git diff --stat
```

当前已观察到的变更范围包括：

- Desktop main/preload/renderer：`apps/desktop/src/main/index.ts`、`apps/desktop/src/preload/index.ts`、`apps/desktop/src/renderer/src/main.tsx`、ChatPage、Topbar、Composer、ChatTimeline、McpPage、多个 chat card 组件和样式。
- Desktop 事件与展示模型：`notificationRouter.ts`、`sessionState.ts`、`displayEvents.ts`、`displayTypes.ts`、`toolEvents.ts`、`contentBlocks.tsx`、fixture。
- App Server / Core：`src/app-server/*`、`src/core/sessionCore.ts`、`src/core/coreQueryTurnRunner.ts`、`src/core/workspaceCore.ts`、`src/core/types.ts`。
- 上下文/记忆：`src/services/SessionMemory/*`、`src/app-server/handlers/contextHandlers.ts`、`src/utils/nullRenderingAttachmentTypes.ts`。
- 文档与脚本：`docs/architecture/*`、`docs/stages/app-server-todo.md`、`docs/stages/desktop-interaction-cards-todo.md`、多个 smoke 脚本。
- `dist/` 下也有对应生成产物变更，新线程不要单独删除或回滚。

当前未跟踪的新文件包括多张 Desktop 交互卡片、`contextHandlers.ts`、`setup.ts`、上下文状态 smoke、Desktop shell cards smoke，以及新的架构文档。新线程必须先理解这些文件的用途，再继续修改。

## 6. 已完成的重要能力

根据当前 todo 和工作区，近期已推进到以下能力：

- App Server 协议、stdio JSON-RPC、session/thread/turn API、权限闭环、Desktop 原型、打包和更新准备。
- Desktop 输出展示、事件协议、运行元数据、工具事件卡片、文件/附件/引用系统。
- Desktop 交互卡片专项已完成，包含 AskUserQuestion、计划卡、Shell 权限卡、文件卡、WebFetch/Skill/长尾卡、UI 组件化和 smoke。
- P25/P26 已完成上下文状态、压缩状态、记忆状态、thread resume、runtime snapshot、manual compact 等 App Server/Desktop 桥接。

## 7. 新线程启动建议

建议新线程第一条指令：

```text
读取 D:\agent_project\claude-code-reforged\docs\stages\current-handoff-20260508.md、
D:\agent_project\claude-code-reforged\docs\stages\app-server-todo.md 和当前 git status，
从 P23-1 多模态来源与格式盘点继续。不要读取旧 session 原始 jsonl，不要重置脏工作区。
```

新线程的第一步应执行：

```powershell
git status --short
git diff --stat
Select-String -LiteralPath 'D:\agent_project\claude-code-reforged\docs\stages\app-server-todo.md' -Pattern 'P23-|多模态|附件上传|sendPolicy|previewPolicy' -Encoding UTF8
```

然后优先盘点这些文件：

- `apps/desktop/src/renderer/src/components/layout/Composer.tsx`
- `apps/desktop/src/renderer/src/components/pages/ChatPage.tsx`
- `apps/desktop/src/renderer/src/domain/displayTypes.ts`
- `apps/desktop/src/renderer/src/domain/fileEvents.ts`
- `src/app-server/protocol.ts`
- `src/app-server/handlers/sessionHandlers.ts`
- `src/core/sessionCore.ts`
- `src/core/coreQueryTurnRunner.ts`
- `src/types/message.ts`
- `src/services/llm/sessions/CodexOAuthSession.ts`

## 8. 验证命令

Windows PowerShell 5.1 下优先使用 `.cmd` 入口：

```powershell
npm.cmd run typecheck:desktop -- --pretty false
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-context
npm.cmd run desktop:build
git diff --check
```

如果涉及 Core 或通用协议，再补：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
```

## 9. 风险与规则

- 不要继续把旧线程 `019d659d...` 原始 jsonl 当主上下文读取；只在查历史证据时定点扫描。
- 不要把“能预览附件”误当成“模型已经收到附件”。
- 不要在 renderer 里直接读文件系统；文件选择、读取、缩略图、内容引用应通过 main/preload 白名单能力。
- 不要把大附件、二进制、图片 base64 长期塞进 React 状态、transcript 或 compact summary。
- 不要把 Desktop、App Server、Core 各写一套附件协议；应共用同一组字段和映射规则。
- 不要回滚用户或其他线程留下的未提交改动。
- 若运行验证会影响当前用户正在用的 Desktop 入口，执行前必须说明主入口、临时入口和影响范围。

## 10. 下一步执行建议

下一步只做 P23-1：

1. 盘点 Desktop composer 当前附件入口和“附件暂不随消息发送”的断点。
2. 盘点 App Server `turn/start` 入参是否已有附件字段或扩展点。
3. 盘点 Core user message 当前是否只接收 text，如何扩展到 image/text attachment。
4. 盘点已有 `FileSnapshot / AttachmentSnapshot / MediaSnapshot` 字段，决定是否复用或补字段。
5. 把 P23-1 结论回写到 `docs/stages/app-server-todo.md`，再进入 P23-2。

