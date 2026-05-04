import type { JsonObject } from './displayTypes.js'
import {
  createDisplayEventIdentity,
  withContentBlock,
  type DisplayEventContractContext,
  type DisplayEventIdentity,
} from './eventContract.js'

export type TodoItemStatus = 'completed' | 'in_progress' | 'pending' | string

export type TodoListItem = {
  content: string
  status: TodoItemStatus
  activeForm?: string
}

export type TodoOverlaySnapshot = {
  id: string
  title: string
  items: TodoListItem[]
  identity?: DisplayEventIdentity
  raw: unknown
}

export function extractTodoOverlaySnapshotFromBlocks(
  id: string,
  blocks: JsonObject[],
  context?: DisplayEventContractContext,
): TodoOverlaySnapshot | null {
  for (const [contentIndex, block] of blocks.entries()) {
    if (block.type !== 'tool_use') {
      continue
    }

    const name = typeof block.name === 'string' ? block.name : ''
    if (name !== 'TodoWrite') {
      continue
    }

    const input = block.input
    if (!input || typeof input !== 'object') {
      return null
    }

    const todos = (input as JsonObject).todos
    if (!Array.isArray(todos)) {
      return null
    }

    const items = todos.map(normalizeTodoItem).filter(Boolean) as TodoListItem[]
    if (!items.length) {
      return null
    }

    return {
      id,
      title: 'TodoWrite',
      items,
      identity: createDisplayEventIdentity(
        withContentBlock(context ?? { itemId: id }, block, contentIndex),
      ),
      raw: input,
    }
  }

  return null
}

function normalizeTodoItem(value: unknown): TodoListItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const object = value as JsonObject
  const content = typeof object.content === 'string' ? object.content.trim() : ''
  if (!content) {
    return null
  }

  return {
    content,
    status:
      typeof object.status === 'string' && object.status
        ? object.status
        : 'pending',
    activeForm:
      typeof object.activeForm === 'string' && object.activeForm.trim()
        ? object.activeForm
        : undefined,
  }
}
