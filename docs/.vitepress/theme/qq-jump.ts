/**
 * QQ 音乐「跳转即播放」插件
 *
 * Markdown 里写一条普通链接即可调用，无需任何组件：
 *   [QQ音乐可听](qqmusic://qq.com/media/playSonglist?p={"song":[{"songmid":"MID","type":"0"}],"action":"play"})
 *
 * 行为策略（方案 A：官方页为主，scheme 仅作 markdown 数据载体）：
 * - qqmusic://...playSonglist 带 action:play 的协议是逆向形态，运行时
 *   不再使用；插件只从中提取 songmid，拼官方详情页地址；
 * - 手机端：直接导航官方歌曲详情页 y.qq.com/n/ryqq/songDetail/<mid>，
 *   装了 App 由官方页提供唤起入口，没装页面本身可听——「装没装、怎么
 *   回退」全交给官方，不再手写定时器探测；
 * - 桌面端：点击后弹确认气泡问要不要去网页版（官方页无自动播放，
 *   不折腾客户端唤起）。
 *
 * 提示条复用 ncm-jump 的 .rs-ncm-toast 样式（类名只是样式钩子，
 * id 独立为 rs-qq-toast，两个平台不会同时弹，互不干扰）。
 * 事件委托挂在 document 上，SPA 路由切换无需重绑。
 */

const LINK_RE = /"songmid"\s*:\s*"([^"]+)"/i
const TOAST_ID = 'rs-qq-toast'
const LAUNCH_LOCK_MS = 3000
/** 网页版确认气泡停留时长：不点「转到网页版」就自动消失 */
const FALLBACK_TOAST_MS = 5000

let lastLaunchAt = 0
/** 当前提示（确认气泡 / 复制提示共用）的自动消失定时器 */
let autoHideTimer: ReturnType<typeof setTimeout> | undefined

function clearAutoHideTimer() {
  if (autoHideTimer !== undefined) {
    clearTimeout(autoHideTimer)
    autoHideTimer = undefined
  }
}

/** 安排提示在 ms 后自动消失 */
function armAutoHide(ms: number) {
  clearAutoHideTimer()
  autoHideTimer = setTimeout(() => {
    autoHideTimer = undefined
    hideToast()
  }, ms)
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

function hideToast() {
  document.getElementById(TOAST_ID)?.classList.remove('is-show')
}

/** 复制成功提示：有 songmid 时附「打开网页版」按钮，点击直达官方详情页 */
function showCopyToast(titleText: string, webUrl?: string) {
  let toast = document.getElementById(TOAST_ID)
  if (!toast) {
    toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.className = 'rs-ncm-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = ''
  const msg = document.createElement('span')
  msg.textContent = `已复制歌名请前往qq音乐搜索：${titleText}`
  toast.append(msg)
  if (webUrl) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rs-ncm-toast-btn'
    btn.textContent = '打开网页版'
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      clearAutoHideTimer()
      window.location.href = webUrl
    })
    toast.append(btn)
  }
  // 强制一次重排后再加类，保证进场上浮动画能触发
  void toast.offsetHeight
  toast.classList.add('is-show')
  // 带按钮时与确认气泡同长（5s），给用户留点击时间
  armAutoHide(FALLBACK_TOAST_MS)
}

/**
 * 「未检测到客户端」确认气泡：不自动跳转，点按钮才去网页版，
 * FALLBACK_TOAST_MS 内不点就自动消失。
 */
function showFallbackToast(webUrl: string) {
  let toast = document.getElementById(TOAST_ID)
  if (!toast) {
    toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.className = 'rs-ncm-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = ''
  const msg = document.createElement('span')
  msg.textContent = '前往QQ音乐网页版收听'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'rs-ncm-toast-btn'
  btn.textContent = '转到网页版'
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    clearAutoHideTimer()
    window.location.href = webUrl
  })
  toast.append(msg, btn)
  // 强制一次重排后再加类，保证进场上浮动画能触发
  void toast.offsetHeight
  toast.classList.add('is-show')
  armAutoHide(FALLBACK_TOAST_MS)
}

/**
 * 移动端直接导航官方歌曲详情页（唤起/回退由官方页负责）；
 * 桌面端官方网页版无自动播放，弹确认气泡问要不要去网页版。
 */
function launch(songmid: string) {
  const now = Date.now()
  if (now - lastLaunchAt < LAUNCH_LOCK_MS) return
  lastLaunchAt = now

  const webUrl = `https://y.qq.com/n/ryqq/songDetail/${songmid}`

  // 移动端：官方详情页自带唤起入口，且本身就是可听的网页版，
  // 不再用 qqmusic:// 逆向协议 + 定时器猜「装没装」
  if (isMobile()) {
    window.location.href = webUrl
    return
  }

  showFallbackToast(webUrl)
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  // 老浏览器兜底：textarea + execCommand
  return new Promise((resolve) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* 忽略 */
    }
    document.body.removeChild(ta)
    resolve()
  })
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

  // QQ 音乐网页短链（c6.y.qq.com）点击策略：
  // - 桌面端：无法唤起 App，点击后复制 data-qq-copy 里的「歌名+歌手」，
  //   弹提示引导用户去 QQ 音乐搜索；
  // - 移动端：c6.y.qq.com 短链可直接唤起 QQ 音乐 App，不阻止默认跳转。
  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[data-qq-copy]'
    )
    if (!link) return

    const copyText = link.getAttribute('data-qq-copy') ?? ''
    const titleText = link.getAttribute('data-qq-title') ?? copyText
    const songmid = link.getAttribute('data-songmid') ?? ''
    if (!copyText) return

    if (isMobile()) {
      // 移动端：有 songmid 时直接导航官方详情页（官方页负责唤起/网页版），
      // 不走 c6 短链；没有 songmid 时交给浏览器走 c6 短链兜底
      if (songmid) {
        e.preventDefault()
        launch(songmid)
      }
      return
    }

    e.preventDefault()
    void copyToClipboard(copyText).then(() => {
      showCopyToast(
        titleText,
        songmid ? `https://y.qq.com/n/ryqq/songDetail/${songmid}` : undefined
      )
    })
  })

  // 悬停时补一个说明 title（不想把提示写死进每个 markdown 链接）
  document.addEventListener('mouseover', (e) => {
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="qqmusic://"]'
    )
    if (!link || link.title) return
    if (!parseSongmid(link.getAttribute('href') ?? '')) return
    link.title = '前往QQ音乐网页版收听'
  })

  // data-qq-copy 链接的悬停提示
  document.addEventListener('mouseover', (e) => {
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[data-qq-copy]'
    )
    if (!link || link.title) return
    link.title = isMobile()
      ? '前往QQ音乐网页版收听'
      : '点击复制歌名，前往QQ音乐搜索'
  })
}
