import { useCallback, useRef, useState } from 'react';
import { logEvent, } from '../services/analytics/index.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { applySkillImprovement } from '../utils/hooks/skillImprovement.js';
import { createSystemMessage } from '../utils/messages.js';
function isObjectRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isSkillUpdate(value) {
    return (isObjectRecord(value) &&
        typeof value.section === 'string' &&
        typeof value.change === 'string' &&
        typeof value.reason === 'string');
}
function isSkillImprovementSuggestion(value) {
    return (isObjectRecord(value) &&
        typeof value.skillName === 'string' &&
        Array.isArray(value.updates) &&
        value.updates.every(isSkillUpdate));
}
export function useSkillImprovementSurvey(setMessages) {
    const rawSuggestion = useAppState(s => s.skillImprovement.suggestion);
    const suggestion = isSkillImprovementSuggestion(rawSuggestion)
        ? rawSuggestion
        : null;
    const setAppState = useSetAppState();
    const [isOpen, setIsOpen] = useState(false);
    const lastSuggestionRef = useRef(null);
    const loggedAppearanceRef = useRef(false);
    // Track the suggestion for display even after clearing AppState
    if (suggestion) {
        lastSuggestionRef.current = suggestion;
    }
    // Open when a new suggestion arrives
    if (suggestion && !isOpen) {
        setIsOpen(true);
        if (!loggedAppearanceRef.current) {
            loggedAppearanceRef.current = true;
            logEvent('tengu_skill_improvement_survey', {
                event_type: 'appeared',
                // _PROTO_skill_name routes to the privileged skill_name BQ column.
                // Unredacted names don't go in additional_metadata.
                _PROTO_skill_name: (suggestion.skillName ??
                    'unknown'),
            });
        }
    }
    const handleSelect = useCallback((selected) => {
        const current = lastSuggestionRef.current;
        if (!current)
            return;
        const applied = selected !== 'dismissed';
        logEvent('tengu_skill_improvement_survey', {
            event_type: 'responded',
            response: (applied
                ? 'applied'
                : 'dismissed'),
            // _PROTO_skill_name routes to the privileged skill_name BQ column.
            // Unredacted names don't go in additional_metadata.
            _PROTO_skill_name: current.skillName,
        });
        if (applied) {
            void applySkillImprovement(current.skillName, current.updates).then(() => {
                setMessages(prev => [
                    ...prev,
                    createSystemMessage(`Skill "${current.skillName}" updated with improvements.`, 'suggestion'),
                ]);
            });
        }
        // Close and clear
        setIsOpen(false);
        loggedAppearanceRef.current = false;
        setAppState(prev => {
            if (!prev.skillImprovement.suggestion)
                return prev;
            return {
                ...prev,
                skillImprovement: { suggestion: null },
            };
        });
    }, [setAppState, setMessages]);
    return {
        isOpen,
        suggestion: lastSuggestionRef.current,
        handleSelect,
    };
}
//# sourceMappingURL=useSkillImprovementSurvey.js.map