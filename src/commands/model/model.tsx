import chalk from 'chalk'
import * as React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { ModelPicker } from '../../components/ModelPicker.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { setCoreModel, setCoreModelProfile } from '../../core/modelCore.js'
import { resetDefaultLlmRuntime } from '../../services/llm/defaultRuntime.js'
import { loadLlmConfig } from '../../services/llm/llmConfig.js'
import {
  getLlmRuntimeDisplayStatus,
  getLlmProviderDisplayName,
} from '../../services/llm/runtimeStatus.js'
import { resetDefaultCodexOAuthSession } from '../../services/llm/sessions/defaultCodexOAuthSession.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import type { EffortLevel } from '../../utils/effort.js'
import { isBilledAsExtraUsage } from '../../utils/extraUsage.js'
import {
  clearFastModeCooldown,
  isFastModeAvailable,
  isFastModeEnabled,
  isFastModeSupportedByModel,
} from '../../utils/fastMode.js'
import { MODEL_ALIASES } from '../../utils/model/aliases.js'
import {
  checkOpus1mAccess,
  checkSonnet1mAccess,
} from '../../utils/model/check1mAccess.js'
import {
  getDefaultMainLoopModelSetting,
  isOpus1mMergeEnabled,
  renderDefaultModelSetting,
  type ModelSetting,
} from '../../utils/model/model.js'
import { isModelAllowed } from '../../utils/model/modelAllowlist.js'
import { validateModel } from '../../utils/model/validateModel.js'

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNullableString(value: unknown): string | null {
  return value === null ? null : asOptionalString(value) ?? null
}

function asModelSetting(value: unknown): ModelSetting | undefined {
  return value === null ? null : asOptionalString(value)
}

function getActiveProviderStatus() {
  return getLlmRuntimeDisplayStatus()
}

function ModelPickerWrapper({
  onDone,
}: {
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  const mainLoopModel = useAppState(state => state.mainLoopModel)
  const mainLoopModelForSession = useAppState(
    state => state.mainLoopModelForSession,
  )
  const isFastMode = useAppState(state => state.fastMode)
  const setAppState = useSetAppState()

  function handleCancel(): void {
    logEvent('tengu_model_command_menu', {
      action:
        'cancel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    const displayModel = renderModelLabel(asNullableString(mainLoopModel))
    onDone(`Kept model as ${chalk.bold(displayModel)}`, {
      display: 'system',
    })
  }

  function handleSelect(
    model: string | null,
    effort: EffortLevel | undefined,
  ): void {
    logEvent('tengu_model_command_menu', {
      action:
        (model ?? 'default') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      from_model:
        (mainLoopModel ??
          'default') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      to_model:
        (model ?? 'default') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    setAppState(prev => ({
      ...prev,
      mainLoopModel: model,
      mainLoopModelForSession: null,
    }))

    let message = `Set model to ${chalk.bold(renderModelLabel(model))}`
    if (effort !== undefined) {
      message += ` with ${chalk.bold(effort)} effort`
    }

    let wasFastModeToggledOn: boolean | undefined
    if (isFastModeEnabled()) {
      clearFastModeCooldown()
      if (!isFastModeSupportedByModel(model) && isFastMode) {
        setAppState(prev => ({
          ...prev,
          fastMode: false,
        }))
        wasFastModeToggledOn = false
      } else if (
        isFastModeSupportedByModel(model) &&
        isFastModeAvailable() &&
        isFastMode
      ) {
        message += ' · Fast mode ON'
        wasFastModeToggledOn = true
      }
    }

    if (
      isBilledAsExtraUsage(
        model,
        wasFastModeToggledOn === true,
        isOpus1mMergeEnabled(),
      )
    ) {
      message += ' · Billed as extra usage'
    }
    if (wasFastModeToggledOn === false) {
      message += ' · Fast mode OFF'
    }
    onDone(message)
  }

  const currentModelSetting = asModelSetting(mainLoopModel)
  const showFastModeNotice =
    isFastModeEnabled() &&
    isFastMode &&
    currentModelSetting !== undefined &&
    isFastModeSupportedByModel(currentModelSetting) &&
    isFastModeAvailable()

  return (
    <ModelPicker
      initial={mainLoopModel}
      sessionModel={mainLoopModelForSession}
      onSelect={handleSelect}
      onCancel={handleCancel}
      isStandaloneCommand
      showFastModeNotice={showFastModeNotice}
      headerText="Switch between Anthropic / Claude models. Applies to this session and future CCR sessions."
    />
  )
}

function SetAnthropicModelAndClose({
  args,
  onDone,
}: {
  args: string
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  const isFastMode = useAppState(state => state.fastMode)
  const setAppState = useSetAppState()
  const model = args === 'default' ? null : args

  React.useEffect(() => {
    async function handleModelChange(): Promise<void> {
      if (model && !isModelAllowed(model)) {
        onDone(
          `Model '${model}' is not available. Your organization restricts model selection.`,
          { display: 'system' },
        )
        return
      }

      if (model && isOpus1mUnavailable(model)) {
        onDone(
          'Opus 4.6 with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m',
          { display: 'system' },
        )
        return
      }
      if (model && isSonnet1mUnavailable(model)) {
        onDone(
          'Sonnet 4.6 with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m',
          { display: 'system' },
        )
        return
      }

      if (!model) {
        setModel(null)
        return
      }

      if (isKnownAlias(model)) {
        setModel(model)
        return
      }

      try {
        const { valid, error } = await validateModel(model)
        if (valid) {
          setModel(model)
          return
        }
        onDone(error || `Model '${model}' not found`, {
          display: 'system',
        })
      } catch (error) {
        onDone(`Failed to validate model: ${(error as Error).message}`, {
          display: 'system',
        })
      }
    }

    function setModel(modelValue: string | null): void {
      setAppState(prev => ({
        ...prev,
        mainLoopModel: modelValue,
        mainLoopModelForSession: null,
      }))

      let message = `Set model to ${chalk.bold(renderModelLabel(modelValue))}`
      let wasFastModeToggledOn: boolean | undefined

      if (isFastModeEnabled()) {
        clearFastModeCooldown()
        if (!isFastModeSupportedByModel(modelValue) && isFastMode) {
          setAppState(prev => ({
            ...prev,
            fastMode: false,
          }))
          wasFastModeToggledOn = false
        } else if (isFastModeSupportedByModel(modelValue) && isFastMode) {
          message += ' · Fast mode ON'
          wasFastModeToggledOn = true
        }
      }

      if (
        isBilledAsExtraUsage(
          modelValue,
          wasFastModeToggledOn === true,
          isOpus1mMergeEnabled(),
        )
      ) {
        message += ' · Billed as extra usage'
      }
      if (wasFastModeToggledOn === false) {
        message += ' · Fast mode OFF'
      }

      onDone(message)
    }

    void handleModelChange()
  }, [isFastMode, model, onDone, setAppState])

  return null
}

function SetConfiguredProviderModelAndClose({
  args,
  onDone,
}: {
  args: string
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  React.useEffect(() => {
    async function updateConfiguredModel(): Promise<void> {
      try {
        if (process.env.CCR_LLM_MODEL?.trim()) {
          onDone(
            'LLM model is currently forced by CCR_LLM_MODEL. Update or unset that environment variable before using /model.',
            { display: 'system' },
          )
          return
        }

        const providerStatus = getActiveProviderStatus()
        const nextModel = args === 'default' ? null : args.trim()
        const result = nextModel
          ? await setCoreModel({
              provider: providerStatus.providerId,
              model: nextModel,
            })
          : await setCoreModelProfile({
              profileId: loadLlmConfig().currentProfileId,
            })
        resetDefaultLlmRuntime()
        resetDefaultCodexOAuthSession()

        const current = result.current as
          | { profileId?: string; provider?: string; model?: string }
          | undefined
        const selectedModel = current?.model ?? nextModel

        onDone(
          nextModel === null
            ? `Reset current profile to its default model ${chalk.bold(selectedModel ?? 'default')}.`
            : `Set configured model for ${providerStatus.providerDisplayName} to ${chalk.bold(selectedModel ?? nextModel)}.`,
        )
      } catch (error) {
        onDone(`Failed to update configured model: ${(error as Error).message}`, {
          display: 'system',
        })
      }
    }

    void updateConfiguredModel()
  }, [args, onDone])

  return null
}

function SetConfiguredProfileAndClose({
  profileId,
  model,
  onDone,
}: {
  profileId: string
  model?: string
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  React.useEffect(() => {
    async function updateConfiguredProfile(): Promise<void> {
      try {
        if (process.env.CCR_LLM_PROVIDER?.trim()) {
          onDone(
            'LLM provider is currently forced by CCR_LLM_PROVIDER. Update or unset that environment variable before using /model profile.',
            { display: 'system' },
          )
          return
        }
        if (process.env.CCR_LLM_MODEL?.trim()) {
          onDone(
            'LLM model is currently forced by CCR_LLM_MODEL. Update or unset that environment variable before using /model profile.',
            { display: 'system' },
          )
          return
        }

        const result = await setCoreModelProfile({
          profileId,
          ...(model?.trim() && model.trim() !== 'default'
            ? { model: model.trim() }
            : {}),
        })
        resetDefaultLlmRuntime()
        resetDefaultCodexOAuthSession()
        const current = result.current as
          | { profileId?: string; provider?: string; model?: string }
          | undefined
        onDone(
          `Set profile to ${chalk.bold(current?.profileId ?? profileId)} · ${chalk.bold(current?.model ?? model ?? 'default')}.`,
        )
      } catch (error) {
        onDone(`Failed to update profile: ${(error as Error).message}`, {
          display: 'system',
        })
      }
    }

    void updateConfiguredProfile()
  }, [model, onDone, profileId])

  return null
}

function isKnownAlias(model: string): boolean {
  return (MODEL_ALIASES as readonly string[]).includes(
    model.toLowerCase().trim(),
  )
}

function isOpus1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkOpus1mAccess() &&
    !isOpus1mMergeEnabled() &&
    normalized.includes('opus') &&
    normalized.includes('[1m]')
  )
}

function isSonnet1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkSonnet1mAccess() &&
    (normalized.includes('sonnet[1m]') ||
      normalized.includes('sonnet-4-6[1m]'))
  )
}

function ShowModelAndClose({
  onDone,
}: {
  onDone: (result?: string) => void
}): React.ReactNode {
  const mainLoopModel = useAppState(state => state.mainLoopModel)
  const mainLoopModelForSession = useAppState(
    state => state.mainLoopModelForSession,
  )
  const effortValue = useAppState(state => state.effortValue)

  React.useEffect(() => {
    const providerStatus = getActiveProviderStatus()
    if (providerStatus.providerId !== 'anthropic') {
      const config = loadLlmConfig()
      const profile = config.profiles[config.currentProfileId]
      const lines = [
        `Current provider: ${providerStatus.providerDisplayName} (${providerStatus.providerId})`,
        `Current profile: ${profile?.name ?? config.currentProfileId} (${config.currentProfileId})`,
        `Current model: ${chalk.bold(providerStatus.model)}`,
      ]
      if (profile?.apiMode) {
        lines.push(`Protocol: ${profile.apiMode}`)
      }
      if (effortValue !== undefined) {
        lines.push(`Effort: ${effortValue}`)
      }
      onDone(lines.join('\n'))
      return
    }

    const displayModel = renderModelLabel(asNullableString(mainLoopModel))
    const effortInfo =
      effortValue !== undefined ? ` (effort: ${effortValue})` : ''
    const sessionModelLabel = asOptionalString(mainLoopModelForSession)
    if (sessionModelLabel) {
      onDone(
        `Current model: ${chalk.bold(renderModelLabel(sessionModelLabel))} (session override from plan mode)\nBase model: ${displayModel}${effortInfo}`,
      )
      return
    }
    onDone(`Current model: ${displayModel}${effortInfo}`)
  }, [effortValue, mainLoopModel, mainLoopModelForSession, onDone])

  return null
}

function buildHelpText(): string {
  const providerStatus = getActiveProviderStatus()
  if (providerStatus.providerId === 'anthropic') {
    return 'Run /model to open the model selection menu, or /model [modelName] to set the model.'
  }
  return `Current LLM provider is ${providerStatus.providerDisplayName} (${providerStatus.providerId}). Run /model [modelId] to update the configured provider model, or /model info to inspect the current provider/model state.`
}

function buildNonAnthropicMenuMessage(): string {
  const providerStatus = getActiveProviderStatus()
  const providerDisplayName = getLlmProviderDisplayName(providerStatus.providerId)
  const config = loadLlmConfig()
  const profile = config.profiles[config.currentProfileId]
  return `Current LLM provider: ${providerDisplayName} (${providerStatus.providerId})\nCurrent profile: ${profile?.name ?? config.currentProfileId} (${config.currentProfileId})\nCurrent configured model: ${chalk.bold(providerStatus.model)}\nUse /model [modelId] to update the model, or /model profile <profileId> [modelId] to switch profile.`
}

export const call: LocalJSXCommandCall = async (onDone, _context, rawArgs) => {
  const args = rawArgs?.trim() || ''
  const providerStatus = getActiveProviderStatus()
  const isAnthropicProvider = providerStatus.providerId === 'anthropic'

  if (COMMON_INFO_ARGS.includes(args)) {
    logEvent('tengu_model_command_inline_help', {
      args: args as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return <ShowModelAndClose onDone={onDone} />
  }

  if (COMMON_HELP_ARGS.includes(args)) {
    onDone(buildHelpText(), {
      display: 'system',
    })
    return
  }

  if (args) {
    const [command, profileId, modelId] = args.split(/\s+/)
    if (command === 'profile' && profileId) {
      return (
        <SetConfiguredProfileAndClose
          profileId={profileId}
          model={modelId}
          onDone={onDone}
        />
      )
    }

    logEvent('tengu_model_command_inline', {
      args: args as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    if (isAnthropicProvider) {
      return <SetAnthropicModelAndClose args={args} onDone={onDone} />
    }
    return <SetConfiguredProviderModelAndClose args={args} onDone={onDone} />
  }

  if (!isAnthropicProvider) {
    onDone(buildNonAnthropicMenuMessage(), {
      display: 'system',
    })
    return
  }

  return <ModelPickerWrapper onDone={onDone} />
}

function renderModelLabel(model: string | null): string {
  const rendered = renderDefaultModelSetting(
    model ?? getDefaultMainLoopModelSetting(),
  )
  return model === null ? `${rendered} (default)` : rendered
}
