export const bugDebugHelperPreset = {
    presetId: 'bug-debug-helper',
    name: 'bug-debug-helper',
    displayName: 'BUG 排查助手',
    description: '排查项目 BUG、回归、报错、UI 与数据不一致、构建或验证异常时使用。适用于先复述现象、确认入口、限定首轮范围、沿调用链回溯、做最小修复并验证。',
    version: '0.1.0',
    files: {
        'SKILL.md': `---
name: bug-debug-helper
description: 排查项目 BUG、回归、报错、UI 与数据不一致、构建或验证异常时使用。适用于先复述现象、确认入口、限定首轮范围、沿调用链回溯、做最小修复并验证。
---

# BUG 排查助手

帮助用户按问题驱动方式排查项目问题。使用时不要先全仓库理解，也不要看到可疑代码就改；从现象入口出发，沿真实调用链和状态变化回溯。

## 工作流程

1. 复述 BUG：现象、实际结果、期望结果、触发入口、报错或截图。
2. 确认首轮范围：只选与入口、报错文本、UI 页面、协议字段或 smoke 名称直接相关的文件。
3. 读取入口代码：确认请求、事件、状态或渲染从哪里进入。
4. 沿调用链回溯：向下看处理流程，向上看数据来源，不做撒网式搜索。
5. 定位最小可疑点：说明证据和排除项。
6. 做最小修复：只改当前根因相关代码，不顺手重构。
7. 验证：先跑定向 smoke 或类型检查，再按影响面补 build 或回归。

## 常见入口

- 前端页面异常：先看对应页面组件、状态管理、服务端 handler 和协议返回。
- 展示协议错误：先看 ThreadDisplay snapshot / patch、projection、reducer 输入事件。
- MCP 问题：先看 MCP 安装管理、transport、tool runtime、result processing。
- Skill 问题：先看 Skill 安装管理、runtime catalog、SkillTool、slash command。
- 构建产物异常：确认 smoke 是否运行 dist；源码改动后先 build。
- 文档与功能不一致：先确认当前实现，再更新文档，不用旧文档反推代码。

## 参考资料

- 目标项目是 CCR，且需要选择入口文件时，可参考 \`references/ccr-debug-entrypoints.md\`。
- 其他项目优先参考项目自己的 README、AGENTS、架构文档和测试脚本。

## 输出要求

- 先给出 BUG 复述和首轮查看范围。
- 再给出调用链证据和根因判断。
- 修复后说明改动文件、验证命令和剩余风险。
- 如果证据不足，明确缺失项，但仍保持窄路径排查。
`,
        'references/ccr-debug-entrypoints.md': `# CCR BUG 排查入口索引

## Desktop / App Server

- Desktop 页面：\`apps/desktop/src/renderer/src/components/pages/\`
- Desktop 样式：\`apps/desktop/src/renderer/src/styles.css\`
- App Server 协议：\`src/app-server/protocol.ts\`
- App Server handler：\`src/app-server/handlers/\`
- App Server router：\`src/app-server/router.ts\`

## ThreadDisplay

- 展示 reducer：\`src/app-server/threadDisplay/\`
- 展示契约：\`docs/architecture/session-context-and-display-contract.md\`
- 实时历史契约：\`docs/architecture/realtime-history-display-contract.md\`

## MCP

- 安装管理：\`src/services/mcp/\`
- MCP client：\`src/mcp/client.ts\`
- MCP 工具运行时辅助：\`src/mcp/toolRuntime.ts\`
- MCP 结果处理：\`src/mcp/resultProcessing.ts\`
- MCP 文档：\`docs/mcp/\`

## Skill

- Skill 模型和归一：\`src/skills/\`
- Skill 安装管理：\`src/services/skills/\`
- Skill 工具：\`src/tools/SkillTool/\`
- Skill 文档：\`docs/skills/\`

## 验证选择

- 修改源代码后，若 smoke 走构建产物，先运行 build。
- 修改 Skill 安装管理，优先跑 skill install / runtime 相关 smoke。
- 修改 MCP 安装管理，优先跑 mcp install / tool runtime 相关 smoke。
- 修改 Desktop UI，优先跑 desktop typecheck，并用真实页面或截图核对。
`,
    },
};
//# sourceMappingURL=bugDebugHelper.js.map