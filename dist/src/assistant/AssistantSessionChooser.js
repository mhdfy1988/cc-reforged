import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Dialog } from '../components/design-system/Dialog.js';
import { Box, Text } from '../ink.js';
export function AssistantSessionChooser(props) {
    return (_jsx(Dialog, { title: "Assistant \u4F1A\u8BDD\u9009\u62E9\u5668\u6682\u4E0D\u53EF\u7528", subtitle: "\u5F53\u524D\u6062\u590D\u7248\u53EA\u63D0\u4F9B\u663E\u5F0F\u5360\u4F4D\uFF0C\u4E0D\u4F1A\u9759\u9ED8\u8FD4\u56DE\u7A7A\u767D\u3002", onCancel: props.onCancel, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Text, { children: ["\u5F53\u524D\u68C0\u6D4B\u5230 ", props.sessions.length, " \u4E2A\u5019\u9009\u4F1A\u8BDD\uFF0C\u4F46\u9009\u62E9\u5165\u53E3\u5C1A\u672A\u6062\u590D\u3002"] }), props.children] }) }));
}
//# sourceMappingURL=AssistantSessionChooser.js.map