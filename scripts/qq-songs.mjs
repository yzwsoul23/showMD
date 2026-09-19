/**
 * QQ 音乐歌曲批量导出工具
 *
 * 输入一个歌单 / 专辑 / 歌手链接，批量拉取歌曲，
 * 补全专辑发行时间 publicTime，按发行时间排序，
 * 输出带 publishDate / publishMs 的 CSV（纯 UTF-8 无 BOM）。
 * 公开 fcgi 接口，免登录、免 cookie。
 *
 * 用法：
 *   node scripts/qq-songs.mjs "https://y.qq.com/n/ryqq/playlist/9485452162" out.csv asc
 *   node scripts/qq-songs.mjs "https://y.qq.com/n/ryqq/album/002LiyZW27dGjC"   out.csv asc
 *   node scripts/qq-songs.mjs "https://y.qq.com/n/ryqq/singer/0025NhlN2yWrP4"  out.csv desc
 *
 * 参数：
 *   link     歌单 / 专辑 / 歌手链接（必填，地址栏链接或分享链接均可）
 *   outFile  输出 CSV 路径（默认 qq_songs_by_time.csv）
 *   order    asc 升序 / desc 降序（默认 asc）
 */

import { writeFileSync } from 'node:fs'

const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Referer: 'https://y.qq.com/'
}

const COMMON = 'g_tk=0&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** QQ fcgi 偶尔返回 jsonp 包裹，JSON 直解失败时剥一层 callback(...) */
async function getJSON(url) {
  const r = await fetch(url, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  const txt = (await r.text()).trim()
  try {
    return JSON.parse(txt)
  } catch {
    const m = txt.match(/^[\w$.]+\(([\s\S]*)\)\s*;?$/)
    if (!m) throw new Error(`返回内容不是 JSON：${url}\n${txt.slice(0, 120)}`)
    return JSON.parse(m[1])
  }
}

// 专辑接口 singer 是对象数组，歌单接口 singer 是字符串数组，两种都兼容
const singerNames = (arr) => (arr || []).map((s) => (typeof s === 'string' ? s : s && s.name) || '').join('/')

/** 统一曲目结构；部分接口把字段嵌在 track_info 里 */
function normalizeSong(s, album = {}) {
  const t = s.track_info || s
  return {
    songmid: t.songmid || t.mid || '',
    songid: t.songid || t.id || '',
    songname: t.songname || t.name || '',
    singers: singerNames(t.singer),
    albumname: album.name || t.albumname || '',
    albummid: album.mid || t.albummid || '',
    albumid: album.id || t.albumid || '',
    interval: toSeconds(t.interval),
    publishRaw: t.time_public || album.aDate || album.publicTime || album.publishTime || ''
  }
}

function toSeconds(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  if (!isNaN(n)) return n
  const m = String(v).match(/^(\d+):(\d{1,2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

/* ---------- 链接解析 ---------- */

function parseQQLink(raw) {
  const u = new URL(raw.includes('://') ? raw : 'https://y.qq.com/' + raw)
  // 新版地址栏路径式：/n/ryqq/(playlist|album|singer)/<id>
  const m = u.pathname.match(/\/(playlist|album|singer)\/([\w-]+)/)
  if (m) return { type: m[1], id: m[2] }
  // 老版 / 分享页：hash 或 search 里的 id / albummid / disstid / singermid
  const hash = decodeURIComponent(u.hash.replace(/^#/, ''))
  const sp = new URLSearchParams(hash.includes('=') ? (hash.split('?')[1] || '') : u.search)
  const text = `${u.pathname} ${hash} ${u.search}`
  if (/playlist/.test(text)) {
    const id = sp.get('id') || sp.get('disstid')
    if (id) return { type: 'playlist', id }
  }
  if (/album/.test(text)) {
    const id = sp.get('id') || sp.get('albummid') || sp.get('albumMid')
    if (id) return { type: 'album', id }
  }
  if (/singer|musician/i.test(text)) {
    const id = sp.get('id') || sp.get('singermid') || sp.get('singerMid')
    if (id) return { type: 'singer', id }
  }
  if (/^\d+$/.test(raw.trim())) return { type: 'playlist', id: raw.trim() }
  return null
}

/* ---------- 数据来源 ---------- */

/** 歌单：disstid -> cdlist[0].songlist（通常不含发行时间，稍后按专辑回补） */
async function playlistTracks(disstid) {
  const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${disstid}`
  const d = await getJSON(url)
  const cd = (d.cdlist && d.cdlist[0]) || {}
  return (cd.songlist || []).map((s) => normalizeSong(s))
}

/** 专辑元数据：优先 albummid；纯数字 id 先按 mid 试、查无专辑再回退 albumid。
 *  版权限制专辑 code=404 但 data 里仍带 aDate/name（list 为 null），照常返回。 */
async function fetchAlbum(id, byMid = /[A-Za-z]/.test(id), isRetry = false) {
  const key = byMid ? 'albummid' : 'albumid'
  const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?${key}=${encodeURIComponent(id)}&${COMMON}`
  const d = await getJSON(url)
  // 新结构专辑元数据在 d.data，老结构在 d.album
  const al = d.data || d.album || {}
  if (!al.mid && !al.name) {
    if (byMid && /^\d+$/.test(id) && !isRetry) {
      await sleep(150)
      return fetchAlbum(id, false, true)
    }
    throw new Error(`专辑 ${id} 查询失败${d.message ? `（${d.message}）` : ''}`)
  }
  return al
}

async function albumTracks(id, byMid) {
  const al = await fetchAlbum(id, byMid)
  const list = al.list || al.songlist || []
  return list.map((s) => normalizeSong(s, al))
}

/** 歌手：singermid -> 专辑列表(order=time) -> 逐专辑取歌 */
async function singerTracks(singermid) {
  let albums = []
  let begin = 0
  let guard = 0
  while (guard++ < 50) {
    const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_singer_album.fcg?singermid=${singermid}&order=time&begin=${begin}&num=50&${COMMON}`
    const d = await getJSON(url)
    const list = (d.data && d.data.list) || d.list || []
    if (!list.length) break
    albums = albums.concat(list)
    if (list.length < 50) break
    begin += 50
    await sleep(200)
  }
  const out = []
  for (const a of albums) {
    const mid = a.albumMID || a.album_mid || a.mid
    if (!mid) continue
    try {
      const tr = await albumTracks(mid)
      // 专辑列表本身也带 pubTime/aDate，专辑接口没给时兜底
      if (!tr[0] || !tr[0].publishRaw) {
        const pub = a.pubTime || a.publicTime || a.aDate || ''
        tr.forEach((t) => { if (!t.publishRaw) t.publishRaw = pub })
      }
      out.push(...tr)
    } catch (e) {
      console.warn(`  [warn] 专辑 ${mid} 拉取失败：${e.message}`)
    }
    await sleep(200)
  }
  return out
}

/** 歌单没有单曲发行时间：按专辑去重，回查每张专辑的 publicTime */
async function fillPlaylistPublish(rows) {
  const cache = new Map()
  for (const r of rows) {
    if (r.publishRaw || !r.albummid) continue
    if (!cache.has(r.albummid)) {
      let pub = ''
      try {
        const al = await fetchAlbum(r.albummid)
        pub = al.aDate || al.publicTime || al.publishTime || ''
      } catch (e) {
        console.warn(`  [warn] 专辑 ${r.albummid} 发行时间回查失败：${e.message}`)
      }
      cache.set(r.albummid, pub)
      await sleep(150)
    }
    r.publishRaw = cache.get(r.albummid)
  }
}

/* ---------- 发行时间 / 排序 / CSV ---------- */

/** 兼容 yyyy-MM-dd / yyyy.M.d / 秒 / 毫秒；纯日期按本地时区解析，避免 UTC 跨日 */
function publishMs(v) {
  if (v == null || v === '') return 0
  let ms = 0
  if (typeof v === 'number') {
    ms = v > 1e12 ? v : v * 1000
  } else {
    const str = String(v).trim()
    if (/^\d{10,13}$/.test(str)) {
      const n = Number(str)
      ms = str.length === 10 ? n * 1000 : n
    } else {
      const dm = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
      if (dm) ms = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])).getTime()
      else {
        const t = Date.parse(str.replace(/[./]/g, '-'))
        ms = isNaN(t) ? 0 : t
      }
    }
  }
  // QQ 音乐用 1899 年作为「未知发行时间」占位，按无日期处理（沉底）
  if (ms && new Date(ms).getFullYear() < 1900) return 0
  return ms
}

function fmtDate(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function sortByPublish(rows, desc = false) {
  return rows.slice().sort((a, b) => {
    const pa = publishMs(a.publishRaw)
    const pb = publishMs(b.publishRaw)
    // 没有发布时间的沉底（不论升序降序）
    if (!pa && !pb) return 0
    if (!pa) return 1
    if (!pb) return -1
    return desc ? pb - pa : pa - pb
  })
}

const csvField = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`

function qqScheme(songmid) {
  const p = JSON.stringify({ song: [{ type: '0', songmid }], action: 'play' })
  return `qqmusic://qq.com/media/playSonglist?p=${p}`
}

function toCSV(rows) {
  const head = [
    'publishDate', 'publishMs', 'songmid', 'songId', 'title', 'artists',
    'albummid', 'albumId', 'album', 'durationSec', 'qqmusic', 'webUrl'
  ]
  const lines = [head.map(csvField).join(',')]
  const seen = new Set()
  for (const r of rows) {
    if (!r.songmid) continue
    const key = r.songmid + '|' + r.albummid
    if (seen.has(key)) continue
    seen.add(key)
    const ms = publishMs(r.publishRaw)
    lines.push([
      fmtDate(ms), ms || '',
      r.songmid, r.songid, r.songname, r.singers,
      r.albummid, r.albumid, r.albumname,
      r.interval || '',
      qqScheme(r.songmid),
      `https://y.qq.com/n/ryqq/songDetail/${r.songmid}`
    ].map(csvField).join(','))
  }
  return lines.join('\r\n')
}

/* ---------- 入口 ---------- */

async function main(link, outFile, desc) {
  const p = parseQQLink(link)
  if (!p) {
    console.warn('无法解析链接，只支持歌单(playlist) / 专辑(album) / 歌手(singer)链接')
    process.exit(1)
  }
  let rows = []
  if (p.type === 'playlist') {
    rows = await playlistTracks(p.id)
    console.log(`[歌单] ${p.id} -> ${rows.length} 首，开始按专辑回查发行时间……`)
    await fillPlaylistPublish(rows)
  } else if (p.type === 'album') {
    rows = await albumTracks(p.id)
  } else if (p.type === 'singer') {
    if (/^\d+$/.test(p.id)) {
      console.warn('歌手链接需要地址栏里字母数字混合的 singermid（如 /n/ryqq/singer/0025NhlN2yWrP4），纯数字 ID 不支持')
      process.exit(1)
    }
    rows = await singerTracks(p.id)
  }
  rows = sortByPublish(rows, desc)
  writeFileSync(outFile, toCSV(rows), 'utf8')
  console.log(`已保存 ${outFile}，共 ${rows.length} 首（按发行时间${desc ? '降序' : '升序'}）`)
}

const [, , link, outFile = 'qq_songs_by_time.csv', order = 'asc'] = process.argv
if (!link) {
  console.error('用法: node scripts/qq-songs.mjs <歌单/专辑/歌手链接> [输出文件] [asc|desc]')
  process.exit(1)
}
main(link, outFile, order === 'desc').catch((e) => {
  console.error(e)
  process.exit(1)
})
