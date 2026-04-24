import type { AppState } from '../../state/AppState.js'
import type { Task, TaskStateBase } from '../../Task.js'
import type { AgentId } from '../../types/ids.js'
import { evictTaskOutput } from '../../utils/task/diskOutput.js'
import { updateTaskState } from '../../utils/task/framework.js'

export type MonitorMcpTaskState = TaskStateBase & {
  type: 'monitor_mcp'
  serverName?: string
  resourceName?: string
  agentId?: string
  abortController?: AbortController
}

export function isMonitorMcpTask(task: unknown): task is MonitorMcpTaskState {
  return (
    typeof task === 'object' &&
    task !== null &&
    'type' in task &&
    task.type === 'monitor_mcp'
  )
}

type SetAppStateFn = (updater: (prev: AppState) => AppState) => void

export async function killMonitorMcp(
  taskId: string,
  setAppState: SetAppStateFn,
): Promise<void> {
  updateTaskState<MonitorMcpTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task
    }

    task.abortController?.abort()
    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
      notified: true,
      abortController: undefined,
    }
  })

  await evictTaskOutput(taskId)
}

export function killMonitorMcpTasksForAgent(
  agentId: AgentId,
  getAppState: () => AppState,
  setAppState: SetAppStateFn,
): void {
  const tasks = getAppState().tasks ?? {}
  for (const [taskId, task] of Object.entries(tasks)) {
    if (
      isMonitorMcpTask(task) &&
      task.agentId === agentId &&
      task.status === 'running'
    ) {
      void killMonitorMcp(taskId, setAppState)
    }
  }
}

export const MonitorMcpTask: Task = {
  name: 'Monitor MCP',
  type: 'monitor_mcp',
  async kill(taskId, setAppState): Promise<void> {
    await killMonitorMcp(taskId, setAppState)
  },
}
