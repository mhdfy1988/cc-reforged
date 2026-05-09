import { useStartupNotification } from './notifs/useStartupNotification.js'

async function noChromeExtensionNotification(): Promise<null> {
  return null
}

export function useChromeExtensionNotification(): void {
  // CCR 已退休旧 Claude in Chrome 提示；浏览器能力后续由通用 MCP 提供。
  useStartupNotification(noChromeExtensionNotification)
}
