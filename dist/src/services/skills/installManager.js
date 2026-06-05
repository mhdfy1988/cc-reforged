import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadSkillPackageForManifest, loadSkillPackageFromDir, } from './installCandidates.js';
import { parseSkillInstallResult, } from './installManifest.js';
import { getCcrSkillInstallPaths, } from './installPaths.js';
import { applySkillInstallTransaction } from './installTransaction.js';
import { hashSkillPackageTree } from './packageTreeIntegrity.js';
import { evaluateSkillSecurityPolicy } from './securityPolicy.js';
import { scanSkillPackage } from './securityScanner.js';
export async function applySkillInstallPlan(plan, options) {
    if (options.confirmationToken !== plan.confirmation.token) {
        throw new Error('Skill install confirmation token mismatch.');
    }
    const securityOverrideAccepted = isSecurityOverrideAccepted(plan, options);
    const nonSecurityConflicts = plan.conflicts.filter(conflict => conflict.kind !== 'security-blocked');
    if (!plan.installable && !securityOverrideAccepted) {
        throw new Error(`Skill install plan is not installable: ${plan.conflicts
            .map(conflict => conflict.message)
            .join('; ')}`);
    }
    if (nonSecurityConflicts.length > 0) {
        throw new Error(`Skill install plan has non-security conflicts: ${nonSecurityConflicts
            .map(conflict => conflict.message)
            .join('; ')}`);
    }
    const paths = getCcrSkillInstallPaths(options.configHomeDir);
    const packageDir = plan.writes.find(write => write.kind === 'package')?.path;
    if (!packageDir) {
        throw new Error('Skill install plan missing package write.');
    }
    const liveSource = await loadSkillPackageForManifest({
        manifest: plan.manifestInput,
        configHomeDir: options.configHomeDir,
        risks: [],
    });
    const liveSourcePackage = liveSource.packagePreview;
    const liveSecurityReport = await scanSkillPackage(liveSourcePackage, {
        source: 'candidate',
    });
    const liveSecurityDecision = evaluateSkillSecurityPolicy(liveSecurityReport, {
        overrideToken: options.securityOverrideToken,
    });
    if (!liveSecurityDecision.installAllowed) {
        throw new Error(`Skill install blocked by live security scan: ${liveSecurityDecision.reasons.join('; ')}`);
    }
    const now = options.now ?? new Date();
    const lockKey = `${plan.scope}:${plan.name}`;
    const warnings = [
        ...plan.risks,
        ...(securityOverrideAccepted ? ['Security override token accepted.'] : []),
    ];
    const skillFilePath = join(packageDir, 'SKILL.md');
    const checksum = await hashFileSha256(liveSourcePackage.bodyPath);
    const packageTree = await hashSkillPackageTree(liveSource.packageDir);
    const transaction = await applySkillInstallTransaction({
        sourceDir: liveSource.packageDir,
        packageDir,
        installedIndexPath: paths.installedIndexPath,
        lockFilePath: paths.lockFilePath,
        plan: {
            name: plan.name,
            scope: plan.scope,
            manifestInput: plan.manifestInput,
        },
        lockKey,
        checksum: {
            skillMd: checksum,
            packageTree: packageTree.sha256,
        },
        originVendor: liveSourcePackage.origin.vendor,
        now,
    });
    const skillPackage = await loadSkillPackageFromDir({
        skillDir: packageDir,
        originVendor: liveSource.originVendor,
        importedFrom: liveSource.importedFrom,
        legacyCommand: liveSource.legacyCommand,
        risks: warnings,
    });
    return parseSkillInstallResult({
        schemaVersion: 1,
        name: plan.name,
        scope: plan.scope,
        packageDir,
        installedRecord: transaction.installedRecord,
        lockRecord: transaction.lockRecord,
        package: skillPackage,
        warnings,
    });
}
function isSecurityOverrideAccepted(plan, options) {
    return (plan.securityDecision.requiresOverride &&
        plan.securityDecision.overrideToken !== undefined &&
        options.securityOverrideToken === plan.securityDecision.overrideToken);
}
async function hashFileSha256(path) {
    return createHash('sha256').update(await readFile(path)).digest('hex');
}
//# sourceMappingURL=installManager.js.map