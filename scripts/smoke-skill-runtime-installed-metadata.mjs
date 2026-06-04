import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-runtime-installed-metadata-')
const previousPowerShellGate = process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL

try {
  process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL = '1'

  const sourceDir = await writeSourceSkill(env.root, 'managed-metadata', {
    frontmatter: `allowed-tools: PowerShell(Get-ChildItem:*)
version: 1.2.3
shell: powershell
paths: src/**/*.ts
hooks:
  PreToolUse:
    - matcher: Write
      hooks:
        - type: command
          command: Write-Output hook-ok`,
    body: 'Shell marker: !`Get-ChildItem -Name package.json`',
  })
  await installSkillFromSource({
    name: 'managed-metadata',
    sourceDir,
    configHome: env.configHome,
    allowSecurityOverride: true,
  })

  await enableRuntimeCommandLoading()
  const [commandsModule, loadSkillsModule, toolModule] = await Promise.all([
    importDist('src/commands.js'),
    importDist('src/skills/loadSkillsDir.js'),
    importDist('src/Tool.js'),
  ])
  commandsModule.clearCommandsCache()
  let commands = await commandsModule.getCommands(env.root)
  assert.equal(
    commands.some(item => item.name === 'managed-metadata'),
    false,
  )
  assert.deepEqual(
    loadSkillsModule.activateConditionalSkillsForPaths(
      ['src/example.ts'],
      env.root,
    ),
    ['managed-metadata'],
  )
  commands = await commandsModule.getCommands(env.root)
  const command = commands.find(item => item.name === 'managed-metadata')

  assert.ok(command)
  assert.equal(command.loadedFrom, 'managed')
  assert.equal(command.version, '1.2.3')
  assert.deepEqual(command.paths, ['src/**/*.ts'])
  assert.equal(command.skillRoot.includes('managed-metadata'), true)
  assert.equal(command.hooks?.PreToolUse?.[0]?.matcher, 'Write')
  assert.equal(
    command.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command,
    'Write-Output hook-ok',
  )

  const permissionContext = {
    ...toolModule.getEmptyToolPermissionContext(),
    mode: 'bypassPermissions',
    isBypassPermissionsModeAvailable: true,
    shouldAvoidPermissionPrompts: true,
  }
  const appState = { toolPermissionContext: permissionContext }
  const toolUseContext = {
    readFileState: new Map(),
    dynamicSkillDirTriggers: new Set(),
    updateFileHistoryState: () => undefined,
    abortController: new AbortController(),
    setAppState: () => undefined,
    getAppState: () => appState,
    options: { isNonInteractiveSession: true },
  }
  const blocks = await command.getPromptForCommand('', toolUseContext)
  const text = blocks.map(block => block.text ?? '').join('\n')
  assert.match(text, /package\.json/)
} finally {
  if (previousPowerShellGate === undefined) {
    delete process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL
  } else {
    process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL = previousPowerShellGate
  }
  await env.cleanup()
}

console.log('smoke-skill-runtime-installed-metadata: ok')
