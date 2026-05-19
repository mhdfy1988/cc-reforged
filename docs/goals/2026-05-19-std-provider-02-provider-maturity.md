# 2026-05-19 STD-PROVIDER-02 已接 provider 成熟化与真实使用闭环

## 背景

STD-PROVIDER-01 已经把 Kimi / GLM 拆成 `kimi-api` / `kimi-code` / `glm-api` / `glm-coding` 四个独立 provider；`kimi-api` / `glm-api` / `glm-coding` 接入公共 OpenAI Chat 兼容链路，`kimi-code` 接入 Anthropic Messages 兼容链路。

但“第一版接入”不等于“方方面面成熟可用”。当前更重要的不是继续追新 provider，而是把用户当前能实际使用的 provider 做稳：

- Codex OAuth
- DeepSeek
- MiniMax 国际版 / 国内版
- Kimi API / Kimi Code
- GLM API / GLM Coding Plan

OpenAI-compatible / Gateway、Anthropic 官方、Gemini、Structured Output 等后续项先后置，避免已接 provider 半熟。

## 成熟度定义

一个 provider 只有同时过完下面层级，才算“成熟可日常使用”：

| 层级 | 含义 |
| --- | --- |
| L0 内置登记 | 有 provider definition、默认配置、模型目录 |
| L1 配置档案 | Desktop / CLI / App Server 能创建和切换 Profile，凭据按 profileId 隔离 |
| L2 协议 smoke | mock smoke 覆盖文本、stream、tools、tool result 历史、usage |
| L3 普通会话 | 能从普通 turn/session 事件流跑通，不只停在 provider 单测 |
| L4 Desktop 可见 | 模型页、聊天区、错误卡、输出块都走标准展示协议 |
| L5 错误治理 | auth、rate limit、quota、network、protocol、unknown 能进入 ErrorSnapshot |
| L6 真实 probe | 有真实 API Key 时能跑脱敏联网 probe，并记录结果；没有 key 时明确标未验证 |
| L7 文档总账 | provider 文档和协议总账标明已完成、未验证、边界和下一步 |

## 当前初判

| Provider | 当前判断 |
| --- | --- |
| `codex-oauth` | 已可用；Codex hosted `image_generation` 图片生成第一版 mock 已过，但还需要补真实会话回归、OAuth 失效场景和真实图片生成 probe |
| `deepseek` | 第一版较稳，已有 OpenAI Chat adapter、thinking、tools、stream、mock smoke；仍需真实 probe 记录和 Desktop 日常路径复查 |
| `minimax` / `minimax-cn` | 文本和图片生成第一版已接；仍需真实工具调用边界、图片真实 probe、错误治理和模型页体验复查 |
| `kimi-api` / `kimi-code` | 第一版刚接入，当前只有 mock smoke；`kimi-code` 已从错误的 OpenAI Chat 兼容路径改到 Anthropic Messages `/v1/messages`；必须补真实 probe、Desktop 配置路径和普通会话 E2E |
| `glm-api` / `glm-coding` | 第一版刚接入，当前只有 mock smoke；必须补真实 probe、Desktop 配置路径和普通会话 E2E |

## 多模态能力初判

这里分两层记录，避免“官方支持”和“CCR 已经完整发送闭环”混成一件事：

- 官方能力：来自供应商文档或模型页，说明模型理论上支持哪些输入/输出。
- CCR 已接能力：已经进入 `modelCatalog.ts`、能力校验、provider adapter 和 smoke 的能力。

| Provider / 模型 | 官方多模态能力 | CCR 当前处理 | 下一步 |
| --- | --- | --- | --- |
| `codex-oauth` / `gpt-5.5` | OpenAI 模型页声明文本/图片输入；Codex 后端通过 hosted `image_generation` 工具生成图片 | 已接文本+图片输入；本地图片在 provider 边界转 base64，不进历史 payload；文本生图输出 mock 已过，走 `/codex/responses` + `tools: image_generation` | 补真实会话回归、真实图片生成 probe 和 OAuth 失效场景；暂不声明视频/文件 |
| `codex-oauth` / `gpt-5.4`、`gpt-5.4-mini` | 当前不作为多模态模型使用 | 目录仍按文本模型处理 | 如果未来打开图片能力，必须先补 probe |
| `deepseek` / `deepseek-v4-flash`、`deepseek-v4-pro` | 当前官方 API 文档未给这两个模型的图片/视频输入承诺 | 目录仍按文本模型处理 | 不启用多模态；只补文本/工具/错误成熟化 |
| `minimax` / `MiniMax-M2.7`、`MiniMax-M2.7-highspeed` | 官方 M2.7 是文本模型线；图片生成是独立 image_generation API | 文本模型按文本输入；`image-01` / `image-01-live` 已接文本生图输出 | 后续单开图生图 / 图片编辑，不把文本模型误标成图片输入 |
| `kimi-api` / `kimi-k2.6` | 官方 Chat Completions 支持文本、图片、视频输入 | 已把 `kimi-k2.6` 目录声明为文本+图片+视频；OpenAI Chat compatible adapter 已支持 `image_url` / `video_url` | 补真实 probe：图片、视频、工具历史、错误分类 |
| `kimi-code` / `kimi-for-coding` | Coding 平台是统一模型标识，不等同于具体多模态模型 | 第一版继续按文本输入处理 | 只在官方明确 Coding API 多模态边界后再打开 |
| `glm-api` / `glm-5.1` | 当前作为文本/推理主模型使用 | 目录仍按文本输入处理 | 保持日常 coding/chat 主线稳定 |
| `glm-api` / `glm-5v-turbo` | 官方 GLM-5V-Turbo 支持图像、视频、文件、文本输入 | 已新增模型目录，CCR 当前打开文本+图片+视频；文件输入先标记 pending | 补真实 probe；文件输入需要单独设计 URL / 上传 / 本地文件策略 |
| `glm-api` / `glm-image` | 官方 GLM-Image 图像生成模型 | 已新增模型目录，CCR 当前按文本生图输出处理，走 `/images/generations` | 补真实 probe；尺寸、风格、失败分类后续继续细化 |
| `glm-coding` / `glm-5.1` | Coding Plan 专用端点，不直接等同通用多模态模型 | 第一版继续按文本输入处理 | 只在官方 Coding Plan 明确模型和多模态边界后再打开 |

GLM 第一版正式版模型组按下面口径展示：

```text
glm-api:
  glm-5.1
    => 最新文本 / 推理主模型，text-only
  glm-5v-turbo
    => 多模态输入模型，text + image + video，file 先 pending
  glm-image
    => 图片生成模型，text -> image

glm-coding:
  glm-5.1
    => Coding Plan 文本主模型，text-only
```

本轮结论：正式版多模态方向要拆成三个子线，不要混在一个“支持多模态”标签里：

1. 用户输入多模态：文本 / 图片 / 视频 / 文件 / 音频进入模型。
2. 生成型多模态输出：图片 / 音频 / 视频 / 文件由模型生成并落盘。
3. Provider 能力成熟化：每个模型的官方能力、CCR 已接能力、真实 probe 状态必须分开记录。

## 第一版任务

1. 成熟度矩阵落地：
   - 在协议总账或独立文档中列出每个 provider 的 L0-L7 状态。
   - 明确“已完成 / mock 已过 / 真实未验证 / 缺 API Key / 不支持”的区别。
   - 增加多模态能力列，区分官方能力、CCR 已接能力和真实 probe 状态。
2. 真实 probe 脚本设计：
   - probe 不进默认 smoke。
   - 输入 API Key 后按 provider/profile 跑文本、stream、tool、错误分类最小检查。
   - 输出必须脱敏，只记录 endpoint、model、能力、状态码、错误分类。
3. 普通会话 E2E：
   - 不只测 provider class。
   - 至少用 mock 或真实 key 验证 turn/session 事件流、Desktop display event、history resume。
4. Desktop 配置体验复查：
   - 模型页能清楚区分 Codex OAuth、DeepSeek、MiniMax、Kimi API、Kimi Code、GLM API、GLM Coding。
   - Kimi Code / GLM Coding 这类订阅权益入口必须显示场景边界，不和通用 API 混用。
5. 文档收口：
   - 更新 provider 接入文档、协议总账、todo。
   - 每个 provider 标明真实联网验证状态。

## 后续方向记录

Provider 能力工具化已经记录为后续方向，但不进入 `STD-PROVIDER-02` 第一版实施范围。

方向说明见：[Provider 能力工具化后续方向](../architecture/provider-capability-tools-future.md)。

当前只保留设计口径：

1. 第一阶段默认同供应商内部调用，例如 `glm-api / glm-5.1` 通过受控工具调用 `glm-api / glm-5v-turbo` 做视觉理解，调用 `glm-api / glm-image` 做图片生成。
2. 第二阶段再做显式跨供应商能力路由，例如主模型用 DeepSeek，视觉工具用 Kimi，图片生成用 GLM 或 MiniMax。
3. 跨供应商必须由用户或 Profile 明确配置，不能静默自动选择。
4. Desktop、日志、历史恢复和错误快照必须记录实际调用的 provider/model。
5. 当前发布主线仍优先完成已接 provider 成熟化、真实 probe、普通会话 E2E、Desktop 展示和错误治理。

## 非目标

- 不新增 OpenAI-compatible / Gateway profile。
- 不新增 Anthropic 官方真实 provider。
- 不新增 Gemini adapter。
- 不做 Structured Output 产品化。
- 不做音频 / 文件 / 视频生成。
- 不实现 Provider 能力工具化；该方向只做文档沉淀，后续等主线稳定后再开独立 goal。

## 验收命令

默认回归：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime
npm.cmd run smoke:provider-output-fixtures
npm.cmd run smoke:desktop-display-events
git diff --check
```

按需 probe：

```powershell
# 后续新增，真实联网，不进入默认 smoke
npm.cmd run probe:provider -- <profileId>
```

## 当前状态

- 阶段已进入成熟度收口：总表已落到 [协议实现状态总账](../architecture/protocol-implementation-status.md#41-当前正式版目标-provider-成熟度矩阵)。
- 当前结论：Codex OAuth、DeepSeek、MiniMax、Kimi、GLM 还没有全部达到“成熟可日常使用”；但本机已有 key 的 `deepseek-1`、`minimax-cn-1`、`kimi-api-1`、`glm-api-1` 已完成文本 / stream 真实 probe。
- 真实 probe 入口已落地：`npm.cmd run probe:provider`，设计见 [CCR Provider 真实 Probe 设计与入口](../architecture/provider-real-probe-design.md)。
- 下一步继续补 tool、多模态、图片生成、Desktop 展示、历史恢复和错误快照状态；`kimi-code` 当前本机缺少 `kimi-code-*` Profile / 凭据，需要用户重新保存连接配置后再跑真实 probe。
