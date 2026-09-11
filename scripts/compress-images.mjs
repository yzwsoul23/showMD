/**
 * 图片批量压缩脚本
 * 遍历 docs/public/images 下所有图片（含已有 WebP），统一压缩：
 *   - 正文图片：最大宽度 1000px，WebP 质量 60
 *   - 头像（avatars 目录）：最大宽度 200px，WebP 质量 60
 * 转换后删除原图。SVG 仅 favicon 保留。
 *
 * 用法：node scripts/compress-images.mjs          # 增量（跳过已优化）
 *       node scripts/compress-images.mjs --force  # 强制重新压缩全部
 */
import { readdir, stat, unlink, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'public', 'images')
const AVATARS_DIR = join(IMAGES_DIR, 'avatars')

const QUALITY = 60
const MAX_CONTENT_WIDTH = 1000
const MAX_AVATAR_WIDTH = 200

const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.svg', '.webp'])
const KEEP_SVG = new Set(['favicon.svg'])

const FORCE = process.argv.includes('--force')

/** 删除文件，Windows 上可能遇到杀软/索引器占用（EBUSY/EPERM），带重试 */
async function removeSource(filePath, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await unlink(filePath)
      return
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    }
  }
}

/** 递归收集目录下所有可压缩图片 */
async function collectImages(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectImages(fullPath)))
    } else if (
      SOURCE_EXTS.has(extname(entry.name).toLowerCase()) &&
      !KEEP_SVG.has(entry.name)
    ) {
      files.push(fullPath)
    }
  }
  return files
}

/** 根据路径判断是否是头像 */
function isAvatar(filePath) {
  return filePath.startsWith(AVATARS_DIR)
}

/** 压缩单张图片，返回是否实际执行了写入 */
async function compressImage(inputPath) {
  const isAv = isAvatar(inputPath)
  const maxWidth = isAv ? MAX_AVATAR_WIDTH : MAX_CONTENT_WIDTH
  const outPath = join(
    dirname(inputPath),
    `${basename(inputPath, extname(inputPath))}.webp`
  )

  // 如果输入本身已是 webp 且无 --force，检查是否需要跳过
  const isAlreadyWebp = extname(inputPath).toLowerCase() === '.webp'
  if (isAlreadyWebp && !FORCE) {
    const rawMeta = await readFile(inputPath)
    const meta = await sharp(rawMeta).metadata()
    if (meta.width <= maxWidth) {
      return { skipped: true, outPath }
    }
  }

  // 极小文件（<2KB）无需压缩
  const inputStat = await stat(inputPath)
  if (inputStat.size < 2048) {
    return { skipped: true, outPath }
  }

  // 先读入内存再交给 sharp，确保文件句柄完全释放后再写入
  const rawBuffer = await readFile(inputPath)
  const buffer = await sharp(rawBuffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer()

  const afterSize = buffer.length

  // 如果输入是 webp 且输出比原文件大（压缩无收益），保留原文件
  if (isAlreadyWebp && afterSize >= inputStat.size) {
    return { skipped: true, outPath }
  }

  // sharp 已释放句柄，直接覆写
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await writeFile(outPath, buffer)
      break
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
    }
  }

  // 删除非 webp 原图
  if (!isAlreadyWebp) {
    try {
      await removeSource(inputPath)
    } catch (err) {
      console.warn(`  警告：原图暂被占用未能删除：${inputPath}（${err.code}）`)
    }
  }

  return {
    skipped: false,
    outPath,
    beforeKB: Math.round(inputStat.size / 1024),
    afterKB: Math.round(afterSize / 1024)
  }
}

async function main() {
  if (!existsSync(IMAGES_DIR)) {
    console.error(`[compress-images] 图片目录不存在：${IMAGES_DIR}`)
    process.exit(1)
  }

  const images = await collectImages(IMAGES_DIR)
  if (images.length === 0) {
    console.log('[compress-images] 没有需要处理的图片')
    return
  }

  let processed = 0
  let skipped = 0
  let savedBytes = 0

  for (const inputPath of images) {
    const rel = inputPath.replace(IMAGES_DIR, '')
    try {
      const result = await compressImage(inputPath)
      if (result.skipped) {
        skipped++
        continue
      }
      processed++
      savedBytes += (result.beforeKB - result.afterKB) * 1024
      console.log(
        `[compress-images] ${rel} ${result.beforeKB}KB -> ${result.afterKB}KB`
      )
    } catch (err) {
      console.error(`[compress-images] 跳过 ${rel}：${err.code || err.message}`)
      skipped++
    }
  }

  console.log(
    `[compress-images] 完成：处理 ${processed} 张，跳过 ${skipped} 张，` +
    `体积变化 ${Math.round(savedBytes / 1024)}KB`
  )
}

main().catch((err) => {
  console.error('[compress-images] 执行失败：', err)
  process.exit(1)
})
