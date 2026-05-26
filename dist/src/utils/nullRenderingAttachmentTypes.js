export const NULL_RENDERING_ATTACHMENT_TYPES = [
    'hook_success',
    'hook_additional_context',
    'hook_cancelled',
    'command_permissions',
    'agent_mention',
    'budget_usd',
    'critical_system_reminder',
    'edited_image_file',
    'edited_text_file',
    'opened_file_in_ide',
    'output_style',
    'plan_mode',
    'plan_mode_exit',
    'plan_mode_reentry',
    'structured_output',
    'team_context',
    'todo_reminder',
    'context_efficiency',
    'deferred_tools_delta',
    'mcp_instructions_delta',
    'companion_intro',
    'token_usage',
    'ultrathink_effort',
    'max_turns_reached',
    'task_reminder',
    'auto_mode',
    'auto_mode_exit',
    'output_token_usage',
    'verify_plan_reminder',
    'current_session_memory',
    'compaction_reminder',
    'date_change',
];
const NULL_RENDERING_ATTACHMENT_TYPE_SET = new Set(NULL_RENDERING_ATTACHMENT_TYPES);
export function isNullRenderingAttachmentType(type) {
    return (typeof type === 'string' && NULL_RENDERING_ATTACHMENT_TYPE_SET.has(type));
}
export function isNullRenderingAttachmentValue(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const attachment = value;
    const nestedFile = attachment.file && typeof attachment.file === 'object'
        ? attachment.file
        : undefined;
    return [
        attachment.type,
        attachment.name,
        attachment.displayName,
        attachment.display_name,
        attachment.fileName,
        attachment.filename,
        attachment.displayPath,
        attachment.path,
        nestedFile?.type,
        nestedFile?.name,
        nestedFile?.fileName,
        nestedFile?.filename,
        nestedFile?.path,
    ].some(isNullRenderingAttachmentType);
}
//# sourceMappingURL=nullRenderingAttachmentTypes.js.map