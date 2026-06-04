export const releaseCheckHelperPreset = {
    presetId: 'release-check-helper',
    name: 'release-check-helper',
    displayName: '发布检查助手',
    description: '准备项目发布、打包、更新版本、检查 CHANGELOG、运行 release gate 或确认发布前工作区时使用。适用于按顺序核对版本规划、文档、typecheck、build、领域 smoke、打包命令和发布产物。',
    version: '0.1.0',
    files: {
        'SKILL.md': `---
name: release-check-helper
description: 准备项目发布、打包、更新版本、检查 CHANGELOG、运行 release gate 或确认发布前工作区时使用。适用于按顺序核对版本规划、文档、typecheck、build、领域 smoke、打包命令和发布产物。
---

# 发布检查助手

帮助用户在发布前按固定顺序检查项目。这个 Skill 只生成检查计划、执行验证和整理问题清单，不自动发布、不自动推送、不跳过失败项。

## 工作流程

1. 先确认发布目标：npm 包、Desktop 安装器、GitHub Release，还是三者都要。
2. 确认版本规划和 CHANGELOG：当前功能应进入哪个版本，不能把 Skill 大批次误写到旧版本。
3. 检查工作区：区分源码、dist、docs、smoke、package、临时文件和无关文件。
4. 先跑基础验证：typecheck 和 build。
5. 再按领域跑 release gate：Skill、MCP、Desktop。
6. 打包前确认 README、CHANGELOG、goal 和专题文档没有旧口径。
7. 打包后核对产物、自动更新 feed 或 release 草稿状态。
8. 最后输出：通过项、失败项、需要人工确认项、禁止发布项。

## 版本口径

- 当前发布版本必须以 \`package.json\` 和 CHANGELOG 为准。
- 如果用户已明确某批功能属于后续版本，不要写进当前版本。
- 版本、tag、npm、Desktop Release 必须使用同一个最终版本号。

## 参考资料

- 目标项目是 CCR，且需要生成发布前命令清单时，可参考 \`references/release-gate.md\`。
- 其他项目优先参考项目自己的 package scripts、CI 配置、发布 runbook 和 CHANGELOG。

## 输出要求

- 先列发布目标和版本号。
- 再列必须运行的验证命令。
- 对失败项给出阻断级别和下一步。
- 不要在工作区未清点、验证未通过或版本未确认时建议发布。
`,
        'references/release-gate.md': `# CCR 发布前检查清单

以下命令只在目标项目是 CCR 时使用；其他项目应以当前仓库自己的 scripts、CI 和发布 runbook 为准。

## 基础验证

\`\`\`text
npm.cmd run typecheck -- --pretty false
npm.cmd run build
git diff --check
\`\`\`

## 领域 release gate

\`\`\`text
npm.cmd run smoke:skill-release
npm.cmd run smoke:mcp-release
npm.cmd run smoke:desktop-release-gate
\`\`\`

## Skill / MCP 重点 smoke

\`\`\`text
npm.cmd run smoke:skill-install-builtin-presets
npm.cmd run smoke:skill-end-to-end
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:mcp-end-to-end
\`\`\`

## npm 包预检

\`\`\`text
npm.cmd pack --dry-run
\`\`\`

## Desktop 产物预检

\`\`\`text
npm.cmd run desktop:dist
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run smoke:desktop-signing-readiness
\`\`\`

## 禁止发布条件

- 版本号和 CHANGELOG 不一致。
- build 失败或 dist 未同步。
- release gate 失败且没有明确环境原因。
- 工作区混入无关临时文件。
- remote registry 暂停项被写成当前已实现。
- Desktop 产物不存在或 metadata 指向不存在的文件。
`,
    },
};
//# sourceMappingURL=releaseCheckHelper.js.map