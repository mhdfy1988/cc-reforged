import { createFetchWithInit, } from '@modelcontextprotocol/sdk/shared/transport.js';
import { getSessionId } from '../../bootstrap/state.js';
import { getOauthConfig } from '../../constants/oauth.js';
import { checkAndRefreshOAuthTokenIfNeeded, getClaudeAIOAuthTokens, handleOAuth401Error, } from '../../utils/auth.js';
import { getMCPUserAgent } from '../../utils/http.js';
import { getProxyFetchOptions } from '../../utils/proxy.js';
import { logEvent } from '../analytics/index.js';
import { ClaudeAuthProvider, wrapFetchWithStepUpDetection, } from './auth.js';
import { getMcpServerHeaders } from './headersHelper.js';
/**
 * Default timeout for individual MCP requests (auth, tool calls, etc.)
 */
export const MCP_REQUEST_TIMEOUT_MS = 60000;
/**
 * MCP Streamable HTTP spec requires clients to advertise acceptance of both
 * JSON and SSE on every POST. Servers that enforce this strictly reject
 * requests without it (HTTP 406).
 * https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#sending-messages-to-the-server
 */
export const MCP_STREAMABLE_HTTP_ACCEPT = 'application/json, text/event-stream';
export function buildHttpRequestHeaders({ userAgent = getMCPUserAgent(), sessionIngressToken, hasOAuthTokens, combinedHeaders, }) {
    return {
        'User-Agent': userAgent,
        ...(sessionIngressToken &&
            !hasOAuthTokens && {
            Authorization: `Bearer ${sessionIngressToken}`,
        }),
        ...combinedHeaders,
    };
}
export async function buildSseEventSourceHeaders({ authProvider, userAgent = getMCPUserAgent(), initHeaders, combinedHeaders, }) {
    const authHeaders = {};
    const tokens = await authProvider.tokens();
    if (tokens) {
        authHeaders.Authorization = `Bearer ${tokens.access_token}`;
    }
    return {
        'User-Agent': userAgent,
        ...authHeaders,
        ...initHeaders,
        ...combinedHeaders,
        Accept: 'text/event-stream',
    };
}
export function redactMcpTransportHeadersForLog(headers) {
    if (!headers) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [
        key,
        key.toLowerCase() === 'authorization' ? '[REDACTED]' : value,
    ]));
}
/**
 * Fetch wrapper for claude.ai proxy connections. Attaches the OAuth bearer
 * token and retries once on 401 via handleOAuth401Error (force-refresh).
 *
 * The Anthropic API path has this retry (withRetry.ts, grove.ts) to handle
 * memoize-cache staleness and clock drift. Without the same here, a single
 * stale token mass-401s every claude.ai connector and sticks them all in the
 * 15-min needs-auth cache.
 */
export function createClaudeAiProxyFetch(innerFetch) {
    return async (url, init) => {
        const doRequest = async () => {
            await checkAndRefreshOAuthTokenIfNeeded();
            const currentTokens = getClaudeAIOAuthTokens();
            if (!currentTokens) {
                throw new Error('No claude.ai OAuth token available');
            }
            // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${currentTokens.accessToken}`);
            const response = await innerFetch(url, { ...init, headers });
            // Return the exact token that was sent. Reading getClaudeAIOAuthTokens()
            // again after the request is wrong under concurrent 401s: another
            // connector's handleOAuth401Error clears the memoize cache, so we'd read
            // the NEW token from keychain, pass it to handleOAuth401Error, which
            // finds same-as-keychain -> returns false -> skips retry. Same pattern as
            // bridgeApi.ts withOAuthRetry (token passed as fn param).
            return { response, sentToken: currentTokens.accessToken };
        };
        const { response, sentToken } = await doRequest();
        if (response.status !== 401) {
            return response;
        }
        // handleOAuth401Error returns true only if the token actually changed
        // (keychain had a newer one, or force-refresh succeeded). Gate retry on
        // that - otherwise we double round-trip time for every connector whose
        // downstream service genuinely needs auth.
        const tokenChanged = await handleOAuth401Error(sentToken).catch(() => false);
        logEvent('tengu_mcp_claudeai_proxy_401', {
            tokenChanged: tokenChanged,
        });
        if (!tokenChanged) {
            const now = getClaudeAIOAuthTokens()?.accessToken;
            if (!now || now === sentToken) {
                return response;
            }
        }
        try {
            return (await doRequest()).response;
        }
        catch {
            return response;
        }
    };
}
/**
 * Wraps a fetch function to apply a fresh timeout signal to each request.
 */
export function wrapFetchWithTimeout(baseFetch) {
    return async (url, init) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        if (method === 'GET') {
            return baseFetch(url, init);
        }
        // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
        const headers = new Headers(init?.headers);
        if (!headers.has('accept')) {
            headers.set('accept', MCP_STREAMABLE_HTTP_ACCEPT);
        }
        const controller = new AbortController();
        const timer = setTimeout(c => c.abort(new DOMException('The operation timed out.', 'TimeoutError')), MCP_REQUEST_TIMEOUT_MS, controller);
        timer.unref?.();
        const parentSignal = init?.signal;
        const abort = () => controller.abort(parentSignal?.reason);
        parentSignal?.addEventListener('abort', abort);
        if (parentSignal?.aborted) {
            controller.abort(parentSignal.reason);
        }
        const cleanup = () => {
            clearTimeout(timer);
            parentSignal?.removeEventListener('abort', abort);
        };
        try {
            const response = await baseFetch(url, {
                ...init,
                headers,
                signal: controller.signal,
            });
            cleanup();
            return response;
        }
        catch (error) {
            cleanup();
            throw error;
        }
    };
}
export async function buildSseClientTransportOptions({ name, serverRef, }) {
    const authProvider = new ClaudeAuthProvider(name, serverRef);
    const combinedHeaders = await getMcpServerHeaders(name, serverRef);
    const proxyOptions = getProxyFetchOptions();
    return {
        authProvider,
        fetch: wrapFetchWithTimeout(wrapFetchWithStepUpDetection(createFetchWithInit(), authProvider)),
        requestInit: {
            headers: {
                'User-Agent': getMCPUserAgent(),
                ...combinedHeaders,
            },
        },
        eventSourceInit: {
            fetch: async (url, init) => {
                const headers = await buildSseEventSourceHeaders({
                    authProvider,
                    initHeaders: init?.headers,
                    combinedHeaders,
                });
                // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
                return fetch(url, {
                    ...init,
                    ...proxyOptions,
                    headers,
                });
            },
        },
    };
}
export function buildSseIdeClientTransportOptions() {
    const proxyOptions = getProxyFetchOptions();
    if (!proxyOptions.dispatcher) {
        return undefined;
    }
    return {
        eventSourceInit: {
            fetch: async (url, init) => {
                // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
                return fetch(url, {
                    ...init,
                    ...proxyOptions,
                    headers: {
                        'User-Agent': getMCPUserAgent(),
                        ...init?.headers,
                    },
                });
            },
        },
    };
}
export async function buildHttpClientTransportOptions({ name, serverRef, sessionIngressToken, }) {
    const authProvider = new ClaudeAuthProvider(name, serverRef);
    const combinedHeaders = await getMcpServerHeaders(name, serverRef);
    const hasOAuthTokens = !!(await authProvider.tokens());
    const proxyOptions = getProxyFetchOptions();
    const headers = buildHttpRequestHeaders({
        sessionIngressToken,
        hasOAuthTokens,
        combinedHeaders,
    });
    return {
        options: {
            authProvider,
            fetch: wrapFetchWithTimeout(wrapFetchWithStepUpDetection(createFetchWithInit(), authProvider)),
            requestInit: {
                ...proxyOptions,
                headers,
            },
        },
        summary: {
            headers: redactMcpTransportHeadersForLog(headers),
            hasAuthProvider: !!authProvider,
            timeoutMs: MCP_REQUEST_TIMEOUT_MS,
            proxy: proxyOptions.dispatcher ? 'custom dispatcher' : 'default',
        },
    };
}
export function buildClaudeAiProxyTransportOptions({ serverId, fetchImpl, }) {
    const tokens = getClaudeAIOAuthTokens();
    if (!tokens) {
        throw new Error('No claude.ai OAuth token found');
    }
    const oauthConfig = getOauthConfig();
    const proxyUrl = `${oauthConfig.MCP_PROXY_URL}${oauthConfig.MCP_PROXY_PATH.replace('{server_id}', serverId)}`;
    const proxyOptions = getProxyFetchOptions();
    const fetchWithAuth = createClaudeAiProxyFetch(fetchImpl ?? globalThis.fetch);
    return {
        proxyUrl,
        options: {
            fetch: wrapFetchWithTimeout(fetchWithAuth),
            requestInit: {
                ...proxyOptions,
                headers: {
                    'User-Agent': getMCPUserAgent(),
                    'X-Mcp-Client-Session-Id': getSessionId(),
                },
            },
        },
    };
}
//# sourceMappingURL=remoteTransportOptions.js.map