import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = await mkdtemp(join(tmpdir(), 'ccr-desktop-management-fixtures-'))
const skillDir = join(root, 'skill-local')
const commandDir = join(root, '.claude', 'commands')
const manifestDir = join(root, 'manifests')

await mkdir(join(skillDir, 'references'), { recursive: true })
await mkdir(commandDir, { recursive: true })
await mkdir(manifestDir, { recursive: true })

await writeFile(
  join(skillDir, 'SKILL.md'),
  `---\nname: desktop_acceptance_skill\ndescription: Desktop acceptance local Skill.\nversion: 1.0.0\nuser-invocable: true\ndisable-model-invocation: false\npaths: references/**/*.md\n---\n\nUse this Skill only for Desktop management acceptance.\n`,
  'utf8',
)
await writeFile(
  join(skillDir, 'references', 'guide.md'),
  'Desktop management acceptance reference.\n',
  'utf8',
)

const commandFile = join(commandDir, 'desktop-acceptance-command.md')
await writeFile(
  commandFile,
  `---\ndescription: Desktop acceptance command.\nargument-hint: [topic]\n---\n\nCheck Desktop acceptance status for $ARGUMENTS.\n`,
  'utf8',
)

const mcpLocalHttpManifest = join(manifestDir, 'mcp-local-http.json')
await writeFile(
  mcpLocalHttpManifest,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      name: 'desktop_acceptance_http_mcp',
      displayName: 'Desktop Acceptance HTTP MCP',
      description: 'Desktop acceptance local HTTP MCP manifest.',
      source: {
        kind: 'remote-url',
        url: 'http://127.0.0.1:3217/mcp',
        headersRequired: false,
      },
      transport: 'http',
      serverConfig: {
        type: 'http',
        url: 'http://127.0.0.1:3217/mcp',
      },
      permissions: [
        {
          kind: 'network',
          required: true,
        },
      ],
      dataBoundary: 'local-only',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

const mcpLocalStdioManifest = join(manifestDir, 'mcp-local-stdio.json')
await writeFile(
  mcpLocalStdioManifest,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      name: 'desktop_acceptance_stdio_mcp',
      displayName: 'Desktop Acceptance stdio MCP',
      description: 'Desktop acceptance local stdio MCP manifest.',
      source: {
        kind: 'local-directory',
        path: root,
      },
      transport: 'stdio',
      entry: {
        command: process.execPath,
        args: ['--version'],
        cwd: root,
      },
      serverConfig: {
        type: 'stdio',
        command: process.execPath,
        args: ['--version'],
        cwd: root,
      },
      permissions: [
        {
          kind: 'filesystem',
          required: false,
        },
      ],
      dataBoundary: 'local-only',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

const skillInstallManifest = join(manifestDir, 'skill-install-manifest.json')
await writeFile(
  skillInstallManifest,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      name: 'desktop_acceptance_skill_manifest',
      displayName: 'Desktop Acceptance Skill Manifest',
      description: 'Desktop acceptance Skill install manifest.',
      version: '1.0.0',
      source: {
        kind: 'imported-skill',
        path: skillDir,
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
      compatibility: {
        vendor: 'agent-skills',
        convertedFromCommand: false,
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log('Desktop management acceptance fixtures:')
console.log(`root=${root}`)
console.log(`skillDir=${skillDir}`)
console.log(`claudeCommand=${commandFile}`)
console.log(`mcpLocalHttpManifest=${mcpLocalHttpManifest}`)
console.log(`mcpLocalStdioManifest=${mcpLocalStdioManifest}`)
console.log(`skillInstallManifest=${skillInstallManifest}`)
