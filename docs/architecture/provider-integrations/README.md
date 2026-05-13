# 供应商接入文档

这里记录 CCR 每个内置 LLM 供应商的接入方式。截至 `0.4.3`，已接入 Codex OAuth、DeepSeek、MiniMax 国际版和 MiniMax 国内版。

文档关注：

- 供应商 ID、协议和认证方式
- Profile 与凭据如何落盘
- 请求链路如何进入统一 LLM Runtime
- smoke 覆盖了哪些关键不变式

当前文档：

| 供应商 | 文档 |
| --- | --- |
| Codex OAuth | [codex-oauth.md](./codex-oauth.md) |
| DeepSeek | [deepseek.md](./deepseek.md) |
| MiniMax 国际版 / 国内版 | [minimax.md](./minimax.md) |

新增供应商时，优先在本目录新增同名文档，并同步补对应 smoke。公共协议差异先落在 adapter，再由具体 provider 只保留供应商差异。
