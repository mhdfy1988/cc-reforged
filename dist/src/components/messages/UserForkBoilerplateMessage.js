import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Box, Text } from '../../ink.js';
export function UserForkBoilerplateMessage({ addMargin, param }) {
    return (_jsx(Box, { marginLeft: addMargin ? 2 : 0, children: _jsx(Text, { dimColor: true, children: param.text ?? param.from ?? 'Fork boilerplate message' }) }));
}
//# sourceMappingURL=UserForkBoilerplateMessage.js.map