/**
 * 网易云音乐歌曲批量导出工具
 *
 * 输入一个歌单 / 歌手 / 专辑链接，批量拉取歌曲，
 * 补全专辑发行时间 al.publishTime，按发行时间排序，
 * 输出带 publishDate / publishMs 的 CSV（纯 UTF-8 无 BOM）。
 *
 * 歌手链接默认走「全部歌曲」分页接口（免登录，单页 100）：歌手名下所有单曲，
 * 含只挂在合辑名下的歌和别人专辑里的客串 feat。
 * 加 --albums 改走「专辑页」模式：分页拉歌手全部专辑再逐张取歌，
 * 只收歌手自己专辑/EP/单曲里的版本；网易云专辑详情接口需登录（-462），需设置 NCM_COOKIE。
 *
 * 用法：
 *   node scripts/ncm-songs.mjs "https://music.163.com/playlist?id=3778678" out.csv asc
 *   node scripts/ncm-songs.mjs "https://music.163.com/artist?id=12345"     out.csv desc
 *   node scripts/ncm-songs.mjs "https://music.163.com/artist?id=12345"     out.csv asc --albums
 *   node scripts/ncm-songs.mjs "https://music.163.com/album?id=12345"      out.csv desc
 *
 * 参数：
 *   link      歌单 / 歌手 / 专辑链接（必填）
 *   outFile   输出 CSV 路径（默认 songs_by_time.csv）
 *   order     asc 升序 / desc 降序（默认 asc）
 *   --albums  歌手链接改走专辑页遍历模式（网易云需 NCM_COOKIE）
 *
 * 环境变量：
 *   NCM_BASE  自定义 API 基址（默认 https://music.163.com）
 *   NCM_COOKIE  携带 MUSIC_U 等 cookie，可拉私密歌单 / 我喜欢的音乐
 */

import { writeFileSync } from 'node:fs'

const BASE = process.env.NCM_BASE || 'https://music.163.com'
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Referer: 'https://music.163.com/'
}
if (process.env.NCM_COOKIE) H.Cookie = process.env.NCM_COOKIE

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJSON(path) {
  const r = await fetch(BASE + path, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`)
  return r.json()
}

const artists = (t) => (t.ar || t.artists || []).map((a) => a.name).join('/')
const albumOf = (t) => t.al || t.album || {}

function pubMs(t) {
  const al = albumOf(t)
  // 单曲 detail 可能在 al.publishTime；部分在 t.publishTime
  return Number(al && al.publishTime) || Number(t.publishTime) || 0
}

function fmtDate(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  // 用本地时区切片，避免 UTC 跨日显示差一天
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ---------- 数据来源 ---------- */

async function playlistTracks(pid) {
  const d = await getJSON(`/api/v6/playlist/detail?id=${pid}&n=5000`)
  const ids = ((d.playlist && d.playlist.trackIds) || []).map((x) => x.id)
  const out = []
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const sd = await getJSON(`/api/song/detail?ids=${encodeURIComponent(JSON.stringify(chunk))}`)
    out.push(...(sd.songs || []))
    await sleep(200)
  }
  return out
}

/** 专辑曲目。专辑详情接口 -462 表示需要绑定手机（cookie） */
async function albumTracks(aid) {
  try {
    const d = await getJSON(`/api/album/${aid}?ext=true&limit=1000`)
    if (d.code === -462) {
      console.warn('  [warn] 专辑详情需要登录（-462），请设置 NCM_COOKIE 环境变量')
      return []
    }
    // 两种返回结构：顶层 songs 或嵌套在 album.songs
    return d.songs || (d.album && d.album.songs) || []
  } catch {
    return []
  }
}

/** 歌手全部歌曲（免登录）：直接分页「全部歌曲」接口，单页上限 100。
 *  返回项自带 artists / album(id,name,publishTime) / duration / fee，
 *  无需再遍历专辑逐张取歌，也不依赖需要登录的专辑详情接口。 */
async function artistAllSongs(uid) {
  const out = []
  let offset = 0
  let guard = 0
  while (guard++ < 200) {
    const d = await getJSON(`/api/v1/artist/songs?id=${uid}&order=time&limit=100&offset=${offset}`)
    const list = d.songs || []
    out.push(...list)
    if (!list.length || out.length >= d.total) break
    offset += 100
    await sleep(200)
  }
  return out
}

/** 歌手「专辑页」模式：分页拉歌手全部专辑，再逐张专辑取歌。
 *  与全部歌曲模式的区别：只收歌手自己专辑/EP/单曲里的版本，
 *  不含只挂在合辑名下的歌和别人专辑里的客串 feat。
 *  注意：-462（需登录）按专辑逐个出现，部分专辑无 cookie 也能拉，
 *  因此逐张容错并在末尾汇总失败数，提示补 NCM_COOKIE。 */
async function artistAlbumsTracks(uid) {
  const albums = []
  let offset = 0
  let guard = 0
  while (guard++ < 100) {
    const d = await getJSON(`/api/artist/albums/${uid}?offset=${offset}&limit=50`)
    const list = d.hotAlbums || []
    if (!list.length) break
    albums.push(...list)
    offset += 50
    await sleep(200)
  }
  const out = []
  let failed = 0
  for (let i = 0; i < albums.length; i++) {
    try {
      const d = await getJSON(`/api/album/${albums[i].id}?ext=true&limit=1000`)
      if (d.code === -462) throw new Error('需要登录（-462）')
      const s = d.songs || (d.album && d.album.songs) || []
      console.log(`  [${i + 1}/${albums.length}] ${albums[i].name}（${s.length} 首）`)
      out.push(...s)
    } catch (e) {
      failed++
      console.warn(`  [warn] 专辑「${albums[i].name}」拉取失败：${e.message}`)
    }
    await sleep(200)
  }
  if (failed) {
    console.warn(`[warn] ${failed}/${albums.length} 张专辑拉取失败：网易云部分专辑详情需登录，可设置 NCM_COOKIE 环境变量后重试`)
  }
  return out
}

/* ---------- 排序 / CSV ---------- */

function sortByPublish(tracks, desc = false) {
  return tracks.slice().sort((a, b) => {
    const pa = pubMs(a)
    const pb = pubMs(b)
    // 没有发布时间的沉底（不论升序降序）
    if (!pa && !pb) return a.id - b.id
    if (!pa) return 1
    if (!pb) return -1
    return desc ? pb - pa : pa - pb
  })
}

const csvField = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`

function toCSV(tracks) {
  const head = [
    'publishDate', 'publishMs', 'songId', 'title', 'artists',
    'albumId', 'album', 'durationSec', 'fee', 'orpheus', 'webUrl'
  ]
  const lines = [head.map(csvField).join(',')]
  const seen = new Set()
  for (const t of tracks) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    const al = albumOf(t)
    const ms = pubMs(t)
    lines.push([
      fmtDate(ms), ms || '',
      t.id, t.name || '', artists(t),
      al.id || '', al.name || '',
      Math.round((t.dt || t.duration || 0) / 1000),
      t.fee !== undefined ? t.fee : '',
      `orpheus://song/${t.id}/?autoplay=1`,
      `https://music.163.com/song?id=${t.id}`
    ].map(csvField).join(','))
  }
  return lines.join('\r\n')
}

/* ---------- 入口 ---------- */

function pickId(url, type) {
  const u = new URL(url.includes('://') ? url : 'https://music.163.com/' + url)
  const hash = decodeURIComponent(u.hash.replace(/^#/, ''))
  const sp = new URLSearchParams(hash.includes('=') ? (hash.split('?')[1] || '') : u.search)
  if (sp.get('id')) return sp.get('id')
  const m = u.pathname.match(new RegExp('/' + type + '/(\\d+)'))
  return m ? m[1] : ''
}

async function main(link, outFile, desc) {
  let tracks = []
  if (/playlist/.test(link)) {
    tracks = await playlistTracks(pickId(link, 'playlist'))
  } else if (/artist/.test(link)) {
    tracks = byAlbum
      ? await artistAlbumsTracks(pickId(link, 'artist'))
      : await artistAllSongs(pickId(link, 'artist'))
  } else if (/album/.test(link)) {
    tracks = await albumTracks(pickId(link, 'album'))
  } else {
    console.warn('只支持歌单(playlist) / 歌手(artist) / 专辑(album)链接')
    process.exit(1)
  }
  tracks = sortByPublish(tracks, desc)
  writeFileSync(outFile, toCSV(tracks), 'utf8')
  console.log(`已保存 ${outFile}，共 ${tracks.length} 首（按发行时间${desc ? '降序' : '升序'}）`)
}

const argv = process.argv.slice(2)
const byAlbum = argv.includes('--albums') || argv.includes('--by-album')
const [link, outFile = 'songs_by_time.csv', order = 'asc'] = argv.filter((a) => !a.startsWith('--'))
if (!link) {
  console.error('用法: node scripts/ncm-songs.mjs <歌单/歌手/专辑链接> [输出文件] [asc|desc] [--albums]')
  process.exit(1)
}
main(link, outFile, order === 'desc').catch((e) => {
  console.error(e)
  process.exit(1)
})
