# ESM require 专项排查与修复方案

扫描日期：2026-04-25

## 1. 当前结论

CCR 当前包形态是 Node ESM：

- `package.json` 设置了 `"type": "module"`
- `tsconfig.base.json` 使用 `module: "ESNext"` 与 `moduleResolution: "Bundler"`
- CLI 通过 `node --experimental-loader ./bun-bundle-loader.mjs ./cli.js` 运行

所以源码里从 sourcemap 恢复出来的裸 `require(...)` 不能继续依赖全局 `require`。一旦对应路径在 Node ESM 里执行，就会出现：

```text
Error: require is not defined
```

本次扫描 `src/**/*.ts` 与 `src/**/*.tsx` 的结果：

- 含实际 `require(...)` 的文件：98 个
- 实际 `require(...)` 调用：264 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：92 个
- 未保护的 `require(...)` 调用：230 处

这不是一个单点 bug，而是一类“原始 Bun / 内部打包环境懒加载写法迁移到 Node ESM 后失配”的问题。

## 2. 不能一刀切改成静态 import

这些 `require(...)` 的来源不完全一样，不能统一粗暴改成顶部静态 `import`。

主要原因：

- 有些是为了保留 feature flag 的死代码消除语义，例如 `KAIROS`、`WORKFLOW_SCRIPTS`、`VOICE_MODE`、`TEAMMEM`。
- 有些是为了避免启动阶段加载重依赖，例如 `undici`、`highlight.js`、`yaml`、`proper-lockfile`。
- 有些是为了避免循环依赖，例如 `WorktreeExitDialog.tsx -> sessionStorage.ts`、`messages.ts -> teammateMailbox.ts`。
- 有些是平台或运行时专属依赖，例如 `modifiers-napi`、`bun:ffi`、`@ant/computer-use-*`。
- 有些 `require('src/...')` 依赖的是打包器别名，不适合用 `createRequire`，更适合改成动态 `import(...)` 或相对路径。

因此正确修复目标不是“所有 require 都换 import”，而是“每个 require 根据调用场景换成合适的 ESM 兼容懒加载方式”。

## 3. 修复方式决策表

当前阶段已经明确以 Node 24 作为 CCR 的运行时边界。Node 24 下最理想的修复方向是：项目主代码尽量走纯 ESM，只在模块系统边界保留兼容桥。也就是说，内部模块优先使用静态 `import` 或动态 `import(...)`；`createRequire(import.meta.url)` 主要用于 CommonJS 包、原生插件、资源边界，或当前还不能重构的同步懒加载点。

不要通过全局注入 `require` 来“兜底”。那种做法虽然能短期压住报错，但会掩盖每个加载点的真实语义，也容易让路径解析、缓存行为、loader 行为继续混乱。

| 场景 | 推荐方式 | 原因 |
| --- | --- | --- |
| Node 内置模块，不需要懒加载 | 静态 `import ... from 'node:xxx'` | 最清晰、最符合 ESM，避免继续制造 CommonJS 边界 |
| Node 内置模块，且有明确懒加载理由 | `await import('node:xxx')` 或 `createRequire(import.meta.url)` | 优先动态 import；如果调用点必须保持同步，再用 `createRequire` |
| CJS 包或重依赖包 | `createRequire(import.meta.url)` | 保留同步 API 与 CJS module shape，例如 `undici`、`yaml`、`highlight.js`、`proper-lockfile` |
| 当前函数本身已经是 async | `await import(...)` | 不需要制造同步 require，且更符合 ESM |
| 项目内部模块，无循环依赖且不需要懒加载 | 静态 `import` | 长期最优，类型、依赖图、打包分析都最稳定 |
| 项目内部模块，需要懒加载 | `await import(...)` | 保留懒加载，同时不依赖 CommonJS |
| `require('src/...')` 这种路径别名 | 优先 `await import('src/...')`，或改成相对 ESM import | `createRequire` 不走当前 ESM loader 的 `src/*` 解析逻辑 |
| 为了打破循环依赖的内部模块 | 短期 `createRequire(import.meta.url)`；长期拆纯函数或改成 async 边界 | 不能直接静态 import，否则可能重新引入循环依赖 |
| feature flag 顶层条件加载 | 短期 `createRequire(import.meta.url)`；长期抽成 registry/lazy factory | 保留当前同步命令注册模型，减少一次性大改 |
| 文本资源 `.txt` | `readFile(new URL(..., import.meta.url), 'utf8')` 并确保资源进入 dist | Node 默认不能 require 文本资源 |
| Bun 专属模块，例如 `bun:ffi` | 保持 Bun 分支保护，Node 分支显式不可用或跳过 | Node 运行时不应尝试加载 Bun-only 模块 |
| 未安装的专有/平台模块 | feature gate + try/catch + 明确降级 | 不能让默认 CCR 主线因为可选依赖缺失而崩溃 |

## 4. 第一批：主线运行时优先修复

第一批应优先处理“用户当前 TUI / `-p` / 工具调用容易触发”的 require。

| 文件 | 当前 require 内容 | 建议方式 |
| --- | --- | --- |
| `src/utils/yaml.ts` | `require('yaml')` | 加 `createRequire`，保留非 Bun 分支懒加载 |
| `src/utils/proxy.ts` | `require('undici')` | 加 `createRequire`，保留代理/mTLS 才加载 `undici` |
| `src/utils/mtls.ts` | `require('undici')` | 加 `createRequire`，保留 TLS 配置路径懒加载 |
| `src/utils/caCerts.ts` | `require('tls')` | 加 `createRequire`，保留 CA 证书路径懒加载 |
| `src/utils/processUserInput/processBashCommand.tsx` | `require('src/tools/PowerShellTool/PowerShellTool.js')` | 改 `await import('src/tools/PowerShellTool/PowerShellTool.js')`，因为当前函数已是 async，且 `src/*` 应走 loader |
| `src/utils/promptShellExecution.ts` | `require('../tools/PowerShellTool/PowerShellTool.js')` | 可改 `await import(...)`，调用链已在 async prompt shell 执行路径内 |
| `src/native-ts/color-diff/index.ts` | `require('highlight.js')` | 加 `createRequire`，保留高亮库懒加载 |
| `src/utils/modifiers.ts` | `require('modifiers-napi')` | 加 `createRequire`，保留 macOS 原生模块懒加载与平台保护 |
| `src/components/WorktreeExitDialog.tsx` | `require('../utils/sessionStorage.js')` | 加 `createRequire`，保留打破循环依赖的同步懒加载 |
| `src/constants/product.ts` | `require('../bridge/sessionIdCompat.js')` | 短期加 `createRequire`；长期把 `toCompatSessionId` 下沉到无依赖 helper，彻底移除 require |
| `src/utils/messages.ts` | `require('./teammateMailbox.js')` 等 | 加 `createRequire`；feature-gated snip 相关保持懒加载 |

第一批目标是：不改变业务逻辑，不扩大加载范围，只把已恢复源码里的裸 require 改成 Node ESM 下可执行的等价懒加载。

### 第一批修复记录

修复日期：2026-04-26

已处理：

- `src/utils/yaml.ts`：为 `yaml` 懒加载补本地 `createRequire(import.meta.url)`。
- `src/utils/proxy.ts`：为 `undici` 代理路径补本地 `createRequire(import.meta.url)`。
- `src/utils/mtls.ts`：为 TLS fetch 的 `undici` 懒加载补本地 `createRequire(import.meta.url)`。
- `src/utils/caCerts.ts`：为 `tls` 懒加载补本地 `createRequire(import.meta.url)`。
- `src/utils/processUserInput/processBashCommand.tsx`：把 PowerShellTool 别名路径从裸 `require('src/...')` 改为 `await import('src/...')`。
- `src/utils/promptShellExecution.ts`：把 prompt shell 的 PowerShellTool 懒加载改为 `await import(...)`。
- `src/native-ts/color-diff/index.ts`：为 `highlight.js` 懒加载补本地 `createRequire(import.meta.url)`。
- `src/utils/modifiers.ts`：为 macOS 原生模块 `modifiers-napi` 补本地 `createRequire(import.meta.url)`，保留平台保护。
- `src/components/WorktreeExitDialog.tsx`：为打破循环依赖的 `sessionStorage` 懒加载补本地 `createRequire(import.meta.url)`。
- `src/constants/product.ts`：为 `sessionIdCompat` 同步懒加载补本地 `createRequire(import.meta.url)`。
- `src/utils/messages.ts`：为 teammate / snip 相关内部懒加载补本地 `createRequire(import.meta.url)`。

已验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
- Node 24 + `bun-bundle-loader.mjs` 下的第一批专项 smoke：覆盖 `yaml`、`caCerts`、`mtls`、`proxy`、`product`、`modifiers`、`color-diff`、`messages`、`WorktreeExitDialog`、`PowerShellTool` 动态加载。
- `git diff --check`
- `npm.cmd run ci:smoke`

独立审查：

- 审查线程结论：`PASS_WITH_NOTES`。
- 未发现高风险逻辑问题；`createRequire(import.meta.url)` 与 `await import(...)` 的选择符合当前 Node 24 + ESM 边界。
- 审查指出 `processBashCommand.tsx` 与 `WorktreeExitDialog.tsx` 残留旧内联 sourcemap，已清理后重新通过 `typecheck`、`build` 与专项 smoke。
- 主线程已修复 `npm.cmd run smoke:deps` 的既有断言问题：脚本现在接受 `dist/` 或 `dist/...` 发布白名单，并继续通过 `npm pack --dry-run --json` 验证实际包内包含 `dist`、排除 `src` 与 `tmp`。
- 主线程同步修复 `smoke:runtime` 的旧产品期望：版本断言改为 `CCR v0.1`，帮助入口断言改为 `Usage: ccr`，未登录路径改为隔离 `CCR_CONFIG_DIR` 后验证 Codex OAuth 未登录提示。

第一批后剩余扫描结果：

- 含实际 `require(...)` 的文件：96 个
- 实际 `require(...)` 调用：262 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：81 个
- 未保护的 `require(...)` 调用：212 处

## 5. 第二批：启动注册表与 UI 组件

第二批处理“启动链路和 UI 组件里大量 feature-gated require”。

| 文件/区域 | 建议方式 |
| --- | --- |
| `src/commands.ts` | 顶部加本地 `createRequire`，保留命令注册表同步结构 |
| `src/query.ts` | 顶部加本地 `createRequire`，保留 compact / context collapse / skill search 的 feature gate |
| `src/main.tsx` | 顶部加本地 `createRequire`，但只作为过渡；后续主入口应逐步改成显式 async loader |
| `src/tasks.ts` | 加 `createRequire`，保留 task registry feature gate |
| `src/skills/bundled/index.ts` | 加 `createRequire`，保留 bundled skill 条件注册 |
| `src/constants/prompts.ts` | 加 `createRequire`，保留 prompt 组件按 feature gate 加载 |
| `src/components/Messages.tsx` / `Message.tsx` / `TokenWarning.tsx` | 加 `createRequire`，保留 UI 组件懒加载 |
| `src/components/messages/UserTextMessage.tsx` | 加 `createRequire`，保留不同消息类型组件懒加载 |
| `src/components/permissions/PermissionRequest.tsx` | 加 `createRequire`，保留可选工具 permission UI |
| `src/state/AppState.tsx` | 加 `createRequire`，保留 voice provider feature gate |
| `src/cli/print.ts` | 加 `createRequire`，保留 headless / UDS / cron / skill search 可选路径 |

这一批大多是“内部 ESM 模块的同步条件加载”。在当前 Node 24 环境里 `createRequire` 可以作为低侵入过渡方案；如果后续要严格兼容 Node 18，需要把这些内部 ESM require 进一步改为 `await import(...)`、顶层 await，或 registry lazy factory。

### 第二批修复记录

修复日期：2026-04-26

已处理：

- `src/commands.ts`：为命令注册表中 feature-gated 命令模块补本地 `createRequire(import.meta.url)`。
- `src/query.ts`：为 reactive compact、context collapse、skill prefetch、classifier、snip、task summary 等条件模块补本地 `createRequire(import.meta.url)`。
- `src/main.tsx`：为主入口中的 teammate、assistant、coordinator、brief、bridge、proactive 等同步懒加载补本地 `createRequire(import.meta.url)`。
- `src/tasks.ts`：为 workflow / monitor task 注册补本地 `createRequire(import.meta.url)`。
- `src/skills/bundled/index.ts`：为 bundled skill 条件注册补本地 `createRequire(import.meta.url)`。
- `src/constants/prompts.ts`：为 prompt 组装中的 compact、proactive、brief、discover skill 等条件模块补本地 `createRequire(import.meta.url)`。
- `src/components/Messages.tsx`：为 proactive / brief / send-user-file 条件 UI 模块补本地 `createRequire(import.meta.url)`。
- `src/components/Message.tsx`：为 snip 边界和 compact snip 条件渲染补本地 `createRequire(import.meta.url)`。
- `src/components/TokenWarning.tsx`：为 context collapse 条件状态展示补本地 `createRequire(import.meta.url)`。
- `src/components/messages/UserTextMessage.tsx`：为 webhook、fork、cross-session、channel 条件消息组件补本地 `createRequire(import.meta.url)`。
- `src/components/permissions/PermissionRequest.tsx`：为 review artifact、workflow、monitor 等条件权限 UI 补本地 `createRequire(import.meta.url)`。
- `src/state/AppState.tsx`：为 voice provider 条件上下文补本地 `createRequire(import.meta.url)`。
- `src/cli/print.ts`：为 headless/SDK 路径中的 coordinator、proactive、cron、extract memories、UDS、agent dir 刷新等条件模块补本地 `createRequire(import.meta.url)`。

同步清理：

- 已清理本轮被修改源码中残留的旧内联 `//# sourceMappingURL=data:...`。这些旧内联 map 来自 sourcemap 恢复阶段，继续保留会让审查和后续 diff 判断混乱。

已验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run ci:smoke`
- `git diff --check`

独立审查：

- 审查线程结论：`PASS_WITH_NOTES`。
- 未发现需要返工的问题；`createRequire(import.meta.url)` 都在首次 `require(...)` 前建立，没有本地 `require` 遮蔽冲突。
- 审查线程对本轮已改源码里的 `require(...)` 目标做了顶层 `await` AST 扫描，结果为 0，因此短期使用 `createRequire` 可接受。
- 本轮已改源码没有残留内联 data sourcemap；对应 `dist/*.js` 使用外置 `.js.map`，map 的 `sources` 指向正确源码。

第二批后剩余扫描结果：

- 含实际 `require(...)` 的文件：96 个
- 实际 `require(...)` 调用：262 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：68 个
- 未保护的 `require(...)` 调用：132 处

### 第三批 A 修复记录

修复日期：2026-04-26

本轮范围：

- 命令层：`clear`、`compact`、`context` 相关命令中的低风险同步懒加载。
- UI 层：上下文可视化、Logo、memory 选择器、消息组件、权限弹窗、PromptInput、Settings、后台任务弹窗。
- hooks 层：全局快捷键、REPL bridge、语音集成中的条件模块加载。
- memdir / query / utils：memory 检测、system prompt、tool pool、stop hooks 等辅助路径。

本轮原则：

- 同步路径保留原有同步语义，补 `createRequire(import.meta.url)`，不改函数生命周期。
- 已处于 async 函数内的内部模块加载，优先改为 `await import(...)`。
- 不在本轮触碰 `bun:ffi`、`.txt` 资产 require、专有 computer-use addon、复杂 service/tool 主链路，避免一次性扩大风险。

特殊处理：

- `src/commands/context/context-noninteractive.ts`：
  - `collectContextData(...)` 内的 context collapse 操作改成 `await import(...)`。
  - 同文件同步格式化路径仍需同步加载，因此补本地 `createRequire(import.meta.url)`。
- `src/hooks/useReplBridge.tsx`：
  - webhook sanitizer 位于 async 回调内，改成 `await import(...)`，没有额外引入同步 require 桥。
- `src/components/tasks/BackgroundTasksDialog.tsx`：
  - 补本地 `createRequire(import.meta.url)`。
  - 将 `require('src/tasks/LocalWorkflowTask/LocalWorkflowTask.js')` 改成相对路径 `require('../../tasks/LocalWorkflowTask/LocalWorkflowTask.js')`，避免路径映射字符串在运行时解析不稳定。

已验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run ci:smoke`
- `git diff --check`

第三批 A 后剩余扫描结果：

- 含实际 `require(...)` 的文件：95 个
- 实际 `require(...)` 调用：260 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：44 个
- 未保护的 `require(...)` 调用：96 处

### 第三批 B 修复记录

修复日期：2026-04-26

本轮范围：

- services 层轻量路径：analytics metadata、API classifier bridge、compact 相关模块、extract memories。
- utils 层轻量路径：background housekeeping、CLAUDE/CCR memory 发现、read/search collapse、配置、环境工具、会话恢复。
- permissions 层：permission setup、permissions、classifier decision、permission rule parser。

本轮原则：

- 这些文件里的 `require(...)` 主要用于 feature gate 下的同步常量、同步 helper 或 DCE 保护，暂不改异步生命周期。
- 统一补 `createRequire(import.meta.url)`，保留原始 feature gate、注释和条件加载结构。
- 没有处理 `screens`、`mcp`、`tools` 主链路、专有 addon、`.txt` 资源和 `bun:ffi`，这些仍放到后续专项。

已验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run ci:smoke`
- `git diff --check`

第三批 B 后剩余扫描结果：

- 含实际 `require(...)` 的文件：95 个
- 实际 `require(...)` 调用：260 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：27 个
- 未保护的 `require(...)` 调用：70 处

### 第三批 C 修复记录

修复日期：2026-04-26

本轮范围：

- 普通 bridge / session 路径：`initReplBridge.ts`、`trustedDevice.ts`、`ResumeConversation.tsx`、`setup.ts`。
- MCP / LSP 路径：`services/mcp/*`、`services/lsp/LSPServerInstance.ts`。
- tools 路径：`AgentTool`、`ExitPlanModeTool`、`SendMessageTool`、`SkillTool`、`ToolSearchTool`。
- utils 路径：`analyzeContext.ts`、`attachments.ts`、`ide.ts`、`messages/systemInit.ts`、`sessionFileAccessHooks.ts`、`sessionRestore.ts`。

本轮原则：

- 普通同步懒加载统一补 `createRequire(import.meta.url)`。
- 保留原 feature gate / DCE 注释，不重排恢复源码结构。
- 清理本轮触达文件中残留的旧内联 `sourceMappingURL=data`。

已验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run ci:smoke`
- `git diff --check`

第三批 C 后剩余扫描结果：

- 含实际 `require(...)` 的文件：95 个
- 实际 `require(...)` 调用：260 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：5 个
- 未保护的 `require(...)` 调用：23 处

### 第三批 D 修复记录

修复日期：2026-04-26

本轮范围：

- `src/screens/REPL.tsx`
- `src/upstreamproxy/upstreamproxy.ts`
- `src/utils/computerUse/inputLoader.ts`
- `src/utils/computerUse/swiftLoader.ts`
- `src/utils/permissions/yoloClassifier.ts`

本轮原则：

- `REPL.tsx` 仍按同步 UI 条件加载处理，补 `createRequire(import.meta.url)`，不拆主屏生命周期。
- `bun:ffi` 与 computer-use 原生包属于边界依赖，补 `createRequire(import.meta.url)` 后仍依赖原有 feature / platform guard。
- `yoloClassifier.ts` 的 `.txt` require 已补本地 `createRequire(import.meta.url)`，并已补入 CCR 自研兼容 prompt；构建阶段通过 `postbuild` 复制到 `dist`。

已验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run ci:smoke`
- `git diff --check`

第三批 D 后剩余扫描结果：

- 含实际 `require(...)` 的文件：95 个
- 实际 `require(...)` 调用：260 处
- 其中未声明本地 `createRequire(import.meta.url)` 的文件：0 个
- 未保护的 `require(...)` 调用：0 处

遗留风险：

- `src/utils/permissions/yoloClassifier.ts` 依赖的 `src/utils/permissions/yolo-classifier-prompts/` 目录已恢复为 CCR 自研兼容 prompt。
- 如果未来打开 `TRANSCRIPT_CLASSIFIER`，还需要补真实场景评测；当前目标是恢复文件解析、构建复制和发布打包完整性。

### 整体复核记录

复核日期：2026-04-26

复核口径：

- 去掉行注释和块注释后重新扫描源码真实 `require(...)`。
- 检查每个含 `require(...)` 的文件是否存在本地 `createRequire(import.meta.url)`。
- 检查 `createRequire(import.meta.url)` 是否出现在首次真实 `require(...)` 之前。
- 抽取字符串字面量 `require('...')` 目标，检查相对源码目标、dist 目标、文本资产和专有包解析情况。

桥接复核结论：

- 含真实 `require(...)` 的源码文件：95 个。
- 真实 `require(...)` 调用：259 处。
- 未声明本地 `createRequire(import.meta.url)` 的文件：0 个。
- `createRequire(import.meta.url)` 出现在首次 `require(...)` 之后的文件：0 个。
- `git diff --check`：通过。

运行验证：

- `npm.cmd run typecheck -- --pretty false`：通过。
- `npm.cmd run build -- --pretty false`：通过。
- `npm.cmd run ci:smoke`：通过。

目标解析风险：

- 当前仍有 26 个字符串字面量 `require('...')` 指向源码 / dist 中不存在的本地目标。
- 这些缺失目标主要集中在关闭或专有 feature gate 下，例如 `commands/agents-platform`、`commands/proactive`、`commands/assistant`、`commands/remoteControlServer`、若干专有工具和若干 bundled skill；`yolo-classifier-prompts/*.txt` 已由 CCR 自研兼容 prompt 补齐。
- 详细清单已经拆到 [runtime-missing-targets.md](./runtime-missing-targets.md)，后续修复以该文档作为剩余问题入口。
- 默认路径与当前 smoke 覆盖范围不会触发这些目标；一旦打开对应 feature，需要先恢复模块或显式保持 feature 关闭。

已确认的特殊风险：

- `src/utils/permissions/yoloClassifier.ts`：3 个 `.txt` prompt 资产已补为 CCR 自研兼容版，未直接复制疑似泄露来源；`postbuild` 会复制到 `dist/src/utils/permissions/yolo-classifier-prompts/`，发布包通过 `dist/**/*.txt` 纳入。
- `src/utils/ide.ts`：已将 `require('src/components/IdeOnboardingDialog.js')` 改为 `require('../components/IdeOnboardingDialog.js')`。普通 Node `createRequire.resolve(...)` 已验证可解析到 `dist/src/components/IdeOnboardingDialog.js`。
- `src/services/mcp/client.ts`：`@ant/claude-for-chrome-mcp` 当前未安装；应继续依赖 feature gate，打开 Chrome MCP 前需恢复依赖。
- `src/utils/computerUse/inputLoader.ts` / `src/utils/computerUse/swiftLoader.ts`：`@ant/computer-use-input`、`@ant/computer-use-swift` 当前未安装；打开 computer-use 前需恢复依赖或提供可控降级。
- `src/upstreamproxy/upstreamproxy.ts`：`bun:ffi` 在当前 Node 下不可解析；该路径必须只在 Bun / 远程容器边界内触发。

一句话结论：

`require is not defined` 这一类 ESM 裸 require 问题已清零；剩余风险不再是桥接缺失，而是关闭功能背后的源码模块、文本资产、专有 native 包和运行时边界尚未恢复。

## 6. 第三批：关闭功能、专有依赖与特殊资产

第三批不是默认主线，但必须记录，避免以后打开 feature flag 时突然炸。

| 文件/区域 | 风险 | 建议方式 |
| --- | --- | --- |
| `src/utils/permissions/yoloClassifier.ts` | `require` 已有桥接，`.txt` prompt 资产已补为 CCR 自研兼容版 | 后续如启用 `TRANSCRIPT_CLASSIFIER`，需要做真实 auto mode 场景评测，不再直接依赖疑似泄露 prompt |
| `src/utils/computerUse/inputLoader.ts` / `swiftLoader.ts` | 已补 `createRequire`，但 `@ant/computer-use-*` 默认未必安装 | 继续依赖 feature / platform guard，打开功能前做 native addon smoke |
| `src/upstreamproxy/upstreamproxy.ts` | 已补 `createRequire`，但 `bun:ffi` 是 Bun 专属 | Node 下必须不进入该分支；打开远程 upstreamproxy 前做容器专项 smoke |
| `src/bridge/*` | 已补普通 require 桥接 | 打开 bridge / trusted device feature 前做专项 ESM 验证 |
| `src/services/*` | 普通路径已补桥接 | context collapse / skill search / extract memories 恢复时继续做功能级 smoke |
| `src/screens/*` | `REPL.tsx` 与恢复屏已补桥接 | TUI 手动场景仍需覆盖：启动、恢复会话、后台任务、context collapse reset |
| `src/tools/*` | 普通工具内部 require 已补桥接 | 各关闭功能打开前按工具逐个 smoke |

## 7. Node 版本边界

当前本机 Node 是 `v24.14.0`，CCR 当前阶段也正式以 Node 24+ 作为运行时边界。

`package.json` 的运行时要求应保持为：

```json
"engines": {
  "node": ">=24.0.0"
}
```

这意味着当前修复可以合理利用 Node 24 的 ESM / CommonJS 互操作能力，但仍然要控制使用边界：

- `createRequire` 可以作为 CommonJS 包、native addon、同步懒加载点的正式修复方式。
- 内部 ESM 模块不应长期依赖 `createRequire` 作为默认风格；能改 `import` / `await import(...)` 的，仍然优先改。
- Node 18 / Node 20 兼容不再是当前默认承诺。如果未来要降级支持，需要单独开兼容专项。

一句话：Node 24 是当前产品边界；`createRequire` 是可用工具，但不是新的默认编码风格。CCR 的长期方向仍然是内部代码 ESM 化，边界依赖桥接化。

## 8. 验证方案

每批修复后都要跑：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build -- --pretty false
```

第一批还要做专项 smoke：

- `TaskCreateTool` 再跑一次，确认不再出现 `proper-lockfile` 相关 `require is not defined`
- TUI 启动后让模型创建文件，确认不再出现 `Error: require is not defined`
- `!` shell 路径至少验证 bash 默认路径；如果启用 PowerShell 默认 shell，再验证 PowerShellTool 动态 import
- 有代理或自定义 CA 环境时，验证 `proxy.ts`、`mtls.ts`、`caCerts.ts`
- 打开一次 diff/高亮输出，验证 `highlight.js` 懒加载

## 9. 后续建议

建议补一个自动审计脚本，例如 `scripts/audit-esm-require.mjs`：

- 扫描 `src/**/*.ts` 与 `src/**/*.tsx`
- 找到裸 `require(...)`
- 如果文件没有本地 `createRequire(import.meta.url)`，且不是允许名单，就报出文件和行号
- CI 或发布前至少作为 warning 运行

这样后面恢复 sourcemap 源码或补 feature 时，不会再次把裸 require 带进 Node ESM 运行时。
