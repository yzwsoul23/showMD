/**
 * 网易云音乐「跳转即播放」插件
 *
 * Markdown 里写一条普通链接即可调用，无需任何组件：
 *   [《CSC》](orpheus://song/5252838)              单曲
 *   [《亚特兰蒂斯》](orpheus://album/140566771)    专辑
 *   [歌单名](orpheus://playlist/2030267115)        歌单
 *   旧写法 orpheus://song/123/?autoplay=1 也兼容，自动归一化
 *
 * 原理（参考 https://github.com/a2942/163MusicJump 与网易云 PC Scheme 研究）：
 * - 手机端：orpheus://<类型>/<id> 即可唤起 App；
 * - PC 客户端不认 ?autoplay=1，能打开但不播放。自动播放要下发
 *   Base64 JSON 指令：orpheus://<base64({type,id,cmd:'play'})>。
 *   song / playlist 已被实测支持；album 指令为同构推断，个别客户端版本
 *   若不支持自动播放也会正常打开专辑详情页；
 * - 未安装客户端时用 blur / visibilitychange 心跳检测。桌面端窗口放宽到
 *   4s：协议已被「始终允许」时客户端冷启动要数秒才夺走浏览器焦点，窗口
 *   太短会把已唤起误判为未安装；
 * - 检测不到唤起时不再自动跳网页版，而是弹一个 5 秒的确认气泡，点击
 *   「转到网页版」才会跳，不点过时自动消失——把跳不跳的选择权交给用户，
 *   也兜住「客户端其实已唤起、只是焦点检测误判」的场景。
 *
 * 事件委托挂在 document 上（与灯箱同一套思路），SPA 路由切换无需重绑。
 */

type NcmKind = 'song' | 'album' | 'playlist'

const LINK_RE = /^orpheus:\/\/(song|album|playlist)\/(\d+)/i
const TOAST_ID = 'rs-ncm-toast'
const LAUNCH_LOCK_MS = 3000

/** 唤起检测窗口：期间页面没失焦就视为未安装，弹网页版确认气泡 */
const MOBILE_DETECT_MS = 2500
const DESKTOP_DETECT_MS = 4000
/** 网页版确认气泡停留时长：不点「转到网页版」就自动消失 */
const FALLBACK_TOAST_MS = 5000

/** 各类型的网页版回退地址与中文叫法 */
const KIND_META: Record<NcmKind, { webPath: string; label: string }> = {
  song: { webPath: 'song', label: '歌曲' },
  album: { webPath: 'album', label: '专辑' },
  playlist: { webPath: 'playlist', label: '歌单' }
}

let lastLaunchAt = 0
/** 网页版确认气泡的自动消失定时器（新气泡顶掉旧气泡前先清掉） */
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

/** 解析 href，返回类型与 ID；不认识的协议返回 null */
function parseLink(href: string): { kind: NcmKind; id: string } | null {
  const m = LINK_RE.exec(href)
  if (!m) return null
  return { kind: m[1].toLowerCase() as NcmKind, id: m[2] }
}

/** PC 端自动播放协议：Base64 编码的 JSON 指令（内容全 ASCII，btoa 安全） */
function buildDesktopUri(kind: NcmKind, id: string) {
  const cmd = JSON.stringify({ type: kind, id, cmd: 'play' })
  return `orpheus://${btoa(cmd)}`
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

/**
 * 「未检测到客户端」确认气泡：不自动跳转，点按钮才去网页版，
 * FALLBACK_TOAST_MS 内不点就自动消失。
 */
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
  msg.textContent = '未检测到网易云音乐客户端'
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
  // 强制一次重排后再加类，保证进场上浮动画能触发
  void toast.offsetHeight
  toast.classList.add('is-show')
  fallbackTimer = setTimeout(hideToast, FALLBACK_TOAST_MS)
}

/**
 * 唤起客户端并做网页版回退。
 * - 页面失焦/隐藏 = 系统弹出了「打开网易云音乐？」对话框或已切到 App；
 * - PC 客户端冷启动要数秒才夺走浏览器焦点，桌面端检测窗口放宽到 4s，
 *   移动端切 App 很快，保持 2.5s；
 * - 判定时除事件标志外，再用 document.hidden / hasFocus() 实时兜底
 *   （blur 可能因浏览器差异延迟或不触发）；判定为未安装时也不自动跳
 *   网页版，而是弹确认气泡让用户决定，误判场景下不点即可。
 */
function launch(kind: NcmKind, id: string) {
  const now = Date.now()
  if (now - lastLaunchAt < LAUNCH_LOCK_MS) return
  lastLaunchAt = now

  const meta = KIND_META[kind]
  const appUrl = isMobile()
    ? `orpheus://${kind}/${id}`
    : buildDesktopUri(kind, id)
  const webUrl = `https://music.163.com/#/${meta.webPath}?id=${id}`

  showToast('正在唤起网易云音乐客户端…')
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

  /** 实时兜底判断：页面是否已因唤起客户端而离开前台 */
  const leftNow = () => hasLeft || document.hidden || !document.hasFocus()

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
    // 不自动跳网页版：弹 5 秒确认气泡，点击才转；若客户端其实刚被
    // 唤起、稍后才夺走焦点，用户切回浏览器时气泡会被自动收起
    showFallbackToast(webUrl)
    document.addEventListener('visibilitychange', onVisible)
  }, isMobile() ? MOBILE_DETECT_MS : DESKTOP_DETECT_MS)
}

export function setupNcmJump() {
  if (typeof document === 'undefined') return

  // 点击委托：识别歌曲/专辑/歌单链接并改写为平台对应的播放协议
  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="orpheus://"]'
    )
    if (!link) return

    const parsed = parseLink(link.getAttribute('href') ?? '')
    if (!parsed) return // 其他 orpheus 协议（歌手/MV 等）不接管，走默认打开

    e.preventDefault()
    launch(parsed.kind, parsed.id)
  })

  // 悬停时补一个说明 title（不想把提示写死进每个 markdown 链接）
  document.addEventListener('mouseover', (e) => {
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="orpheus://"]'
    )
    if (!link || link.title) return
    const parsed = parseLink(link.getAttribute('href') ?? '')
    if (!parsed) return
    link.title = `在网易云音乐客户端打开${KIND_META[parsed.kind].label}并播放（未安装则打开网页版）`
  })
}
