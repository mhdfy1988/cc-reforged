#!/usr/bin/env node
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const sourceSvg = join(root, 'apps', 'desktop', 'assets', 'ccr-icon.svg')
const outputDir = join(root, 'apps', 'desktop', 'assets', 'generated')
const rendererPublicDir = join(root, 'apps', 'desktop', 'src', 'renderer', 'public')
const iconSizes = [16, 24, 32, 48, 64, 128, 256]

await mkdir(outputDir, { recursive: true })
await mkdir(rendererPublicDir, { recursive: true })

const svg = await readFile(sourceSvg)
const pngBuffers = new Map()

for (const size of iconSizes) {
  const png = await renderPng(svg, size)
  pngBuffers.set(size, png)
  await writeFile(join(outputDir, `icon-${size}.png`), png)
}

const iconPng = await renderPng(svg, 512)
const rendererIconPng = await renderPng(svg, 256)
await writeFile(join(outputDir, 'icon.png'), iconPng)
await writeFile(join(outputDir, 'icon.ico'), buildIco(pngBuffers))
await writeFile(join(rendererPublicDir, 'ccr-icon.png'), rendererIconPng)

console.log(
  JSON.stringify(
    {
      ok: true,
      source: sourceSvg,
      outputDir,
      rendererPublicDir,
      generated: [
        'icon.png',
        'icon.ico',
        'ccr-icon.png',
        ...iconSizes.map(size => `icon-${size}.png`),
      ],
    },
    null,
    2,
  ),
)

function renderPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer()
}

function buildIco(buffersBySize) {
  const entries = [...buffersBySize.entries()].sort(([a], [b]) => a - b)
  const headerSize = 6
  const directorySize = entries.length * 16
  let imageOffset = headerSize + directorySize

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const directories = []
  const images = []

  for (const [size, image] of entries) {
    const directory = Buffer.alloc(16)
    directory.writeUInt8(size === 256 ? 0 : size, 0)
    directory.writeUInt8(size === 256 ? 0 : size, 1)
    directory.writeUInt8(0, 2)
    directory.writeUInt8(0, 3)
    directory.writeUInt16LE(1, 4)
    directory.writeUInt16LE(32, 6)
    directory.writeUInt32LE(image.length, 8)
    directory.writeUInt32LE(imageOffset, 12)
    directories.push(directory)
    images.push(image)
    imageOffset += image.length
  }

  return Buffer.concat([header, ...directories, ...images])
}
