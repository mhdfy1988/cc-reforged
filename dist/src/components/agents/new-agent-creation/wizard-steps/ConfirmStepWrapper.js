import { jsx as _jsx } from "react/jsx-runtime";
import chalk from 'chalk';
import React, { useCallback, useState } from 'react';
import { logEvent } from 'src/services/analytics/index.js';
import { useSetAppState } from 'src/state/AppState.js';
import { AGENT_COLORS } from '../../../../tools/AgentTool/agentColorManager.js';
import { getActiveAgentsFromList } from '../../../../tools/AgentTool/loadAgentsDir.js';
import { editFileInEditor } from '../../../../utils/promptEditor.js';
import { useWizard } from '../../../wizard/index.js';
import { getNewAgentFilePath, saveAgentToFile } from '../../agentFileUtils.js';
import { validateAgent } from '../../validateAgent.js';
import { ConfirmStep } from './ConfirmStep.js';
function isSaveableAgentLocation(value) {
    return value === 'userSettings' || value === 'projectSettings';
}
function isStringArray(value) {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function isAgentColorName(value) {
    return typeof value === 'string' && AGENT_COLORS.some(color => color === value);
}
function isAgentMemoryScope(value) {
    return value === 'user' || value === 'project' || value === 'local';
}
function normalizeFinalAgent(finalAgent, location) {
    if (!finalAgent || typeof finalAgent.agentType !== 'string' || typeof finalAgent.whenToUse !== 'string' || typeof finalAgent.getSystemPrompt !== 'function' || !isSaveableAgentLocation(location)) {
        return null;
    }
    if (finalAgent.tools != null && !isStringArray(finalAgent.tools)) {
        return null;
    }
    if (finalAgent.model != null && typeof finalAgent.model !== 'string') {
        return null;
    }
    if (finalAgent.color != null && !isAgentColorName(finalAgent.color)) {
        return null;
    }
    if (finalAgent.memory != null && !isAgentMemoryScope(finalAgent.memory)) {
        return null;
    }
    return {
        agentType: finalAgent.agentType,
        whenToUse: finalAgent.whenToUse,
        getSystemPrompt: finalAgent.getSystemPrompt,
        tools: isStringArray(finalAgent.tools) ? finalAgent.tools : undefined,
        model: typeof finalAgent.model === 'string' ? finalAgent.model : undefined,
        color: isAgentColorName(finalAgent.color) ? finalAgent.color : undefined,
        memory: isAgentMemoryScope(finalAgent.memory) ? finalAgent.memory : undefined,
        source: location
    };
}
export function ConfirmStepWrapper({ tools, existingAgents, onComplete }) {
    const { wizardData } = useWizard();
    const [saveError, setSaveError] = useState(null);
    const setAppState = useSetAppState();
    const saveAgent = useCallback(async (openInEditor) => {
        const normalizedAgent = normalizeFinalAgent(wizardData?.finalAgent, wizardData?.location);
        if (!normalizedAgent) {
            setSaveError('Agent configuration is incomplete and cannot be confirmed yet.');
            return;
        }
        const validation = validateAgent(normalizedAgent, tools, existingAgents);
        if (!validation.isValid) {
            setSaveError(validation.errors[0] ?? 'Agent configuration is incomplete and cannot be confirmed yet.');
            return;
        }
        setSaveError(null);
        try {
            await saveAgentToFile(normalizedAgent.source, normalizedAgent.agentType, normalizedAgent.whenToUse, normalizedAgent.tools, normalizedAgent.getSystemPrompt(), true, normalizedAgent.color, normalizedAgent.model, normalizedAgent.memory);
            setAppState(state => {
                const allAgents = state.agentDefinitions.allAgents.concat(normalizedAgent);
                return {
                    ...state,
                    agentDefinitions: {
                        ...state.agentDefinitions,
                        activeAgents: getActiveAgentsFromList(allAgents),
                        allAgents
                    }
                };
            });
            if (openInEditor) {
                const filePath = getNewAgentFilePath({
                    source: normalizedAgent.source,
                    agentType: normalizedAgent.agentType
                });
                await editFileInEditor(filePath);
            }
            logEvent('tengu_agent_created', {
                agent_type: normalizedAgent.agentType,
                generation_method: wizardData.wasGenerated ? 'generated' : 'manual',
                source: normalizedAgent.source,
                tool_count: normalizedAgent.tools?.length ?? 'all',
                has_custom_model: !!normalizedAgent.model,
                has_custom_color: !!normalizedAgent.color,
                has_memory: !!normalizedAgent.memory,
                memory_scope: normalizedAgent.memory ?? 'none',
                ...(openInEditor ? {
                    opened_in_editor: true
                } : {})
            });
            const message = openInEditor ? `Created agent: ${chalk.bold(normalizedAgent.agentType)} and opened in editor. ` + `If you made edits, restart to load the latest version.` : `Created agent: ${chalk.bold(normalizedAgent.agentType)}`;
            onComplete(message);
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save agent');
        }
    }, [wizardData, tools, existingAgents, onComplete, setAppState]);
    const handleSave = useCallback(() => saveAgent(false), [saveAgent]);
    const handleSaveAndEdit = useCallback(() => saveAgent(true), [saveAgent]);
    return _jsx(ConfirmStep, { tools: tools, existingAgents: existingAgents, onSave: handleSave, onSaveAndEdit: handleSaveAndEdit, error: saveError });
}
//# sourceMappingURL=ConfirmStepWrapper.js.map