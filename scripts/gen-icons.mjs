/**
 * Generates minimal valid PNG icon files for the PWA using only Node built-ins.
 * Creates: public/pwa-192x192.png, public/pwa-512x512.png, public/apple-touch-icon.png
 */
import { createWriteStream, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')
mkdirSync(publicDir, { recursive: true })

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ─── PNG chunk writer ─────────────────────────────────────────────────────────

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([typeBytes, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBytes, data, crcVal])
}

// ─── PNG generator ────────────────────────────────────────────────────────────

/**
 * Draw a solid-colour square PNG with a centred letter.
 * bg = [r, g, b], fg = [r, g, b]  (all 0-255)
 */
function makePNG(size, bg, fg) {
  // Build raw RGBA rows
  const rows = []
  const cx = size / 2
  const cy = size / 2

  // Simple 5×7 pixel font for 'S'
  // We'll draw a large "S" using a simple geometric approach
  const letterScale = Math.floor(size * 0.45)

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4) // filter byte + RGBA pixels
    row[0] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      const off = 1 + x * 4
      // Rounded rectangle background
      const rx = x - cx, ry = y - cy
      const radius = size * 0.22
      const inner = size / 2 - radius
      const inRoundedRect =
        Math.abs(rx) <= inner || Math.abs(ry) <= inner ||
        Math.hypot(Math.abs(rx) - inner, Math.abs(ry) - inner) <= radius

      // Draw 'S' shape using bezier-ish regions
      // Normalise to [-1,1]
      const nx = (x - cx) / (letterScale / 2)
      const ny = (y - cy) / (letterScale / 2)

      // Top bar of S
      const topBar = nx >= -0.7 && nx <= 0.7 && ny >= -1.0 && ny <= -0.65
      // Upper left curve fill
      const upperLeft = nx >= -0.75 && nx <= -0.35 && ny >= -0.65 && ny <= -0.1
      // Middle bar of S
      const midBar = nx >= -0.7 && nx <= 0.7 && ny >= -0.15 && ny <= 0.15
      // Lower right curve fill
      const lowerRight = nx >= 0.35 && nx <= 0.75 && ny >= 0.1 && ny <= 0.65
      // Bottom bar of S
      const bottomBar = nx >= -0.7 && nx <= 0.7 && ny >= 0.65 && ny <= 1.0

      const isLetter = topBar || upperLeft || midBar || lowerRight || bottomBar

      const [r, g, b] = inRoundedRect
        ? (isLetter ? fg : bg)
        : [0, 0, 0]
      const a = inRoundedRect ? 255 : 0

      row[off] = r; row[off + 1] = g; row[off + 2] = b; row[off + 3] = a
    }
    rows.push(row)
  }

  const raw = Buffer.concat(rows)
  const compressed = deflateSync(raw)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Generate icons ───────────────────────────────────────────────────────────

// Brand colours: bg = slate-900 (#0f172a), fg = sky-400 (#38bdf8)
const bg = [15, 23, 42]
const fg = [56, 189, 248]

const icons = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
]

for (const { name, size } of icons) {
  const buf = makePNG(size, bg, fg)
  const dest = path.join(publicDir, name)
  createWriteStream(dest).end(buf)
  console.log(`✓ ${dest} (${buf.length} bytes)`)
}
