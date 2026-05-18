export function createCcrErrorSnapshot(input) {
    const message = normalizeErrorMessage(input.message ?? getErrorMessage(input.error));
    const category = input.category ?? classifyErrorCategory(message, input.source);
    const source = input.source ?? inferErrorSource(message, category);
    const retryable = input.retryable ?? inferRetryable(category);
    return {
        errorId: createErrorId(source, category, message),
        category,
        severity: input.severity ?? inferSeverity(category),
        title: getErrorTitle(category),
        message,
        source,
        retryable,
        recommendedActions: getRecommendedActions(category, retryable),
        ...(input.retryAfterMs === undefined ? {} : { retryAfterMs: input.retryAfterMs }),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        ...(input.turnId ? { turnId: input.turnId } : {}),
        ...(input.toolUseId ? { toolUseId: input.toolUseId } : {}),
        ...(input.permissionRequestId
            ? { permissionRequestId: input.permissionRequestId }
            : {}),
        ...(input.rawRef ? { rawRef: input.rawRef } : {}),
        ...(input.safeDetails
            ? { safeDetails: sanitizeErrorDetails(input.safeDetails) }
            : {}),
    };
}
export function sanitizeErrorDetails(details) {
    return sanitizeValue(details);
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object') {
        const message = error.message;
        if (typeof message === 'string') {
            return message;
        }
    }
    return '未知错误。';
}
function normalizeErrorMessage(message) {
    const trimmed = message.trim();
    return trimmed || '未知错误。';
}
function classifyErrorCategory(message, source) {
    const text = message.toLowerCase();
    if (text.includes('api key') ||
        text.includes('unauthorized') ||
        text.includes('401') ||
        text.includes('authentication') ||
        text.includes('auth_required') ||
        text.includes('token expired')) {
        return 'auth_expired';
    }
    if (text.includes('rate limit') ||
        text.includes('rate_limited') ||
        text.includes('too many requests') ||
        text.includes('429')) {
        return 'rate_limited';
    }
    if (text.includes('quota') ||
        text.includes('billing') ||
        text.includes('insufficient balance') ||
        text.includes('credits')) {
        return 'quota_exceeded';
    }
    if (text.includes('refusal') ||
        text.includes('refused') ||
        text.includes('model refused')) {
        return 'model_refusal';
    }
    if (text.includes('safety') ||
        text.includes('content_filter') ||
        text.includes('blocked by policy') ||
        text.includes('safety_blocked')) {
        return 'safety_blocked';
    }
    if (text.includes('tool_call_id') ||
        text.includes('tool_result') ||
        text.includes('functionresponse') ||
        text.includes('function_call_output') ||
        text.includes('invalid role') ||
        text.includes('protocol')) {
        return 'protocol_error';
    }
    if (text.includes('network') ||
        text.includes('timeout') ||
        text.includes('econnrefused') ||
        text.includes('enotfound') ||
        text.includes('und_err_connect_timeout')) {
        return 'network_error';
    }
    if (source === 'tool') {
        return 'tool_error';
    }
    return 'unknown_error';
}
function inferErrorSource(message, category) {
    if (category === 'network_error') {
        return 'network';
    }
    if (category === 'auth_expired' ||
        category === 'rate_limited' ||
        category === 'quota_exceeded' ||
        category === 'model_refusal' ||
        category === 'safety_blocked' ||
        category === 'protocol_error') {
        return 'provider';
    }
    const text = message.toLowerCase();
    if (text.includes('mcp')) {
        return 'mcp';
    }
    if (text.includes('tool')) {
        return 'tool';
    }
    return 'unknown';
}
function inferRetryable(category) {
    switch (category) {
        case 'rate_limited':
        case 'network_error':
            return true;
        case 'auth_expired':
        case 'quota_exceeded':
        case 'model_refusal':
        case 'safety_blocked':
        case 'protocol_error':
            return false;
        default:
            return 'unknown';
    }
}
function inferSeverity(category) {
    switch (category) {
        case 'model_refusal':
        case 'safety_blocked':
            return 'warning';
        case 'unknown_error':
            return 'error';
        default:
            return 'error';
    }
}
function getErrorTitle(category) {
    switch (category) {
        case 'auth_expired':
            return '认证失败';
        case 'rate_limited':
            return '请求过于频繁';
        case 'quota_exceeded':
            return '额度不足';
        case 'model_refusal':
            return '模型拒答';
        case 'safety_blocked':
            return '安全策略拦截';
        case 'tool_error':
            return '工具执行失败';
        case 'network_error':
            return '网络请求失败';
        case 'protocol_error':
            return '协议历史不合法';
        case 'unknown_error':
            return '未知错误';
    }
}
function getRecommendedActions(category, retryable) {
    switch (category) {
        case 'auth_expired':
            return ['reauth', 'open_logs', 'copy_diagnostics'];
        case 'rate_limited':
        case 'network_error':
            return ['retry', 'open_logs', 'copy_diagnostics'];
        case 'quota_exceeded':
        case 'model_refusal':
        case 'safety_blocked':
            return ['switch_model', 'open_logs', 'copy_diagnostics'];
        case 'tool_error':
        case 'protocol_error':
            return retryable === true
                ? ['retry', 'open_logs', 'copy_diagnostics']
                : ['open_logs', 'copy_diagnostics'];
        case 'unknown_error':
            return ['open_logs', 'copy_diagnostics'];
    }
}
function createErrorId(source, category, message) {
    const hash = Math.abs(hashString(`${source}:${category}:${message}`))
        .toString(36)
        .slice(0, 8);
    return `err_${category}_${hash}`;
}
function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }
    return hash;
}
function sanitizeValue(value) {
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (!value || typeof value !== 'object') {
        return typeof value === 'string' ? redactSecretText(value) : value;
    }
    const output = {};
    for (const [key, child] of Object.entries(value)) {
        output[key] = isSensitiveKey(key)
            ? '[REDACTED]'
            : sanitizeValue(child);
    }
    return output;
}
function isSensitiveKey(key) {
    const normalized = key.toLowerCase();
    return [
        'authorization',
        'api_key',
        'apikey',
        'access_token',
        'refresh_token',
        'cookie',
        'set-cookie',
        'password',
        'secret',
        'token',
    ].some(part => normalized.includes(part));
}
function redactSecretText(value) {
    return value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gu, 'Bearer [REDACTED]')
        .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, 'sk-[REDACTED]');
}
//# sourceMappingURL=errorSnapshot.js.map