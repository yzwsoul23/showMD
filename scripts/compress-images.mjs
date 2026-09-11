/**
 * 图片批量压缩脚本
 * 遍历 docs/public/images 下所有 jpg/jpeg/png，统一转换为质量 80 的 WebP，
 * 转换成功后删除原图。已是 .webp 的文件保持不变。
 *
 * 用法：node scripts/compress-images.mjs
 */
import { readdir, stat, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'docs', 'public', 'images')
const WEBP_QUALITY = 80

const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.svg'])
/** 保留为 SVG 的文件（如网站 favicon） */
const KEEP_SVG = new Set(['favicon.svg'])

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

async function main() {
  if (!existsSync(IMAGES_DIR)) {
    console.error(`[compress-images] 图片目录不存在：${IMAGES_DIR}`)
    process.exit(1)
  }

  const images = await collectImages(IMAGES_DIR)
  if (images.length === 0) {
    console.log('[compress-images] 没有需要压缩的 jpg/jpeg/png 图片')
    return
  }

  let converted = 0
  let savedBytes = 0

  for (const inputPath of images) {
    const outputPath = join(
      dirname(inputPath),
      `${basename(inputPath, extname(inputPath))}.webp`
    )

    const [inputStat, outputExists] = await Promise.all([
      stat(inputPath),
      existsSync(outputPath) ? stat(outputPath) : Promise.resolve(null)
    ])

    // 目标 webp 已存在且不旧于原图时跳过转换，但仍尝试清理残留原图
    if (outputExists && outputExists.mtimeMs >= inputStat.mtimeMs) {
      try {
        await removeSource(inputPath)
      } catch {
        /* 原图被占用时忽略，下次运行再清理 */
      }
      continue
    }

    await sharp(inputPath).webp({ quality: WEBP_QUALITY }).toFile(outputPath)
    const outputStat = await stat(outputPath)
    savedBytes += inputStat.size - outputStat.size
    converted += 1
    console.log(
      `[compress-images] ${inputPath.replace(IMAGES_DIR, '')} -> .webp ` +
        `(${(inputStat.size / 1024).toFixed(0)}KB -> ${(outputStat.size / 1024).toFixed(0)}KB)`
    )

    try {
      await removeSource(inputPath)
    } catch (err) {
      console.warn(`[compress-images] 警告：原图暂被占用，未能删除，请稍后手动删除：${inputPath}（${err.code}）`)
    }
  }

  console.log(
    `[compress-images] 完成：转换 ${converted} 张，体积变化 ${(savedBytes / 1024).toFixed(0)}KB`
  )
}

main().catch((err) => {
  console.error('[compress-images] 执行失败：', err)
  process.exit(1)
})
