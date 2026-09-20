/**
 * 档案封存 / 解封脚本
 *
 * 用法：
 *   npm run maintain -- <id>            封存：原文加密存档，.md 替换为占位页，artists.ts 标记 maintenance
 *   npm run maintain -- <id> unseal     解封：从密文恢复原文，去掉 maintenance 标记
 *
 * 密码：环境变量 ARCHIVE_KEY（本地设置，勿提交；模式同 ncm-songs 的 NCM_COOKIE）
 *   PowerShell：$env:ARCHIVE_KEY="你的密码"
 *
 * 原文以 AES-256-GCM 加密成 _drafts/<id>.md.enc（base64 密文 JSON）提交到仓库，
 * 外人打开是一串密文无法直接阅读；解封需提供同样密码。
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS_DIR = join(ROOT, 'docs')
const DRAFTS_DIR = join(ROOT, '_drafts')
const ARTISTS_TS = join(DOCS_DIR, 'data', 'artists.ts')

// --- 参数解析（兼容 "id unseal" 与 "id -- unseal" 两种写法）---
const args = process.argv.slice(2).filter((a) => a !== '--')
const id = args[0]
const action = args.includes('unseal') ? 'unseal' : 'seal'

if (!id) {
  console.error('用法：npm run maintain -- <id> [unseal]')
  console.error('  封存：npm run maintain -- gali')
  console.error('  解封：npm run maintain -- gali unseal')
  process.exit(1)
}

if (!/^[a-z0-9-]+$/.test(id)) {
  console.error(`[maintain] id 只能含小写字母、数字、连字符：${id}`)
  process.exit(1)
}

const artistMd = join(DOCS_DIR, 'artists', `${id}.md`)
const encPath = join(DRAFTS_DIR, `${id}.md.enc`)

// --- 加密 / 解密（AES-256-GCM）---
function getKey() {
  const raw = process.env.ARCHIVE_KEY
  if (!raw) {
    console.error('[maintain] 缺少密码：请先设置环境变量 ARCHIVE_KEY')
    console.error('  PowerShell：$env:ARCHIVE_KEY="你的密码"')
    process.exit(1)
  }
  // 用 SHA-256 把任意长度密码派生为固定 32 字节密钥
  return createHash('sha256').update(raw).digest()
}

function encrypt(plain) {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // 单行 JSON 密文，各段 base64
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64')
  }) + '\n'
}

function decrypt(json) {
  const key = getKey()
  const obj = JSON.parse(json.trim())
  const iv = Buffer.from(obj.iv, 'base64')
  const tag = Buffer.from(obj.tag, 'base64')
  const data = Buffer.from(obj.data, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

// --- 占位页 ---
function placeholder(title) {
  return `---
title: ${title}
description: ${title} 档案正在重新编写中，暂未公开。
---

# 档案维护中

**${title}** 的档案正由文档老师重新编写，暂未公开。

编写完成后将恢复展示，敬请期待。
`
}

// 从原 .md frontmatter 提取 title，缺失则回退用 id
function extractTitle(md) {
  const m = md.match(/^title:\s*(.+)$/m)
  return m ? m[1].trim() : id
}

// --- artists.ts 维护标记增删 ---
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 在该歌手 id 行后插入 maintenance: true,；若已带标记返回 null
function addMaintenanceFlag(content) {
  const idRe = new RegExp(`^(\\s*)id:\\s*'${escapeRe(id)}',\\s*$`, 'm')
  const m = content.match(idRe)
  if (!m) {
    console.error(`[maintain] artists.ts 中找不到 id: '${id}'，请检查 id 拼写`)
    process.exit(1)
  }
  const indent = m[1]
  // 检查 id 行之后紧邻的字段是否已是 maintenance（已封存）
  const afterId = content.slice(m.index + m[0].length)
  const nextRe = /^\s*(maintenance:\s*true|name:|alias:|region:|label:|avatar:|debutYear:|bio:|songs:)/m
  const next = afterId.match(nextRe)
  if (next && next[1].startsWith('maintenance')) {
    return null
  }
  return content.replace(m[0], `${m[0]}\n${indent}maintenance: true,`)
}

// 删除该歌手 id 行后紧邻的 maintenance: true, 行；若无则返回 null
function removeMaintenanceFlag(content) {
  const re = new RegExp(`(id:\\s*'${escapeRe(id)}',\\s*\\n)\\s*maintenance:\\s*true,\\s*\\n`)
  if (!re.test(content)) return null
  return content.replace(re, '$1')
}

// --- 主流程 ---
if (action === 'seal') {
  if (!existsSync(artistMd)) {
    console.error(`[maintain] 不存在：docs/artists/${id}.md`)
    process.exit(1)
  }
  const original = await readFile(artistMd, 'utf8')

  // 已是占位页则拒绝重复封存（避免用占位覆盖密文丢失原文）
  if (original.includes('# 档案维护中')) {
    console.error(`[maintain] docs/artists/${id}.md 已是占位页，疑似已封存；如需重新封存请先 unseal 恢复原文`)
    process.exit(1)
  }

  // artists.ts 已带标记也拒绝
  const ts = await readFile(ARTISTS_TS, 'utf8')
  const tsNext = addMaintenanceFlag(ts)
  if (tsNext === null) {
    console.error(`[maintain] artists.ts 中 ${id} 已带 maintenance 标记，疑似已封存；请先 unseal`)
    process.exit(1)
  }

  const title = extractTitle(original)

  // 加密原文
  await mkdir(DRAFTS_DIR, { recursive: true })
  await writeFile(encPath, encrypt(original), 'utf8')
  console.log(`[maintain] 原文已加密存档：_drafts/${id}.md.enc`)

  // 写占位页
  await writeFile(artistMd, placeholder(title), 'utf8')
  console.log(`[maintain] 占位页已写入：docs/artists/${id}.md`)

  // artists.ts 加标记
  await writeFile(ARTISTS_TS, tsNext, 'utf8')
  console.log(`[maintain] artists.ts 已标记 ${id} maintenance: true`)

  console.log(`\n封存完成。手动同步：docs/.vitepress/config.ts 的 nav/sidebar 里给「${title}」的 text 加「（维护中）」。`)
} else {
  // 解封
  if (!existsSync(encPath)) {
    console.error(`[maintain] 不存在密文：_drafts/${id}.md.enc，疑似未封存`)
    process.exit(1)
  }
  let original
  try {
    original = decrypt(await readFile(encPath, 'utf8'))
  } catch (e) {
    console.error(`[maintain] 解密失败：ARCHIVE_KEY 密码错误或密文损坏（${e.message}）`)
    process.exit(1)
  }

  // 恢复原文
  await writeFile(artistMd, original, 'utf8')
  console.log(`[maintain] 原文已恢复：docs/artists/${id}.md`)

  // 删密文
  await rm(encPath)
  console.log(`[maintain] 已删除密文：_drafts/${id}.md.enc`)

  // artists.ts 去标记
  const ts = await readFile(ARTISTS_TS, 'utf8')
  const tsNext = removeMaintenanceFlag(ts)
  if (tsNext === null) {
    console.log(`[maintain] artists.ts 中未找到 ${id} 的 maintenance 标记，跳过`)
  } else {
    await writeFile(ARTISTS_TS, tsNext, 'utf8')
    console.log(`[maintain] artists.ts 已去掉 ${id} 的 maintenance 标记`)
  }

  console.log(`\n解封完成。手动同步：docs/.vitepress/config.ts 的 nav/sidebar 里去掉「${id}」的「（维护中）」。`)
}
