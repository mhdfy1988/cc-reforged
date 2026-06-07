const STATIC_RECOVERY_FEATURE_FLAGS = {
    AGENT_TRIGGERS: false,
    AGENT_TRIGGERS_REMOTE: false,
    ABLATION_BASELINE: false,
    ALLOW_TEST_VERSIONS: false,
    ANTI_DISTILLATION_CC: false,
    AUTO_THEME: false,
    AWAY_SUMMARY: false,
    BASH_CLASSIFIER: false,
    BG_SESSIONS: false,
    BRIDGE_MODE: false,
    BUILDING_CLAUDE_APPS: false,
    BUDDY: false,
    BYOC_ENVIRONMENT_RUNNER: false,
    CACHED_MICROCOMPACT: false,
    CCR_AUTO_CONNECT: false,
    CCR_MIRROR: false,
    CCR_REMOTE_SETUP: false,
    CHICAGO_MCP: false,
    COMMIT_ATTRIBUTION: false,
    COMPACTION_REMINDERS: false,
    CONNECTOR_TEXT: false,
    CONTEXT_COLLAPSE: false,
    COORDINATOR_MODE: false,
    COWORKER_TYPE_TELEMETRY: false,
    DAEMON: false,
    DIRECT_CONNECT: false,
    DOWNLOAD_USER_SETTINGS: false,
    DUMP_SYSTEM_PROMPT: false,
    ENHANCED_TELEMETRY_BETA: false,
    EXPERIMENTAL_SKILL_SEARCH: true,
    EXTRACT_MEMORIES: false,
    FILE_PERSISTENCE: false,
    FORK_SUBAGENT: false,
    HARD_FAIL: false,
    HISTORY_PICKER: false,
    HISTORY_SNIP: false,
    HOOK_PROMPTS: false,
    KAIROS: false,
    KAIROS_CHANNELS: false,
    MCP_RICH_OUTPUT: false,
    MCP_SKILLS: false,
    MEMORY_SHAPE_TELEMETRY: false,
    MESSAGE_ACTIONS: false,
    MONITOR_TOOL: false,
    NATIVE_CLIENT_ATTESTATION: false,
    NATIVE_CLIPBOARD_IMAGE: false,
    NEW_INIT: false,
    PERFETTO_TRACING: false,
    POWERSHELL_AUTO_MODE: false,
    PROACTIVE: false,
    PROMPT_CACHE_BREAK_DETECTION: false,
    QUICK_SEARCH: false,
    REACTIVE_COMPACT: false,
    REVIEW_ARTIFACT: false,
    RUN_SKILL_GENERATOR: false,
    SELF_HOSTED_RUNNER: false,
    SKILL_IMPROVEMENT: false,
    SSH_REMOTE: false,
    STREAMLINED_OUTPUT: false,
    TEAMMEM: false,
    TERMINAL_PANEL: false,
    TEMPLATES: false,
    TOKEN_BUDGET: false,
    TRANSCRIPT_CLASSIFIER: false,
    // Security-path parser should stay on by default in recovery builds.
    // Shadow mode remains opt-in because it is observational only.
    TREE_SITTER_BASH: true,
    TREE_SITTER_BASH_SHADOW: false,
    UDS_INBOX: false,
    ULTRAPLAN: false,
    ULTRATHINK: false,
    UNATTENDED_RETRY: false,
    UPLOAD_USER_SETTINGS: false,
    VERIFICATION_AGENT: false,
    VOICE_MODE: false,
    WEB_BROWSER_TOOL: false,
    WORKFLOW_SCRIPTS: false
};
function readFeatureListFromEnv(name) {
    const raw = process.env[name];
    if (!raw) {
        return new Set();
    }
    return new Set(raw
        .split(',')
        .map(part => part.trim())
        .filter(Boolean));
}
const enabledByEnv = readFeatureListFromEnv('CC_REFORGED_ENABLE_FEATURES');
const disabledByEnv = readFeatureListFromEnv('CC_REFORGED_DISABLE_FEATURES');
export const RECOVERY_FEATURE_FLAGS = Object.freeze(Object.fromEntries(Object.entries(STATIC_RECOVERY_FEATURE_FLAGS).map(([name, value]) => {
    if (disabledByEnv.has(name)) {
        return [name, false];
    }
    if (enabledByEnv.has(name)) {
        return [name, true];
    }
    return [name, value];
})));
export function feature(name) {
    return RECOVERY_FEATURE_FLAGS[name] ?? false;
}
export function getEnabledRecoveryFeatures() {
    return Object.entries(RECOVERY_FEATURE_FLAGS)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
}
//# sourceMappingURL=featureFlags.js.map