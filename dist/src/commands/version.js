const call = async () => {
    return {
        type: 'text',
        value: MACRO.BUILD_TIME
            ? `CCR v${MACRO.VERSION} (built ${MACRO.BUILD_TIME})`
            : `CCR v${MACRO.VERSION}`,
    };
};
const version = {
    type: 'local',
    name: 'version',
    description: 'Print the version this session is running (not what autoupdate downloaded)',
    isEnabled: () => process.env.USER_TYPE === 'ant',
    supportsNonInteractive: true,
    load: () => Promise.resolve({ call }),
};
export default version;
//# sourceMappingURL=version.js.map