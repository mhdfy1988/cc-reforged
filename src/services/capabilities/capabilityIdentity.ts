import type {
  ExtensionCapabilityKind,
  ExtensionCapabilitySourceKind,
} from './capabilityTypes.js'

export type SkillCapabilityIdentityInput = {
  sourceKind: ExtensionCapabilitySourceKind
  name: string
  loadedFrom?: string | null
  pluginId?: string | null
  mcpServerName?: string | null
  installedRef?: string | null
}

export type ExtensionCapabilityIdentityInput = {
  kind: ExtensionCapabilityKind
  sourceKind: ExtensionCapabilitySourceKind
  name: string
  sourceRef?: string | null
  pluginId?: string | null
  mcpServerName?: string | null
  appId?: string | null
}

export function createCapabilityId(
  kind: ExtensionCapabilityKind,
  parts: readonly (string | null | undefined)[],
): string {
  return [kind, ...parts.map(encodeCapabilityIdPart)].join(':')
}

export function createSkillCapabilityId(
  input: SkillCapabilityIdentityInput,
): string {
  return createCapabilityId('skill', [
    input.sourceKind,
    input.name,
    input.loadedFrom,
    input.pluginId,
    input.mcpServerName,
    input.installedRef,
  ])
}

export function createExtensionCapabilityId(
  input: ExtensionCapabilityIdentityInput,
): string {
  return createCapabilityId(input.kind, [
    input.sourceKind,
    input.name,
    input.sourceRef,
    input.pluginId,
    input.mcpServerName,
    input.appId,
  ])
}

function encodeCapabilityIdPart(value: string | null | undefined): string {
  return encodeURIComponent(value ?? '')
}
