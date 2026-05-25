# CCR Desktop 消息头像分类设计

## 目标

把聊天时间线左侧头像从统一的 `i` / `我`，升级为基于消息分类和工具分类的稳定视觉语言。用户扫一眼头像就能区分：用户、模型、系统提示、工具、文件、网页、权限、错误、压缩恢复等事件。

第一版目标是覆盖当前 `DisplayEvent.type` 与 `toolSnapshot.category` 中所有已定义分类，并为未知类型保留兜底头像，避免后续新增协议字段时出现空白或误导。

## 设计草图

```text
普通会话

[我]  请运行 PowerShell 命令 Get-Location。
[K]   我将只运行这个命令。
[终端] PowerShell 命令        运行命令：Get-Location        失败
[盾牌] 用户拒绝了 PowerShell 命令执行。
[归档] 上下文已压缩                                      完成

网页与搜索

[搜索] 网页搜索              query=鱼缸硝化系统建立方法   执行中
[网页] 网页抓取              https://example.com           成功

文件与附件

[文件] 读取文件              src/main.ts                   成功
[编辑] 修改文件              README.md                     成功
[附件] 用户上传              screenshot.png                已附加

模型与 Agent

[K]   Kimi Code 回复内容
[C]   Codex 回复内容
[代理] 子任务执行            修复测试                      执行中
```

## 判定顺序

头像解析应集中在一个函数里，例如 `resolveMessageAvatar(event, runtime)`，不要把头像逻辑散落在各个卡片组件。

推荐顺序：

1. 如果 `event.type === 'assistant_message'`，优先使用当前模型或 Provider 头像。
2. 如果 `event.type` 是工具类，优先看 `event.toolSnapshot.category`。
3. 如果是文件、附件、引用类事件，优先看对应 snapshot 的 kind/source。
4. 如果是 `system_notice`，再看 `compactSnapshot`、`sourceKind`、文本语义等细分。
5. 如果是错误或失败状态，允许使用错误态覆盖基础头像。
6. 兜底到未知头像。

输出结构建议：

```ts
type MessageAvatarDescriptor = {
  icon: AvatarIcon
  label: string
  tone: AvatarTone
  title: string
}
```

其中 `label` 用于无图标兜底或首字母头像，`title` 用于 hover 提示。

## 消息类型映射

| 消息类型 | 头像 | 色调 | 说明 |
|---|---|---|---|
| `user_message` | `我` / `UserRound` | user | 用户消息，保留当前暖橙识别 |
| `assistant_message` | 模型头像 / Provider 首字母 | assistant | Kimi 显示 `K`，Codex 显示 `C`，未知模型用 `Bot` |
| `thinking_summary` | `Brain` | thinking | 思考摘要，低对比展示 |
| `tool_call` | 按工具分类映射 | tool | 工具调用卡 |
| `tool_result` | 按工具分类映射 | tool | 孤立工具结果或结果卡 |
| `permission_request` | `ShieldQuestion` / `KeyRound` | permission | 权限请求 |
| `todo_list` | `ListTodo` | control | 任务列表，通常隐藏在 overlay，但进时间线时也要有头像 |
| `file_change` | `FilePenLine` | file | 文件变更 |
| `file_reference` | `FileSearch` / `Link` | file | 文件引用、搜索命中、URL 引用 |
| `attachment` | `Paperclip` / `Image` | file | 附件；图片附件可用图片图标 |
| `error` | `TriangleAlert` | danger | 错误卡 |
| `system_notice` | `Info` | system | 普通系统提示 |
| 未知 `DisplayEvent.type` | `CircleHelp` | muted | 未识别消息类型兜底 |

## 系统提示细分

| 条件 | 头像 | 色调 | 说明 |
|---|---|---|---|
| `event.compactSnapshot` 存在 | `ArchiveRestore` | compact | 上下文压缩、恢复、归档类提示 |
| `sourceKind === 'context_compaction'` | `ArchiveRestore` | compact | 压缩运行中或完成 |
| `sourceKind` 包含 `session` / 文本包含“恢复历史会话” | `History` | compact | 历史恢复提示 |
| 普通 `system_notice` | `Info` | system | 信息提示 |

## 工具分类映射

| `toolSnapshot.category` | 头像 | 色调 | 说明 |
|---|---|---|---|
| `shell` | `SquareTerminal` | shell | PowerShell、Bash、CMD |
| `file` | 按文件操作细分 | file | Read、Write、Edit、Glob、Grep |
| `mcp` | `PlugZap` | mcp | MCP 工具调用 |
| `browser` | `MousePointerClick` | web | 浏览器自动化 |
| `search` | `Search` | search | 网页搜索、通用搜索 |
| `web` | `Globe2` | web | 网页抓取、URL 访问 |
| `agent` | `Bot` / 模型头像 | agent | 子 Agent / Task |
| `media` | `Image` | media | 图片生成、多媒体输出 |
| `internal` | `Cog` | muted | 内部工具，通常弱化或隐藏 |
| `control` | `SlidersHorizontal` / `Shield` | control | TodoWrite、AskUserQuestion、模式切换 |
| `unknown` | `CircleHelp` | muted | 未识别工具兜底 |

## 文件工具细分

如果 `event.fileToolSnapshot.operation` 存在，优先覆盖 `category=file` 的通用头像。

| 文件操作 | 头像 | 说明 |
|---|---|---|
| `read` | `FileText` | 读取文件 |
| `write` | `FilePlus2` | 写入新文件或生成文件 |
| `edit` | `FilePenLine` | 修改文件 |
| `delete` | `Trash2` | 删除文件 |
| `search` | `FileSearch` | Glob、Grep、文件搜索 |
| `notebook_edit` | `NotebookPen` | Notebook 编辑 |
| `unknown` | `FileQuestion` | 未识别文件操作 |

## 状态覆盖

头像的基础形状由类型决定，状态只改变色调或角标，避免同一种事件在时间线中频繁变脸。

| 状态 | 视觉处理 |
|---|---|
| `running` / `streaming` / `pending` | 保持基础头像，加轻微动效或小圆点 |
| `waiting_permission` | 基础头像旁加权限角标，或使用权限色调 |
| `completed` | 基础头像，成功色不必过强 |
| `failed` / `denied` / `interrupted` / `cancelled` / `timeout` | 基础头像转 danger 色调，必要时角标 `!` |

## 模型头像策略

助手消息优先体现“当前谁在说话”，不再固定显示 `C`。

第一版：

| 来源 | 头像 |
|---|---|
| 当前模型名包含 `kimi` | `K` |
| 当前模型名包含 `codex` | `C` |
| 当前模型名包含 `gpt` / `openai` | `O` 或 `Sparkles` |
| 当前模型名包含 `claude` | `A` 或 `Bot` |
| 当前模型名包含 `glm` | `G` |
| 未知模型 | `Bot` |

后续增强：

- 引入 Provider logo 或本地 SVG 图标。
- 允许用户在设置中选择“模型首字母 / Provider 图标 / 统一助手图标”。
- 在头像 hover 中显示当前 provider、model、连接状态。

## 兜底规则

必须覆盖未来未知分类：

1. 未知 `DisplayEvent.type`：`CircleHelp`，标题 `未知消息类型：${event.type}`。
2. 未知 `toolSnapshot.category`：`CircleHelp`，标题 `未知工具分类：${category}`。
3. 缺少 `toolSnapshot` 的工具事件：`Wrench`，标题 `工具事件`。
4. 缺少模型信息的助手消息：`Bot`，标题 `助手`。
5. 失败状态但没有错误分类：保留基础头像，danger 色调，标题补 `执行失败`。

## 实现落点

建议新增：

- `apps/desktop/src/renderer/src/domain/avatarEvents.ts`
  - `resolveMessageAvatar(event, runtime)`
  - `resolveToolAvatar(snapshot, event)`
  - `resolveAssistantAvatar(runtime)`
- `apps/desktop/src/renderer/src/components/chat/MessageAvatar.tsx`
  - 统一渲染头像、label、lucide icon、tone class。

建议改造：

- `MessageFrame`：不再要求每个调用方传固定 `label`，改传 `event` 后内部解析头像。
- `UserMessage`、`AssistantMessage`、`SystemNoticeCard`、`ToolCard`、`ErrorCard`、`FileCard`：统一使用 `MessageAvatar`。
- `styles/chat.css` 或 `styles/cards.css`：增加 `.message-avatar` 与 `.message-avatar-tone-*`。

## 验收清单

- 用户消息仍显示清晰的 `我`。
- 助手消息按当前模型显示头像，Kimi 至少显示 `K`。
- PowerShell/Bash/CMD 显示终端头像，不再显示通用 `i`。
- 网页搜索、浏览器、文件、MCP、Agent、媒体、权限、错误都有不同头像。
- 未知类型不崩溃，显示 `?` 兜底。
- 历史恢复和实时事件使用同一套头像解析，不出现恢复后头像变回 `i`。
- failed 状态能改变色调或角标，但不破坏基础分类识别。
