import type {
  CcrDesktopApi,
  CcrDesktopEvent,
} from '../../../preload/index.js'

declare global {
  interface Window {
    ccr: CcrDesktopApi
  }
}

export type { CcrDesktopEvent }
