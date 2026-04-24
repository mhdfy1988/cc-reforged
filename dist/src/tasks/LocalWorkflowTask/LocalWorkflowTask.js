import { evictTaskOutput } from '../../utils/task/diskOutput.js';
import { updateTaskState } from '../../utils/task/framework.js';
export function isLocalWorkflowTask(task) {
    return (typeof task === 'object' &&
        task !== null &&
        'type' in task &&
        task.type === 'local_workflow');
}
export async function killWorkflowTask(taskId, setAppState) {
    updateTaskState(taskId, setAppState, task => {
        if (task.status !== 'running') {
            return task;
        }
        for (const controller of task.agentControllers?.values() ?? []) {
            controller.abort();
        }
        return {
            ...task,
            status: 'killed',
            endTime: Date.now(),
            notified: true,
            agentControllers: undefined,
        };
    });
    await evictTaskOutput(taskId);
}
export const LocalWorkflowTask = {
    name: 'Local Workflow',
    type: 'local_workflow',
    async kill(taskId, setAppState) {
        await killWorkflowTask(taskId, setAppState);
    },
};
//# sourceMappingURL=LocalWorkflowTask.js.map