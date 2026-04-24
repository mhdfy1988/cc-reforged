const CCSHARE_ID_PATTERN = /(?:^|\/)(?<id>[a-z0-9][a-z0-9-]*-\d{8}-\d{6})(?:\/)?$/i;
export function parseCcshareId(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const match = CCSHARE_ID_PATTERN.exec(trimmed);
    return match?.groups?.id ?? null;
}
export async function loadCcshare(_ccshareId) {
    throw new Error('ccshare 恢复链路尚未恢复，当前无法从共享链接加载会话');
}
export async function resumeCcShare(..._args) { }
//# sourceMappingURL=ccshareResume.js.map