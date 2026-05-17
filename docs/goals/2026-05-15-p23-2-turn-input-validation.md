# Goal: P23-2 App Server 多模态输入协议与发送前校验

## 目标

让 App Server 的 `turn/start` 能接收统一的多模态输入结构，并在创建 turn 之前基于当前 `modelCapabilities` 做发送前校验。

第一版目标不是把图片或文件真正发进 provider，而是先把协议入口、归一化结果和阻止规则定住，保证“不支持的附件不会创建 turn，也不会被静默丢弃”。

## 为什么先做这个

P23-1 已经能回答当前模型支持哪些输入和输出能力。下一步必须把这个能力接到 `turn/start`，否则 Desktop 后续即使有附件草稿，也没有稳定协议把“用户想发送的内容”交给 App Server。

如果先做 Desktop 上传 UI，容易出现三个问题：

- 前端看起来能选文件，但 App Server 仍然只认 `text`。
- 不支持图片的模型仍然创建 turn，错误滞后到 provider 请求阶段。
- Core 和 Desktop 对附件字段各自猜一套，后续历史恢复会很难收敛。

## 第一版范围

1. 扩展 `TurnStartParamsSchema`，支持旧 `input.type = "text"` 和新 `input.type = "content"`。
2. 新增最小内容块结构：
   - `text`
   - `image`
   - `file`
   - `audio`
3. 新协议必须保留旧纯文本客户端兼容。
4. App Server handler 在调用 Core 之前完成输入归一化和能力校验。
5. 当前模型不支持对应模态时，返回稳定 JSON-RPC 错误，不创建 turn。
6. 先把 Core 入口仍然降级为文本执行；多模态内容真正进入 Core user message 留给 MM-03。
7. 增加 smoke，覆盖旧文本、新文本内容块、图片被阻止、Profile 覆盖图片允许但暂不传入 Core、未知模型默认阻止图片。

## 明确不做

- 不做 Desktop 附件草稿 UI。
- 不做 main/preload 文件读取。
- 不做图片 base64 或本地文件内容读取。
- 不做 Core user message 内容块持久化。
- 不做 provider adapter 图片映射。
- 不做图片真实模型请求。
- 不做历史附件展示。

这些留给 MM-03 到 MM-08。

## 输入结构草案

旧协议继续有效：

```json
{
  "threadId": "thread-1",
  "input": {
    "type": "text",
    "text": "你好"
  }
}
```

新协议：

```json
{
  "threadId": "thread-1",
  "input": {
    "type": "content",
    "content": [
      {
        "type": "text",
        "text": "帮我看这张图"
      },
      {
        "type": "image",
        "attachmentId": "att-1",
        "mimeType": "image/png",
        "sizeBytes": 120000,
        "source": {
          "kind": "file",
          "path": "D:\\work\\a.png"
        }
      }
    ]
  }
}
```

第一版只允许 metadata 和受控引用进入协议，不读取本地文件内容，不把 base64 写进普通日志。

## 校验规则

1. `text` 内容块要求非空文本。
2. `image` 内容块要求当前能力包含 `image` 输入。
3. `file` 内容块要求当前能力包含 `file` 输入。
4. `audio` 内容块要求当前能力包含 `audio` 输入。
5. 如果图片声明了 `mimeType`，且能力里有 `image.mimeTypes`，必须匹配。
6. 如果图片声明了 `sizeBytes`，且能力里有 `image.maxImageBytes`，不能超限。
7. 不支持时抛 `CoreError('invalid_params', ...)`，错误详情包含 `unsupportedModalities`、`modelCapabilities.source`、`provider`、`model`、`profileId`。
8. 归一化后如果没有任何文本内容，第一版可以用附件摘要生成一个保守文本 fallback，但必须在 metadata 里标记 `multimodalInput.deferred = true`。

## 二次验证迭代

实现后必须二次验证：

- 旧 `input.type = "text"` 仍能通过。
- 新 `input.type = "content"` 纯文本能通过。
- 默认文本模型遇到图片会在创建 turn 前失败。
- Profile 覆盖声明图片能力后，图片输入能通过 App Server 校验，但 Core 执行仍以文本 fallback 运行。
- 未知模型默认纯文本，因此图片输入被阻止。

如果验证发现 `TurnStartParams` 表达不了后续 Desktop 附件字段，先更新 goal 和设计文档，再继续实现。

## 验收标准

- `TurnStartParamsSchema` 同时支持旧文本和新内容块协议。
- App Server 创建 turn 前已经完成能力校验。
- 不支持的图片/文件/音频不会创建 turn。
- 旧文本链路不回归。
- 新增 smoke 能离线验证上述场景。
- `docs/stages/multimodal-input-output-todo.md` 当前指针更新到 MM-03。

## 完成记录

已完成：

- `turn/start` 支持旧 `input.type = "text"` 和新 `input.type = "content"`。
- 已新增 `text`、`image`、`file`、`audio` 内容块 schema 和受控 `source` 引用结构。
- 已新增 App Server 输入归一化层，创建 turn 前根据当前 `modelCapabilities` 校验模态、图片 mime type、图片大小和图片数量。
- 不支持的多模态输入返回 `invalid_params`，错误详情包含 provider、profileId、model、拒绝块和能力摘要。
- 当前阶段 Core 仍接收文本 fallback，并在 turn metadata 里标记 `multimodalInput`，等待 MM-03 接入真实内容块。
- 已新增 `smoke:turn-input` 覆盖旧文本、新 content 文本、默认文本模型阻止图片、Profile 覆盖允许图片、未知模型默认阻止图片。

验证通过：

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run smoke:turn-input`
- `npm.cmd run smoke:model-capabilities`
- `npm.cmd run smoke:llm-config`
- `npm.cmd run smoke:llm-runtime-status`
- `npm.cmd run smoke:app-server`
- `npm.cmd run desktop:build`
- `git diff --check`

已知情况：

- `npm.cmd run typecheck:desktop` 仍失败在既有 `MACRO`、Bun、可选原生依赖类型缺失等全仓历史问题，不是本阶段新增改动引入。

下一步：

- 进入 MM-03：Core user message 内容块归一化。

## 建议验证命令

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:turn-input
npm.cmd run smoke:model-capabilities
git diff --check
```

如果 `typecheck:desktop` 仍失败在既有 `MACRO` / Bun / 可选原生依赖问题，本阶段总结里记录，不把它当作本轮新增失败。
