# 历史会话恢复结构化索引（2026-05-18）

## 1. 文档目标

这份索引用来承接两段已经接近上下文上限的历史会话，避免后续继续开发时遗漏用户要求、阶段决策和已发现问题。

来源会话：

| 会话 ID | 本地记录 | 覆盖范围 | 恢复状态 |
| --- | --- | --- | --- |
| `019e064d-a23d-7c32-8380-3c76c93324cc` | `C:\Users\luoji\.codex\sessions\2026\05\08\rollout-2026-05-08T14-36-51-019e064d-a23d-7c32-8380-3c76c93324cc.jsonl` | 0.4.5/0.4.6/0.4.7、Desktop 布局、供应商接入、项目 settings、多模态前置讨论 | 已抽取主线，截图细节需按文档/代码复核 |
| `019e2564-9006-7ae2-b24e-f7722cc468b2` | `C:\Users\luoji\.codex\sessions\2026\05\14\rollout-2026-05-14T15-30-08-019e2564-9006-7ae2-b24e-f7722cc468b2.jsonl` | 历史会话、工具展示、多模态、协议标准化、Provider 协议盘点、`STD-DISPLAY-01` | 已抽取主线，最后断点已提交 |

## 2. 恢复结论

| 结论 | 状态 | 后续动作 |
| --- | --- | --- |
| 当前主线不是继续扩新 provider，而是先补协议标准层 | 已确认 | 按 `STD-HISTORY-01 -> P24 ErrorSnapshot -> STD-DISPLAY-02` 继续 |
| `STD-DISPLAY-01 CcrContentBlock` 已完成并推送 | 已完成 | 后续不要重复做内容块类型，只在需要时扩展标准字段 |
| 历史会话里的截图只能恢复引用和部分上下文，不能完全恢复图上所有标注 | 风险存在 | 后续遇到相关视觉问题时，用当前代码和真机复测确认 |
| 被中断的 turn 可能有部分工具动作但无最终总结 | 风险存在 | 以 git diff、commit、todo 文档为准，不以半截回复为准 |

## 3. 已完成事项

| 编号 | 用户要求 / 问题 | 恢复判断 | 证据 / 落点 |
| --- | --- | --- | --- |
| DONE-01 | 打包版白屏，需要修复启动显示时机 | 已完成 | `v0.4.5`，窗口改为 renderer 加载完成后显示 |
| DONE-02 | 桌面端品牌、图标、启动页统一到 CCR | 已完成 | `v0.4.6` / `v0.4.7`，图标源统一、安装包图标修复 |
| DONE-03 | 前端页面减少冗余描述，标题下不要习惯性加说明 | 已沉淀 | 全局规则已加入“只保留必要内容，减少冗余、重复和解释性文本” |
| DONE-04 | Codex OAuth、DeepSeek、MiniMax 接入过程要形成文档 | 已完成 | `docs/architecture/provider-integrations/` 下已有 `codex-oauth.md`、`deepseek.md`、`minimax.md` |
| DONE-05 | P23 多模态输入、附件预览、发送和历史展示第一版 | 已完成 | `docs/stages/app-server-todo.md` 标记 P23 已完成 |
| DONE-06 | DeepSeek / OpenAI-compatible 中断后悬空工具结果导致会话不可用 | 已完成第一版 | `STD-TOOL-01`、`STD-TOOL-02` 已完成，已有 provider tool profile 和工具结果修复 |
| DONE-07 | 多模型协议不能以某一家为标准，要形成 CCR 自己的标准协议 | 已完成 | `docs/architecture/ccr-standard-llm-protocol.md` |
| DONE-08 | 所有需要对接的 provider 协议要先盘点并对照官方文档 | 已完成 | `docs/architecture/provider-protocol-inventory-and-official-docs.md` |
| DONE-09 | 调整后续计划，先做标准层稳定化 | 已完成 | `5fa4ca0 docs: reprioritize standard protocol work` |
| DONE-10 | `STD-DISPLAY-01 CcrContentBlock` 共享类型 | 已完成 | `6e5ba78 feat: add ccr content block standard` |

## 4. 已登记但未完成事项

| 编号 | 用户要求 / 问题 | 当前落点 | 下一步 |
| --- | --- | --- | --- |
| TODO-01 | 发送给 provider 前需要历史校验，避免中断、工具缺失、不同 provider 历史格式导致会话再次坏掉 | `STD-HISTORY-01 History Validator` | 当前最高优先级 |
| TODO-02 | 错误不能都显示成一段红框或误判为 path not found，要区分 provider、工具、参数、限流、认证、拒答、安全拦截 | `P24 ErrorSnapshot` | `STD-HISTORY-01` 后继续 |
| TODO-03 | Provider 输出和历史恢复要有固定 fixture / smoke，不靠真机临时试 | `STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke` | P24 前后都可补，但不应晚于继续扩 provider |
| TODO-04 | 生成型多模态输出、音频、视频、文件 API 等能力需要设计 | `STD-OUTPUT-03` / 协议盘点文档 P2 | 标准层稳定后再做 |
| TODO-05 | Gateway / OpenRouter / Vercel AI Gateway 不能只靠模型名猜能力 | Provider 协议盘点文档和 tool profile | 后续补 profile 覆盖和 probe 记录 |
| TODO-06 | Gemini adapter 需要先按标准协议处理 `functionCall/functionResponse`、thinking、文件输入等规则 | Provider 协议盘点文档 | `STD-HISTORY-01` 要预留 Gemini 历史规则 |
| TODO-07 | 历史会话中用户消息、附件、图片恢复不能丢 | `desktop-session-history-todo.md`、P23 历史恢复、`STD-HISTORY-01` | 后续验证历史恢复 UI 和 transcript 映射 |

## 5. 已放弃或暂缓事项

| 编号 | 用户要求 / 问题 | 状态 | 说明 |
| --- | --- | --- | --- |
| HOLD-01 | 长说明文字为什么不省略 / 是否要折叠 | 暂缓 | 用户已明确“算了，不管这个长说明的问题了，以后出问题再说” |
| HOLD-02 | 旧截图里某些纯视觉间距、线条、滚动细节 | 暂缓复核 | 部分问题已在布局和滚动专项里处理，但历史截图无法完整还原全部标注；再次出现时按真机截图处理 |
| HOLD-03 | npm publish | 暂缓 | 当时 0.4.5 npm 发布卡在 2FA，后续桌面版本明确跳过 npm publish |

## 6. 需要确认的遗留点

| 编号 | 遗留点 | 为什么需要确认 | 建议处理 |
| --- | --- | --- | --- |
| CHECK-01 | “读取失败后是否分析失败原因并换方式读取” | 历史会话里有提问，但没有稳定落成实现项 | 放入 `P24 ErrorSnapshot` 的错误恢复动作设计 |
| CHECK-02 | `No response requested` 在历史恢复后如何展示 | 历史截图无法完整恢复，且涉及中断状态、恢复状态和显示策略 | 在 `STD-HISTORY-01` 或 `STD-DISPLAY-02` 中补 fixture |
| CHECK-03 | 中断后仍显示“执行中” | 已经修过一部分，但历史恢复场景仍需要确认 | `STD-HISTORY-01` 要把中断态转成明确终态或恢复态 |
| CHECK-04 | TodoWrite 在不同模型下输出结构是否一致 | 已通过 provider tool profile 做第一版统一，但展示 fixture 还不够完整 | `STD-DISPLAY-02` 补 DeepSeek / OpenAI-compatible / Anthropic fixture |
| CHECK-05 | 每家模型支持什么能力在哪里定义 | 已有 provider profile 和协议盘点，但真实 UI / 配置可见性还需后续验证 | 后续做 provider profile 页面或 probe 结果展示 |

## 7. 当前继续顺序

| 顺序 | 任务 | 目标 | 不变式 |
| --- | --- | --- | --- |
| 1 | `STD-HISTORY-01 History Validator` | 发送给 provider 前扫描、修复或阻断非法历史 | 不让中断、缺工具结果、provider 方言差异把会话打死 |
| 2 | `P24 ErrorSnapshot` | 统一错误分类、限流、认证、拒答、安全拦截和可恢复动作 | 错误卡不能靠字符串猜，也不能误导成 path not found |
| 3 | `STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke` | 固定各 provider 输出样例和历史恢复样例 | 后续接 provider 先跑样例，不靠真机瞎试 |
| 4 | `STD-OUTPUT-03` 和新 provider | 继续 Gemini、Gateway、生成型多模态输出等能力 | 不能绕过 CCR 标准协议和 provider profile |

## 8. 后续使用规则

1. 每次从历史会话接续时，先看本文件和 `docs/stages/app-server-todo.md` 当前指针。
2. 如果发现历史里有新要求但本文件没有登记，先补本文件，再继续实现。
3. 如果某项已经进入 `app-server-todo.md`，这里保留索引，不复制长实现方案。
4. 如果某项只是截图视觉细节，必须用当前真机页面复测后再定结论。
5. 如果某项涉及 provider 官方协议，先更新 `provider-protocol-inventory-and-official-docs.md`，再改 adapter 或 UI。
