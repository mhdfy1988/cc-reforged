import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const policy = await importDist('src/skills/skillActivationPolicy.js')

const baseRecord = {
  schemaVersion: 1,
  name: 'activation-demo',
  scope: 'user',
  installedAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  manifest: {
    schemaVersion: 1,
    name: 'activation-demo',
    source: {
      kind: 'imported-skill',
      path: 'D:/source/activation-demo',
    },
    targetScope: 'user',
    defaults: {
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    },
    trust: {
      thirdParty: false,
      executableContent: false,
      networkDeclared: false,
      secretsDeclared: [],
    },
  },
  packageDir: 'D:/ccr/skills/packages/activation-demo',
  skillFilePath: 'D:/ccr/skills/packages/activation-demo/SKILL.md',
  packageOwnerMarkerPath:
    'D:/ccr/skills/packages/activation-demo/.ccr-skill-package.json',
  enabled: true,
  modelInvocable: true,
  userInvocable: true,
  lockKey: 'user:activation-demo',
}

function inspect(patch) {
  return {
    lockKey: 'user:activation-demo',
    name: 'activation-demo',
    status: patch.status ?? 'installed',
    installedRecord: {
      ...baseRecord,
      ...patch.record,
    },
    package: Object.prototype.hasOwnProperty.call(patch, 'package')
      ? patch.package
      : {},
  }
}

assert.deepEqual(
  pick(policy.evaluateInstalledSkillActivation(inspect({}))),
  {
    runtimeVisible: true,
    modelInvocable: true,
    userInvocable: true,
  },
)

assert.deepEqual(
  pick(
    policy.evaluateInstalledSkillActivation(
      inspect({
        record: {
          modelInvocable: false,
          userInvocable: true,
        },
      }),
    ),
  ),
  {
    runtimeVisible: true,
    modelInvocable: false,
    userInvocable: true,
  },
)

assert.equal(
  policy.evaluateInstalledSkillActivation(
    inspect({
      record: {
        enabled: false,
      },
    }),
  ).runtimeVisible,
  false,
)

assert.equal(
  policy.evaluateInstalledSkillActivation(
    inspect({
      status: 'drifted',
    }),
  ).runtimeVisible,
  false,
)

assert.equal(
  policy.evaluateInstalledSkillActivation(
    inspect({
      package: null,
    }),
  ).runtimeVisible,
  false,
)

function pick(result) {
  return {
    runtimeVisible: result.runtimeVisible,
    modelInvocable: result.modelInvocable,
    userInvocable: result.userInvocable,
  }
}

console.log('smoke-skill-runtime-activation-policy: ok')
