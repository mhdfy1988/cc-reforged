# 03 类型收口与 Guard 模式库

1. 动态 `require(...)` 能力收口禁止直接 `as ModuleView`，必须做运行时能力判定（如 `typeof x === 'function'`）。
2. SDK 输出禁止把内部消息直接 `as SDKMessage` 强转，必须通过显式 normalize 映射。
3. 诊断/状态页遇到 malformed 状态必须显式告警，禁止伪装成正常空态。
4. 合法但未建模状态必须可见（`unsupported/unavailable`），不能坍缩到既有分支。
5. 本地消息变体优先在消费文件内用“本地 pipeline 联合 + guard + 最小桥接”。
6. 认证互斥开关必须显式优先级，禁止冲突并存。
7. SDK shim 优先绑定构造器签名（如 `ConstructorParameters<typeof Client>[0]`）。
8. selector 丢泛型返回 `unknown` 时，优先本地 typed wrapper，禁止全局放宽。
9. 编译期常量分支报错时，优先“值不变 + 类型适度放宽”，禁止改运行语义。
10. 本地 pipeline 子消息类型必须对齐真实生产端形状。
11. 第三方 shim 修复需覆盖“主文件 + 真实消费点”，禁止 `[key: string]: unknown` 兜底。
12. guard 已完成收口后，应同轮清理不可达空值分支。
13. 判别式联合 guard 不能只验 `type` 存在，必须校验枚举值与分支关键字段。
14. 外部 profile/roles 写回前，必填字段 fail-closed；可选字段要区分 `null` 与 `undefined`。
15. guard 约束必须与上游可选字段契约一致，禁止误收紧。
16. 运行时有明确构造器时优先 `instanceof`，避免鸭子类型误判。
17. UUID 透传链统一 `validateUuid(...)`，非法值 fail-closed。
18. 失败联合类型先判别守卫收窄，再读失败字段。
19. 对“写路径 trusted gate”改造时，必须同时约束入口状态与隐藏状态（如 `isAdding*` / `isHidden`），避免 untrusted 下出现“页面被隐藏但写入弹窗不渲染”的空窗态。
20. 对 JSON 反序列化后的容器（如 `cells`）做 guard 时，不能只校验“是数组”；必须校验数组元素最小视图（字段与字段类型），并把下游字符串输入统一 fail-closed 收口。
21. 对功能必需的 override/adapter（例如决定真实 `.call()` 分发的 Computer Use overrides），禁止用可选链 + `?? {}` 静默降级；缺失时必须显式 fail-closed（抛错或显式不可用）。
22. 在 ESM/`verbatimModuleSyntax` 工程里，第三方包“缺类型声明”优先用本地 shim（`declare module`）补齐并保持标准 `import`；不要用顶层 `require` 把类型问题转成潜在运行时互操作问题。
23. 布尔判别联合读取失败分支字段时，优先用 `x.flag === false` 显式收窄；不要依赖 `!x.flag`，避免当前 TS 配置下失败分支字段无法收窄。
