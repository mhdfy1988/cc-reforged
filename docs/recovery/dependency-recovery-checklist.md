# Claude Code Reforged 依赖恢复清单

## 1. 文档目标

本文档用于定义 `claude-code-reforged` 的依赖恢复范围、恢复顺序和分层策略。

它解决的问题不是“缺哪个包就装哪个包”，而是：

1. 当前仓库到底缺了哪些真实依赖。
2. 哪些依赖属于主链必须恢复，哪些属于后续能力。
3. 哪些扫描结果其实是 sourcemap 恢复噪声，不能当真依赖处理。
4. 后续补 `package.json` 时，应该如何分层写入，而不是一次性堆满。

本文档是以下两份文档的进一步执行化拆解：

- [recovery-repair-plan.md](./recovery-repair-plan.md)
- [engineering-skeleton-recovery-checklist.md](./engineering-skeleton-recovery-checklist.md)

## 2. 当前基线

## 2.1 当前 `package.json` 与真实依赖严重不一致

当前顶层包信息见：

- [package.json](D:/agent_project/claude-code-reforged/package.json)
- [bun.lock](D:/agent_project/claude-code-reforged/bun.lock)

已确认事实：

1. [package.json](D:/agent_project/claude-code-reforged/package.json) 的 `dependencies` 为空。
2. [bun.lock](D:/agent_project/claude-code-reforged/bun.lock) 也几乎为空，仅保留 `sharp` 平台包相关信息。
3. 但源码中真实存在大量第三方依赖导入。

结论：

- 当前恢复仓不能依赖现有 `package.json` 和 `bun.lock` 作为真实依赖来源。

## 2.2 当前依赖识别方法

本轮依赖识别采用的是“源码导入静态扫描”，覆盖了：

1. `import ... from 'pkg'`
2. `require('pkg')`
3. `import('pkg')`

并排除了以下内容：

1. 相对路径导入
2. `src/*` 路径别名
3. `node:*`
4. `bun:*`
5. 本地绝对路径

## 2.3 当前扫描结果的两个关键判断

### 判断一：依赖数量远超表面包信息

高频依赖根包包括：

- `react`
- `lodash-es`
- `@anthropic-ai/sdk`
- `zod`
- `figures`
- `axios`
- `chalk`
- `@modelcontextprotocol/sdk`
- `@opentelemetry/api`
- `chokidar`
- `ws`
- `execa`

### 判断二：扫描结果里混有恢复噪声

扫描中还出现了一些显然不应该进入依赖清单的内容，例如：

- `OC & Bulk Overages copy`
- `CCR v2`
- `-A20`
- `Bash(git *)`
- `Bash(prefix:*)`
- `npm run test:*`
- `completed with no key`

经定位，这类内容来自：

1. 注释
2. 文本常量
3. 规则样例
4. 恢复时残留的字符串噪声

结论：

- 依赖恢复必须先过一层“伪依赖排除”，不能把扫描结果原样写入 `package.json`。

## 3. 依赖恢复原则

## 3.1 总体原则

1. 先恢复主链必须依赖，再恢复外围依赖。
2. 先恢复运行时依赖，再补开发时依赖。
3. 先恢复跨平台纯 JS 依赖，再补平台专用和原生依赖。
4. 对实验性和 feature-gated 模块，默认延后恢复。

## 3.2 包管理器策略

恢复期建议统一以 **npm** 作为主包管理器，而不是 Bun。

原因：

1. 运行时目标仍然是 Node 18+ CLI。
2. [package.json](D:/agent_project/claude-code-reforged/package.json) 明确声明了 Node 运行时边界。
3. 源码中的产品更新路径也是围绕 npm 版本分发设计的。

注意：

- `bun.lock` 当前仅作为恢复快照副产物看待，不作为真实依赖锁文件来源。

## 3.3 恢复期写入策略

后续补 `package.json` 时，依赖默认按四类写入：

1. `dependencies`
2. `optionalDependencies`
3. `devDependencies`
4. 暂缓依赖清单（先不写入）

## 4. 依赖分层

## 4.1 第一层：主链核心运行依赖

这层依赖直接决定“普通 CLI 主链 + Query 主链 + Tool 主链”能不能恢复。

### 推荐纳入 `dependencies` 的第一批包

#### A. 模型与协议主链

1. `@anthropic-ai/sdk`
2. `@modelcontextprotocol/sdk`
3. `zod`

说明：

- `@anthropic-ai/sdk` 广泛出现在消息、模型、流式输出类型中。
- `@modelcontextprotocol/sdk` 直接用于 MCP client/server 与 schema。
- `zod` 是 SDK schema、命令输入输出校验的关键基础。

关键源码落点：

- [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts)
- [src/entrypoints/mcp.ts](D:/agent_project/claude-code-reforged/src/entrypoints/mcp.ts)
- [src/entrypoints/sdk/coreSchemas.ts](D:/agent_project/claude-code-reforged/src/entrypoints/sdk/coreSchemas.ts)

#### B. 通用运行依赖

1. `axios`
2. `lodash-es`
3. `chalk`
4. `figures`
5. `strip-ansi`
6. `semver`
7. `execa`
8. `diff`
9. `ignore`
10. `lru-cache`
11. `chokidar`
12. `ws`
13. `p-map`
14. `shell-quote`

说明：

- 这些包覆盖了 HTTP、缓存、进程、终端、文本处理、文件监听、WebSocket、并发等主链能力。

关键源码落点示例：

- `axios`：
  - [src/assistant/sessionHistory.ts](D:/agent_project/claude-code-reforged/src/assistant/sessionHistory.ts)
  - [src/bridge/bridgeApi.ts](D:/agent_project/claude-code-reforged/src/bridge/bridgeApi.ts)
- `execa`：
  - [src/utils/auth.ts](D:/agent_project/claude-code-reforged/src/utils/auth.ts)
- `chokidar`：
  - [src/keybindings/loadUserBindings.ts](D:/agent_project/claude-code-reforged/src/keybindings/loadUserBindings.ts)
  - [src/utils/cronScheduler.ts](D:/agent_project/claude-code-reforged/src/utils/cronScheduler.ts)

#### C. UI 主链依赖

1. `react`
2. `react/compiler-runtime`
3. `usehooks-ts`
4. `react-reconciler`

说明：

- 当前仓库没有直接依赖外部 `ink` 包的明显信号，反而是自带了一套本地 `src/ink/*` 实现。
- 但 `React` 本身仍然是核心 UI 依赖，不能省。

关键源码落点：

- [src/ink.ts](D:/agent_project/claude-code-reforged/src/ink.ts)
- [src/ink/root.ts](D:/agent_project/claude-code-reforged/src/ink/root.ts)
- [src/state/AppState.tsx](D:/agent_project/claude-code-reforged/src/state/AppState.tsx)

## 4.2 第二层：主产品增强依赖

这层依赖不是“最小一轮 Query”必须，但会很快影响可用性。

### 推荐作为第二批恢复对象

1. `fuse.js`
2. `marked`
3. `qrcode`
4. `highlight.js`
5. `cli-highlight`
6. `type-fest`
7. `yaml`
8. `xss`
9. `fflate`
10. `turndown`
11. `proper-lockfile`

说明：

- 这一层主要服务于搜索建议、富文本展示、格式化、序列化、安全清洗和部分产品增强能力。

关键源码落点示例：

- `fuse.js`：
  - [src/hooks/unifiedSuggestions.ts](D:/agent_project/claude-code-reforged/src/hooks/unifiedSuggestions.ts)
  - [src/components/LogSelector.tsx](D:/agent_project/claude-code-reforged/src/components/LogSelector.tsx)

## 4.3 第三层：MCP、云、遥测相关依赖

这层依赖与主产品价值相关，但在首轮恢复中不应拖住最小主链。

### 推荐作为第三批恢复对象

#### A. 遥测与观测

1. `@opentelemetry/api`
2. `@opentelemetry/api-logs`
3. `@opentelemetry/sdk-logs`
4. `@opentelemetry/sdk-metrics`
5. `@opentelemetry/sdk-trace-base`
6. `@opentelemetry/core`
7. `@opentelemetry/resources`
8. `@opentelemetry/semantic-conventions`

关键源码落点：

- [src/bootstrap/state.ts](D:/agent_project/claude-code-reforged/src/bootstrap/state.ts)
- [src/entrypoints/init.ts](D:/agent_project/claude-code-reforged/src/entrypoints/init.ts)

#### B. 云与远程执行扩展

1. `@aws-sdk/client-bedrock`
2. `@smithy/node-http-handler`
3. `@smithy/core`
4. `google-auth-library`
5. `https-proxy-agent`

说明：

- 这一组明显偏向多模型、代理、云接入和网络环境适配，不应成为首轮阻塞项。

#### C. 协议扩展与 Anthropic 平台周边

1. `@anthropic-ai/mcpb`
2. `@anthropic-ai/sandbox-runtime`
3. `@anthropic-ai/claude-agent-sdk`

说明：

- 这一组更偏平台能力和高级集成，建议延后。

## 4.4 第四层：平台专用与原生依赖

这层依赖默认不纳入首轮恢复完成标准。

### 当前已识别对象

1. `audio-capture-napi`
2. `image-processor-napi`
3. `modifiers-napi`
4. `@ant/computer-use-mcp`
5. `@ant/computer-use-mcp/types`
6. `@ant/computer-use-input`
7. `@ant/computer-use-swift`
8. `@ant/claude-for-chrome-mcp`

关键源码落点示例：

- `audio-capture-napi`：
  - [src/services/voice.ts](D:/agent_project/claude-code-reforged/src/services/voice.ts)
- `@ant/computer-use-mcp`：
  - feature-gated，明显属于后期能力

处理原则：

1. 首轮不要求这些依赖全部安装成功。
2. 首轮允许通过特性关闭、stub 或降级路径绕开。
3. 只有在恢复对应产品能力时，再单独处理这些平台依赖。

## 5. 开发依赖恢复建议

下面这组依赖不是从业务 import 直接扫描出来的，而是为了让恢复工程能工作，建议单独加入 `devDependencies`。

### 推荐第一批 `devDependencies`

1. `typescript`
2. `tsx`
3. `@types/node`
4. `@types/react`

### 推荐第二批 `devDependencies`

1. 用于宏替身和构建的工具
2. 用于最小 typecheck / bundle 的工具
3. 用于恢复期脚本运行的工具

说明：

- 这部分应在后续“构建与宏适配清单”里进一步落细，不在当前文档里一次性定死全部工具链。

## 6. 伪依赖排除清单

下列内容当前应显式视为“扫描噪声”，不得写入真实依赖清单：

1. `OC & Bulk Overages copy`
2. `CCR v2`
3. `-A20`
4. `Bash(git *)`
5. `Bash(prefix:*)`
6. `npm run test:*`
7. `completed with no key`
8. 其他来自注释、规则样例、恢复残片的字符串

说明：

- 这一步默认在生成正式依赖草案前先过滤一次。

## 7. 建议的恢复顺序

## 7.1 第 1 轮：最小运行依赖

目标：

先让普通 CLI 主链和最小 Query 主链具备解析与运行条件。

建议恢复：

1. `react`
2. `react/compiler-runtime`
3. `zod`
4. `@anthropic-ai/sdk`
5. `@modelcontextprotocol/sdk`
6. `lodash-es`
7. `axios`
8. `chalk`
9. `figures`
10. `strip-ansi`
11. `semver`
12. `execa`
13. `lru-cache`
14. `chokidar`
15. `ws`

状态变化：

`空壳依赖清单 -> 主链可解析的最小依赖集`

## 7.2 第 2 轮：CLI 与产品增强依赖

目标：

提升可用性和普通产品体验。

建议恢复：

1. `fuse.js`
2. `marked`
3. `qrcode`
4. `highlight.js`
5. `cli-highlight`
6. `ignore`
7. `diff`
8. `yaml`
9. `xss`
10. `fflate`
11. `turndown`

状态变化：

`主链可解析 -> CLI 产品面逐步可用`

## 7.3 第 3 轮：遥测、云与协议扩展

目标：

恢复非核心但重要的集成能力。

建议恢复：

1. `@opentelemetry/*`
2. `@aws-sdk/client-bedrock`
3. `@smithy/*`
4. `google-auth-library`
5. `https-proxy-agent`
6. `@anthropic-ai/mcpb`
7. `@anthropic-ai/sandbox-runtime`

状态变化：

`主产品基本可用 -> 平台能力开始回归`

## 7.4 第 4 轮：平台专用和原生依赖

目标：

在主产品稳定后，再追回语音、computer-use、Chrome 相关能力。

状态变化：

`主产品稳定 -> 高级外围能力逐步恢复`

## 8. 建议的 `package.json` 恢复结构

后续恢复 `package.json` 时，建议按下面的口径组织：

### `dependencies`

放：

1. 主链运行依赖
2. 普通 CLI 必需依赖
3. 模型与 MCP 主链依赖

### `optionalDependencies`

放：

1. 平台相关 `sharp` 包
2. 后续可能进入恢复链的原生平台包

### `devDependencies`

放：

1. TypeScript 与类型包
2. 构建、宏适配和恢复脚本所需工具

### 暂缓清单

单独文档管理，不立即写进 `package.json`：

1. 平台特定原生能力
2. 明显 feature-gated 的外围实验能力

## 9. 阶段验收标准

依赖恢复阶段完成时，至少要满足：

1. 已形成一份去噪后的正式依赖草案。
2. 核心主链所需依赖不再依赖人工猜测。
3. 依赖已按主链、增强、平台、原生四层拆开。
4. `package.json` 的后续补全可以直接按本文档执行。

## 10. 结论

`claude-code-reforged` 当前最大的依赖问题不是“缺几个包”，而是：

1. 真实依赖和现有 `package.json` 完全脱节。
2. 扫描结果里混有恢复噪声。
3. 核心依赖、增强依赖、平台依赖还没有分层。

因此依赖恢复必须遵循下面这条主线：

1. 先去噪。
2. 再分层。
3. 先补主链。
4. 最后补外围。

只有按这个顺序做，后续的工程恢复和产品恢复才不会反复返工。
