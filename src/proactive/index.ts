import { createSignal } from '../utils/signal.js'

const proactiveChanges = createSignal<[]>()

let proactiveActive = false
let contextBlocked = false
let nextTickAt: number | null = null

function emitChange(): void {
  proactiveChanges.emit()
}

export function activateProactive(_source?: string): void {
  if (!proactiveActive) {
    proactiveActive = true
  }
  if (!contextBlocked) {
    nextTickAt = Date.now()
  }
  emitChange()
}

export function deactivateProactive(): void {
  proactiveActive = false
  nextTickAt = null
  emitChange()
}

export function isProactiveActive(): boolean {
  return proactiveActive
}

export function isProactivePaused(): boolean {
  return !proactiveActive || contextBlocked
}

export function setContextBlocked(blocked: boolean): void {
  if (contextBlocked === blocked) return
  contextBlocked = blocked
  nextTickAt = proactiveActive && !contextBlocked ? Date.now() : null
  emitChange()
}

export function subscribeToProactiveChanges(listener: () => void): () => void {
  return proactiveChanges.subscribe(listener)
}

export function getNextTickAt(): number | null {
  return nextTickAt
}

