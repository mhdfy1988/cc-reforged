import { getInitialSettings } from '../utils/settings/settings.js';
import { getTeamFilePath } from '../utils/swarm/teamHelpers.js';
import { getKairosActive, setKairosActive } from '../bootstrap/state.js';
let assistantForced = false;
function getAssistantName() {
    const settings = getInitialSettings();
    const configuredName = settings.assistantName?.trim();
    return configuredName && configuredName.length > 0 ? configuredName : 'assistant';
}
export function markAssistantForced() {
    assistantForced = true;
}
export function isAssistantForced() {
    return assistantForced;
}
export function isAssistantMode() {
    const settings = getInitialSettings();
    return assistantForced || getKairosActive() || settings.assistant === true;
}
export async function initializeAssistantTeam() {
    if (!getKairosActive()) {
        setKairosActive(true);
    }
    const assistantName = getAssistantName();
    const teamName = assistantName;
    return {
        teamName,
        teamFilePath: getTeamFilePath(teamName),
        leadAgentId: assistantName,
        selfAgentId: assistantName,
        selfAgentName: assistantName,
        isLeader: true,
        teammates: {},
    };
}
export function getAssistantSystemPromptAddendum() {
    const assistantName = getAssistantName();
    return [
        '# Assistant Mode',
        '',
        `You are running as ${assistantName}.`,
        'Stay concise, proactive, and focused on helping the user complete coding work.',
    ].join('\n');
}
export function getAssistantActivationPath() {
    return '.claude/agents/assistant.md';
}
//# sourceMappingURL=index.js.map