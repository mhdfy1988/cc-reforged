const fork = {
    type: 'local-jsx',
    name: 'fork',
    description: 'Fork sub-agent commands (placeholder bridge)',
    isEnabled: () => false,
    load: async () => ({
        call: async () => null,
    }),
};
export default fork;
//# sourceMappingURL=index.js.map