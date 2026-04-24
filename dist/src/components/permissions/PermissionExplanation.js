import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { c as _c } from "react/compiler-runtime";
import React, { Suspense, use, useState } from 'react';
import { Box, Text } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { logEvent } from '../../services/analytics/index.js';
import { generatePermissionExplanation, isPermissionExplainerEnabled } from '../../utils/permissions/permissionExplainer.js';
import { ShimmerChar } from '../Spinner/ShimmerChar.js';
import { useShimmerAnimation } from '../Spinner/useShimmerAnimation.js';
const LOADING_MESSAGE = 'Loading explanation…';
function ShimmerLoadingText() {
    const $ = _c(7);
    const [ref, glimmerIndex] = useShimmerAnimation("responding", LOADING_MESSAGE, false);
    let t0;
    if ($[0] !== glimmerIndex) {
        t0 = LOADING_MESSAGE.split("").map((char, index) => _jsx(ShimmerChar, { char: char, index: index, glimmerIndex: glimmerIndex, messageColor: "inactive", shimmerColor: "text" }, index));
        $[0] = glimmerIndex;
        $[1] = t0;
    }
    else {
        t0 = $[1];
    }
    let t1;
    if ($[2] !== t0) {
        t1 = _jsx(Text, { children: t0 });
        $[2] = t0;
        $[3] = t1;
    }
    else {
        t1 = $[3];
    }
    let t2;
    if ($[4] !== ref || $[5] !== t1) {
        t2 = _jsx(Box, { ref: ref, children: t1 });
        $[4] = ref;
        $[5] = t1;
        $[6] = t2;
    }
    else {
        t2 = $[6];
    }
    return t2;
}
function getRiskColor(riskLevel) {
    switch (riskLevel) {
        case 'LOW':
            return 'success';
        case 'MEDIUM':
            return 'warning';
        case 'HIGH':
            return 'error';
    }
}
function getRiskLabel(riskLevel) {
    switch (riskLevel) {
        case 'LOW':
            return 'Low risk';
        case 'MEDIUM':
            return 'Med risk';
        case 'HIGH':
            return 'High risk';
    }
}
function isObjectRecord(value) {
    return typeof value === 'object' && value !== null;
}
/**
 * Creates an explanation promise that never rejects.
 * Errors are caught and returned as null.
 */
function createExplanationPromise(props) {
    return generatePermissionExplanation({
        toolName: props.toolName,
        toolInput: props.toolInput,
        toolDescription: props.toolDescription,
        messages: props.messages,
        signal: new AbortController().signal // Won't abort - request is fast enough
    }).catch(() => null);
}
function isRiskLevel(value) {
    return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH';
}
function isPermissionExplanation(value) {
    return (isObjectRecord(value) &&
        isRiskLevel(value.riskLevel) &&
        typeof value.explanation === 'string' &&
        typeof value.reasoning === 'string' &&
        typeof value.risk === 'string');
}
function toPermissionExplanationDisplayState(value) {
    if (isPermissionExplanation(value)) {
        return {
            kind: 'valid',
            value,
        };
    }
    if (value === null || value === undefined) {
        return {
            kind: 'unavailable',
        };
    }
    if (isObjectRecord(value)) {
        return {
            kind: 'malformed',
        };
    }
    return {
        kind: 'unavailable',
    };
}
/**
 * Hook that manages the permission explainer state.
 * Creates the fetch promise lazily (only when user hits Ctrl+E)
 * to avoid consuming tokens for explanations users never view.
 */
export function usePermissionExplainerUI(props) {
    const $ = _c(9);
    let t0;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
        t0 = isPermissionExplainerEnabled();
        $[0] = t0;
    }
    else {
        t0 = $[0];
    }
    const enabled = t0;
    const [visible, setVisible] = useState(false);
    const [promise, setPromise] = useState(null);
    let t1;
    if ($[1] !== promise || $[2] !== props || $[3] !== visible) {
        t1 = () => {
            if (!visible) {
                logEvent("tengu_permission_explainer_shortcut_used", {});
                if (!promise) {
                    setPromise(createExplanationPromise(props));
                }
            }
            setVisible(_temp);
        };
        $[1] = promise;
        $[2] = props;
        $[3] = visible;
        $[4] = t1;
    }
    else {
        t1 = $[4];
    }
    let t2;
    if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
        t2 = {
            context: "Confirmation",
            isActive: enabled
        };
        $[5] = t2;
    }
    else {
        t2 = $[5];
    }
    useKeybinding("confirm:toggleExplanation", t1, t2);
    let t3;
    if ($[6] !== promise || $[7] !== visible) {
        t3 = {
            visible,
            enabled,
            promise
        };
        $[6] = promise;
        $[7] = visible;
        $[8] = t3;
    }
    else {
        t3 = $[8];
    }
    return t3;
}
/**
 * Inner component that uses React 19's use() to read the promise.
 * Suspends while loading, returns null on error.
 */
function _temp(v) {
    return !v;
}
function ExplanationResult(t0) {
    const $ = _c(21);
    const { promise } = t0;
    const explanationResult = use(promise);
    const explanationState = toPermissionExplanationDisplayState(explanationResult);
    if (explanationState.kind === 'unavailable') {
        let t1;
        if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
            t1 = _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Explanation unavailable" }) });
            $[0] = t1;
        }
        else {
            t1 = $[0];
        }
        return t1;
    }
    if (explanationState.kind === 'malformed') {
        let t1;
        if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
            t1 = _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Explanation malformed" }) });
            $[1] = t1;
        }
        else {
            t1 = $[1];
        }
        return t1;
    }
    const explanation = explanationState.value;
    let t1;
    if ($[2] !== explanation.explanation) {
        t1 = _jsx(Text, { children: explanation.explanation });
        $[2] = explanation.explanation;
        $[3] = t1;
    }
    else {
        t1 = $[3];
    }
    let t2;
    if ($[4] !== explanation.reasoning) {
        t2 = _jsx(Box, { marginTop: 1, children: _jsx(Text, { children: explanation.reasoning }) });
        $[4] = explanation.reasoning;
        $[5] = t2;
    }
    else {
        t2 = $[5];
    }
    let t3;
    if ($[6] !== explanation.riskLevel) {
        t3 = getRiskColor(explanation.riskLevel);
        $[6] = explanation.riskLevel;
        $[7] = t3;
    }
    else {
        t3 = $[7];
    }
    let t4;
    if ($[8] !== explanation.riskLevel) {
        t4 = getRiskLabel(explanation.riskLevel);
        $[8] = explanation.riskLevel;
        $[9] = t4;
    }
    else {
        t4 = $[9];
    }
    let t5;
    if ($[10] !== t3 || $[11] !== t4) {
        t5 = _jsxs(Text, { color: t3, children: [t4, ":"] });
        $[10] = t3;
        $[11] = t4;
        $[12] = t5;
    }
    else {
        t5 = $[12];
    }
    let t6;
    if ($[13] !== explanation.risk) {
        t6 = _jsxs(Text, { children: [" ", explanation.risk] });
        $[13] = explanation.risk;
        $[14] = t6;
    }
    else {
        t6 = $[14];
    }
    let t7;
    if ($[15] !== t5 || $[16] !== t6) {
        t7 = _jsx(Box, { marginTop: 1, children: _jsxs(Text, { children: [t5, t6] }) });
        $[15] = t5;
        $[16] = t6;
        $[17] = t7;
    }
    else {
        t7 = $[17];
    }
    let t8;
    if ($[18] !== t1 || $[19] !== t2 || $[20] !== t7) {
        t8 = _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [t1, t2, t7] });
        $[18] = t1;
        $[19] = t2;
        $[20] = t7;
        $[21] = t8;
    }
    else {
        t8 = $[21];
    }
    return t8;
}
/**
 * Content component - shows loading (via Suspense) or explanation when visible
 */
export function PermissionExplainerContent(t0) {
    const $ = _c(3);
    const { visible, promise } = t0;
    if (!visible || !promise) {
        return null;
    }
    let t1;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
        t1 = _jsx(Box, { marginTop: 1, children: _jsx(ShimmerLoadingText, {}) });
        $[0] = t1;
    }
    else {
        t1 = $[0];
    }
    let t2;
    if ($[1] !== promise) {
        t2 = _jsx(Suspense, { fallback: t1, children: _jsx(ExplanationResult, { promise: promise }) });
        $[1] = promise;
        $[2] = t2;
    }
    else {
        t2 = $[2];
    }
    return t2;
}
//# sourceMappingURL=PermissionExplanation.js.map