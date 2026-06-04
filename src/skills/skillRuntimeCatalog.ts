import type { Command } from '../types/command.js'

export type SkillRuntimeCatalogDiagnostic = {
  kind: 'duplicate-name'
  name: string
  kept: SkillRuntimeCatalogCommandRef
  skipped: SkillRuntimeCatalogCommandRef
  message: string
}

export type SkillRuntimeCatalogCommandRef = {
  name: string
  source: string
  loadedFrom: string
  rank: number
}

export type SkillRuntimeCatalog = {
  commands: Command[]
  diagnostics: SkillRuntimeCatalogDiagnostic[]
}

let lastSkillRuntimeCatalogDiagnostics: SkillRuntimeCatalogDiagnostic[] = []

type RankedCommand = {
  command: Command
  index: number
  rank: number
}

export function createSkillRuntimeCatalog(
  commands: readonly Command[],
): SkillRuntimeCatalog {
  const ranked = commands
    .filter(command => command.type === 'prompt')
    .map((command, index) => ({
      command,
      index,
      rank: getSkillRuntimePriority(command),
    }))
    .sort(compareRankedCommands)

  const diagnostics: SkillRuntimeCatalogDiagnostic[] = []
  const keptByName = new Map<string, RankedCommand>()
  for (const item of ranked) {
    const existing = keptByName.get(item.command.name)
    if (!existing) {
      keptByName.set(item.command.name, item)
      continue
    }
    diagnostics.push({
      kind: 'duplicate-name',
      name: item.command.name,
      kept: toCommandRef(existing),
      skipped: toCommandRef(item),
      message: `Skill '${item.command.name}' from ${toSourceLabel(item.command)} was hidden because ${toSourceLabel(existing.command)} has higher runtime priority.`,
    })
  }

  lastSkillRuntimeCatalogDiagnostics = diagnostics

  return {
    commands: [...keptByName.values()].sort(compareRankedCommands).map(item => item.command),
    diagnostics,
  }
}

export function getLastSkillRuntimeCatalogDiagnostics(): SkillRuntimeCatalogDiagnostic[] {
  return [...lastSkillRuntimeCatalogDiagnostics]
}

export function getSkillRuntimePriority(command: Command): number {
  if (command.type !== 'prompt') {
    return 100
  }
  if (command.loadedFrom === 'dynamic') {
    return 6
  }
  if (command.loadedFrom === 'commands_DEPRECATED') {
    return 8
  }
  if (command.source === 'policySettings') {
    return 0
  }
  if (
    command.source === 'projectSettings' ||
    command.source === 'localSettings' ||
    command.source === 'flagSettings'
  ) {
    return 1
  }
  if (command.source === 'userSettings' && command.loadedFrom !== 'managed') {
    return 2
  }
  if (command.loadedFrom === 'managed') {
    return 3
  }
  if (command.loadedFrom === 'plugin' || command.source === 'plugin') {
    return 4
  }
  if (command.loadedFrom === 'bundled' || command.source === 'bundled') {
    return 5
  }
  if (command.loadedFrom === 'mcp' || command.source === 'mcp') {
    return 7
  }
  return 9
}

function compareRankedCommands(a: RankedCommand, b: RankedCommand): number {
  const rankDiff = a.rank - b.rank
  if (rankDiff !== 0) {
    return rankDiff
  }
  return a.index - b.index
}

function toCommandRef(item: RankedCommand): SkillRuntimeCatalogCommandRef {
  return {
    name: item.command.name,
    source: getCommandSource(item.command),
    loadedFrom: item.command.loadedFrom ?? 'unknown',
    rank: item.rank,
  }
}

function toSourceLabel(command: Command): string {
  return `${getCommandSource(command)}/${command.loadedFrom ?? 'unknown'}`
}

function getCommandSource(command: Command): string {
  return command.type === 'prompt' ? String(command.source) : 'non-prompt'
}
