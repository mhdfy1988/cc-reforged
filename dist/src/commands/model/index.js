import { getLlmRuntimeDisplayStatus } from '../../services/llm/runtimeStatus.js';
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js';
import { getMainLoopModel, renderModelName } from '../../utils/model/model.js';
export default {
    type: 'local-jsx',
    name: 'model',
    get description() {
        const llmStatus = getLlmRuntimeDisplayStatus();
        if (llmStatus.providerId === 'anthropic') {
            return `Set the AI model for CCR (currently ${renderModelName(getMainLoopModel())})`;
        }
        return `Inspect or set the configured model for ${llmStatus.providerDisplayName} (currently ${llmStatus.model})`;
    },
    argumentHint: '[model]',
    get immediate() {
        return shouldInferenceConfigCommandBeImmediate();
    },
    load: () => import('./model.js'),
};
//# sourceMappingURL=index.js.map