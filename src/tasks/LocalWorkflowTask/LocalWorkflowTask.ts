import type { AppState } from '../../state/AppState.js'
import type { Task, TaskStateBase } from '../../Task.js'
import { evictTaskOutput } from '../../utils/task/diskOutput.js'
import { updateTaskState } from '../../utils/task/framework.js'

export type LocalWorkflowTaskState = TaskStateBase & {
  type: 'local_workflow'
  workflowId?: string
  runId?: string
  workflowName?: string
  summary?: string
  agentCount: number
  agentControllers?: Map<string, AbortController>
}

export function isLocalWorkflowTask(task: unknown): task is LocalWorkflowTaskState {
  return (
    typeof task === 'object' &&
    task !== null &&
    'type' in task &&
    task.type === 'local_workflow'
  )
}

type SetAppStateFn = (updater: (prev: AppState) => AppState) => void

export async function killWorkflowTask(
  taskId: string,
  setAppState: SetAppStateFn,
): Promise<void> {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task
    }

    for (const controller of task.agentControllers?.values() ?? []) {
      controller.abort()
    }

    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
      notified: true,
      agentControllers: undefined,
    }
  })

  await evictTaskOutput(taskId)
}

export const LocalWorkflowTask: Task = {
  name: 'Local Workflow',
  type: 'local_workflow',
  async kill(taskId, setAppState): Promise<void> {
    await killWorkflowTask(taskId, setAppState)
  },
}
