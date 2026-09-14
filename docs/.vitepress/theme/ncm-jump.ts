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
 * - 未安装客户端时用 blur / visibilitychange 心跳检测，2.5s 后回退网页版，
 *   避免点击后页面毫无反应。
 *
 * 事件委托挂在 document 上（与灯箱同一套思路），SPA 路由切换无需重绑。
 */

type NcmKind = 'song' | 'album' | 'playlist'

const LINK_RE = /^orpheus:\/\/(song|album|playlist)\/(\d+)/i
const TOAST_ID = 'rs-ncm-toast'
const LAUNCH_LOCK_MS = 3000

/** 各类型的网页版回退地址与中文叫法 */
const KIND_META: Record<NcmKind, { webPath: string; label: string }> = {
  song: { webPath: 'song', label: '歌曲' },
  album: { webPath: 'album', label: '专辑' },
  playlist: { webPath: 'playlist', label: '歌单' }
}

let lastLaunchAt = 0

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
 * 唤起客户端并做网页版回退。
 * 页面失焦/隐藏说明系统弹出了「打开网易云音乐？」对话框或已切到 App；
 * 2.5s 内页面始终在前台 = 大概率没装客户端，跳网页版。
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
  const start = Date.now()
  let hasLeft = false
  const onLeave = () => {
    hasLeft = true
  }
  window.addEventListener('blur', onLeave, { once: true })
  document.addEventListener('visibilitychange', onLeave, { once: true })

  window.location.href = appUrl

  window.setTimeout(() => {
    window.removeEventListener('blur', onLeave)
    document.removeEventListener('visibilitychange', onLeave)
    if (!hasLeft && Date.now() - start < 3500) {
      showToast('未检测到客户端，正在打开网页版…')
      window.setTimeout(() => {
        window.location.href = webUrl
      }, 800)
    } else {
      // 已唤起：用户切回浏览器时再收起提示
      if (document.visibilityState === 'visible') {
        hideToast()
      } else {
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            hideToast()
            document.removeEventListener('visibilitychange', onVisible)
          }
        }
        document.addEventListener('visibilitychange', onVisible)
      }
    }
  }, 2500)
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
