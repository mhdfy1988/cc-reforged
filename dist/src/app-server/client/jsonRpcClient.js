import { JsonRpcNotificationSchema, JsonRpcResponseSchema, } from '../protocol.js';
import { AppServerClientError, jsonRpcErrorToClientError, } from './errors.js';
const DEFAULT_TIMEOUT_MS = 30_000;
const LATE_RESPONSE_RETENTION_MS = 10 * 60_000;
export class JsonRpcClient {
    transport;
    nextId = 1;
    closed = false;
    pending = new Map();
    timedOutRequests = new Map();
    notifications = new Set();
    errors = new Set();
    disposers;
    defaultTimeoutMs;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.disposers = [
            transport.onLine(line => this.handleLine(line)),
            transport.onClose(event => {
                this.rejectAll(new AppServerClientError('process_exited', 'App Server process exited before all requests completed.', event));
            }),
        ];
    }
    request(method, params, options = {}) {
        if (this.closed) {
            return Promise.reject(new AppServerClientError('closed', 'App Server client is closed.'));
        }
        const id = this.nextId++;
        const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
        const payload = {
            jsonrpc: '2.0',
            id,
            method,
            ...(params === undefined ? {} : { params }),
        };
        return new Promise((resolve, reject) => {
            const pending = {
                method,
                resolve: value => resolve(value),
                reject,
            };
            if (timeoutMs > 0) {
                pending.timer = setTimeout(() => {
                    this.pending.delete(id);
                    this.trackTimedOutRequest(id, method, timeoutMs);
                    reject(new AppServerClientError('request_timeout', `App Server request timed out: ${method}`, { method, timeoutMs }));
                }, timeoutMs);
            }
            this.pending.set(id, pending);
            try {
                this.transport.sendLine(JSON.stringify(payload));
            }
            catch (error) {
                this.pending.delete(id);
                this.clearTimer(pending);
                reject(error);
            }
        });
    }
    notify(method, params) {
        if (this.closed) {
            throw new AppServerClientError('closed', 'App Server client is closed.');
        }
        this.transport.sendLine(JSON.stringify({
            jsonrpc: '2.0',
            method,
            ...(params === undefined ? {} : { params }),
        }));
    }
    onNotification(listener) {
        this.notifications.add(listener);
        return () => this.notifications.delete(listener);
    }
    onError(listener) {
        this.errors.add(listener);
        return () => this.errors.delete(listener);
    }
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.disposers.forEach(dispose => dispose());
        this.rejectAll(new AppServerClientError('closed', 'App Server client is closed.'));
        this.clearTimedOutRequests();
        this.transport.close();
    }
    handleLine(line) {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch (error) {
            this.emitError(new AppServerClientError('parse_error', 'Invalid JSON from App Server.', {
                line: trimmed,
                error,
            }));
            return;
        }
        const responseParse = JsonRpcResponseSchema.safeParse(parsed);
        if (responseParse.success) {
            this.handleResponse(responseParse.data);
            return;
        }
        const notificationParse = JsonRpcNotificationSchema.safeParse(parsed);
        if (notificationParse.success) {
            this.emitNotification(notificationParse.data);
            return;
        }
        this.emitError(new AppServerClientError('protocol_error', 'Unknown App Server protocol message.', { message: parsed }));
    }
    handleResponse(response) {
        if (response.id === null) {
            this.emitError(new AppServerClientError('protocol_error', 'App Server returned a response without request id.', response));
            return;
        }
        const pending = this.pending.get(response.id);
        if (!pending) {
            if (this.timedOutRequests.has(response.id)) {
                this.clearTimedOutRequest(response.id);
                return;
            }
            this.emitError(new AppServerClientError('protocol_error', 'App Server returned a response for an unknown request.', response));
            return;
        }
        this.pending.delete(response.id);
        this.clearTimer(pending);
        if ('error' in response) {
            pending.reject(jsonRpcErrorToClientError(response));
            return;
        }
        pending.resolve(response.result);
    }
    emitNotification(notification) {
        for (const listener of this.notifications) {
            listener(notification);
        }
    }
    emitError(error) {
        for (const listener of this.errors) {
            listener(error);
        }
    }
    rejectAll(error) {
        for (const pending of this.pending.values()) {
            this.clearTimer(pending);
            pending.reject(error);
        }
        this.pending.clear();
    }
    clearTimer(pending) {
        if (pending.timer) {
            clearTimeout(pending.timer);
        }
    }
    trackTimedOutRequest(id, method, timeoutMs) {
        this.clearTimedOutRequest(id);
        const cleanupTimer = setTimeout(() => {
            this.timedOutRequests.delete(id);
        }, LATE_RESPONSE_RETENTION_MS);
        this.timedOutRequests.set(id, { method, timeoutMs, cleanupTimer });
    }
    clearTimedOutRequest(id) {
        const request = this.timedOutRequests.get(id);
        if (!request) {
            return;
        }
        clearTimeout(request.cleanupTimer);
        this.timedOutRequests.delete(id);
    }
    clearTimedOutRequests() {
        for (const request of this.timedOutRequests.values()) {
            clearTimeout(request.cleanupTimer);
        }
        this.timedOutRequests.clear();
    }
}
//# sourceMappingURL=jsonRpcClient.js.map