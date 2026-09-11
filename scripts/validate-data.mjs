/**
 * 数据完整性校验脚本
 * 1. artists.ts 中每个 id 必须存在对应的 docs/artists/<id>.md
 * 2. avatar 指向的文件必须存在于 docs/public/ 下
 * 3. songs 数组必须非空，且每条都包含 title / year / role
 * 4. id 不得重复
 *
 * 任一检查失败则输出具体缺失项并以退出码 1 结束。
 *
 * 用法：node scripts/validate-data.mjs
 */
import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = join(__dirname, '..', 'docs')
const ARTISTS_TS = join(DOCS_DIR, 'data', 'artists.ts')

/** 通过 esbuild 即时把 TS 数据源打包为 ESM 后读取 */
async function loadArtists() {
  const tempDir = await mkdtemp(join(tmpdir(), 'validate-data-'))
  const outFile = join(tempDir, 'artists.mjs')
  try {
    await build({
      entryPoints: [ARTISTS_TS],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: outFile,
      logLevel: 'silent'
    })
    const mod = await import(pathToFileURL(outFile).href)
    return mod.artists
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function validateArtist(artist) {
  const errors = []
  const { id, avatar, songs } = artist

  // 1. 对应 MD 文件
  const mdPath = join(DOCS_DIR, 'artists', `${id}.md`)
  if (!existsSync(mdPath)) {
    errors.push(`缺少艺人页面文件：docs/artists/${id}.md`)
  }

  // 2. 头像文件（avatar 必须是以 / 开头的站点内路径）
  if (typeof avatar !== 'string' || !avatar.startsWith('/')) {
    errors.push(`avatar 必须是以 "/" 开头的站点内路径，当前值：${String(avatar)}`)
  } else if (!existsSync(join(DOCS_DIR, 'public', avatar))) {
    errors.push(`头像文件不存在：docs/public${avatar}`)
  }

  // 3. 代表作品
  if (!Array.isArray(songs) || songs.length === 0) {
    errors.push('songs 数组不能为空')
  } else {
    songs.forEach((song, index) => {
      if (typeof song.title !== 'string' || !song.title.trim()) {
        errors.push(`songs[${index}].title 缺失或非法`)
      }
      if (typeof song.year !== 'number' || !Number.isInteger(song.year)) {
        errors.push(`songs[${index}]《${song?.title ?? ''}》的 year 必须是整数年份`)
      }
      if (typeof song.role !== 'string' || !song.role.trim()) {
        errors.push(`songs[${index}]《${song?.title ?? ''}》的 role 缺失`)
      }
    })
  }

  return errors
}

async function main() {
  if (!existsSync(ARTISTS_TS)) {
    console.error(`[validate-data] 数据源文件不存在：${ARTISTS_TS}`)
    process.exit(1)
  }

  const artists = await loadArtists()
  const errors = []
  const seenIds = new Set()

  for (const artist of artists) {
    if (!artist || typeof artist.id !== 'string' || !artist.id.trim()) {
      errors.push('存在缺少合法 id 的艺人数据项')
      continue
    }
    if (seenIds.has(artist.id)) {
      errors.push(`id 重复：${artist.id}`)
      continue
    }
    seenIds.add(artist.id)
    errors.push(...validateArtist(artist))
  }

  if (errors.length > 0) {
    console.error('[validate-data] 数据校验失败：')
    errors.forEach((msg) => console.error(`  - ${msg}`))
    process.exit(1)
  }

  console.log(`[validate-data] 校验通过：共 ${artists.length} 位艺人，数据完整`)
}

main().catch((err) => {
  console.error('[validate-data] 执行失败：', err)
  process.exit(1)
})
