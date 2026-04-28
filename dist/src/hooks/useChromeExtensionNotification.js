import { useStartupNotification } from './notifs/useStartupNotification.js';
async function noChromeExtensionNotification() {
    return null;
}
export function useChromeExtensionNotification() {
    // CCR 已退休旧 Claude in Chrome 提示；浏览器能力后续由通用 MCP 提供。
    useStartupNotification(noChromeExtensionNotification);
}
//# sourceMappingURL=useChromeExtensionNotification.js.map