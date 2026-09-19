/**
 * QQ 音乐「跳转即播放」插件
 *
 * Markdown 里写一条普通链接即可调用，无需任何组件：
 *   [QQ音乐可听](qqmusic://qq.com/media/playSonglist?p={"song":[{"songmid":"MID","type":"0"}],"action":"play"})
 *
 * 行为策略（与 ncm-jump 分工不同）：
 * - 手机端：location.href 触发 qqmusic:// 协议尝试唤起 App，800ms 内页面
 *   没有失焦/隐藏就视为未唤起，弹 5 秒确认气泡，点「转到网页版」才跳
 *   y.qq.com 歌曲详情页——不自动跳，兜住「其实已唤起、只是检测误判」；
 * - 桌面端：不折腾客户端唤起，点击后直接弹确认气泡问要不要去网页版。
 *
 * 提示条复用 ncm-jump 的 .rs-ncm-toast 样式（类名只是样式钩子，
 * id 独立为 rs-qq-toast，两个平台不会同时弹，互不干扰）。
 * 事件委托挂在 document 上，SPA 路由切换无需重绑。
 */

const LINK_RE = /"songmid"\s*:\s*"([^"]+)"/i
const TOAST_ID = 'rs-qq-toast'
const LAUNCH_LOCK_MS = 3000
/** 唤起检测窗口：用户指定 800ms，期间页面没失焦就视为未唤起，弹网页版确认气泡 */
const MOBILE_DETECT_MS = 800
/** 网页版确认气泡停留时长：不点「转到网页版」就自动消失 */
const FALLBACK_TOAST_MS = 5000

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

/** 解析 songmid；markdown-it 会把 href 里的引号编码成 %22，先解码再匹配 */
function parseSongmid(href: string): string | null {
  let raw = href
  try {
    raw = decodeURIComponent(href)
  } catch {
    // 编码异常时用原文兜底匹配
  }
  return LINK_RE.exec(raw)?.[1] ?? null
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
  // 强制一次重排后再加类，保证进场上浮动画能触发
  void toast.offsetHeight
  toast.classList.add('is-show')
  fallbackTimer = setTimeout(hideToast, FALLBACK_TOAST_MS)
}

/**
 * 移动端唤起客户端并做网页版回退；桌面端直接弹网页版确认气泡。
 * 页面失焦/隐藏 = 系统弹出了「打开QQ音乐？」对话框或已切到 App；
 * 除事件标志外再用 document.hidden 实时兜底（浏览器弹外部协议对话框时
 * hasFocus 会误报 false，切到客户端时 document.hidden 才为 true）。
 */
function launch(songmid: string) {
  const now = Date.now()
  if (now - lastLaunchAt < LAUNCH_LOCK_MS) return
  lastLaunchAt = now

  const webUrl = `https://y.qq.com/n/ryqq/songDetail/${songmid}`

  if (!isMobile()) {
    showFallbackToast(webUrl)
    return
  }

  const appUrl = `qqmusic://qq.com/media/playSonglist?p={"song":[{"songmid":"${songmid}","type":"0"}],"action":"play"}`

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

  window.location.href = appUrl

  window.setTimeout(() => {
    cleanup()
    // 「从客户端切回浏览器」时收起提示/气泡（与 ncm-jump 同款兜底）：
    // 已唤起时页面 hidden，用户切回来自动收起；判定未安装弹的气泡，
    // 若客户端冷启动较慢稍后夺走焦点，用户切回时同样收起
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        hideToast()
        clearFallbackTimer()
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    if (hasLeft || document.hidden) {
      document.addEventListener('visibilitychange', onVisible)
      return
    }
    // 不自动跳网页版：弹 5 秒确认气泡，点击才转
    showFallbackToast(webUrl)
    document.addEventListener('visibilitychange', onVisible)
  }, MOBILE_DETECT_MS)
}

export function setupQqJump() {
  if (typeof document === 'undefined') return

  // 点击委托：识别 QQ 音乐播放协议链接并唤起/提示
  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="qqmusic://"]'
    )
    if (!link) return

    // 拖选（桌面）或长按选择（移动端）选中了胶囊文字时，属于复制歌名场景：
    // 只阻止 qqmusic:// 协议的默认跳转、不唤起客户端，保留用户选区；
    // 普通单击时 mousedown 会先把选区折叠，这里读到的是空选区，正常唤起
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().length > 0) {
      e.preventDefault()
      return
    }

    const songmid = parseSongmid(link.getAttribute('href') ?? '')
    if (!songmid) return

    e.preventDefault()
    launch(songmid)
  })

  // 悬停时补一个说明 title（不想把提示写死进每个 markdown 链接）
  document.addEventListener('mouseover', (e) => {
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="qqmusic://"]'
    )
    if (!link || link.title) return
    if (!parseSongmid(link.getAttribute('href') ?? '')) return
    link.title = '在QQ音乐客户端播放（未检测到客户端时提示跳网页版）'
  })
}
