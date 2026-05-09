// Critical system constants extracted to break circular dependencies
import { feature } from 'bun:bundle';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js';
import { logForDebugging } from '../utils/debug.js';
import { getClaudeConfigHomeDir, isEnvDefinedFalsy, } from '../utils/envUtils.js';
import { getAPIProvider, isFirstPartyAnthropicBaseUrl, } from '../utils/model/providers.js';
import { getWorkload } from '../utils/workloadContext.js';
const DEFAULT_PREFIX = `You are Claude Code, Anthropic's official CLI for Claude.`;
const AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX = `You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.`;
const AGENT_SDK_PREFIX = `You are a Claude agent, built on Anthropic's Claude Agent SDK.`;
const CCR_PREFIX = `You are CCR, a coding agent for terminal and desktop workflows.`;
const AGENT_SDK_CCR_PRESET_PREFIX = `You are CCR, a coding agent for terminal and desktop workflows, running in non-interactive agent mode.`;
const CCR_AGENT_PREFIX = `You are a CCR coding agent.`;
const CLI_SYSPROMPT_PREFIX_VALUES = [
    DEFAULT_PREFIX,
    AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX,
    AGENT_SDK_PREFIX,
    CCR_PREFIX,
    AGENT_SDK_CCR_PRESET_PREFIX,
    CCR_AGENT_PREFIX,
];
/**
 * All possible CLI sysprompt prefix values, used by splitSysPromptPrefix
 * to identify prefix blocks by content rather than position.
 */
export const CLI_SYSPROMPT_PREFIXES = new Set(CLI_SYSPROMPT_PREFIX_VALUES);
function getConfiguredLlmProviderForSystemIdentity() {
    const envProvider = process.env.CCR_LLM_PROVIDER?.trim().toLowerCase();
    if (envProvider) {
        return envProvider;
    }
    const configPath = process.env.CCR_LLM_CONFIG_PATH?.trim() ||
        join(getClaudeConfigHomeDir(), 'data', 'llm.config.local.json');
    try {
        if (!existsSync(configPath)) {
            return 'codex-oauth';
        }
        const raw = readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.provider === 'string' && parsed.provider.trim()) {
            return parsed.provider.trim().toLowerCase();
        }
    }
    catch {
        return 'unknown';
    }
    return 'codex-oauth';
}
/**
 * Claude Code attribution is a first-party protocol hint. Do not expose it to
 * OpenAI/Codex OAuth, BigModel, or other Anthropic-compatible gateways: it is
 * model-visible because the upstream client carries it in the system prompt.
 */
export function shouldUseClaudeCodeSystemIdentity() {
    const apiProvider = getAPIProvider();
    if (apiProvider === 'bedrock' ||
        apiProvider === 'vertex' ||
        apiProvider === 'foundry') {
        return true;
    }
    if (getConfiguredLlmProviderForSystemIdentity() !== 'anthropic') {
        return false;
    }
    return isFirstPartyAnthropicBaseUrl();
}
export function getCLISyspromptPrefix(options) {
    const apiProvider = getAPIProvider();
    if (!shouldUseClaudeCodeSystemIdentity()) {
        if (options?.isNonInteractive) {
            if (options.hasAppendSystemPrompt) {
                return AGENT_SDK_CCR_PRESET_PREFIX;
            }
            return CCR_AGENT_PREFIX;
        }
        return CCR_PREFIX;
    }
    if (apiProvider === 'vertex') {
        return DEFAULT_PREFIX;
    }
    if (options?.isNonInteractive) {
        if (options.hasAppendSystemPrompt) {
            return AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX;
        }
        return AGENT_SDK_PREFIX;
    }
    return DEFAULT_PREFIX;
}
/**
 * Check if attribution header is enabled.
 * Enabled by default, can be disabled via env var or GrowthBook killswitch.
 */
function isAttributionHeaderEnabled() {
    if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ATTRIBUTION_HEADER)) {
        return false;
    }
    return getFeatureValue_CACHED_MAY_BE_STALE('tengu_attribution_header', true);
}
/**
 * Get attribution header for API requests.
 * Returns a header string with cc_version (including fingerprint) and cc_entrypoint.
 * Enabled by default, can be disabled via env var or GrowthBook killswitch.
 *
 * When NATIVE_CLIENT_ATTESTATION is enabled, includes a `cch=00000` placeholder.
 * Before the request is sent, Bun's native HTTP stack finds this placeholder
 * in the request body and overwrites the zeros with a computed hash. The
 * server verifies this token to confirm the request came from a real Claude
 * Code client. See bun-anthropic/src/http/Attestation.zig for implementation.
 *
 * We use a placeholder (instead of injecting from Zig) because same-length
 * replacement avoids Content-Length changes and buffer reallocation.
 */
export function getAttributionHeader(fingerprint) {
    if (!shouldUseClaudeCodeSystemIdentity() || !isAttributionHeaderEnabled()) {
        return '';
    }
    const version = `${MACRO.VERSION}.${fingerprint}`;
    const entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT ?? 'unknown';
    // cch=00000 placeholder is overwritten by Bun's HTTP stack with attestation token
    const cch = feature('NATIVE_CLIENT_ATTESTATION') ? ' cch=00000;' : '';
    // cc_workload: turn-scoped hint so the API can route e.g. cron-initiated
    // requests to a lower QoS pool. Absent = interactive default. Safe re:
    // fingerprint (computed from msg chars + version only, line 78 above) and
    // cch attestation (placeholder overwritten in serialized body bytes after
    // this string is built). Server _parse_cc_header tolerates unknown extra
    // fields so old API deploys silently ignore this.
    const workload = getWorkload();
    const workloadPair = workload ? ` cc_workload=${workload};` : '';
    const header = `x-anthropic-billing-header: cc_version=${version}; cc_entrypoint=${entrypoint};${cch}${workloadPair}`;
    logForDebugging(`attribution header ${header}`);
    return header;
}
//# sourceMappingURL=system.js.map