import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { readFileSync } from 'fs';
import React from 'react';
import { fileURLToPath } from 'url';
import Box from './Box.js';
import Text from './Text.js';
/* eslint-disable custom-rules/no-process-cwd -- stack trace file:// paths are relative to the real OS cwd, not the virtual cwd */
// Error's source file is reported as file:///home/user/file.js
// This function removes the file://[cwd] part
const cleanupPath = (path) => {
    if (!path) {
        return undefined;
    }
    const normalizedPath = path.replace(/\\/g, '/');
    const normalizedCwd = process.cwd().replace(/\\/g, '/');
    const cwdPrefix = normalizedCwd.endsWith('/') ? normalizedCwd : `${normalizedCwd}/`;
    return normalizedPath.startsWith(cwdPrefix) ? normalizedPath.slice(cwdPrefix.length) : path;
};
function normalizeStackFilePath(rawPath) {
    if (rawPath.startsWith('file://')) {
        try {
            return fileURLToPath(rawPath);
        }
        catch {
            return rawPath;
        }
    }
    return rawPath;
}
function parseStackLine(line) {
    const match = /^\s*at\s+(?:(.+?)\s+\()?(.*?):(\d+):(\d+)\)?$/.exec(line);
    if (!match) {
        return undefined;
    }
    const [, rawFunctionName, rawFile, rawLine, rawColumn] = match;
    const parsedLine = Number(rawLine);
    const parsedColumn = Number(rawColumn);
    if (!Number.isFinite(parsedLine) || !Number.isFinite(parsedColumn)) {
        return undefined;
    }
    return {
        file: normalizeStackFilePath(rawFile),
        line: parsedLine,
        column: parsedColumn,
        function: rawFunctionName?.trim() || '<anonymous>'
    };
}
function createCodeExcerpt(sourceCode, targetLine, contextLines = 2) {
    if (!Number.isInteger(targetLine) || targetLine < 1) {
        return undefined;
    }
    const lines = sourceCode.split(/\r?\n/);
    if (targetLine > lines.length) {
        return undefined;
    }
    const start = Math.max(1, targetLine - contextLines);
    const end = Math.min(lines.length, targetLine + contextLines);
    const excerpt = [];
    for (let line = start; line <= end; line++) {
        excerpt.push({
            line,
            value: lines[line - 1] ?? ''
        });
    }
    return excerpt.length > 0 ? excerpt : undefined;
}
export default function ErrorOverview({ error }) {
    const stack = error.stack ? error.stack.split('\n').slice(1) : undefined;
    const origin = stack ? parseStackLine(stack[0]) : undefined;
    const filePath = cleanupPath(origin?.file);
    let excerpt;
    let lineWidth = 0;
    if (filePath && origin?.line) {
        try {
            // eslint-disable-next-line custom-rules/no-sync-fs -- sync render path; error overlay can't go async without suspense restructuring
            const sourceCode = readFileSync(filePath, 'utf8');
            excerpt = createCodeExcerpt(sourceCode, origin.line);
            if (excerpt) {
                for (const { line } of excerpt) {
                    lineWidth = Math.max(lineWidth, String(line).length);
                }
            }
        }
        catch {
            // file not readable — skip source context
        }
    }
    return _jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { children: [_jsxs(Text, { backgroundColor: "ansi:red", color: "ansi:white", children: [' ', "ERROR", ' '] }), _jsxs(Text, { children: [" ", error.message] })] }), origin && filePath && _jsx(Box, { marginTop: 1, children: _jsxs(Text, { dim: true, children: [filePath, ":", origin.line, ":", origin.column] }) }), origin && excerpt && _jsx(Box, { marginTop: 1, flexDirection: "column", children: excerpt.map(({ line: line_0, value }) => _jsxs(Box, { children: [_jsx(Box, { width: lineWidth + 1, children: _jsxs(Text, { dim: line_0 !== origin.line, backgroundColor: line_0 === origin.line ? 'ansi:red' : undefined, color: line_0 === origin.line ? 'ansi:white' : undefined, children: [String(line_0).padStart(lineWidth, ' '), ":"] }) }), _jsx(Text, { backgroundColor: line_0 === origin.line ? 'ansi:red' : undefined, color: line_0 === origin.line ? 'ansi:white' : undefined, children: ' ' + value }, line_0)] }, line_0)) }), error.stack && _jsx(Box, { marginTop: 1, flexDirection: "column", children: error.stack.split('\n').slice(1).map(line_1 => {
                    const parsedLine = parseStackLine(line_1);
                    // If the line from the stack cannot be parsed, we print out the unparsed line.
                    if (!parsedLine) {
                        return _jsxs(Box, { children: [_jsx(Text, { dim: true, children: "- " }), _jsx(Text, { bold: true, children: line_1 })] }, line_1);
                    }
                    return _jsxs(Box, { children: [_jsx(Text, { dim: true, children: "- " }), _jsx(Text, { bold: true, children: parsedLine.function }), _jsxs(Text, { dim: true, children: [' ', "(", cleanupPath(parsedLine.file) ?? '', ":", parsedLine.line, ":", parsedLine.column, ")"] })] }, line_1);
                }) })] });
}
//# sourceMappingURL=ErrorOverview.js.map