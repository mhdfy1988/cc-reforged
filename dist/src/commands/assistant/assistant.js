import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Dialog } from '../../components/design-system/Dialog.js';
import { Box, Text } from '../../ink.js';
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js';
import { join } from 'path';
export async function computeDefaultInstallDir() {
    return join(getClaudeConfigHomeDir(), 'assistant');
}
export function NewInstallWizard(props) {
    return (_jsx(Dialog, { title: "Assistant \u5B89\u88C5\u5411\u5BFC\u6682\u4E0D\u53EF\u7528", subtitle: "\u5F53\u524D\u6062\u590D\u7248\u53EA\u63D0\u4F9B\u663E\u5F0F\u5360\u4F4D\uFF0C\u4E0D\u4F1A\u9759\u9ED8\u5B8C\u6210\u5B89\u88C5\u3002", onCancel: props.onCancel, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Text, { children: ["\u9ED8\u8BA4\u5B89\u88C5\u76EE\u5F55\uFF1A", props.defaultDir] }), _jsx(Text, { dimColor: true, children: "\u8BE5\u5165\u53E3\u5C1A\u672A\u6062\u590D\u4E3A\u5B8C\u6574\u5B89\u88C5\u6D41\u7A0B\u3002" }), props.children] }) }));
}
//# sourceMappingURL=assistant.js.map