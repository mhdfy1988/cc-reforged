import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Box, Text } from '../../ink.js';
export function UserCrossSessionMessage({ addMargin, param }) {
    return (_jsx(Box, { marginLeft: addMargin ? 2 : 0, children: _jsx(Text, { dimColor: true, children: param.text ?? param.from ?? 'Cross-session message' }) }));
}
//# sourceMappingURL=UserCrossSessionMessage.js.map