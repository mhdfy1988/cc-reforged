import { evictTaskOutput } from '../../utils/task/diskOutput.js';
import { updateTaskState } from '../../utils/task/framework.js';
export function isMonitorMcpTask(task) {
    return (typeof task === 'object' &&
        task !== null &&
        'type' in task &&
        task.type === 'monitor_mcp');
}
export async function killMonitorMcp(taskId, setAppState) {
    updateTaskState(taskId, setAppState, task => {
        if (task.status !== 'running') {
            return task;
        }
        task.abortController?.abort();
        return {
            ...task,
            status: 'killed',
            endTime: Date.now(),
            notified: true,
            abortController: undefined,
        };
    });
    await evictTaskOutput(taskId);
}
export function killMonitorMcpTasksForAgent(agentId, getAppState, setAppState) {
    const tasks = getAppState().tasks ?? {};
    for (const [taskId, task] of Object.entries(tasks)) {
        if (isMonitorMcpTask(task) &&
            task.agentId === agentId &&
            task.status === 'running') {
            void killMonitorMcp(taskId, setAppState);
        }
    }
}
export const MonitorMcpTask = {
    name: 'Monitor MCP',
    type: 'monitor_mcp',
    async kill(taskId, setAppState) {
        await killMonitorMcp(taskId, setAppState);
    },
};
//# sourceMappingURL=MonitorMcpTask.js.map