import { getMemoryScopeDisplay } from '../../tools/AgentTool/agentMemory.js';
export function SnapshotUpdateDialog(_props) {
    return null;
}
export function buildMergePrompt(agentType, scope) {
    const scopeDisplay = getMemoryScopeDisplay(scope);
    return [
        `请先检查 ${agentType} 的持久记忆是否需要与较新的快照合并。`,
        `记忆范围：${scopeDisplay}`,
        '如果快照内容有价值，请在继续当前任务前先完成合并，再继续回答用户请求。',
    ].join('\n');
}
//# sourceMappingURL=SnapshotUpdateDialog.js.map