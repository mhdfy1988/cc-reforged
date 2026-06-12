import { spawnSync } from 'node:child_process'

const groups = {
  mcp: [
    'smoke:mcp-end-to-end',
    'smoke:mcp-manifest-builder',
    'smoke:mcp-manifest-import',
    'smoke:mcp-install-candidates',
    'smoke:mcp-cli-install',
    'smoke:mcp-adopt',
    'smoke:mcp-transport-factory',
    'smoke:mcp-remote-transport-options',
    'smoke:mcp-tool-runtime',
    'smoke:mcp-result-processing',
    'smoke:mcp-install-presets',
    'smoke:mcp-skill-resource-adapter',
    'smoke:capability-management-projection',
    'smoke:capability-management-actions',
    'smoke:capability-runtime-environment',
    'smoke:capability-identity-relations',
    'smoke:app-capability-registry-lifecycle',
    'smoke:extension-capability-management-e2e',
    'smoke:external-extension-matrix',
  ],
  skill: [
    'smoke:skill-end-to-end',
    'smoke:skill-import',
    'smoke:skill-import-local-archive',
    'smoke:skill-install-builtin-preset',
    'smoke:skill-install-candidates',
    'smoke:skill-install-apply',
    'smoke:skill-install-reliability',
    'smoke:skill-install-inspector',
    'smoke:skill-package-tree-integrity',
    'smoke:skill-management-api',
    'smoke:skill-management-service',
    'smoke:skill-capability-catalog',
    'smoke:capability-catalog-skill-provider',
    'smoke:skill-runtime-installed-loader',
    'smoke:skill-runtime-installed-metadata',
    'smoke:skill-runtime-catalog',
    'smoke:skill-runtime-dynamic-catalog',
    'smoke:skill-runtime-catalog-unified',
    'smoke:skill-static-listing-filter',
    'smoke:skill-listing-runtime-catalog-alignment',
    'smoke:skill-command-adapter-boundaries',
    'smoke:skill-discovery-index',
    'smoke:skill-turn-zero-discovery',
    'smoke:skill-inter-turn-discovery',
    'smoke:skill-discover-tool',
    'smoke:skill-search-feature-gate',
    'smoke:skill-runtime-tool-context',
    'smoke:skill-request-context-e2e',
    'smoke:skill-visibility-ledger',
    'smoke:skill-runtime-slash-command',
    'smoke:skill-cli-search',
    'smoke:skill-cli-import-install',
    'smoke:skill-cli-status-repair-uninstall',
    'smoke:skill-security-scanner',
    'smoke:skill-security-install-plan',
    'smoke:skill-security-apply-inspect',
    'smoke:skill-mcp-negative-boundaries',
    'smoke:mcp-skill-resource-adapter',
    'smoke:extension-runtime-visibility',
    'smoke:app-server-tool-pool-capability-alignment',
    'smoke:capability-catalog-plugin-relations',
    'smoke:capability-management-projection',
    'smoke:capability-management-actions',
    'smoke:capability-management-confirmation-token',
    'smoke:capability-management-mcp-runtime',
    'smoke:capability-runtime-environment',
    'smoke:capability-identity-relations',
    'smoke:app-capability-registry-lifecycle',
    'smoke:extension-capability-management-e2e',
    'smoke:external-extension-matrix',
  ],
  'skill-internal': [
    'smoke:skill-management-service',
    'smoke:skill-management-api',
    'smoke:skill-install-reliability',
    'smoke:skill-package-tree-integrity',
    'smoke:skill-installed-package-inspection',
    'smoke:skill-capability-catalog',
    'smoke:capability-catalog-skill-provider',
    'smoke:skill-runtime-installed-loader',
    'smoke:skill-static-listing-filter',
    'smoke:skill-listing-runtime-catalog-alignment',
    'smoke:skill-command-adapter-boundaries',
    'smoke:skill-discovery-index',
    'smoke:skill-turn-zero-discovery',
    'smoke:skill-inter-turn-discovery',
    'smoke:skill-discover-tool',
    'smoke:skill-search-feature-gate',
    'smoke:skill-runtime-tool-context',
    'smoke:skill-request-context-e2e',
    'smoke:skill-visibility-ledger',
    'smoke:skill-runtime-slash-command',
    'smoke:mcp-skill-resource-adapter',
    'smoke:extension-runtime-visibility',
    'smoke:app-server-tool-pool-capability-alignment',
    'smoke:capability-catalog-plugin-relations',
    'smoke:capability-management-projection',
    'smoke:capability-management-actions',
    'smoke:capability-management-confirmation-token',
    'smoke:capability-management-mcp-runtime',
    'smoke:capability-runtime-environment',
    'smoke:capability-identity-relations',
    'smoke:app-capability-registry-lifecycle',
    'smoke:extension-capability-management-e2e',
    'smoke:external-extension-matrix',
  ],
  plugin: [
    'typecheck',
    'typecheck:desktop',
    'build',
    'desktop:build',
    'smoke:plugin-productization-matrix',
  ],
  desktop: [
    'typecheck:desktop',
    'fixtures:desktop-management-acceptance',
    'smoke:desktop-branding',
    'smoke:desktop-display-events',
    'smoke:desktop-session-state',
    'smoke:desktop-shell-cards',
    'smoke:mcp-end-to-end',
    'smoke:skill-end-to-end',
    'smoke:skill-mcp-negative-boundaries',
    'smoke:capability-management-projection',
    'smoke:desktop-skill-management-projection',
    'smoke:capability-runtime-environment',
    'smoke:capability-identity-relations',
    'smoke:app-capability-registry-lifecycle',
    'smoke:extension-capability-management-e2e',
  ],
}

const groupName = process.argv[2]
if (!groupName || !groups[groupName]) {
  console.error(
    `Usage: node ./scripts/run-release-smoke-group.mjs <${Object.keys(groups).join('|')}>`,
  )
  process.exitCode = 1
} else {
  runGroup(groupName, groups[groupName])
}

function runGroup(groupName, scripts) {
  console.log(
    `[release-smoke] group=${groupName} steps=${scripts.length}`,
  )

  for (const script of scripts) {
    console.log(`[release-smoke] start group=${groupName} step=${script}`)
    const command =
      process.platform === 'win32' ? 'cmd.exe' : 'npm'
    const args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', `npm.cmd run ${script}`]
        : ['run', script]
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })

    if (result.error) {
      console.error(
        `[release-smoke] failed group=${groupName} step=${script} error=${result.error.message}`,
      )
      process.exitCode = 1
      return
    }

    if (result.status !== 0) {
      console.error(
        `[release-smoke] failed group=${groupName} step=${script} exit=${result.status}`,
      )
      process.exitCode = result.status ?? 1
      return
    }

    console.log(`[release-smoke] ok group=${groupName} step=${script}`)
  }

  console.log(`[release-smoke] ok group=${groupName}`)
}
