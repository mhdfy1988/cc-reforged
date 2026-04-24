import { createSignal } from '../utils/signal.js';
const proactiveChanges = createSignal();
let proactiveActive = false;
let contextBlocked = false;
let nextTickAt = null;
function emitChange() {
    proactiveChanges.emit();
}
export function activateProactive(_source) {
    if (!proactiveActive) {
        proactiveActive = true;
    }
    if (!contextBlocked) {
        nextTickAt = Date.now();
    }
    emitChange();
}
export function deactivateProactive() {
    proactiveActive = false;
    nextTickAt = null;
    emitChange();
}
export function isProactiveActive() {
    return proactiveActive;
}
export function isProactivePaused() {
    return !proactiveActive || contextBlocked;
}
export function setContextBlocked(blocked) {
    if (contextBlocked === blocked)
        return;
    contextBlocked = blocked;
    nextTickAt = proactiveActive && !contextBlocked ? Date.now() : null;
    emitChange();
}
export function subscribeToProactiveChanges(listener) {
    return proactiveChanges.subscribe(listener);
}
export function getNextTickAt() {
    return nextTickAt;
}
//# sourceMappingURL=index.js.map