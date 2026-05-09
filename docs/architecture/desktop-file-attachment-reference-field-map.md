# CCR Desktop 文件、附件与引用字段来源盘点

## 目标

本文件对应 P21-1，先确认 Core / App Server / Desktop 当前已经稳定提供哪些文件、附件、引用字段，再决定后续 `FileSnapshot`、`AttachmentSnapshot`、`ReferenceSnapshot` 怎么设计。

这一阶段只做盘点和边界确认，不改运行逻辑，也不从大段 stdout 里硬猜文件路径。

## 当前事件链路

```text
Core tool / query()
  -> 原生 Message content block
  -> App Server item/completed notification
  -> Desktop eventContract 归一化 identity
  -> DisplayEvent / ToolSnapshot
  -> ChatTimeline / ToolCard
```

关键现状：

- App Server `item/completed` 会透出 `threadId`、`turnId`、`itemId`、`status` 和 `content`。
- Desktop `eventContract` 会从 notification params、item、content block 中抽取 `threadId`、`turnId`、`contentIndex`、`toolUseId`、`parentToolUseId`、`requestId`、`provider`、`model`。
- Desktop 当前已有 `ToolSnapshot`，但还没有独立 `FileSnapshot` / `AttachmentSnapshot` / `ReferenceSnapshot`。
- `DisplayEventType` 已预留 `file_change`，但当前没有正式文件事件模型和组件。

## 已有稳定字段

### 通用事件身份

| 字段 | 来源 | 稳定性 | 用途 |
| --- | --- | --- | --- |
| `threadId` | App Server notification params / item / block | 稳定 | 归属会话 |
| `turnId` | App Server notification params / item / block | 稳定 | 归属轮次 |
| `itemId` | App Server notification params | 稳定 | 展示事件主 ID |
| `contentIndex` | content block index | 稳定 | 同一 item 内定位 block |
| `toolUseId` | tool_use block id / tool_result tool_use_id | 稳定 | 合并工具调用和结果 |
| `parentToolUseId` | progress / 派生事件 | 部分稳定 | 合并工具进度到父工具卡 |
| `requestId` | provider / App Server params | 可选 | 排障 |
| `provider` / `model` | params / item | 可选 | 运行上下文展示 |

### 当前工具卡字段

| 字段 | 来源 | 稳定性 | P21 复用方式 |
| --- | --- | --- | --- |
| `name` | tool_use name | 稳定 | 判断 Read / Write / Edit / Glob / Grep / MCP 等来源 |
| `category` | Desktop `toolEvents` 归类 | 稳定 | 文件、搜索、MCP、浏览器、命令分类 |
| `input` | tool_use input | 稳定 | P21 优先从这里拿路径、pattern、glob |
| `result` | tool_result content / structured result | 部分稳定 | 有结构化结果时可用；纯文本结果只做详情，不做主字段来源 |
| `target` | `file_path` / `filePath` / `path` / `url` / `pattern` / `query` | 稳定但粗糙 | 可作为第一版路径摘要，不足以表达文件快照 |
| `command` / `cwd` / `shell` | Shell / PowerShell input | 稳定 | 只能作为命令卡字段，不直接推导文件变更 |
| `risk` / `permissionRequestId` | permission/tool policy | 稳定 | 工作区外路径和危险操作提示 |
| `errorClass` / `errorMessage` | Desktop 错误分类 | 稳定 | P24 复用，P21 只展示路径类错误 |

## 工具字段来源表

| 工具 | 输入中稳定字段 | 结果中稳定字段 | 可生成的 P21 事件 | 结论 |
| --- | --- | --- | --- | --- |
| `Read` | `file_path`、`offset`、`limit`、`pages` | `file.filePath`、`content`、`numLines`、`startLine`、`totalLines`；图片和 notebook 有独立结果类型 | `read_file`、`reference`、图片预览候选 | 可作为文件读取卡和引用卡第一来源 |
| `Write` | `file_path`、`content` | `filePath`、`content`、`structuredPatch`、`originalFile`、`gitDiff` | `generated_file`、`edited_file`、diff 预览候选 | 最适合生成文件卡，结果结构足够稳定 |
| `Edit` | `file_path`、`old_string`、`new_string`、`replace_all` | `filePath`、`oldString`、`newString`、`originalFile`、`structuredPatch`、`userModified`、`replaceAll`、`gitDiff` | `edited_file`、diff 预览候选 | 可生成编辑文件卡和 diff 入口 |
| `MultiEdit` | 当前没有独立工具文件；Desktop 已按工具名预留分类 | 取决于未来是否出现 `edits` 结构 | `edited_file` | 先作为兼容预留，不主动假设已稳定 |
| `Glob` | `pattern`、`path` | `filenames[]`、`truncated`、`durationMs` | `search_reference`、文件列表引用 | 可生成搜索引用，但不是文件变更 |
| `Grep` | `pattern`、`path`、`glob`、`output_mode`、行号/上下文参数 | `filenames[]`、`content`、`numLines`、`numMatches`、`appliedLimit`、`appliedOffset` | `search_reference`、代码行引用候选 | `content` 模式可含 `path:line:content`，后续应结构化解析 grep 结果，不从任意 stdout 猜 |
| `LS` | P21 todo 提到，但当前源码未找到独立 `LSTool` | 无 | 目录引用 | 当前缺失，Windows 目录查看主要走 `PowerShell` 或后续高层工具 |
| `PowerShell` | `command`、`description`、`timeout`、`run_in_background` | `stdout`、`stderr`、`persistedOutputPath`、`backgroundTaskId`、progress | 命令结果，非文件事件主来源 | 不从命令字符串或 stdout 硬推文件卡；只在明确结构化结果存在时再接入 |
| `Bash` | `command`、`description`、`timeout` 等 | stdout/stderr/progress | 命令结果，非 Windows 主路径 | 当前 Windows App Server 默认不优先暴露；不作为 P21 文件来源 |
| MCP 工具 | open-world input，按 server/tool 自定义 schema | 当前 `MCPTool` 基础输出是 string | MCP 引用候选 | 需要后续 MCP adapter 透出结构化资源 URI / file path 后再做正式引用 |
| 浏览器 / Playwright MCP | 取决于 MCP 工具 schema | 取决于 MCP 返回 | 网页引用、截图、媒体候选 | 暂归 P23 / MCP 专项，不在 P21-1 直接实现 |
| `TodoWrite` / `AskUserQuestion` | 控制型工具字段 | 控制结果 | 无 | 继续隐藏或专用展示，不进入文件/附件系统 |

## 字段分级

### 已有稳定字段

- 工具身份：`toolUseId`、`name`、`category`、`status`。
- 工具输入路径：`file_path`、`filePath`、`path`、`pattern`、`glob`。
- 文件写入结果：`filePath`、`structuredPatch`、`originalFile`、`gitDiff`。
- 文件读取结果：`file.filePath`、`content`、`startLine`、`totalLines`。
- 搜索结果：`filenames[]`、`content`、`numMatches`、`appliedLimit`、`appliedOffset`。

### 只能从工具输入拿到

- 目标文件路径：多数工具的 `file_path` / `path`。
- 写入内容和编辑内容：`content`、`old_string`、`new_string`。
- 搜索意图：`pattern`、`glob`、`output_mode`。
- 命令执行意图：`command`、`cwd`。

### 只能从结果拿到

- 文件是否新建或更新：`Write` 的 `type: create/update`。
- diff 结构：`structuredPatch` / `gitDiff`。
- 读文件返回的实际行数和起始行：`numLines`、`startLine`、`totalLines`。
- 搜索命中列表：`filenames[]`。

### 不应从 stdout 硬猜

- PowerShell / Bash stdout 中的文件路径。
- `File created successfully at: ...` 这类人类可读成功文本。
- `Grep content` 的任意大段文本。后续可以针对 Grep 工具结构化输出做专门 parser，但不能泛化到所有 stdout。
- MCP string result 中看起来像路径或 URL 的内容，除非 MCP adapter 明确标注资源类型。

### 当前缺口

| 缺口 | 影响 | 建议补法 |
| --- | --- | --- |
| 无独立 `FileSnapshot` | 文件卡只能借用工具卡 `target` | P21-2 定义文件展示模型 |
| 无独立 `AttachmentSnapshot` | 输入框 `+` 和上传文件没有统一状态 | P21-6 先做 UI 状态和附件列表模型 |
| 无独立 `ReferenceSnapshot` | 代码位置、搜索引用仍混在 Markdown 或工具详情里 | P21-2/P21-5 定义引用模型和复制/打开交互 |
| `DisplayEventType.file_change` 未落地 | 已预留类型但无数据结构 | P21-3 从工具结果归一化生成 |
| `LS` 高层工具缺失 | 目录展示依赖命令工具，Windows 体验不稳 | 后续工具能力治理中补高层目录工具或 PowerShell 结构化 adapter |
| MCP / 浏览器结果缺结构化资源字段 | 无法稳定生成网页引用、截图、文件引用 | MCP adapter 补 `resourceUri`、`mimeType`、`title`、`path` 等字段 |
| 工作区相对路径和安全分级未统一 | 工作区外路径风险展示不稳定 | P21-2 引入 `workspaceRelativePath`、`absolutePath`、`safety` |

## P21-2 设计建议

P21-2 已按“先补展示模型，不直接做 UI”的顺序落地：

```ts
type FileSnapshot = {
  id: string
  source: 'Read' | 'Write' | 'Edit' | 'Glob' | 'Grep' | 'MCP' | 'Browser' | 'UserUpload'
  kind: 'generated_file' | 'read_file' | 'edited_file' | 'search_result' | 'reference'
  path: string
  absolutePath?: string
  workspaceRelativePath?: string
  safety: 'workspace' | 'outside_workspace' | 'remote' | 'unknown'
  mimeType?: string
  sizeBytes?: number
  range?: { startLine?: number; startColumn?: number; endLine?: number; endColumn?: number }
  toolUseId?: string
  raw?: unknown
}
```

第一版只从稳定结构化字段生成 `FileSnapshot`，不要从普通 stdout 正则猜路径。

实际落点：

- `apps/desktop/src/renderer/src/domain/fileEvents.ts`：定义 `FileSnapshot`、`AttachmentSnapshot`、`ReferenceSnapshot`、路径安全分级和文本范围模型。
- `apps/desktop/src/renderer/src/domain/displayEvents.ts`：`DisplayEvent` 正式挂载 `fileSnapshot`、`attachmentSnapshot`、`referenceSnapshot`，并新增 `file_reference`、`attachment` 展示事件类型。
- `apps/desktop/src/renderer/src/domain/fixtures/display-events.json`：补文件变更、代码引用和附件占位样例。
- `scripts/smoke-desktop-display-events.mjs`：校验文件/附件/引用快照必须包含路径或名称、来源、类型、状态和安全分级等基础字段。

P21-3 再处理工具结果到这些快照的归一化，不在 P21-2 中把工具 stdout 或文本结果直接解析成文件事件。

## P21-3 归一化落地

P21-3 已新增 `extractFileDisplaySnapshotsFromToolSnapshot()`，归一化规则如下：

| 工具 | 归一化来源 | 生成快照 | 说明 |
| --- | --- | --- | --- |
| `Write` | `input.file_path`，其次 `result.filePath` / `result.path` | `FileSnapshot(kind: generated_file / edited_file)` | `result.type === update` 时按编辑文件处理，否则按生成文件处理 |
| `Read` | `input.file_path`，其次 `result.file.filePath` / `result.filePath` | `FileSnapshot(kind: read_file)` | `startLine + numLines` 会派生文本范围 |
| `Edit` / `MultiEdit` / `NotebookEdit` | `input.file_path`，其次结果路径字段 | `FileSnapshot(kind: edited_file)` | 只取稳定字段，diff 预览留给后续增强 |
| `Glob` | `result.filenames[0]`，其次 `input.path / input.pattern` | `ReferenceSnapshot(kind: file)` | 当前只生成引用，不代表文件变更 |
| `Grep` | `result.filenames[0]`，其次 `input.path / input.glob / input.pattern` | `ReferenceSnapshot(kind: search_match)` | 搜索命中引用，不从任意 stdout 猜路径 |

路径安全分级第一版规则：

- `http://` / `https://` 视为 `remote`。
- 相对路径视为 `workspace`。
- `..` 路径视为 `outside_workspace`。
- 绝对路径在 renderer 没有工作区根上下文时暂记为 `unknown`，后续 P21-7 由 preload / main process 做真实工作区边界判断。

重要边界：

- `PowerShell` / `Bash` 的 stdout 不参与文件快照归一化。
- MCP string result 不参与文件快照归一化，等待 MCP adapter 明确资源字段。
- 工具结果和工具调用继续合并到同一张工具卡，文件/引用快照作为同一个 `DisplayEvent` 的附加展示模型，不破坏 P20 生命周期规则。

## 验收结论

P21-1 已确认：

- 当前文件/附件/引用还没有独立展示模型。
- 工具输入和部分工具结果已经有足够稳定字段，可以支撑 P21-2 / P21-3。
- 文件写入、文件读取、搜索引用应优先从 `Read`、`Write`、`Edit`、`Glob`、`Grep` 的结构化 input/output 生成。
- PowerShell / Bash / MCP string result 暂不作为文件卡主来源，除非后续补结构化 adapter。

P21-2 已确认：

- 文件、附件、引用已有独立展示模型，可以被 `DisplayEvent` 稳定承载。
- 模型已覆盖工作区相对路径、绝对路径、来源、类型、风险/安全分级、文本范围、mime type 和工具关联 ID。
- 当前只做模型和 fixture，不提供打开文件、复制路径、上传发送等交互能力；这些进入 P21-4 到 P21-7。

P21-3 已确认：

- `Write`、`Read`、`Edit`、`MultiEdit`、`Glob`、`Grep` 已能从稳定工具字段派生文件/引用快照。
- 工具调用和工具结果合并后会重新派生快照，因此结构化结果可以补充文本范围、搜索命中和真实结果路径。
- 不从命令 stdout、MCP 文本结果或普通 assistant 文本里猜路径。

P21-4 已确认：

- `FileCard` 用于独立文件、引用和附件事件。
- `FileSnapshotPanel` 可嵌入 `ToolCard`，因此工具调用仍保持一张主卡，同时展示文件/引用详情。
- 当前按钮只做 UI 占位，不执行打开、复制、定位；真实能力必须在 P21-7 通过 preload 白名单接入。

P21-5 到 P21-8 已确认：

- 引用文本统一显示为 `path:line[:column]`，搜索引用可以展示 `excerpt`。
- 输入框 `+` 已支持附件选择占位，展示附件文件名、大小和 mime type，但暂不把附件内容发送给模型。
- `openPath`、`showItemInFolder`、`copyText` 已通过 preload 白名单暴露；路径解析、工作区外二次确认和 Electron `shell` / `clipboard` 调用都在 main process。
- display-event fixture 已覆盖文件变更、文件引用、附件占位、工具内嵌文件快照和工具内嵌引用快照。
- P21 第一版不做 diff 预览、多模态文件内容发送、MCP 资源结构化、网页/截图预览；这些分别进入后续 P22 / P23 / MCP 专项。
