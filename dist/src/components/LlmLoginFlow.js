import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useState } from 'react';
import { Box, Text } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { resetDefaultLlmRuntime } from '../services/llm/defaultRuntime.js';
import { getLlmProviderConfig, loadLlmConfig, updatePersistedLlmConfig, } from '../services/llm/llmConfig.js';
import { createDefaultCodexOAuthSession, resetDefaultCodexOAuthSession, } from '../services/llm/sessions/defaultCodexOAuthSession.js';
import { logError } from '../utils/log.js';
import { Select } from './CustomSelect/select.js';
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow.js';
import { Spinner } from './Spinner.js';
export function LlmLoginFlow({ onDone }) {
    const [mode, setMode] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const startCodexOAuth = useCallback(async () => {
        try {
            setErrorMessage('');
            setMode('codex-checking');
            const config = loadLlmConfig();
            const codexProviderConfig = getLlmProviderConfig('codex-oauth', config);
            if (config.provider !== 'codex-oauth') {
                await updatePersistedLlmConfig({
                    provider: 'codex-oauth',
                    model: codexProviderConfig?.defaultModel ?? 'gpt-5.4',
                });
                resetDefaultLlmRuntime();
                resetDefaultCodexOAuthSession();
            }
            const session = createDefaultCodexOAuthSession();
            const availability = await session.getAvailability();
            if (availability.available) {
                onDone();
                return;
            }
            setMode('codex-login');
            await session.loginWithBrowser();
            resetDefaultCodexOAuthSession();
            resetDefaultLlmRuntime();
            onDone();
        }
        catch (error) {
            logError(error);
            setErrorMessage(error.message);
            setMode('error');
        }
    }, [onDone]);
    const startAnthropicLogin = useCallback(async (nextMode) => {
        try {
            await updatePersistedLlmConfig({
                provider: 'anthropic',
                model: null,
            });
            resetDefaultLlmRuntime();
            setMode(nextMode);
        }
        catch (error) {
            logError(error);
            setErrorMessage(error.message);
            setMode('error');
        }
    }, []);
    useKeybinding('confirm:yes', () => {
        setMode('idle');
    }, {
        context: 'Confirmation',
        isActive: mode === 'platform',
    });
    useKeybinding('confirm:yes', () => {
        void startCodexOAuth();
    }, {
        context: 'Confirmation',
        isActive: mode === 'error',
    });
    if (mode === 'anthropic-claudeai') {
        return _jsx(ConsoleOAuthFlow, { onDone: onDone, forceLoginMethod: "claudeai" });
    }
    if (mode === 'anthropic-console') {
        return _jsx(ConsoleOAuthFlow, { onDone: onDone, forceLoginMethod: "console" });
    }
    if (mode === 'platform') {
        return (_jsxs(Box, { flexDirection: "column", gap: 1, marginTop: 1, children: [_jsx(Text, { bold: true, children: "CCR can also use API keys through 3rd-party platforms." }), _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { children: "Set up one of the following environment variables or settings:" }), _jsxs(Text, { children: ["\u2022 Amazon Bedrock:", ' ', _jsx(Text, { color: "warning", children: "CLAUDE_CODE_USE_BEDROCK=1" })] }), _jsxs(Text, { children: ["\u2022 Microsoft Foundry:", ' ', _jsx(Text, { color: "warning", children: "CLAUDE_CODE_USE_FOUNDRY=1" })] }), _jsxs(Text, { children: ["\u2022 Google Vertex AI:", ' ', _jsx(Text, { color: "warning", children: "CLAUDE_CODE_USE_VERTEX=1" })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "permission", children: ["Press ", _jsx(Text, { bold: true, children: "Enter" }), " to go back to login options."] }) })] })] }));
    }
    if (mode === 'codex-checking') {
        return (_jsx(Box, { flexDirection: "column", gap: 1, marginTop: 1, children: _jsxs(Box, { children: [_jsx(Spinner, {}), _jsx(Text, { children: "Checking Codex OAuth credential..." })] }) }));
    }
    if (mode === 'codex-login') {
        return (_jsxs(Box, { flexDirection: "column", gap: 1, marginTop: 1, children: [_jsxs(Box, { children: [_jsx(Spinner, {}), _jsx(Text, { children: "Opening browser for Codex OAuth login..." })] }), _jsx(Text, { dimColor: true, children: "Complete ChatGPT / Codex authorization in the browser, then return to this terminal." })] }));
    }
    if (mode === 'error') {
        return (_jsxs(Box, { flexDirection: "column", gap: 1, marginTop: 1, children: [_jsxs(Text, { color: "error", children: ["Codex OAuth error: ", errorMessage] }), _jsxs(Text, { color: "permission", children: ["Press ", _jsx(Text, { bold: true, children: "Enter" }), " to retry."] })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", gap: 1, marginTop: 1, children: [_jsx(Text, { bold: true, children: "CCR can use Codex OAuth, Claude subscription, Anthropic Console billing, or a third-party platform." }), _jsx(Text, { children: "Select login method:" }), _jsx(Box, { children: _jsx(Select, { options: [
                        {
                            label: (_jsxs(Text, { children: ["Codex OAuth \u00B7", ' ', _jsx(Text, { dimColor: true, children: "ChatGPT / Codex account" }), '\n'] })),
                            value: 'codex-oauth',
                        },
                        {
                            label: (_jsxs(Text, { children: ["Claude account with subscription \u00B7", ' ', _jsx(Text, { dimColor: true, children: "Pro, Max, Team, or Enterprise" }), '\n'] })),
                            value: 'claudeai',
                        },
                        {
                            label: (_jsxs(Text, { children: ["Anthropic Console account \u00B7", ' ', _jsx(Text, { dimColor: true, children: "API usage billing" }), '\n'] })),
                            value: 'console',
                        },
                        {
                            label: (_jsxs(Text, { children: ["3rd-party platform \u00B7", ' ', _jsx(Text, { dimColor: true, children: "Amazon Bedrock, Microsoft Foundry, or Vertex AI" }), '\n'] })),
                            value: 'platform',
                        },
                    ], onChange: value => {
                        if (value === 'codex-oauth') {
                            void startCodexOAuth();
                        }
                        else if (value === 'claudeai') {
                            void startAnthropicLogin('anthropic-claudeai');
                        }
                        else if (value === 'console') {
                            void startAnthropicLogin('anthropic-console');
                        }
                        else {
                            setMode('platform');
                        }
                    } }) })] }));
}
//# sourceMappingURL=LlmLoginFlow.js.map