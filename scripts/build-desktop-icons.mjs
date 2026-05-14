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
const icoImages = []

for (const size of iconSizes) {
  const png = await renderPng(svg, size)
  const raw = await renderRawRgba(svg, size)
  icoImages.push(raw)
  await writeFile(join(outputDir, `icon-${size}.png`), png)
}

const iconPng = await renderPng(svg, 512)
const rendererIconPng = await renderPng(svg, 256)
await writeFile(join(outputDir, 'icon.png'), iconPng)
await writeFile(join(outputDir, 'icon.ico'), buildIco(icoImages))
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

async function renderRawRgba(svgBuffer, size) {
  const { data, info } = await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    size,
    width: info.width,
    height: info.height,
    data,
  }
}

function buildIco(sourceImages) {
  const entries = sourceImages
    .map(image => [image.size, buildDibIconImage(image)])
    .sort(([a], [b]) => a - b)
  const headerSize = 6
  const directorySize = entries.length * 16
  let imageOffset = headerSize + directorySize

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const directories = []
  const iconImages = []

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
    iconImages.push(image)
    imageOffset += image.length
  }

  return Buffer.concat([header, ...directories, ...iconImages])
}

function buildDibIconImage(image) {
  const { width, height, data } = image
  const xorStride = width * 4
  const andStride = Math.ceil(width / 32) * 4
  const bitmapHeader = Buffer.alloc(40)
  const xorBitmap = Buffer.alloc(xorStride * height)
  const andMask = Buffer.alloc(andStride * height)

  bitmapHeader.writeUInt32LE(40, 0)
  bitmapHeader.writeInt32LE(width, 4)
  bitmapHeader.writeInt32LE(height * 2, 8)
  bitmapHeader.writeUInt16LE(1, 12)
  bitmapHeader.writeUInt16LE(32, 14)
  bitmapHeader.writeUInt32LE(0, 16)
  bitmapHeader.writeUInt32LE(xorBitmap.length + andMask.length, 20)
  bitmapHeader.writeInt32LE(0, 24)
  bitmapHeader.writeInt32LE(0, 28)
  bitmapHeader.writeUInt32LE(0, 32)
  bitmapHeader.writeUInt32LE(0, 36)

  for (let y = 0; y < height; y += 1) {
    const sourceY = height - 1 - y
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (sourceY * width + x) * 4
      const targetOffset = y * xorStride + x * 4
      xorBitmap[targetOffset] = data[sourceOffset + 2]
      xorBitmap[targetOffset + 1] = data[sourceOffset + 1]
      xorBitmap[targetOffset + 2] = data[sourceOffset]
      xorBitmap[targetOffset + 3] = data[sourceOffset + 3]
    }
  }

  return Buffer.concat([bitmapHeader, xorBitmap, andMask])
}
