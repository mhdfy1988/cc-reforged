import { getInitialSettings } from '../utils/settings/settings.js'
import { getTeamFilePath } from '../utils/swarm/teamHelpers.js'
import { getKairosActive, setKairosActive } from '../bootstrap/state.js'
import type { AppState } from '../state/AppStateStore.js'

let assistantForced = false

function getAssistantName(): string {
  const settings = getInitialSettings()
  const configuredName = (settings as { assistantName?: string }).assistantName?.trim()
  return configuredName && configuredName.length > 0 ? configuredName : 'assistant'
}

export function markAssistantForced(): void {
  assistantForced = true
}

export function isAssistantForced(): boolean {
  return assistantForced
}

export function isAssistantMode(): boolean {
  const settings = getInitialSettings() as { assistant?: boolean }
  return assistantForced || getKairosActive() || settings.assistant === true
}

export async function initializeAssistantTeam(): Promise<
  NonNullable<AppState['teamContext']>
> {
  if (!getKairosActive()) {
    setKairosActive(true)
  }

  const assistantName = getAssistantName()
  const teamName = assistantName

  return {
    teamName,
    teamFilePath: getTeamFilePath(teamName),
    leadAgentId: assistantName,
    selfAgentId: assistantName,
    selfAgentName: assistantName,
    isLeader: true,
    teammates: {},
  }
}

export function getAssistantSystemPromptAddendum(): string {
  const assistantName = getAssistantName()
  return [
    '# Assistant Mode',
    '',
    `You are running as ${assistantName}.`,
    'Stay concise, proactive, and focused on helping the user complete coding work.',
  ].join('\n')
}

export function getAssistantActivationPath(): string {
  return '.claude/agents/assistant.md'
}
