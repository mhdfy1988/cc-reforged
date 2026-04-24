import {
  KEYBINDING_ACTIONS,
  KEYBINDING_CONTEXTS,
} from './schema.js'

export type KeybindingContextName = (typeof KEYBINDING_CONTEXTS)[number]
export type KeybindingAction = (typeof KEYBINDING_ACTIONS)[number]

export type ParsedKeystroke = {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  super: boolean
}

export type Chord = ParsedKeystroke[]

export type KeybindingBlock = {
  context: KeybindingContextName
  bindings: Record<
    string,
    KeybindingAction | `command:${string}` | null
  >
}

export type ParsedBinding = {
  chord: Chord
  action: KeybindingAction | `command:${string}` | null
  context: KeybindingContextName
}
