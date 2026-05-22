# CCR 文件搜索链路修复记录

## 目标

把 `Glob`、`Grep`、文件补全、全局搜索和诊断中共同依赖的 ripgrep 链路收敛成可观测、可兜底、可测试的实现。第一阶段先解决开发版和打包态缺少 `rg` 时直接 `ENOENT` 的问题。

## 当前链路

- `src/utils/ripgrep.ts` 是统一入口，提供 `ripGrep()`、`ripGrepStream()`、`countFilesRoundedRg()` 和 `getRipgrepStatus()`。
- `src/utils/glob.ts` 通过 `ripGrep(['--files', ...])` 支撑 `Glob` 工具。
- `src/tools/GrepTool/GrepTool.ts` 通过 `ripGrep()` 支撑内容搜索、文件命中列表和计数。
- `src/hooks/fileSuggestions.ts` 优先走 `git ls-files`，失败后走 `ripGrep(['--files', ...])`。
- `src/components/GlobalSearchDialog.tsx` 走 `ripGrepStream()` 做全局搜索流式结果。
- `src/utils/markdownConfigLoader.ts` 已经有 markdown native fallback；当前 `ripGrep()` 底层兜底后也能覆盖默认路径。
- `src/utils/doctorDiagnostic.ts` 读取 `getRipgrepStatus()` 用于诊断展示。

## 已完成

- 当内置 `dist/src/utils/vendor/ripgrep/.../rg(.exe)` 不存在时，优先回退到系统 `rg`。
- 新增 `scripts/prepare-ripgrep-vendor.mjs`，按当前平台从 `@vscode/ripgrep-<platform>-<arch>` 准备 `vendor/ripgrep/<arch-platform>/rg(.exe)`。
- `postbuild` 会把 `vendor/ripgrep` 复制到 `dist/src/utils/vendor/ripgrep`，让运行时的内置路径真实存在。
- 当前 Windows x64 已准备 `vendor/ripgrep/x64-win32/rg.exe`，并复制到 `dist/src/utils/vendor/ripgrep/x64-win32/rg.exe`。
- 当内置 `rg` 和系统 `rg` 都不可用，或进程返回 `ENOENT` / `EACCES` / `EPERM` 时，`ripGrep()` 会走 Node 原生文件搜索兜底。
- `ripGrepStream()` 在同类错误下也会走 Node 原生内容搜索兜底，覆盖全局搜索入口。
- 原生兜底支持：
  - `--files`
  - `--glob` / `-g` 的包含与排除
  - `--type` 常见类型映射
  - `-l` 文件命中列表
  - `-c` 命中计数
  - `-n` 行号
  - `-i` 忽略大小写
  - `-F` 字面量搜索
  - `-e` 明确 pattern
  - `-A` / `-B` / `-C` 简单上下文
  - `-m` 单文件命中上限
  - `--max-columns` 长行截断
- 新增 `smoke:file-search`，强制清空 PATH 模拟无系统 `rg`，验证 `Glob`、`Grep` 和 stream 都可用。
- 发布流水线和桌面打包入口会在构建/打包前执行 `prepare:ripgrep`，只准备当前目标平台对应的 `rg` 二进制。
- `ci:smoke` 已纳入 `prepare:ripgrep`、`smoke:ripgrep-vendor` 和 `smoke:file-search`，避免发布前漏掉文件搜索链路。
- Doctor 诊断会区分真实 `rg` 可用、真实 `rg` 不可用但 native fallback 可用、以及搜索链路不可用三种状态，避免只显示 `Not working`。

## 验收命令

```powershell
npm.cmd run typecheck
npm.cmd run prepare:ripgrep
npm.cmd run build
npm.cmd run smoke:ripgrep-vendor
npm.cmd run smoke:file-search
git diff --check
```

本轮复核结果：以上命令均已通过。

## 已知边界

- 原生 fallback 是保底实现，不替代 ripgrep 的完整语义；极复杂正则、多行正则和超大仓库仍应优先使用真实 `rg`。
- 0.6.x 阶段只保证 `rg` 缺失或被系统拦截时基础文件搜索可用；后续如果要扩大原生 fallback 语义，应单独建新 todo，避免把第一阶段继续拉长。
