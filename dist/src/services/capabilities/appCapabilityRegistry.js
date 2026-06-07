export class AppCapabilityRegistry {
    revision = 0;
    appsById = new Map();
    register(input) {
        return input.mode === 'upsert'
            ? this.upsert(input.apps)
            : this.replace(input.apps);
    }
    replace(apps) {
        const nextApps = createUniqueAppMap(apps);
        this.appsById.clear();
        for (const [appId, app] of nextApps) {
            this.appsById.set(appId, app);
        }
        this.revision += 1;
        return this.getSnapshot();
    }
    upsert(apps) {
        for (const [appId, app] of createUniqueAppMap(apps)) {
            this.appsById.set(appId, app);
        }
        this.revision += 1;
        return this.getSnapshot();
    }
    clear() {
        this.appsById.clear();
        this.revision += 1;
        return this.getSnapshot();
    }
    getSnapshot() {
        return {
            schemaVersion: 1,
            revision: this.revision,
            apps: [...this.appsById.values()]
                .sort((left, right) => left.id.localeCompare(right.id))
                .map(cloneApp),
        };
    }
}
function createUniqueAppMap(apps) {
    const result = new Map();
    for (const app of apps) {
        if (result.has(app.id)) {
            throw new Error(`Duplicate app connector id in registration: ${app.id}`);
        }
        result.set(app.id, cloneApp(app));
    }
    return result;
}
function cloneApp(app) {
    return structuredClone(app);
}
//# sourceMappingURL=appCapabilityRegistry.js.map