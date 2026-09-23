/**
 * 档案封存脚本（纯文件操作，无加密、无密码）
 *
 * 用法：
 *   npm run maintain -- <id>
 *   示例：npm run maintain -- gali
 *
 * 封存只做两件事：
 *   1. docs/artists/<id>.md 移动到本地 _drafts/<id>.md（.gitignore 已排除 _drafts/，不会提交）
 *   2. docs/artists/_maintenance.md 占位模板复制为 docs/artists/<id>.md
 *
 * 也可以完全不用脚本，手动操作等价：
 *   把 docs/artists/<id>.md 拖进 _drafts/，再把 _maintenance.md 复制一份改名为 <id>.md。
 *
 * 解封无需任何命令：把 _drafts/<id>.md 直接拖回 docs/artists/ 覆盖占位页即可。
 * 首页在构建时扫描 md 内的 rs:maintenance 标记，覆盖后「档案维护中」角标自动消失，
 * 不需要改 artists.ts、config.ts 或任何其他文件。
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS_DIR = join(ROOT, 'docs')
const ARTISTS_DIR = join(DOCS_DIR, 'artists')
const DRAFTS_DIR = join(ROOT, '_drafts')
const ARTISTS_TS = join(DOCS_DIR, 'data', 'artists.ts')
const PLACEHOLDER = join(ARTISTS_DIR, '_maintenance.md')

// 首页据该标记识别维护中页面，需与 _maintenance.md 内注释、index.md 的检测常量保持一致
const MARKER = '<!-- rs:maintenance -->'

// --- 参数解析（兼容 "-- <id>" 写法）---
const args = process.argv.slice(2).filter((a) => a !== '--')
const id = args[0]

if (!id) {
  console.error('用法：npm run maintain -- <id>')
  console.error('  示例：npm run maintain -- gali')
  console.error('  解封无需脚本：把 _drafts/<id>.md 拖回 docs/artists/ 覆盖即可')
  process.exit(1)
}

if (args[1] === 'unseal') {
  console.log('[maintain] 解封不需要跑脚本：')
  console.log(`  直接把 _drafts/${id}.md 拖回 docs/artists/ 覆盖同名文件即可，首页角标会自动消失。`)
  process.exit(0)
}

if (!/^[a-z0-9-]+$/.test(id)) {
  console.error(`[maintain] id 只能含小写字母、数字、连字符：${id}`)
  process.exit(1)
}

const artistMd = join(ARTISTS_DIR, `${id}.md`)
const draftPath = join(DRAFTS_DIR, `${id}.md`)

// --- 前置检查 ---
if (!existsSync(PLACEHOLDER)) {
  console.error('[maintain] 缺少占位模板：docs/artists/_maintenance.md')
  process.exit(1)
}

if (!existsSync(artistMd)) {
  console.error(`[maintain] 不存在：docs/artists/${id}.md`)
  process.exit(1)
}

const current = await readFile(artistMd, 'utf8')
if (current.includes(MARKER)) {
  console.error(`[maintain] docs/artists/${id}.md 已是维护中占位页，疑似已封存`)
  console.error(`  如需解封：把 _drafts/${id}.md 拖回 docs/artists/ 覆盖即可`)
  process.exit(1)
}

if (existsSync(draftPath)) {
  console.error(`[maintain] 本地已存在 _drafts/${id}.md，为避免覆盖备份已中止`)
  console.error('  请先处理（确认无用后删除，或改名挪走）再封存')
  process.exit(1)
}

// id 拼写检查：artists.ts 里要能找到对应数据项
const ts = await readFile(ARTISTS_TS, 'utf8')
if (!new RegExp(`id:\\s*'${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(ts)) {
  console.error(`[maintain] docs/data/artists.ts 中找不到 id: '${id}'，请检查拼写`)
  process.exit(1)
}

// --- 执行封存 ---
await mkdir(DRAFTS_DIR, { recursive: true })
await rename(artistMd, draftPath)
console.log(`[maintain] 原文已移到本地：_drafts/${id}.md（_drafts/ 已被 .gitignore 排除）`)

const placeholder = await readFile(PLACEHOLDER, 'utf8')
await writeFile(artistMd, placeholder, 'utf8')
console.log(`[maintain] 占位页已就位：docs/artists/${id}.md（复制自 _maintenance.md）`)

console.log('\n封存完成。提交时只会包含占位页，原文仅保留在本机。')
console.log('解封时把 _drafts 里的 md 拖回 docs/artists/ 覆盖即可，无需改其他文件。')
