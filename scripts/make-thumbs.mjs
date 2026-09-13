/**
 * 原图 → 站点缩略图（黑胶档案站工作流主通道）
 *
 * 扫描 docs/public/images/originals/<艺人id>/ 下的高清原图，
 * 同名生成 docs/public/images/<艺人id>/<名称>.webp：
 *   - 最大宽度 1000px（与站点正文规格一致），quality 75
 *   - 目标已存在则跳过（增量运行），--force 全部重新生成
 *   - GIF 按动图转换（保留动画）
 *
 * 正文缩略图与 originals 里的原图同名不同扩展名，
 * 灯箱靠这个约定自动找到高清原图（/images/<id>/x.webp → /images/originals/<id>/x.jpg）。
 *
 * 用法：npm run thumbs            # 增量
 *       npm run thumbs -- --force # 强制重新生成
 */
import { readdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'public', 'images')
const ORIGINALS_DIR = join(IMAGES_DIR, 'originals')

const MAX_WIDTH = 1000
const QUALITY = 75
const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.gif'])

const FORCE = process.argv.includes('--force')

/** 递归收集 originals 下所有原图，返回绝对路径列表 */
async function collectSources(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSources(fullPath)))
    } else if (SOURCE_EXTS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

/** 带重试写入（Windows 杀软/索引器可能短暂占用文件） */
async function writeFileRetry(outPath, buffer) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await writeFile(outPath, buffer)
      return
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
    }
  }
}

async function main() {
  if (!existsSync(ORIGINALS_DIR)) {
    console.error(`[make-thumbs] 原图目录不存在：${ORIGINALS_DIR}`)
    console.error('[make-thumbs] 请先按 艺人id 建子目录放入高清原图，如 originals/swimming/xxx.jpg')
    process.exit(1)
  }

  const sources = await collectSources(ORIGINALS_DIR)
  if (sources.length === 0) {
    console.log('[make-thumbs] originals 目录下没有可处理的图片')
    return
  }

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const srcPath of sources) {
    const rel = srcPath.slice(ORIGINALS_DIR.length + 1)
    const relBase = rel.slice(0, -extname(rel).length)
    const outPath = join(IMAGES_DIR, `${relBase}.webp`)

    if (!FORCE && existsSync(outPath)) {
      skipped++
      continue
    }

    try {
      const rawBuffer = await readFile(srcPath)
      const isAnimated = extname(srcPath).toLowerCase() === '.gif'
      const pipeline = sharp(rawBuffer, isAnimated ? { animated: true } : undefined)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      const buffer = await pipeline.webp({ quality: QUALITY }).toBuffer()
      await writeFileRetry(outPath, buffer)
      ok++
      console.log(`[make-thumbs] ${rel} -> images/${relBase}.webp`)
    } catch (err) {
      failed++
      console.error(`[make-thumbs] 失败 ${rel}：${err.code || err.message}`)
    }
  }

  console.log(`[make-thumbs] 完成：生成 ${ok} 张，跳过 ${skipped} 张，失败 ${failed} 张`)
  if (failed > 0) process.exitCode = 1
}

main()
