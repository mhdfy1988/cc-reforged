import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

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
assert(events.length >= 6, 'fixture should cover multiple display event kinds')

const eventTypes = new Set(events.map(event => event.type))
for (const type of [
  'user_message',
  'assistant_message',
  'thinking_summary',
  'tool_call',
  'todo_list',
  'error',
]) {
  assert(eventTypes.has(type), `fixture is missing ${type}`)
}

assert(
  !events.some(event => event.type === 'tool_result'),
  'tool_result should be merged into the original tool_call card in fixtures',
)

const visibleTimelineEvents = events.filter(
  event => event.type !== 'todo_list' && !event.timelineHidden,
)
assert(
  !visibleTimelineEvents.some(
    event => event.toolSnapshot?.name === 'AskUserQuestion',
  ),
  'AskUserQuestion should be hidden from the main timeline',
)

for (const event of events) {
  assert(typeof event.id === 'string' && event.id, 'event.id is required')
  assert(typeof event.text === 'string', `event.text is required for ${event.id}`)

  if (event.toolSnapshot) {
    assert(
      event.identity?.turnId,
      `tool event ${event.id} must preserve turnId`,
    )
    assert(
      event.identity?.toolUseId,
      `tool event ${event.id} must preserve toolUseId`,
    )
    assert(
      typeof event.toolSnapshot.category === 'string' &&
        event.toolSnapshot.category,
      `tool event ${event.id} must classify tool category`,
    )
    assert(
      typeof event.toolSnapshot.statusLabel === 'string' &&
        event.toolSnapshot.statusLabel,
      `tool event ${event.id} must expose a localized status label`,
    )

    if (event.toolSnapshot.kind === 'call') {
      assert(
        'result' in event.toolSnapshot,
        `tool call ${event.id} must carry merged tool result`,
      )
    }
  }

  if (event.todoSnapshot) {
    assert(
      Array.isArray(event.todoSnapshot.items) &&
        event.todoSnapshot.items.length > 0,
      `todo event ${event.id} must contain todo items`,
    )
  }
}

const shellError = events.find(
  event => event.toolSnapshot?.errorClass === 'shell_unavailable',
)
assert(
  shellError?.toolSnapshot?.actionableHint,
  'shell unavailable errors must include an actionable hint',
)

assert(
  fixture.permission?.permissionRequestId,
  'permission fixture must include permissionRequestId',
)
assert(fixture.permission?.toolUseId, 'permission fixture must include toolUseId')

console.log('smoke-desktop-display-events: ok')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
