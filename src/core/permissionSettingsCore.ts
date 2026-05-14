import type {
  EditableSettingSource,
  SettingSource,
} from '../utils/settings/constants.js'
import {
  getEnabledSettingSources,
  SETTING_SOURCES,
  SOURCES,
} from '../utils/settings/constants.js'
import {
  getSettingsDisplayPathsForSource,
  getSettingsWithSources,
  updateSettingsForSource,
} from '../utils/settings/settings.js'
import { SettingsSchema, type SettingsJson } from '../utils/settings/types.js'
import {
  EXTERNAL_PERMISSION_MODES,
  type ExternalPermissionMode,
} from '../types/permissions.js'
import { CoreError } from './errors.js'

export type CorePermissionSettings = {
  allow: string[]
  deny: string[]
  ask: string[]
  defaultMode: string | null
  disableBypassPermissionsMode: boolean
  additionalDirectories: string[]
}

export type CorePermissionSettingsSource = {
  source: SettingSource
  label: string
  editable: boolean
  enabled: boolean
  path?: string
  readPaths: string[]
  permissions: CorePermissionSettings
}

export type CorePermissionSettingsSnapshot = {
  effective: CorePermissionSettings
  sources: CorePermissionSettingsSource[]
  editableSources: EditableSettingSource[]
  defaultSource: EditableSettingSource
  modes: Array<{
    value: ExternalPermissionMode
    label: string
  }>
}

export type CorePermissionSettingsUpdateInput = {
  source: EditableSettingSource
  permissions: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?: ExternalPermissionMode | null
    disableBypassPermissionsMode?: boolean | null
    additionalDirectories?: string[]
  }
}

const EDITABLE_SOURCES = new Set<EditableSettingSource>(SOURCES)

export function getCorePermissionSettingsSnapshot(): CorePermissionSettingsSnapshot {
  const settingsWithSources = getSettingsWithSources()
  const sourceSettings = new Map<SettingSource, SettingsJson>(
    settingsWithSources.sources.map(entry => [entry.source, entry.settings]),
  )
  const enabledSources = new Set(getEnabledSettingSources())

  return {
    effective: normalizePermissionSettings(settingsWithSources.effective),
    sources: SETTING_SOURCES.filter(source => enabledSources.has(source)).map(
      source => {
        const paths = getSettingsDisplayPathsForSource(source)
        return {
          source,
          label: getPermissionSettingSourceLabel(source),
          editable: isEditableSource(source),
          enabled: enabledSources.has(source),
          ...(paths.writePath ? { path: paths.writePath } : {}),
          readPaths: paths.readPaths,
          permissions: normalizePermissionSettings(sourceSettings.get(source)),
        }
      },
    ),
    editableSources: [...SOURCES],
    defaultSource: 'userSettings',
    modes: EXTERNAL_PERMISSION_MODES.map(mode => ({
      value: mode,
      label: getPermissionModeLabel(mode),
    })),
  }
}

export function updateCorePermissionSettings(
  input: CorePermissionSettingsUpdateInput,
): CorePermissionSettingsSnapshot {
  if (!isEditableSource(input.source)) {
    throw new CoreError(
      'invalid_params',
      `Permission settings source is not editable: ${input.source}`,
    )
  }

  const permissions = buildPermissionSettingsPatch(input.permissions)
  const validationPatch = {
    permissions: omitUndefined(permissions),
  } as SettingsJson
  const validation = SettingsSchema().safeParse(validationPatch)
  if (!validation.success) {
    throw new CoreError(
      'invalid_params',
      'Invalid permission settings.',
      validation.error.issues.map(issue => issue.message).join('; '),
    )
  }

  const result = updateSettingsForSource(input.source, {
    permissions,
  } as SettingsJson)
  if (result.error) {
    throw new CoreError(
      'internal_error',
      'Failed to update permission settings.',
      result.error.message,
    )
  }

  return getCorePermissionSettingsSnapshot()
}

function normalizePermissionSettings(
  settings: SettingsJson | null | undefined,
): CorePermissionSettings {
  const permissions = settings?.permissions
  return {
    allow: normalizeStringArray(permissions?.allow),
    deny: normalizeStringArray(permissions?.deny),
    ask: normalizeStringArray(permissions?.ask),
    defaultMode:
      typeof permissions?.defaultMode === 'string'
        ? permissions.defaultMode
        : null,
    disableBypassPermissionsMode:
      permissions?.disableBypassPermissionsMode === 'disable',
    additionalDirectories: normalizeStringArray(
      permissions?.additionalDirectories,
    ),
  }
}

function buildPermissionSettingsPatch(
  input: CorePermissionSettingsUpdateInput['permissions'],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if ('allow' in input) {
    patch.allow = normalizeStringArray(input.allow)
  }
  if ('deny' in input) {
    patch.deny = normalizeStringArray(input.deny)
  }
  if ('ask' in input) {
    patch.ask = normalizeStringArray(input.ask)
  }
  if ('defaultMode' in input) {
    patch.defaultMode = input.defaultMode ?? undefined
  }
  if ('disableBypassPermissionsMode' in input) {
    patch.disableBypassPermissionsMode = input.disableBypassPermissionsMode
      ? 'disable'
      : undefined
  }
  if ('additionalDirectories' in input) {
    patch.additionalDirectories = normalizeStringArray(
      input.additionalDirectories,
    )
  }

  return patch
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  )
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function isEditableSource(source: SettingSource): source is EditableSettingSource {
  return EDITABLE_SOURCES.has(source as EditableSettingSource)
}

function getPermissionSettingSourceLabel(source: SettingSource): string {
  switch (source) {
    case 'localSettings':
      return '本地项目'
    case 'projectSettings':
      return '项目共享'
    case 'userSettings':
      return '用户全局'
    case 'flagSettings':
      return '命令行参数'
    case 'policySettings':
      return '托管策略'
  }
}

function getPermissionModeLabel(mode: ExternalPermissionMode): string {
  switch (mode) {
    case 'default':
      return '默认询问'
    case 'acceptEdits':
      return '自动接受编辑'
    case 'plan':
      return '计划模式'
    case 'dontAsk':
      return '禁止询问'
    case 'bypassPermissions':
      return '绕过权限'
  }
}
