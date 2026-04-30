# CCR Desktop 发布验收 Todo

## 当前任务列表（实时）

- [x] D0 发布验收边界与产物命名基线
- [x] D1 发布产物校验脚本与命令接入
- [x] D2 安装器人工验收 Runbook
- [x] D3 发布清单索引与下一阶段决策点

## 当前指针

- 进行中：D3 发布清单索引与下一阶段决策点
- 当前正在做：Desktop 发布验收准备第一阶段已完成；等待确认下一阶段要先做正式图标、代码签名、自动更新，还是 GitHub Release 发布流程。
- 完成后下一项：待确认下一阶段主线

## D0 发布验收边界与产物命名基线

状态：已完成。

目标：

- 明确当前阶段是 Desktop 发布验收准备，不是正式公开发布。
- 明确当前不会真实安装/卸载用户机器上的应用，避免影响当前环境。
- 明确安装器产物命名、`latest.yml` 元数据和实际文件必须一致。
- 修复 `latest.yml` 指向 `CCR-Desktop-*.exe`，但实际产物为 `CCR Desktop-*.exe` 的不一致问题。

完成标准：

- 产物命名规则写入 `package.json`。
- 重新生成 `desktop:dist` 后，`latest.yml` 的 `path/files.url` 与磁盘文件一致。
- 该问题写入发布验收文档。

当前进展：

- 已把 `package.json` 的 Windows 安装器命名改为 `CCR-Desktop-${version}-${os}-${arch}.${ext}`。
- 已重新运行 `npm.cmd run desktop:dist`，生成 `CCR-Desktop-0.2.0-win-x64.exe`、`.blockmap` 和 `latest.yml`。
- 已清理旧的 `CCR Desktop-0.2.0-win-x64.exe` 与旧 blockmap，避免人工验收误选旧产物。
- 已确认 `latest.yml` 中的 `path/files.url` 与实际产物一致。

## D1 发布产物校验脚本与命令接入

状态：已完成。

目标：

- 新增可重复执行的发布产物 smoke。
- 校验 installer、blockmap、`latest.yml`、文件大小和 SHA512。
- 命令接入 `package.json`，但不放入普通 `ci:smoke`，避免每次 CI 都要求存在安装器产物。

完成标准：

- 新增 `scripts/smoke-desktop-release-artifacts.mjs`。
- 新增 `npm.cmd run smoke:desktop-release-artifacts`。
- 在 `desktop:dist` 后运行通过。

当前进展：

- 已新增 `scripts/smoke-desktop-release-artifacts.mjs`。
- 已新增 npm 脚本 `smoke:desktop-release-artifacts`。
- 脚本会校验 installer、blockmap、`latest.yml`、文件大小和 SHA512。
- 已验证 `npm.cmd run smoke:desktop-release-artifacts` 通过。
- 该 smoke 不纳入普通 `ci:smoke`，避免没有安装器产物时阻塞开发态 CI。

## D2 安装器人工验收 Runbook

状态：已完成。

目标：

- 给出本机人工安装/卸载验收步骤。
- 明确哪些步骤会影响用户当前环境，哪些只是只读检查。
- 明确验收证据要保存哪些命令输出和日志位置。

完成标准：

- 新增发布验收 Runbook。
- 覆盖安装前、安装中、首次启动、App Server、日志、卸载、回滚。
- 明确未签名包不是正式发布。

当前进展：

- 已新增 [CCR Desktop 发布验收 Runbook](../architecture/desktop-release-acceptance-runbook.md)。
- 已覆盖安装前自动校验、人工安装、首次启动、日志、卸载、回滚和正式发布门禁。
- 已明确当前阶段不真实安装/卸载，不启用自动更新。

## D3 发布清单索引与下一阶段决策点

状态：已完成。

目标：

- 把新 todo 和 runbook 加入文档索引。
- 明确下一阶段要在正式图标、代码签名、自动更新、GitHub Release 之间选主线。

完成标准：

- `docs/README.md` 已加入入口。
- 当前 todo 回写完成状态。
- 如果所有准备项完成，todo gate 允许收口。

当前进展：

- 已把发布验收 Runbook 与本 todo 加入 `docs/README.md`。
- 已更新 [CCR Desktop 安装器与发布准备方案](../architecture/desktop-installer-release-readiness.md)，补充无空格安装器命名和 artifact smoke。
- 已验证 `npm.cmd run smoke:desktop-packaged` 通过。
- 已验证 `npm.cmd run ci:smoke` 通过。

## 后续记录（追加）

- 初始化：从 App Server/Desktop P0-P17 完成后拆出独立 Desktop 发布验收主线。当前阶段先做发布准备和校验，不实际安装/卸载，不启用自动更新，VS Code 继续延后。
- 第 1 轮：完成 Desktop 发布验收准备第一阶段。过程中发现真实发布风险：`latest.yml` 指向 `CCR-Desktop-0.2.0-win-x64.exe`，但旧产物实际为 `CCR Desktop-0.2.0-win-x64.exe`，后续自动更新会找不到文件。已将 `artifactName` 固定为无空格 `CCR-Desktop-${version}-${os}-${arch}.${ext}`，新增 `smoke:desktop-release-artifacts` 校验 installer / blockmap / latest.yml / size / SHA512，新增 [CCR Desktop 发布验收 Runbook](../architecture/desktop-release-acceptance-runbook.md)，并重新生成发布产物。`smoke:desktop-release-artifacts`、`smoke:desktop-packaged`、`ci:smoke` 均通过。

## 备注

- 当前状态：active
- 下一步需要：确认下一阶段主线；建议在正式图标、代码签名、自动更新、GitHub Release 发布流程之间选一个，不要同时展开。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop 发布验收准备。
- 当前非目标：不做真实用户环境安装/卸载、不做正式代码签名、不启用自动更新、不做 VS Code 插件。
