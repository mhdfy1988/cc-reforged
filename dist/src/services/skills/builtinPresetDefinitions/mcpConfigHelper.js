export const mcpConfigHelperPreset = {
    presetId: 'mcp-config-helper',
    name: 'mcp-config-helper',
    displayName: 'MCP 配置助手',
    description: '创建或审查 MCP 安装配置时使用。适用于区分本地 stdio、本地 HTTP、npm 包、远端 HTTP MCP，生成最小 manifest，解释当前配置、安装记录和常用安装配置的区别，并提示信任与数据边界。',
    version: '0.1.0',
    files: {
        'SKILL.md': `---
name: mcp-config-helper
description: 创建或审查 MCP 安装配置时使用。适用于区分本地 stdio、本地 HTTP、npm 包、远端 HTTP MCP，生成最小 manifest，解释当前配置、安装记录和常用安装配置的区别，并提示信任与数据边界。
---

# MCP 配置助手

帮助用户把一个 MCP 使用需求整理成可安装、可审查、可复用的安装配置。这个 Skill 只负责设计和检查配置，不直接修改 MCP client 或运行时连接。

## 先判断类型

1. 本地 stdio：用户已有本地命令或脚本，通过标准输入输出通信。
2. 本地 HTTP：用户自己启动了本机服务，应用只记录连接地址和必要 headers。
3. npm 包：通过包名和启动参数生成 stdio 配置。
4. 远端 HTTP：连接第三方远程 MCP，需要明确外部服务、认证方式和数据边界。

## 工作流程

1. 先确认用户要做的是创建配置、导入配置、审查配置、保存常用安装配置，还是接管已有手工配置。
2. 收集 MCP 名称、显示名、transport、命令或 URL、参数、环境要求、认证方式和是否访问外部服务。
3. 生成最小安装配置草案，只保留安装管理层需要的字段。
4. 标出风险：外部服务、网络访问、可执行命令、认证信息、第三方来源。
5. 说明配置会先进入安装计划，用户确认后才写入应用管理记录。
6. 如果是已有手工配置，先建议接管；接管前不要承诺修复或卸载。

## 参考资料

- 配置草案和字段审查示例见 \`references/mcp-config-examples.md\`。

## 输出要求

- 先说明 MCP 类型和配置来源。
- 再给出最小安装配置草案，字段缺失时用占位说明，不编造真实密钥或个人路径。
- 单独列出需要用户确认的风险。
- 明确区分“当前配置”“安装记录”“常用安装配置”。
- 不承诺远端 registry；当前只支持内置、本地 manifest、导入和创建入口。
`,
        'references/mcp-config-examples.md': `# MCP 安装配置短示例

以下示例只表达字段结构，真实地址、命令和认证信息需要由用户确认。

## 本地 stdio

\`\`\`json
{
  "name": "my-local-mcp",
  "displayName": "我的本地 MCP",
  "transport": "stdio",
  "command": "node",
  "args": ["<server-entry>"],
  "scope": "user"
}
\`\`\`

## 本地 HTTP

\`\`\`json
{
  "name": "my-local-http-mcp",
  "displayName": "我的本地 HTTP MCP",
  "transport": "http",
  "url": "<local-mcp-url>",
  "scope": "user"
}
\`\`\`

## npm 包

\`\`\`json
{
  "name": "my-npm-mcp",
  "displayName": "我的 npm MCP",
  "installType": "stdio-npm-package",
  "package": "<package-name>",
  "scope": "user"
}
\`\`\`

## 远端 HTTP

\`\`\`json
{
  "name": "my-remote-mcp",
  "displayName": "我的远端 MCP",
  "transport": "http",
  "url": "<remote-mcp-url>",
  "scope": "user",
  "trust": {
    "thirdParty": true,
    "networkDeclared": true
  }
}
\`\`\`

审查时优先确认：来源是否可信、是否访问外部服务、是否需要认证、写入目标是否为用户全局、是否应该保存为常用安装配置。
`,
    },
};
//# sourceMappingURL=mcpConfigHelper.js.map