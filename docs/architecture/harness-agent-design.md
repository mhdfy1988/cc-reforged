# Harness Agent 架构设计

## 概述

Harness Agent 是一种**结构化、可观测、可控制**的 AI Agent 架构模式。核心思想是将 Agent 的执行过程从"黑盒对话"转变为**白盒流水线**，每个环节都可监控、可干预、可恢复。

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│                   (CLI / GUI / API)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Session   │  │    Event    │  │      Context        │ │
│  │   Layer     │  │   System    │  │     Manager         │ │
│  │             │  │             │  │                     │ │
│  │ • 生命周期   │  │ • 分类体系   │  │ • 窗口管理          │ │
│  │ • 状态机    │  │ • 订阅发布   │  │ • 摘要压缩          │ │
│  │ • 持久化    │  │ • 持久回放   │  │ • 动态检索          │ │
│  │ • 恢复机制   │  │ • 调用链追踪  │  │ • Token 预算        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Tool     │  │   Runtime   │  │     Agent Loop      │ │
│  │   System    │  │             │  │                     │ │
│  │             │  │             │  │                     │ │
│  │ • 分类分级   │  │ • 进程管理   │  │ • 调度决策          │ │
│  │ • 权限策略   │  │ • 资源隔离   │  │ • 错误恢复          │ │
│  │ • 参数校验   │  │ • 沙盒安全   │  │ • 终止判断          │ │
│  │ • 执行控制   │  │ • I/O 转发   │  │ • 人机协作节点       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Permission & Approval System                │ │
│  │         (权限分层 + 审批策略 + 紧急制动)                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           Checkpoint & Recovery System                   │ │
│  │              (快照 + 事件日志 + 状态重建)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Sub-Agent Layer                          │
│              (协调者-工作者 / 消息总线 / 层级委托)             │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Session Layer（会话层）

管理 Agent 实例的完整生命周期。

#### 状态机

```
  IDLE ──► PLANNING ──► EXECUTING ──► WAITING_APPROVAL ──► COMPLETED
   ▲         │              │                │                │
   │         │              │                └────────────────┘
   │         │              └────────────────► ERROR ─────────┘
   │         │                                    │
   └─────────┴────────────────────────────────────┘
        (用户输入 / 恢复 / 重试)
```

#### 核心设计

- 每个会话有唯一 `sessionId`
- 状态转换触发事件
- 定期快照 + 事件日志 = 可恢复

---

### 2. Event System（事件系统）

一切皆为事件，驱动整个系统运转。

#### 事件分类

| Source | Display Type | Visibility |
|--------|-------------|------------|
| user | text | isUserVisible |
| agent | thinking | isMeta |
| tool | code | requiresApproval |
| system | file | isCheckpoint |
| human | tool_call | |
| | tool_result | |
| | error | |
| | approval | |

#### 关联机制

```
tool_call (callId: "abc-123")
   │
   ├──► tool_output (callId: "abc-123") 流式输出
   └──► tool_result (callId: "abc-123") 最终结果
```

#### 追踪机制

- `traceId`: 贯穿用户请求到最终结果的完整链条
- `spanId`: 每个操作节点的标识
- `parentSpanId`: 层级关系

---

### 3. Context Manager（上下文管理）

在有限窗口内，保留最有价值的信息。

#### 分层存储

```
┌─────────────────────────────────────┐
│  Active Context (发送给 LLM)         │
│  [系统提示] + [摘要] + [近期详细]      │
│  总量 < maxTokens (如 8K)            │
└─────────────────────────────────────┘
              ↑
┌─────────────────────────────────────┐
│  Recent History (详细事件)            │
│  最近 N 条完整记录                     │
│  超量 → 触发压缩                      │
└─────────────────────────────────────┘
              ↑
┌─────────────────────────────────────┐
│  Summaries (压缩摘要)                 │
│  "Earlier: 用户要求添加登录功能，已    │
│   完成数据库设计和 API 接口..."        │
└─────────────────────────────────────┘
              ↑
┌─────────────────────────────────────┐
│  Archive (完整归档)                   │
│  向量索引，可检索                      │
└─────────────────────────────────────┘
```

---

### 4. Tool System（工具系统）

定义 Agent 能做什么，以及安全边界。

#### 分类体系

| 维度 | 级别 |
|------|------|
| Risk Level | safe → careful → dangerous → blocked |
| Domain | filesystem / shell / git / network / browser / agent-internal |
| Execution Mode | sync / async / streaming / interactive |
| Scope | local / project / global |

#### 权限策略（分层）

```
L1 Template ──► L2 Session ──► L3 Runtime ──► L4 User ──► L5 Emergency
(越上层优先级越高)
```

#### 审批模式

```
auto ──► once_per_session ──► once_per_target ──► always
```

---

### 5. Runtime（运行时）

工具的实际执行环境。

#### 类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| Host Runtime | 本地进程 | 开发环境 |
| Docker Runtime | 容器隔离 | 可复现环境 |
| Remote Runtime | 云端/服务器 | 生产环境 |
| Browser Runtime | 页面操作 | Operator 模式 |

#### 核心能力

- 进程管理：创建、监控、终止、信号传递
- 资源隔离：文件系统视图、网络限制、环境变量
- I/O 转发：stdout/stderr → 事件流 → UI

---

### 6. Agent Loop（执行循环）

主控制流，决定下一步做什么。

#### 基本循环

```
用户输入 → 构建上下文 → LLM 调用
                              │
                    ┌────────┴────────┐
                    ▼                 ▼
                 [文本回复]        [工具调用]
                    │                 │
                    │           权限检查 → 审批？
                    │                 │
                    │           Runtime 执行
                    │                 │
                    │           结果 → 上下文
                    │                 │
                    └────────┬────────┘
                             ▼
                         继续循环 / 结束
```

#### 高级变体

| 变体 | 说明 |
|------|------|
| Plan & Execute | 先规划，再分步执行，人类审批计划 |
| Multi-Agent | 协调者分解任务，多个工作者并行 |
| Streaming | 流式处理，实时响应 |

---

## Session vs Runtime

### 核心区别

| 维度 | Session | Runtime |
|------|---------|---------|
| 关注点 | 逻辑状态、历史、上下文 | 物理执行、进程、资源 |
| 类比 | 大脑的记忆和决策 | 手脚的实际动作 |
| 生命周期 | 长（整个对话/任务） | 短（单次工具执行） |
| 数量关系 | 一个 Session 可复用多个 Runtime | 一个 Runtime 可被多个 Session 使用 |
| 状态 | 有状态（累积历史） | 相对无状态（执行完即释放） |
| 持久化 | 必须（事件日志+快照） | 可选（进程日志） |

### 架构位置

```
┌─────────────────────────────────────────┐
│              Session Layer               │
│  ┌─────────────────────────────────────┐│
│  │  • 状态机 (IDLE/PLANNING/EXECUTING) ││
│  │  • 事件历史 (Event Store)            ││
│  │  • 上下文管理 (Context Manager)       ││
│  │  • 权限状态 (当前审批结果)            ││
│  │  • 检查点 (Checkpoint)               ││
│  └─────────────────────────────────────┘│
│                    │                    │
│         "我要执行这个工具"               │
│                    │                    │
│                    ▼                    │
│  ┌─────────────────────────────────────┐│
│  │           Agent Loop                ││
│  │  决策: 调用什么工具、何时调用、下一步  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
                    │
                    ▼ 执行请求 (callId, command, args)
┌─────────────────────────────────────────┐
│              Runtime Layer               │
│  ┌─────────────────────────────────────┐│
│  │  • 进程创建 (spawn)                 ││
│  │  • I/O 转发 (stdout/stderr → 事件)  ││
│  │  • 资源隔离 (文件系统/网络/环境变量)  ││
│  │  • 超时控制                         ││
│  │  • 信号处理 (kill/terminate)        ││
│  └─────────────────────────────────────┘│
│                    │                    │
│                    ▼                    │
│           操作系统进程/容器/远程机器        │
└─────────────────────────────────────────┘
```

### 交互流程

```
用户: "读取文件并搜索内容"
    │
    ▼
┌─────────────────────────────────────────┐
│ Session                                 │
│ 状态: idle                              │
│                                         │
│ 1. 添加 user_message 事件                │
│ 2. 状态: idle → planning                 │
│ 3. 构建上下文                            │
│ 4. 调用 LLM                              │
└─────────────────────────────────────────┘
    │
    ▼ LLM 返回: tool_call (read_file)
┌─────────────────────────────────────────┐
│ Session                                 │
│                                         │
│ 5. 添加 tool_call 事件                   │
│    callId: "call-001"                   │
│ 6. 状态: planning → executing            │
│                                         │
│ 7. 检查权限: read_file = safe, auto      │
│                                         │
│ 8. 调用 Runtime.execute({               │
│      callId: "call-001",                │
│      command: "cat",                    │
│      args: ["config.txt"],              │
│      timeout: 30000                     │
│    })                                   │
└─────────────────────────────────────────┘
    │
    ▼ 执行请求
┌─────────────────────────────────────────┐
│ Runtime (HostRuntime)                   │
│                                         │
│ 9. spawn("cat", ["config.txt"])         │
│ 10. 进程 PID: 12345                     │
│ 11. stdout 收到数据: "hello world"       │
│ 12. 转发输出: onOutput("hello world")    │
│ 13. 进程 exit: code 0                   │
│ 14. 返回结果: { exitCode: 0 }           │
└─────────────────────────────────────────┘
    │
    ▼ 执行结果
┌─────────────────────────────────────────┐
│ Session                                 │
│                                         │
│ 15. 添加 tool_result 事件                │
│     callId: "call-001" (匹配!)          │
│     status: "success"                   │
│     output: "hello world"               │
│                                         │
│ 16. 状态: executing → planning          │
│ 17. 更新上下文（包含工具结果）             │
│ 18. 再次调用 LLM...                      │
└─────────────────────────────────────────┘
```

### 关键设计差异

| 场景 | Session 处理 | Runtime 处理 |
|------|-------------|--------------|
| 工具执行失败 | 决策：重试/跳过/终止/换工具 | 返回错误码和 stderr |
| 超时 | 决策：是否继续等待/取消 | 发送 SIGTERM/SIGKILL |
| 输出过大 | 决策：截断/分页/存文件 | 继续读取，不做判断 |
| 并发执行 | 管理多个 pending call | 同时 spawn 多个进程 |
| 安全策略 | 根据工具分类决定是否允许 | 实施沙盒限制（chroot/cgroup） |
| 审计日志 | 记录完整事件序列 | 记录进程日志 |

---

## 关键机制

### 调用链追踪

```
用户: "帮我部署服务"
  │
  ▼ traceId: deploy-001
┌────────────────────────────────────────┐
│ Coordinator Agent                      │
│  span: coordinator-root                │
│  "分解任务..."                          │
│     │                                  │
│     ├──► Worker-1 (代码构建)            │
│     │      span: build-001             │
│     │      parent: coordinator-root    │
│     │      "npm run build"             │
│     │      │                           │
│     │      ├──► Runtime: shell         │
│     │      │      span: shell-001      │
│     │      │      "node build.js"      │
│     │      │      耗时: 30s            │
│     │      │                           │
│     │      └──► Result: success        │
│     │                                  │
│     ├──► Worker-2 (Docker 打包)         │
│     │      span: docker-001            │
│     │      "docker build..."           │
│     │      耗时: 60s                   │
│     │                                  │
│     └──► Worker-3 (K8s 部署)            │
│            span: k8s-001               │
│            "kubectl apply..."          │
│            耗时: 15s                   │
│                                        │
│  Result: 全部成功                       │
│  总耗时: 105s                          │
│  瓶颈: Docker 打包 (60s)               │
└────────────────────────────────────────┘
```

### 顺序保证

```typescript
// 显式依赖声明
const toolCalls: ToolCall[] = [
  {
    id: 'call-1',
    toolName: 'read_file',
    arguments: { path: 'config.json' },
    execution: { mode: 'sequential' }
  },
  {
    id: 'call-2',
    toolName: 'write_file',
    arguments: { path: 'config.json', content: '...' },
    execution: {
      mode: 'sequential',
      dependsOn: ['call-1']
    }
  },
  {
    id: 'call-3',
    toolName: 'run_build',
    arguments: {},
    execution: {
      mode: 'sequential',
      dependsOn: ['call-2']
    }
  }
];

// 执行顺序: A → B → C (拓扑排序)
```

### 子 Agent 协作

#### 模式一: Coordinator-Worker

```
Coordinator: "开发登录功能"
  ├──► Designer: 设计 API 接口
  ├──► Developer: 实现代码
  ├──► Tester: 编写测试
  └──► Reviewer: 代码审查
Coordinator 整合结果
```

#### 模式二: Message Bus

```
Agent-A (前端) ←──共享状态──→ Agent-B (后端)
     │                           │
     └──► 订阅: api.contract ────┘
          变更时自动同步
```

#### 模式三: Hierarchical

```
CEO Agent
  └──► PM Agent
         ├──► Dev Agent
         │      └──► Tool: code
         │
         └──► QA Agent
                └──► Tool: test
```

---

## 会话模板

### 代码助手模板

```typescript
const codeAssistantTemplate: SessionTemplate = {
  id: 'code-assistant',
  name: '代码助手',
  description: '协助代码编写、调试和重构',

  config: {
    model: 'claude-sonnet-4',
    maxTokens: 4096,
    temperature: 0.2,
    persistence: {
      saveInterval: 30000,
      maxHistoryEvents: 1000,
      retentionDays: 30
    }
  },

  tools: [
    { name: 'read_file', riskLevel: 'safe', approval: 'auto' },
    { name: 'write_file', riskLevel: 'careful', approval: 'once_per_target' },
    { name: 'list_directory', riskLevel: 'safe', approval: 'auto' },
    { name: 'search_files', riskLevel: 'safe', approval: 'auto' },
    { name: 'run_test', riskLevel: 'careful', approval: 'auto', timeout: 60000 },
    {
      name: 'execute_command',
      riskLevel: 'dangerous',
      approval: 'always',
      constraints: {
        allowedCommands: ['npm', 'node', 'git', 'python'],
        blockedPatterns: ['rm -rf /', '> /etc/', 'curl.*\\|.*sh'],
        maxDuration: 300000
      }
    }
  ],

  permissions: {
    filesystem: {
      read: ['${PROJECT_ROOT}/**'],
      write: ['${PROJECT_ROOT}/**'],
      blocked: ['${PROJECT_ROOT}/.env', '${PROJECT_ROOT}/node_modules/**']
    },
    network: {
      allowed: ['https://api.github.com', 'https://registry.npmjs.org'],
      blocked: ['*']
    }
  },

  humanInTheLoop: {
    autoApprove: ['safe', 'careful'],
    requireApproval: [
      { tool: 'write_file', when: 'target_exists' },
      { tool: 'execute_command', when: 'risk_level >= dangerous' },
      { pattern: 'git push', when: 'branch == main' }
    ],
    planApproval: {
      mode: 'major_steps',
      skipIf: 'all_tools_safe'
    }
  },

  contextTemplate: {
    systemPrompt: `你是专业的代码助手，帮助用户编写高质量代码。
当前项目: {{projectName}}
技术栈: {{techStack}}

规则:
1. 优先读取现有代码风格，保持一致性
2. 修改前备份或确认
3. 提供清晰的代码注释
4. 运行测试验证修改`,

    variables: {
      projectName: { source: 'git', path: 'remote.origin.url' },
      techStack: { source: 'file', path: 'package.json', extract: 'dependencies' }
    },

    contextWindow: {
      maxTokens: 8000,
      retention: {
        recentMessages: 10,
        summaryOlderThan: 5,
        keepToolResults: 'last_20'
      }
    }
  }
};
```

---

## 设计原则

| 原则 | 体现 |
|------|------|
| **事件驱动** | 一切操作产生事件，便于观测和回放 |
| **显式状态** | 状态机驱动，拒绝隐式逻辑 |
| **Fail Fast** | 错误尽早暴露，不静默吞掉 |
| **可恢复** | 快照 + 事件日志 = 任意时刻恢复 |
| **可审计** | 完整调用链，每个操作可追溯 |
| **最小权限** | 工具默认安全，按需提升 |
| **人机协作** | 关键节点必须可介入、可审批 |

---

## 完整数据流示例

```
用户输入: "添加用户登录功能"
    │
    ▼
Session: 状态 IDLE → PLANNING
    │
    ▼
Context Manager: 构建上下文
    [系统提示] + [项目摘要] + [当前消息]
    │
    ▼
Agent Loop: 调用 LLM
    │
    ▼
LLM 输出 Plan (多步骤)
    │
    ▼
Event: plan_created (requiresApproval: true)
    │
    ▼
UI: 渲染 PlanApprovalCard
用户确认
    │
    ▼
Agent Loop: 执行 Step 1
    │
    ▼
Tool Call: read_file("auth.ts")
    callId: "call-001"
    │
    ▼
Permission Check: safe, auto approve
    │
    ▼
Runtime: HostRuntime.execute()
    │
    ▼
Event: tool_call (callId: "call-001")
Event: tool_result (callId: "call-001", status: "success")
    │
    ▼
Context Manager: 添加结果到上下文
    │
    ▼
Agent Loop: 执行 Step 2
    │
    ▼
Tool Call: write_file("login.ts", "...")
    callId: "call-002"
    │
    ▼
Permission Check: careful, once_per_target
    首次 → 需要审批
    │
    ▼
Event: approval_requested
UI: 渲染 ApprovalCard
用户批准
    │
    ▼
Runtime: execute
    │
    ▼
Event: tool_result (callId: "call-002", status: "success")
    │
    ▼
... (继续执行后续步骤)
    │
    ▼
所有步骤完成
Session: 状态 EXECUTING → COMPLETED
Checkpoint: 保存最终状态
```
