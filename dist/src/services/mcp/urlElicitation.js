import { isFileUrl } from './toolSafety.js';
export function extractUrlElicitationsFromErrorData(errorData) {
    const rawElicitations = errorData != null &&
        typeof errorData === 'object' &&
        'elicitations' in errorData &&
        Array.isArray(errorData.elicitations)
        ? errorData.elicitations
        : [];
    return rawElicitations.filter(isElicitRequestUrlParams);
}
export function findBlockedFileUrlElicitation(elicitations) {
    return elicitations.find(elicitation => isFileUrl(elicitation.url));
}
export function getUrlElicitationNonAcceptContent(params) {
    return `URL elicitation was ${getPastTenseAction(params.action)} by ${params.actor === 'hook' ? 'a hook' : 'the user'}. The tool "${params.tool}" could not complete because it requires the user to open a URL.`;
}
function isElicitRequestUrlParams(value) {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const object = value;
    return (object.mode === 'url' &&
        typeof object.url === 'string' &&
        typeof object.elicitationId === 'string' &&
        typeof object.message === 'string');
}
function getPastTenseAction(action) {
    return action === 'decline' ? 'declined' : `${action}ed`;
}
//# sourceMappingURL=urlElicitation.js.map