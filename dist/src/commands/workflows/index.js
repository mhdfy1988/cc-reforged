const workflows = {
    type: 'local-jsx',
    name: 'workflows',
    description: 'Workflow scripts (placeholder bridge)',
    aliases: ['workflow'],
    isEnabled: () => false,
    load: async () => ({
        call: async () => null,
    }),
};
export default workflows;
//# sourceMappingURL=index.js.map