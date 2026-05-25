export const TOOL_TIMING_METADATA_KEYS = [
    'durationMs',
    'duration_ms',
    'elapsedTimeMs',
    'elapsed_ms',
    'startedAt',
    'started_at',
    'startTime',
    'start_time',
    'completedAt',
    'completed_at',
    'endedAt',
    'ended_at',
    'endTime',
    'end_time',
];
export function stripToolTimingMetadataFromContentBlock(block) {
    if (block.type !== 'tool_result' && block.type !== 'tool_use') {
        return block;
    }
    let changed = false;
    const sanitized = { ...block };
    for (const key of TOOL_TIMING_METADATA_KEYS) {
        if (key in sanitized) {
            delete sanitized[key];
            changed = true;
        }
    }
    return changed ? sanitized : block;
}
//# sourceMappingURL=toolTimingMetadata.js.map