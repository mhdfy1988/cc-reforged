import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(
  repoRoot,
  'apps',
  'desktop',
  'src',
  'renderer',
  'src',
  'domain',
  'fixtures',
  'display-events.json',
)

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const events = fixture.events

assert(Array.isArray(events), 'fixture.events must be an array')

const toolResults = events.filter(event => event.type === 'tool_result')
assert(
  !toolResults.some(event => event.toolSnapshot?.category === 'shell'),
  'shell lifecycle fixtures should not render standalone tool_result cards',
)

const shellEvents = events.filter(
  event => event.toolSnapshot?.category === 'shell',
)
assert(shellEvents.length >= 2, 'fixture must include successful and failed shell cards')

const completedShell = shellEvents.find(
  event => event.toolSnapshot?.status === 'completed',
)
assert(completedShell, 'fixture must include a completed shell card')
assert(
  'result' in completedShell.toolSnapshot,
  'completed shell card must carry merged result content',
)
assert(
  completedShell.toolSnapshot.command &&
    completedShell.toolSnapshot.shell,
  'completed shell card must expose command and shell dialect',
)

const failedShell = shellEvents.find(
  event => event.toolSnapshot?.errorClass === 'shell_unavailable',
)
assert(failedShell, 'fixture must include shell_unavailable shell card')
assert(
  failedShell.toolSnapshot.actionableHint?.includes('PowerShell') &&
    failedShell.toolSnapshot.actionableHint.includes('不需要为了 ls 强行安装 Bash'),
  'shell_unavailable card must guide Windows users to PowerShell/CMD/file tools',
)

const shellPermission = fixture.permission
assert(shellPermission?.interactionKind === 'shell_permission', 'shell permission is required')
assert(shellPermission.toolUseId, 'shell permission must keep toolUseId')
assert(
  shellEvents.some(
    event => event.identity?.toolUseId === shellPermission.toolUseId,
  ),
  'shell permission toolUseId must match an existing shell tool card',
)
assert(
  Array.isArray(shellPermission.permissionSuggestions) &&
    shellPermission.permissionSuggestions.length > 0,
  'shell permission must preserve permission suggestions',
)

console.log('smoke-desktop-shell-cards: ok')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
