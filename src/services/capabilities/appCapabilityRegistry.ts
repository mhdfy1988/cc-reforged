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
