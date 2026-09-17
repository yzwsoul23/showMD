/**
 * QQ音乐「跳转即播放」插件
 *
 * 与 ncm-jump 同一套思路，区别是 markdown 里直接粘贴 QQ音乐的**网页/分享链接**
 * （本身就是可正常打开的 https 链接，禁用 JS 或新标签页打开也不受影响）：
 *   [《专辑名》](https://i2.y.qq.com/n3/other/pages/details/album.html?albummid=003MS8RP1GyP9f)
 *   [《单曲名》](https://y.qq.com/n/ryqq_v2/songDetail/394060996)
 *   [歌单名](https://i2.y.qq.com/n3/other/pages/details/playlist.html?id=3632971993)
 * 也支持桌面版规范地址 https://y.qq.com/n/ryqq/(songDetail|albumDetail|album|playlist)/...
 *
 * QQ音乐有两类 ID（详见桌面 qqmusic.txt 笔记）：
 * - 字母数字混合的 *mid（songmid / albummid），新版详情页用；
 * - 纯数字 id（songid / 数字专辑ID / 歌单ID），老接口与分享页用。
 *
 * 唤起策略（社区常用 scheme，非完全官方，成功率随客户端版本变化，
 * 所以一律「先试 scheme、失败回网页」）：
 * - 单曲：qqmusic://qq.com/media/playSonglist?p={JSON}，mid 走 type:0 songmid，
 *   数字 id 走 type:1 songid，多数版本可直接自动播放；
 * - 专辑：qqmusic://album?id=<数字ID 或 albummid>（一般打开详情页）；
 * - 歌单：qqmusic://playlist?id=<数字ID>（一般打开歌单页）。
 * - 微信内置浏览器拦截 qqmusic://，不接管点击，让 https 兜底直接走网页。
 *
 * 事件委托挂在 document 上，SPA 路由切换无需重绑。
 */

type QqKind = 'song' | 'album' | 'playlist'
/** mid=字母数字混合 MID；id=纯数字 ID，决定单曲 scheme 用 type 0 还是 1 */
type IdType = 'mid' | 'id'

interface QqLink {
  kind: QqKind
  id: string
  idType: IdType
  /** 规范化后的网页版兜底地址 */
  webUrl: string
}

const TOAST_ID = 'rs-qq-toast'
const LAUNCH_LOCK_MS = 3000
/** 唤起检测窗口：期间页面没失焦就视为未安装，弹网页版确认气泡 */
const MOBILE_DETECT_MS = 2500
const DESKTOP_DETECT_MS = 4000
/** 网页版确认气泡停留时长：不点「转到网页版」就自动消失 */
const FALLBACK_TOAST_MS = 5000

const KIND_LABEL: Record<QqKind, string> = {
  song: '歌曲',
  album: '专辑',
  playlist: '歌单'
}

let lastLaunchAt = 0
let fallbackTimer: ReturnType<typeof setTimeout> | undefined

function clearFallbackTimer() {
  if (fallbackTimer !== undefined) {
    clearTimeout(fallbackTimer)
    fallbackTimer = undefined
  }
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** 微信内置浏览器会拦 qqmusic:// 协议，直接走网页链接最稳 */
function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent)
}

function isMid(id: string): boolean {
  return /\D/.test(id)
}

/**
 * 解析 QQ音乐链接。只认单曲 / 专辑 / 歌单三类详情页，其余（歌手页、短链等）
 * 返回 null 不接管。短链 c6.y.qq.com 打开后会 302 到详情页，不在此处理。
 */
export function parseQqLink(rawHref: string): QqLink | null {
  let url: URL
  try {
    url = new URL(rawHref, 'https://y.qq.com')
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (!/(^|\.)y\.qq\.com$/.test(host)) return null

  const seg = url.pathname.split('/').filter(Boolean)
  const q = url.searchParams

  // ---- 单曲 ----
  // y.qq.com/n/ryqq/songDetail/<songmid>
  // y.qq.com/n/ryqq_v2/songDetail/<数字songid>
  const songIdx = seg.findIndex((s) => s === 'songDetail')
  if (songIdx !== -1 && seg[songIdx + 1]) {
    const id = seg[songIdx + 1]
    return {
      kind: 'song',
      id,
      idType: isMid(id) ? 'mid' : 'id',
      webUrl: isMid(id)
        ? `https://y.qq.com/n/ryqq/songDetail/${id}`
        : `https://y.qq.com/n/ryqq_v2/songDetail/${id}`
    }
  }

  // 老播放页 i.y.qq.com/v8/playsong.html?songid=数字 或 &songmid=...
  if (seg.includes('v8') && seg.includes('playsong.html')) {
    const songmid = q.get('songmid')
    const songid = q.get('songid')
    if (songmid) {
      return {
        kind: 'song',
        id: songmid,
        idType: 'mid',
        webUrl: `https://y.qq.com/n/ryqq/songDetail/${songmid}`
      }
    }
    if (songid && /^\d+$/.test(songid)) {
      return {
        kind: 'song',
        id: songid,
        idType: 'id',
        webUrl: `https://y.qq.com/n/ryqq_v2/songDetail/${songid}`
      }
    }
  }

  // ---- 专辑 ----
  // i2.y.qq.com/n3/other/pages/details/album.html?albummid=003MS8RP1GyP9f
  if (seg.includes('details') && seg[seg.length - 1] === 'album.html') {
    const albummid = q.get('albummid') || q.get('albumMid')
    if (albummid) {
      return {
        kind: 'album',
        id: albummid,
        idType: isMid(albummid) ? 'mid' : 'id',
        webUrl: `https://y.qq.com/n/ryqq/albumDetail/${albummid}`
      }
    }
  }
  // y.qq.com/n/ryqq/albumDetail/<albummid>
  const albumDetailIdx = seg.findIndex((s) => s === 'albumDetail')
  if (albumDetailIdx !== -1 && seg[albumDetailIdx + 1]) {
    const id = seg[albumDetailIdx + 1]
    return {
      kind: 'album',
      id,
      idType: isMid(id) ? 'mid' : 'id',
      webUrl: `https://y.qq.com/n/ryqq/albumDetail/${id}`
    }
  }
  // y.qq.com/n/ryqq/album/<数字ID>
  const albumIdx = seg.findIndex((s) => s === 'album')
  if (albumIdx !== -1 && seg[albumIdx + 1]) {
    const id = seg[albumIdx + 1]
    if (/^\d+$/.test(id)) {
      return {
        kind: 'album',
        id,
        idType: 'id',
        webUrl: `https://y.qq.com/n/ryqq/album/${id}`
      }
    }
  }

  // ---- 歌单 ----
  // i2.y.qq.com/n3/other/pages/details/playlist.html?id=数字
  // y.qq.com/n/ryqq/playlist/<数字ID>
  const playlistIdx = seg.findIndex((s) => s === 'playlist')
  if (playlistIdx !== -1 && seg[playlistIdx + 1] && /^\d+$/.test(seg[playlistIdx + 1])) {
    const id = seg[playlistIdx + 1]
    return {
      kind: 'playlist',
      id,
      idType: 'id',
      webUrl: `https://y.qq.com/n/ryqq/playlist/${id}`
    }
  }
  if (seg.includes('details') && seg[seg.length - 1] === 'playlist.html') {
    const id = q.get('id')
    if (id && /^\d+$/.test(id)) {
      return {
        kind: 'playlist',
        id,
        idType: 'id',
        webUrl: `https://y.qq.com/n/ryqq/playlist/${id}`
      }
    }
  }

  return null
}

/** 构造客户端 scheme；花括号、引号全英文，不做整串 encode。
 *  单曲走 JSON 播放指令（多数版本可自动播）；专辑/歌单走简单 scheme，
 *  个别客户端版本不支持时由网页兜底。 */
function buildScheme({ kind, id }: QqLink): string {
  if (kind === 'song') {
    return `qqmusic://qq.com/media/playSonglist?p={"song":[{"songmid":"${id}"}]}`
  }
  if (kind === 'album') {
    // 优先试媒体 JSON 指令（部分版本可直接打开专辑），不支持的版本会被
    // 回退气泡引导到网页版。albumId 同时兼容 mid 与数字 id。
    return `qqmusic://qq.com/media/playAlbum?p={"albumId":"${id}","action":"play"}`
  }
  // 歌单：简单 scheme 社区常用，多数版本能打开歌单页
  return `qqmusic://playlist?id=${id}`
}

function showToast(text: string) {
  clearFallbackTimer()
  let toast = document.getElementById(TOAST_ID)
  if (!toast) {
    toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.className = 'rs-ncm-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = text
  // 强制一次重排后再加类，保证进场上浮动画能触发
  void toast.offsetHeight
  toast.classList.add('is-show')
}

function hideToast() {
  document.getElementById(TOAST_ID)?.classList.remove('is-show')
}

/** 未检测到客户端：不自动跳网页，点按钮才去，5 秒不点自动消失 */
function showFallbackToast(webUrl: string) {
  clearFallbackTimer()
  let toast = document.getElementById(TOAST_ID)
  if (!toast) {
    toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.className = 'rs-ncm-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = ''
  const msg = document.createElement('span')
  msg.textContent = '未检测到QQ音乐客户端'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'rs-ncm-toast-btn'
  btn.textContent = '转到网页版'
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    clearFallbackTimer()
    window.location.href = webUrl
  })
  toast.append(msg, btn)
  void toast.offsetHeight
  toast.classList.add('is-show')
  fallbackTimer = setTimeout(hideToast, FALLBACK_TOAST_MS)
}

function launch(link: QqLink) {
  const now = Date.now()
  if (now - lastLaunchAt < LAUNCH_LOCK_MS) return
  lastLaunchAt = now

  const appUrl = buildScheme(link)

  showToast('正在唤起QQ音乐客户端…')
  let hasLeft = false
  const markLeft = () => {
    hasLeft = true
  }
  window.addEventListener('blur', markLeft)
  document.addEventListener('visibilitychange', markLeft)

  const cleanup = () => {
    window.removeEventListener('blur', markLeft)
    document.removeEventListener('visibilitychange', markLeft)
  }

  // 只用 document.hidden 判断是否真的切到了客户端；hasFocus() 在浏览器弹
  // 「是否打开 QQ 音乐」对话框时会返回 false，会把未唤起误判为已唤起，
  // 导致回退气泡不出现，所以这里不用它。
  const leftNow = () => document.hidden

  window.location.href = appUrl

  window.setTimeout(() => {
    cleanup()
    // 「从客户端切回浏览器」时收起提示/气泡。两种情形共用：
    // ① 已切到 App（此刻页面 hidden）：用户回来时收起「正在唤起」；
    // ② 判定未安装、气泡已显示：客户端若冷启动较慢、用户稍后切走又回来，
    //    顺手收起气泡；一直停在页面则由 fallbackTimer 5 秒后自动消失。
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        hideToast()
        clearFallbackTimer()
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    if (leftNow()) {
      document.addEventListener('visibilitychange', onVisible)
      return
    }
    showFallbackToast(link.webUrl)
    document.addEventListener('visibilitychange', onVisible)
  }, isMobile() ? MOBILE_DETECT_MS : DESKTOP_DETECT_MS)
}

export function setupQqJump() {
  if (typeof document === 'undefined') return

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const anchor = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href*="y.qq.com/"]'
    )
    if (!anchor) return

    const parsed = parseQqLink(anchor.getAttribute('href') ?? '')
    if (!parsed) return // 歌手页、短链等不接管，按普通网页链接打开
    // 微信拦自定义协议：不阻止默认行为，让 https 网页直接兜底
    if (isWeChat()) return

    e.preventDefault()
    launch(parsed)
  })

  document.addEventListener('mouseover', (e) => {
    const anchor = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href*="y.qq.com/"]'
    )
    if (!anchor || anchor.title) return
    const parsed = parseQqLink(anchor.getAttribute('href') ?? '')
    if (!parsed) return
    anchor.title = `在QQ音乐客户端打开${KIND_LABEL[parsed.kind]}并播放（未安装或微信内则打开网页版）`
  })
}
