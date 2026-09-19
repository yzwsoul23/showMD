/**
 * 网易云音乐歌曲批量导出工具
 *
 * 输入一个歌单 / 专辑链接，批量拉取歌曲，
 * 补全专辑发行时间 al.publishTime，按发行时间排序，
 * 输出带 publishDate / publishMs 的 CSV（纯 UTF-8 无 BOM）。
 *
 * 用法：
 *   node scripts/ncm-songs.mjs "https://music.163.com/playlist?id=3778678" out.csv asc
 *   node scripts/ncm-songs.mjs "https://music.163.com/artist?id=12345"     out.csv desc
 *   node scripts/ncm-songs.mjs "https://music.163.com/album?id=12345"      out.csv desc
 *
 * 参数：
 *   link     歌单或专辑链接（必填）
 *   outFile  输出 CSV 路径（默认 songs_by_time.csv）
 *   order    asc 升序 / desc 降序（默认 asc）
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

/** 判断当前是否带登录态（cookie）。专辑详情接口 -462 表示需要绑定手机 */
let authChecked = false
let hasAuth = false
async function checkAuth() {
  if (authChecked) return hasAuth
  authChecked = true
  try {
    const d = await getJSON(`/api/album/1?ext=true&limit=1`)
    hasAuth = d.code !== -462
  } catch {
    hasAuth = false
  }
  return hasAuth
}

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

/** 歌手热门歌曲（免登录，最多 50 首）：/api/artist/{uid} 返回 hotSongs */
async function artistHotSongs(uid) {
  const d = await getJSON(`/api/artist/${uid}`)
  return d.hotSongs || []
}

/** 歌手全部歌曲：遍历所有专辑再逐专辑取歌（最全，需登录态）。
 *  无登录态时回退到热门 50 首。 */
async function artistTracks(uid) {
  const authed = await checkAuth()
  if (!authed) {
    console.log('[info] 未检测到登录态，回退到歌手热门 50 首（全量需 NCM_COOKIE）')
    return artistHotSongs(uid)
  }

  let albums = []
  let offset = 0
  let guard = 0
  while (guard++ < 50) {
    const d = await getJSON(`/api/artist/albums/${uid}?offset=${offset}&limit=50`)
    const list = d.hotAlbums || []
    if (!list.length) break
    albums = albums.concat(list)
    offset += 50
    await sleep(200)
  }
  const out = []
  for (const al of albums) {
    const s = await albumTracks(al.id)
    out.push(...s)
    await sleep(200)
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
    tracks = await artistTracks(pickId(link, 'artist'))
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

const [, , link, outFile = 'songs_by_time.csv', order = 'asc'] = process.argv
if (!link) {
  console.error('用法: node scripts/ncm-songs.mjs <歌单/歌手/专辑链接> [输出文件] [asc|desc]')
  process.exit(1)
}
main(link, outFile, order === 'desc').catch((e) => {
  console.error(e)
  process.exit(1)
})
