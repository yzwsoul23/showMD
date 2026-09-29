/**
 * 从 SVG 渲染 PNG 回退图标（favicon + 导航栏 logo）
 *
 * 现代浏览器优先使用 SVG；不支持 SVG 的旧浏览器回退到 PNG。
 * 修改 logo 后运行一次即可同步更新所有 PNG。
 *
 * 用法：node scripts/make-favicon.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'public', 'images')

/**
 * 把指定 SVG 渲染成 128×128 透明背景 PNG
 * density 拉高保证缩放到 128px 时边缘清晰，再 resize 到精确尺寸
 */
async function renderPng(svgPath, pngPath, label) {
  const svg = await readFile(svgPath)
  const png = await sharp(svg, { density: 512 })
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await writeFile(pngPath, png)
  console.log(`✓ ${label} 已生成 (128×128, 透明背景)`)
}

await renderPng(join(IMAGES_DIR, 'favicon.svg'), join(IMAGES_DIR, 'favicon.png'), 'favicon.png')
await renderPng(join(IMAGES_DIR, 'logo.svg'), join(IMAGES_DIR, 'logo.png'), 'logo.png')
