export function isSkillSearchFeatureEnabled(): boolean {
  return process.env.USER_TYPE === 'ant'
}
