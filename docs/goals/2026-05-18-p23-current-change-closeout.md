# Goal: P23 当前改动提交前收口

## 目标

把 P23 多模态收口后产生的插队改动整理成一个干净基线，并提交到远端仓库。

本 goal 只处理当前工作区已有改动：

- `CHANGELOG.md` 当前未发布说明分类整理。
- 智能强度 / 推理强度后续规划文档。
- Desktop 工具错误分类展示补丁。
- `smoke:desktop-display-events` 对错误分类的回归覆盖。

完成后，本地 `main` 应有一个新的 commit，并 push 到 `origin/main`。不打包，不发布，不生成安装包。

## 迭代 1：目标拆解

第一轮目标是把“当前改动”定义清楚，避免继续扩散。

要做：

1. 确认 git diff 只包含当前收口范围。
2. 确认 `CHANGELOG.md` 的 `Unreleased` 已按“新功能 / 改动 / BUG 修复”三类展示。
3. 确认推理强度只作为后续功能记录在设计和 todo 文档中，不进入本轮代码实现。
4. 确认工具错误分类补丁只覆盖：
   - 大文件读取超限 -> `file_too_large`。
   - 缺失打包工具二进制 `spawn ... ENOENT` -> `command_not_found`。
5. 跑提交前验证。
6. commit + push。

## 迭代 2：边界收紧

第二轮在执行前收紧范围，避免把后续稳定层提前混入当前提交。

本轮不做：

- 不实现 `STD-TOOL-02`。
- 不抽 `CcrContentBlock`。
- 不做 `ErrorSnapshot` 新 UI。
- 不实现智能强度菜单。
- 不新增 provider。
- 不打包、不发布。

本轮验收重点：

- 当前文档能解释“接下来为什么做稳定层”。
- 当前代码只修已有错误分类，不改变工具协议主链路。
- 验证通过后提交信息应表达“P23 closeout / display error classification / docs”这类收口含义。

## 验收标准

- `CHANGELOG.md` 未发布内容已经分类。
- 推理强度规划已进入多供应商设计和 todo。
- 工具错误分类 fixture 覆盖大文件读取和缺失 helper 二进制。
- 提交前验证通过：
  - `npm.cmd run typecheck`
  - `npm.cmd run desktop:build`
  - `npm.cmd run smoke:desktop-display-events`
  - `git diff --check`
- 生成一个本地 commit，并 push 到 `origin/main`。

## 后续

本 goal 完成后，再为稳定层第一项单独开新 goal：

- `STD-TOOL-02 Provider 工具协议第一版收口`

后续每个具体任务继续保持“先 goal，至少两轮迭代，再执行”的节奏。

## 执行结果

状态：已完成验证，等待提交。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run desktop:build`
- `npm.cmd run smoke:desktop-display-events`
- `git diff --check`

本轮确认：

- `CHANGELOG.md` 已按“新功能 / 改动 / BUG 修复”三类整理。
- 智能强度 / 推理强度只进入后续规划，不在本轮实现。
- 工具错误分类只补大文件读取和缺失 helper 二进制两个可观测问题。
- 当前不打包、不发布。
