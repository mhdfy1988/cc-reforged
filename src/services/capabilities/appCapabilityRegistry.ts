import type { AppConnectorCapabilityInput } from './appCapabilityProvider.js'

export type AppCapabilityRegistrationMode = 'replace' | 'upsert'

export type AppCapabilityRegistrySnapshot = {
  schemaVersion: 1
  revision: number
  apps: AppConnectorCapabilityInput[]
}

export class AppCapabilityRegistry {
  private revision = 0
  private readonly appsById = new Map<string, AppConnectorCapabilityInput>()

  register(input: {
    apps: readonly AppConnectorCapabilityInput[]
    mode?: AppCapabilityRegistrationMode
  }): AppCapabilityRegistrySnapshot {
    return input.mode === 'upsert'
      ? this.upsert(input.apps)
      : this.replace(input.apps)
  }

  replace(
    apps: readonly AppConnectorCapabilityInput[],
  ): AppCapabilityRegistrySnapshot {
    const nextApps = createUniqueAppMap(apps)
    this.appsById.clear()
    for (const [appId, app] of nextApps) {
      this.appsById.set(appId, app)
    }
    this.revision += 1
    return this.getSnapshot()
  }

  upsert(
    apps: readonly AppConnectorCapabilityInput[],
  ): AppCapabilityRegistrySnapshot {
    for (const [appId, app] of createUniqueAppMap(apps)) {
      const existing = this.appsById.get(appId)
      if (existing) assertCompatibleOwnership(existing, app)
      this.appsById.set(appId, app)
    }
    this.revision += 1
    return this.getSnapshot()
  }

  clear(): AppCapabilityRegistrySnapshot {
    this.appsById.clear()
    this.revision += 1
    return this.getSnapshot()
  }

  removeOwnedBy(pluginId: string): AppCapabilityRegistrySnapshot {
    let changed = false
    for (const [appId, app] of this.appsById) {
      if (appOwner(app) !== pluginId) continue
      this.appsById.delete(appId)
      changed = true
    }
    if (changed) this.revision += 1
    return this.getSnapshot()
  }

  getSnapshot(): AppCapabilityRegistrySnapshot {
    return {
      schemaVersion: 1,
      revision: this.revision,
      apps: [...this.appsById.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(cloneApp),
    }
  }
}

function assertCompatibleOwnership(
  existing: AppConnectorCapabilityInput,
  incoming: AppConnectorCapabilityInput,
): void {
  const existingOwner = appOwner(existing)
  const incomingOwner = appOwner(incoming)
  if (existingOwner === incomingOwner) return
  throw Object.assign(
    new Error(
      `App connector ${incoming.id} is already registered with a different owner.`,
    ),
    { code: 'plugin-app-owner-conflict' },
  )
}

function appOwner(
  app: AppConnectorCapabilityInput,
): string | undefined {
  return app.parentPluginId ?? app.pluginId
}

function createUniqueAppMap(
  apps: readonly AppConnectorCapabilityInput[],
): Map<string, AppConnectorCapabilityInput> {
  const result = new Map<string, AppConnectorCapabilityInput>()
  for (const app of apps) {
    if (result.has(app.id)) {
      throw new Error(`Duplicate app connector id in registration: ${app.id}`)
    }
    result.set(app.id, cloneApp(app))
  }
  return result
}

function cloneApp(
  app: AppConnectorCapabilityInput,
): AppConnectorCapabilityInput {
  return structuredClone(app)
}
