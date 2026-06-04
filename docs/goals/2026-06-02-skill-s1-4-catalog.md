# Goal S-1.4：SkillCatalog 查询、分组和去重

## 1. 目标

新增 `SkillCatalog`，集中管理当前可用 skill 集合的排序、过滤、查找、分组和去重规则。

这一阶段仍不改变外部行为，先让集合语义从散落的数组 filter 中独立出来。

## 2. 范围

新增建议文件：

```text
src/skills/skillCatalog.ts
```

实现能力：

- `createSkillCatalog(packages)`
- `list()`
- `findByName(name)`
- `findById(id)`
- `groupBySource()`
- `filterModelInvocable()`
- `filterUserInvocable()`
- `dedupeByIdentity()`
- `sortForPrompt()`
- `toPromptCommands(adapter)`

## 3. 排序策略

第一版沿用现有用户可见优先级，不擅自重排。

建议优先级：

```text
project
user
managed / policy
plugin
mcp
bundled
legacy-command
```

最终排序还应按 `name` 稳定排序，确保测试可预测。

## 4. 去重策略

第一版先支持两类去重：

### 4.1 文件身份去重

同一个 `SKILL.md` 通过不同路径读到，只保留一份。

依据：

- canonical file path
- realpath identity

### 4.2 名称冲突检测

同名不同来源不静默覆盖，应产生明确 conflict / warning 信息。

第一版可以先保留现有优先级行为，但必须把冲突写入 catalog diagnostics，给后续 Desktop 展示。

## 5. 过滤策略

`filterModelInvocable()`：

- 排除 `invocation.modelInvocable === false`

`filterUserInvocable()`：

- 排除 `invocation.userInvocable === false`

注意：这两个过滤语义不能混用。

## 6. 非目标

- 不读取文件。
- 不做安装候选。
- 不做安全扫描。
- 不修改 `SkillTool` prompt 格式。
- 不引入复杂缓存。

## 7. 验收标准

- catalog 能按 name 找到 skill。
- catalog 能按 source 分组。
- catalog 能过滤 model-invocable skill。
- catalog 能过滤 user-invocable skill。
- 同一文件重复加载时能去重。
- 同名不同来源能产出 diagnostics。
- 排序稳定，测试可重复。

## 8. 建议测试

- project / user / plugin 混合排序。
- `modelInvocable=false` 过滤。
- `userInvocable=false` 过滤。
- 同 path 去重。
- 同 name 不同 path 冲突诊断。

