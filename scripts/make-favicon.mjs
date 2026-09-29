/**
 * 从 favicon.svg 渲染 128×128 PNG 回退图标
 *
 * 现代浏览器优先使用 SVG favicon；旧浏览器回退到 PNG。
 * 修改 logo 后运行一次即可同步更新 PNG。
 *
 * 用法：node scripts/make-favicon.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'public', 'images')
const FAVICON_SVG = join(IMAGES_DIR, 'favicon.svg')
const FAVICON_PNG = join(IMAGES_DIR, 'favicon.png')

const svg = await readFile(FAVICON_SVG)

// density 拉高保证缩放到 128px 时边缘清晰，再 resize 到精确尺寸
const png = await sharp(svg, { density: 512 })
  .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

await writeFile(FAVICON_PNG, png)
console.log('✓ favicon.png 已生成 (128×128, 透明背景)')
