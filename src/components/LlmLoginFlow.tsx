import React, { useCallback, useState } from 'react'
import { Box, Text } from '../ink.js'
import { useKeybinding } from '../keybindings/useKeybinding.js'
import { resetDefaultLlmRuntime } from '../services/llm/defaultRuntime.js'
import {
  getLlmProviderConfig,
  loadLlmConfig,
  updatePersistedLlmConfig,
} from '../services/llm/llmConfig.js'
import {
  createDefaultCodexOAuthSession,
  resetDefaultCodexOAuthSession,
} from '../services/llm/sessions/defaultCodexOAuthSession.js'
import { logError } from '../utils/log.js'
import { Select } from './CustomSelect/select.js'
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow.js'
import { Spinner } from './Spinner.js'

type LoginMode =
  | 'idle'
  | 'anthropic-claudeai'
  | 'anthropic-console'
  | 'platform'
  | 'codex-checking'
  | 'codex-login'
  | 'error'

type Props = {
  onDone(): void
}

export function LlmLoginFlow({ onDone }: Props): React.ReactNode {
  const [mode, setMode] = useState<LoginMode>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const startCodexOAuth = useCallback(async () => {
    try {
      setErrorMessage('')
      setMode('codex-checking')

      const config = loadLlmConfig()
      const codexProviderConfig = getLlmProviderConfig('codex-oauth', config)
      if (config.provider !== 'codex-oauth') {
        await updatePersistedLlmConfig({
          provider: 'codex-oauth',
          model: codexProviderConfig?.defaultModel ?? 'gpt-5.4',
        })
        resetDefaultLlmRuntime()
        resetDefaultCodexOAuthSession()
      }

      const session = createDefaultCodexOAuthSession()
      const availability = await session.getAvailability()
      if (availability.available) {
        onDone()
        return
      }

      setMode('codex-login')
      await session.loginWithBrowser()
      resetDefaultCodexOAuthSession()
      resetDefaultLlmRuntime()
      onDone()
    } catch (error) {
      logError(error)
      setErrorMessage((error as Error).message)
      setMode('error')
    }
  }, [onDone])

  const startAnthropicLogin = useCallback(
    async (nextMode: Extract<LoginMode, 'anthropic-claudeai' | 'anthropic-console'>) => {
      try {
        await updatePersistedLlmConfig({
          provider: 'anthropic',
          model: null,
        })
        resetDefaultLlmRuntime()
        setMode(nextMode)
      } catch (error) {
        logError(error)
        setErrorMessage((error as Error).message)
        setMode('error')
      }
    },
    [],
  )

  useKeybinding(
    'confirm:yes',
    () => {
      setMode('idle')
    },
    {
      context: 'Confirmation',
      isActive: mode === 'platform',
    },
  )

  useKeybinding(
    'confirm:yes',
    () => {
      void startCodexOAuth()
    },
    {
      context: 'Confirmation',
      isActive: mode === 'error',
    },
  )

  if (mode === 'anthropic-claudeai') {
    return <ConsoleOAuthFlow onDone={onDone} forceLoginMethod="claudeai" />
  }

  if (mode === 'anthropic-console') {
    return <ConsoleOAuthFlow onDone={onDone} forceLoginMethod="console" />
  }

  if (mode === 'platform') {
    return (
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Text bold>CCR can also use API keys through 3rd-party platforms.</Text>
        <Box flexDirection="column" gap={1}>
          <Text>Set up one of the following environment variables or settings:</Text>
          <Text>
            • Amazon Bedrock:{' '}
            <Text color="warning">CLAUDE_CODE_USE_BEDROCK=1</Text>
          </Text>
          <Text>
            • Microsoft Foundry:{' '}
            <Text color="warning">CLAUDE_CODE_USE_FOUNDRY=1</Text>
          </Text>
          <Text>
            • Google Vertex AI:{' '}
            <Text color="warning">CLAUDE_CODE_USE_VERTEX=1</Text>
          </Text>
          <Box marginTop={1}>
            <Text color="permission">
              Press <Text bold>Enter</Text> to go back to login options.
            </Text>
          </Box>
        </Box>
      </Box>
    )
  }

  if (mode === 'codex-checking') {
    return (
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Box>
          <Spinner />
          <Text>Checking Codex OAuth credential...</Text>
        </Box>
      </Box>
    )
  }

  if (mode === 'codex-login') {
    return (
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Box>
          <Spinner />
          <Text>Opening browser for Codex OAuth login...</Text>
        </Box>
        <Text dimColor>
          Complete ChatGPT / Codex authorization in the browser, then return to
          this terminal.
        </Text>
      </Box>
    )
  }

  if (mode === 'error') {
    return (
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Text color="error">Codex OAuth error: {errorMessage}</Text>
        <Text color="permission">
          Press <Text bold>Enter</Text> to retry.
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1} marginTop={1}>
      <Text bold>
        CCR can use Codex OAuth, Claude subscription, Anthropic Console billing,
        or a third-party platform.
      </Text>
      <Text>Select login method:</Text>
      <Box>
        <Select
          options={[
            {
              label: (
                <Text>
                  Codex OAuth ·{' '}
                  <Text dimColor>ChatGPT / Codex account</Text>
                  {'\n'}
                </Text>
              ),
              value: 'codex-oauth',
            },
            {
              label: (
                <Text>
                  Claude account with subscription ·{' '}
                  <Text dimColor>Pro, Max, Team, or Enterprise</Text>
                  {'\n'}
                </Text>
              ),
              value: 'claudeai',
            },
            {
              label: (
                <Text>
                  Anthropic Console account ·{' '}
                  <Text dimColor>API usage billing</Text>
                  {'\n'}
                </Text>
              ),
              value: 'console',
            },
            {
              label: (
                <Text>
                  3rd-party platform ·{' '}
                  <Text dimColor>
                    Amazon Bedrock, Microsoft Foundry, or Vertex AI
                  </Text>
                  {'\n'}
                </Text>
              ),
              value: 'platform',
            },
          ]}
          onChange={value => {
            if (value === 'codex-oauth') {
              void startCodexOAuth()
            } else if (value === 'claudeai') {
              void startAnthropicLogin('anthropic-claudeai')
            } else if (value === 'console') {
              void startAnthropicLogin('anthropic-console')
            } else {
              setMode('platform')
            }
          }}
        />
      </Box>
    </Box>
  )
}
