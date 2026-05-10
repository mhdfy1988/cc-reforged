#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'

const root = process.cwd()
const workflowPath = join(root, '.github', 'workflows', 'desktop-release.yml')

if (!existsSync(workflowPath)) {
  fail('desktop release workflow is missing', { workflowPath })
}

const workflowText = readFileSync(workflowPath, 'utf8')
const workflow = YAML.parse(workflowText)
const workflowOn = workflow.on ?? workflow['on']
const dispatch = workflowOn?.workflow_dispatch
const releaseJob = workflow.jobs?.['desktop-release']
const steps = Array.isArray(releaseJob?.steps) ? releaseJob.steps : []
const stepNames = steps.map((step) => step?.name).filter(Boolean)
const runCommands = steps.map((step) => step?.run).filter(Boolean).join('\n')
const usesValues = steps.map((step) => step?.uses).filter(Boolean)

if (!dispatch?.inputs?.tag?.required) {
  fail('workflow_dispatch tag input is required for release reproducibility')
}

for (const inputName of ['draft', 'signed', 'require_signed']) {
  if (dispatch.inputs?.[inputName]?.type !== 'boolean') {
    fail('workflow input must be a boolean', {
      inputName,
      actual: dispatch.inputs?.[inputName],
    })
  }
}

if (workflow.permissions?.contents !== 'write') {
  fail('desktop release workflow must grant contents: write for GitHub Release creation', {
    permissions: workflow.permissions,
  })
}

if (releaseJob?.['runs-on'] !== 'windows-latest') {
  fail('desktop release workflow must run on windows-latest', {
    runsOn: releaseJob?.['runs-on'],
  })
}

assertStepUses(usesValues, 'actions/checkout@v4')
assertStepUses(usesValues, 'actions/setup-node@v4')
assertText(workflowText, "node-version: '24'", 'workflow must use Node 24')
assertText(workflowText, 'fetch-depth: 0', 'workflow must fetch tags')
assertText(workflowText, 'contents: write', 'workflow must be able to write releases')
assertText(workflowText, 'GH_TOKEN: ${{ github.token }}', 'workflow must provide GH_TOKEN to gh')
assertText(workflowText, 'CCR_DESKTOP_RELEASE_TAG: ${{ inputs.tag }}', 'workflow must pass the selected tag to the release script')
assertText(workflowText, 'CCR_DESKTOP_UPDATE_RELEASE_TAG: ${{ inputs.tag }}', 'workflow must pass the selected tag to the update feed smoke')
assertText(workflowText, 'if: ${{ !inputs.draft }}', 'workflow must only validate the public update feed for public releases')
assertText(workflowText, 'secrets.WIN_CSC_LINK', 'workflow must support Windows signing secrets')
assertText(workflowText, 'secrets.WIN_CSC_KEY_PASSWORD', 'workflow must support Windows signing password secret')

for (const expectedCommand of [
  'npm.cmd install',
  'npm.cmd run ci:smoke',
  'npm.cmd run desktop:dist',
  'npm.cmd run desktop:dist:signed',
  'npm.cmd run smoke:desktop-release-artifacts',
  'npm.cmd run smoke:desktop-signing-readiness',
  'npm.cmd run release:desktop:check',
  'node ./scripts/prepare-desktop-github-release.mjs @releaseArgs',
  'npm.cmd run smoke:desktop-auto-update-feed',
]) {
  assertText(runCommands, expectedCommand, 'workflow is missing an expected command')
}

for (const expectedStep of [
  'Checkout tag',
  'Setup Node',
  'Install dependencies',
  'Run core smoke gate',
  'Build unsigned Desktop installer',
  'Build signed Desktop installer',
  'Verify Desktop release artifacts',
  'Verify Desktop signing readiness',
  'Prepare Desktop release summary',
  'Create GitHub Release',
  'Verify public auto-update feed',
]) {
  if (!stepNames.includes(expectedStep)) {
    fail('workflow is missing an expected step', { expectedStep, stepNames })
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      workflow: '.github/workflows/desktop-release.yml',
      checked: [
        'workflow_dispatch',
        'required_tag_input',
        'draft_signed_inputs',
        'contents_write_permission',
        'windows_runner',
        'node_24',
        'tag_checkout',
        'unsigned_build',
        'signed_build',
        'artifact_smoke',
        'signing_smoke',
        'release_script',
        'public_update_feed_smoke',
        'GH_TOKEN',
      ],
    },
    null,
    2,
  ),
)

function assertStepUses(usesValues, expectedUses) {
  if (!usesValues.includes(expectedUses)) {
    fail('workflow is missing an expected action', { expectedUses, usesValues })
  }
}

function assertText(text, expected, message) {
  if (!text.includes(expected)) {
    fail(message, { expected })
  }
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
