export function createCcrErrorSnapshot(input) {
    const message = normalizeErrorMessage(input.message ?? getErrorMessage(input.error));
    const category = input.category ??
        classifyErrorCategory({
            message,
            source: input.source,
            error: input.error,
            safeDetails: input.safeDetails,
        });
    const source = input.source ??
        inferErrorSource({
            message,
            category,
            error: input.error,
            safeDetails: input.safeDetails,
        });
    const retryable = input.retryable ?? inferRetryable(category);
    const retryAfterMs = input.retryAfterMs ??
        inferRetryAfterMs({
            error: input.error,
            safeDetails: input.safeDetails,
        });
    return {
        errorId: createErrorId(source, category, message),
        category,
        severity: input.severity ?? inferSeverity(category),
        title: getErrorTitle(category),
        message,
        source,
        retryable,
        recommendedActions: getRecommendedActions(category, retryable),
        ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
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
function classifyErrorCategory(context) {
    const text = collectClassificationText(context);
    if (text.includes('api key') ||
        text.includes('invalid_api_key') ||
        text.includes('unauthorized') ||
        text.includes('authentication_error') ||
        text.includes('401') ||
        text.includes('403') ||
        text.includes('authentication') ||
        text.includes('auth_required') ||
        text.includes('token expired') ||
        text.includes('token revoked') ||
        text.includes('oauth_expired') ||
        text.includes('not logged in')) {
        return 'auth_expired';
    }
    if (text.includes('quota') ||
        text.includes('billing') ||
        text.includes('insufficient balance') ||
        text.includes('insufficient_balance') ||
        text.includes('insufficient_quota') ||
        text.includes('credit balance') ||
        text.includes('credits') ||
        text.includes('payment required') ||
        text.includes('402')) {
        return 'quota_exceeded';
    }
    if (text.includes('rate limit') ||
        text.includes('rate_limit') ||
        text.includes('rate_limited') ||
        text.includes('rate-limit') ||
        text.includes('too many requests') ||
        text.includes('too_many_requests') ||
        text.includes('429') ||
        text.includes('throttle') ||
        text.includes('overloaded') ||
        text.includes('529')) {
        return 'rate_limited';
    }
    if (text.includes('safety') ||
        text.includes('content_filter') ||
        text.includes('blocked by policy') ||
        text.includes('safety_blocked') ||
        text.includes('policy_violation')) {
        return 'safety_blocked';
    }
    if (text.includes('model_refusal') ||
        text.includes('stopreason:refusal') ||
        text.includes('stop_reason:refusal') ||
        text.includes('refusal') ||
        text.includes('refused') ||
        text.includes('model refused')) {
        return 'model_refusal';
    }
    if (text.includes('tool_call_id') ||
        text.includes('tool_result') ||
        text.includes('functionresponse') ||
        text.includes('function_call_output') ||
        text.includes('invalid role') ||
        text.includes('protocol') ||
        text.includes('invalid_request_error') ||
        text.includes('invalid request') ||
        text.includes('invalid_params') ||
        text.includes('parse_error') ||
        text.includes('method_not_found') ||
        text.includes('capability_mismatch') ||
        text.includes('json schema') ||
        text.includes('schema validation') ||
        text.includes('400') ||
        text.includes('422')) {
        return 'protocol_error';
    }
    if (text.includes('network') ||
        text.includes('timeout') ||
        text.includes('timed out') ||
        text.includes('econnrefused') ||
        text.includes('enotfound') ||
        text.includes('eai_again') ||
        text.includes('econnreset') ||
        text.includes('api_connection_error') ||
        text.includes('connection error') ||
        text.includes('fetch failed') ||
        text.includes('socket') ||
        text.includes('request_timeout') ||
        text.includes('und_err_connect_timeout')) {
        return 'network_error';
    }
    if (context.source === 'tool' || text.includes('tool_error')) {
        return 'tool_error';
    }
    return 'unknown_error';
}
function inferErrorSource(context) {
    const text = collectClassificationText(context);
    if (text.includes('appservererror') ||
        text.includes('appserverclienterror') ||
        text.includes('jsonrpc') ||
        text.includes('json-rpc') ||
        text.includes('-326') ||
        text.includes('-320')) {
        return 'app_server';
    }
    if (text.includes('coreerror')) {
        return 'core';
    }
    if (text.includes('mcp')) {
        return 'mcp';
    }
    if (text.includes('tool') || context.category === 'tool_error') {
        return 'tool';
    }
    if (context.category === 'network_error') {
        return 'network';
    }
    if (context.category === 'auth_expired' ||
        context.category === 'rate_limited' ||
        context.category === 'quota_exceeded' ||
        context.category === 'model_refusal' ||
        context.category === 'safety_blocked' ||
        context.category === 'protocol_error') {
        return 'provider';
    }
    return 'unknown';
}
function collectClassificationText(context) {
    const signals = new Set();
    addClassificationSignal(signals, context.message);
    addClassificationSignal(signals, context.source);
    collectClassificationSignals(context.error, 'error', signals);
    collectClassificationSignals(context.safeDetails, 'details', signals);
    return Array.from(signals).join('\n').toLowerCase();
}
function collectClassificationSignals(value, path, signals, depth = 0) {
    if (signals.size > 120 || depth > 4 || value === undefined || value === null) {
        return;
    }
    if (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') {
        addClassificationSignal(signals, `${path}:${String(value)}`);
        addClassificationSignal(signals, String(value));
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => collectClassificationSignals(item, `${path}[${index}]`, signals, depth + 1));
        return;
    }
    if (typeof value !== 'object') {
        return;
    }
    if (value instanceof Error) {
        addClassificationSignal(signals, value.name);
        addClassificationSignal(signals, value.message);
        collectClassificationSignals(value.cause, `${path}.cause`, signals, depth + 1);
    }
    for (const [key, child] of Object.entries(value)) {
        addClassificationSignal(signals, key);
        collectClassificationSignals(child, `${path}.${key}`, signals, depth + 1);
    }
}
function addClassificationSignal(signals, value) {
    if (typeof value !== 'string') {
        return;
    }
    const normalized = value.trim();
    if (normalized) {
        signals.add(normalized);
    }
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
function inferRetryAfterMs(context) {
    const signals = [];
    collectRetryAfterSignals(context.error, 'error', signals);
    collectRetryAfterSignals(context.safeDetails, 'details', signals);
    for (const signal of signals) {
        const retryAfterMs = parseRetryAfterValue(signal.value, signal.key);
        if (retryAfterMs !== undefined) {
            return retryAfterMs;
        }
    }
    return undefined;
}
function collectRetryAfterSignals(value, path, signals, depth = 0) {
    if (signals.length > 24 || depth > 4 || value === undefined || value === null) {
        return;
    }
    if (typeof value !== 'object') {
        return;
    }
    if (value instanceof Error) {
        collectRetryAfterSignals(value.cause, `${path}.cause`, signals, depth + 1);
    }
    for (const [key, child] of Object.entries(value)) {
        if (isRetryAfterKey(key)) {
            signals.push({ key, value: child });
        }
        collectRetryAfterSignals(child, `${path}.${key}`, signals, depth + 1);
    }
}
function isRetryAfterKey(key) {
    const compact = normalizeSignalKey(key);
    return (compact === 'retryafter' ||
        compact === 'retryafterms' ||
        compact === 'retryafterseconds' ||
        compact === 'ratelimitreset' ||
        compact === 'xratelimitreset' ||
        compact === 'resetat');
}
function parseRetryAfterValue(value, key) {
    if (typeof value === 'number') {
        return parseRetryAfterNumber(value, key);
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
        return parseRetryAfterNumber(numeric, key);
    }
    const parsedDate = Date.parse(trimmed);
    if (Number.isNaN(parsedDate)) {
        return undefined;
    }
    return clampRetryAfterMs(parsedDate - Date.now());
}
function parseRetryAfterNumber(value, key) {
    if (!Number.isFinite(value) || value < 0) {
        return undefined;
    }
    const compact = normalizeSignalKey(key);
    if (compact.endsWith('ms')) {
        return clampRetryAfterMs(value);
    }
    if (compact.includes('reset')) {
        if (value > 1_000_000_000_000) {
            return clampRetryAfterMs(value - Date.now());
        }
        if (value > 1_000_000_000) {
            return clampRetryAfterMs(value * 1000 - Date.now());
        }
    }
    return clampRetryAfterMs(value * 1000);
}
function clampRetryAfterMs(value) {
    if (!Number.isFinite(value) || value < 0) {
        return undefined;
    }
    const maxRetryAfterMs = 7 * 24 * 60 * 60 * 1000;
    return Math.min(Math.round(value), maxRetryAfterMs);
}
function normalizeSignalKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/gu, '');
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