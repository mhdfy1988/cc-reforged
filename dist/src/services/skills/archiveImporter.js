import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile, } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep as pathSep, } from 'node:path';
import { promisify } from 'node:util';
import { gunzip, inflateRaw } from 'node:zlib';
const gunzipAsync = promisify(gunzip);
const inflateRawAsync = promisify(inflateRaw);
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 200 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 1000;
export async function extractLocalSkillArchive(archivePath) {
    const format = detectArchiveFormat(archivePath);
    const archiveStat = await stat(archivePath);
    if (!archiveStat.isFile()) {
        throw new Error(`Skill archive is not a file: ${archivePath}`);
    }
    if (archiveStat.size > MAX_ARCHIVE_BYTES) {
        throw new Error(`Skill archive is too large: ${archiveStat.size} bytes, max ${MAX_ARCHIVE_BYTES}`);
    }
    const extractedRootDir = await mkdtemp(join(tmpdir(), 'ccr-skill-archive-'));
    const state = { files: 0, expandedBytes: 0 };
    if (format === 'zip') {
        await extractZipArchive(archivePath, extractedRootDir, state);
    }
    else {
        await extractTarArchive(archivePath, extractedRootDir, state, format);
    }
    const skillFiles = await findSkillMarkdownFiles(extractedRootDir);
    if (skillFiles.length === 0) {
        throw new Error('Skill archive does not contain SKILL.md');
    }
    if (skillFiles.length > 1) {
        throw new Error(`Skill archive contains multiple SKILL.md files: ${skillFiles.join(', ')}`);
    }
    return {
        archivePath,
        extractedRootDir,
        skillDir: dirname(skillFiles[0]),
        format,
        warnings: [
            `本地 archive 已解包为临时导入预览目录：${extractedRootDir}`,
            `archive sha256: ${await hashFileSha256(archivePath)}`,
        ],
    };
}
function detectArchiveFormat(archivePath) {
    const lower = archivePath.toLowerCase();
    if (lower.endsWith('.zip'))
        return 'zip';
    if (lower.endsWith('.tar'))
        return 'tar';
    if (lower.endsWith('.tgz') || lower.endsWith('.tar.gz'))
        return 'tgz';
    throw new Error('Unsupported skill archive type. Supported extensions: .zip, .tar, .tgz, .tar.gz');
}
async function extractZipArchive(archivePath, targetRoot, state) {
    const buffer = await readFile(archivePath);
    const eocdOffset = findZipEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
    if (centralDirOffset + centralDirSize > buffer.length) {
        throw new Error('Invalid zip central directory bounds.');
    }
    let offset = centralDirOffset;
    for (let index = 0; index < entryCount; index += 1) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error('Invalid zip central directory entry.');
        }
        const flags = buffer.readUInt16LE(offset + 8);
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer
            .subarray(offset + 46, offset + 46 + fileNameLength)
            .toString('utf8');
        if ((flags & 0x1) !== 0) {
            throw new Error(`Encrypted zip entries are not supported: ${name}`);
        }
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
            throw new Error(`Zip64 entries are not supported: ${name}`);
        }
        const directory = name.endsWith('/');
        let data;
        if (!directory) {
            if (method !== 0 && method !== 8) {
                throw new Error(`Unsupported zip compression method ${method}: ${name}`);
            }
            const localHeader = readZipLocalHeader(buffer, localHeaderOffset);
            const compressed = buffer.subarray(localHeader.dataOffset, localHeader.dataOffset + compressedSize);
            data = method === 0 ? Buffer.from(compressed) : await inflateRawAsync(compressed);
            if (data.length !== uncompressedSize) {
                throw new Error(`Zip entry size mismatch: ${name}`);
            }
        }
        await writeArchiveEntry(targetRoot, { path: name, directory, data }, state);
        offset += 46 + fileNameLength + extraLength + commentLength;
    }
}
function findZipEndOfCentralDirectory(buffer) {
    const minOffset = Math.max(0, buffer.length - 0xffff - 22);
    for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }
    throw new Error('Invalid zip archive: end of central directory not found.');
}
function readZipLocalHeader(buffer, localHeaderOffset) {
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error('Invalid zip local file header.');
    }
    const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    return {
        dataOffset: localHeaderOffset + 30 + fileNameLength + extraLength,
    };
}
async function extractTarArchive(archivePath, targetRoot, state, format) {
    const raw = await readFile(archivePath);
    const buffer = format === 'tgz' ? await gunzipAsync(raw) : raw;
    let offset = 0;
    while (offset + 512 <= buffer.length) {
        const header = buffer.subarray(offset, offset + 512);
        if (isZeroBlock(header))
            break;
        const name = parseTarString(header, 0, 100);
        const prefix = parseTarString(header, 345, 155);
        const path = prefix ? `${prefix}/${name}` : name;
        const size = parseTarSize(header, 124, 12);
        const typeFlag = header.toString('utf8', 156, 157);
        const dataStart = offset + 512;
        const dataEnd = dataStart + size;
        if (dataEnd > buffer.length) {
            throw new Error(`Invalid tar entry bounds: ${path}`);
        }
        if (typeFlag === '1' || typeFlag === '2') {
            throw new Error(`Archive links are not allowed: ${path}`);
        }
        if (typeFlag === 'x' || typeFlag === 'g') {
            offset = dataStart + Math.ceil(size / 512) * 512;
            continue;
        }
        await writeArchiveEntry(targetRoot, {
            path,
            directory: typeFlag === '5',
            data: typeFlag === '5'
                ? undefined
                : Buffer.from(buffer.subarray(dataStart, dataEnd)),
        }, state);
        offset = dataStart + Math.ceil(size / 512) * 512;
    }
}
function parseTarString(buffer, start, length) {
    return buffer
        .toString('utf8', start, start + length)
        .replace(/\0.*$/u, '')
        .trim();
}
function parseTarSize(buffer, start, length) {
    const raw = parseTarString(buffer, start, length);
    if (!raw)
        return 0;
    const value = Number.parseInt(raw, 8);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid tar entry size: ${raw}`);
    }
    return value;
}
function isZeroBlock(buffer) {
    return buffer.every(byte => byte === 0);
}
async function writeArchiveEntry(targetRoot, entry, state) {
    const normalizedPath = normalizeArchiveEntryPath(entry.path);
    if (normalizedPath === null)
        return;
    const target = resolve(targetRoot, ...normalizedPath.split('/'));
    if (!isPathInside(targetRoot, target)) {
        throw new Error(`Archive entry escapes target directory: ${entry.path}`);
    }
    if (entry.directory) {
        await mkdir(target, { recursive: true });
        return;
    }
    if (!entry.data) {
        throw new Error(`Archive file entry is missing data: ${entry.path}`);
    }
    state.files += 1;
    state.expandedBytes += entry.data.length;
    if (state.files > MAX_ARCHIVE_FILES) {
        throw new Error(`Skill archive contains too many files: ${state.files}`);
    }
    if (state.expandedBytes > MAX_EXPANDED_BYTES) {
        throw new Error(`Skill archive expands beyond ${MAX_EXPANDED_BYTES} bytes.`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, entry.data);
}
function normalizeArchiveEntryPath(path) {
    const trimmed = path.replace(/\\/g, '/').replace(/^\.\/+/u, '').trim();
    const withoutTrailingSlash = trimmed.replace(/\/+$/u, '');
    if (!withoutTrailingSlash || withoutTrailingSlash === '.')
        return null;
    if (withoutTrailingSlash.startsWith('/') ||
        /^[a-zA-Z]:/u.test(withoutTrailingSlash)) {
        throw new Error(`Archive entry uses an absolute path: ${path}`);
    }
    const parts = withoutTrailingSlash.split('/');
    if (parts.some(part => part === '..' || part === '')) {
        throw new Error(`Archive entry path is unsafe: ${path}`);
    }
    return parts.join('/');
}
function isPathInside(root, target) {
    const normalizedRoot = resolve(root).toLowerCase();
    const normalizedTarget = resolve(target).toLowerCase();
    return (normalizedTarget === normalizedRoot ||
        normalizedTarget.startsWith(`${normalizedRoot}${pathSep}`));
}
async function findSkillMarkdownFiles(root) {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const absolute = join(root, entry.name);
        if (entry.isDirectory())
            return findSkillMarkdownFiles(absolute);
        if (entry.isFile() && basename(entry.name).toLowerCase() === 'skill.md') {
            return [absolute];
        }
        return [];
    }));
    return nested.flat();
}
async function hashFileSha256(path) {
    return createHash('sha256').update(await readFile(path)).digest('hex');
}
//# sourceMappingURL=archiveImporter.js.map