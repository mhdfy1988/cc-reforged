import type {
  CcrDesktopApi,
  CcrDesktopEvent,
  DesktopConfirmRequest,
  DesktopConfirmTone,
} from '../../../preload/index.js'

declare global {
  interface Window {
    ccr: CcrDesktopApi
  }
}

export type { CcrDesktopEvent, DesktopConfirmRequest, DesktopConfirmTone }
