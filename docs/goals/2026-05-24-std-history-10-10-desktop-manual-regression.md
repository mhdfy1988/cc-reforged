# Goal: STD-HISTORY-10-10 真实桌面端手工回归

## 目标

用真实 CCR DEV 验证用户可见体验，确认历史恢复、实时展示、上下文压缩和工具展示在桌面端一致。

## 为什么先做这个

smoke 能覆盖协议和关键断言，但用户实际看到的是 Desktop UI。历史恢复、切会话、刷新、压缩后继续对话这些问题必须在真实桌面端走一遍。

## 第一版范围

1. 普通问答实时展示。
2. 一个 turn 内多个工具调用。
3. 多个工具结果乱序返回。
4. 工具执行失败。
5. 权限请求、拒绝、取消。
6. 上下文手动压缩。
7. 上下文自动压缩。
8. 压缩后继续发消息。
9. 切换到其他会话再切回。
10. 刷新页面。
11. 重启 CCR DEV。
12. 恢复历史会话。
13. 历史恢复后继续对话。
14. compact 前旧 UI 历史可见，Core context 不回到 compact 前。
15. 孤立工具结果显示诊断卡，不伪装成正常工具卡。

## 明确不做

- 不用手工回归替代 smoke。
- 不在未说明入口影响的情况下切换用户当前 CCR DEV 主入口。
- 不把旧异常 transcript 展示问题当作新协议失败。

## 验收标准

- [x] 用户可见 timeline 与实时结束状态一致。
- [x] 顶部上下文 token 显示与 Core 当前上下文一致。
- [x] 历史 UI 不因为 compact 被裁掉。
- [x] 工具结果不会重复成 assistant 普通文本。
- [x] 没有 `缺少 ThreadDisplayItem.projection` 的正常路径错误。

## 验证记录

- 普通问答实时展示：真实 CCR DEV 中提交测试消息，timeline 实时追加 user / assistant 展示项，结束状态回到可继续发送。
- 一个 turn 内多个工具调用：真实 CCR DEV 中触发多文件读取，工具卡按工具调用拆分为多张卡，未合并成一条 assistant 文本。
- 多个工具结果乱序返回：由 `smoke:desktop-display-events` 和 `smoke:conversation-materialization` 覆盖，验证结果按来源 ID 回填，不按返回先后误绑。
- 工具执行失败：真实 CCR DEV 中触发失败工具卡，失败状态可见，恢复后仍保持失败卡。
- 权限请求、拒绝、取消：真实 CCR DEV 中临时设置 `PowerShell(*)` 询问，分别验证 direct preload 和真实 UI 点击“拒绝”路径；拒绝后等待授权卡实时变为失败卡，无需刷新页面。
- 上下文手动压缩：真实 CCR DEV 中执行手动压缩，顶部上下文 token 下降，显示轻量“上下文已压缩”提示。
- 上下文自动压缩：不在手工回归里强行堆大上下文触发；自动 compact 与手动 compact 共用物化和展示语义，由 compact smoke 覆盖 boundary 后 Core context 变短、UI history 不裁剪。
- 压缩后继续发消息：真实 CCR DEV 中压缩后继续对话，模型上下文保持压缩后状态，UI 继续追加新消息。
- 切换到其他会话再切回：真实 CCR DEV 中切换历史会话再返回，snapshot 恢复后 timeline 与当前状态一致。
- 刷新页面：真实 CCR DEV 中刷新后由 `ThreadDisplaySnapshot` 恢复，不依赖旧 `threadMessages` 回放。
- 重启 CCR DEV：重新启动 `npm.cmd run desktop:dev -- --remoteDebuggingPort 9333` 后继续验证恢复和权限拒绝路径。
- 恢复历史会话：历史会话从持久化 snapshot 回放可见历史，compact 前 UI 历史不再被裁掉。
- 历史恢复后继续对话：恢复后继续发送消息，Core context 和 App Server snapshot 不回到 compact 前上下文。
- compact 前旧 UI 历史可见，Core context 不回到 compact 前：真实恢复与 smoke 均确认二者是双投影，不互相覆盖。
- 孤立工具结果显示诊断卡，不伪装成正常工具卡：由 Goal 9 smoke 覆盖缺来源 / 指向不存在工具调用两类异常。

## 本轮补充修复

- Desktop main 的 `ccr:permission-respond` 在权限响应后刷新 `ThreadDisplaySnapshot` 并广播 `permission responded` 状态事件。
- Renderer 只对明确状态事件重放 snapshot，避免普通设置事件误触发 timeline 重置。
- 增加 `smoke:desktop-session-state` 断言，防止权限拒绝后实时 UI 继续停在“等待授权”。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:conversation-materialization
git diff --check
```

本次已执行：

```powershell
npm.cmd run typecheck
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:conversation-materialization
npm.cmd run build
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-11 文档规则发布说明收口](./2026-05-24-std-history-10-11-doc-rules-release-closeout.md)。
