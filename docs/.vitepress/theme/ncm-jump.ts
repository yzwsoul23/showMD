/**
 * 网易云音乐「跳转即播放」插件
 *
 * Markdown 里写一条普通链接即可调用，无需任何组件：
 *   [《CSC》](orpheus://song/5252838)
 *   [《CSC》](orpheus://song/5252838/?autoplay=1)   ← 旧写法也兼容，自动归一化
 *
 * 原理（参考 https://github.com/a2942/163MusicJump ）：
 * - 手机端：orpheus://song/<id> 即可唤起 App；
 * - PC 客户端不认 ?autoplay=1，能打开但不播放。自动播放必须下发
 *   Base64 JSON 指令：orpheus://<base64({type:'song',id,cmd:'play'})>；
 * - 未安装客户端时用 blur / visibilitychange 心跳检测，2.5s 后回退网页版，
 *   避免点击后页面毫无反应。
 *
 * 事件委托挂在 document 上（与灯箱同一套思路），SPA 路由切换无需重绑。
 */

const SONG_RE = /^orpheus:\/\/song\/(\d+)/i
const TOAST_ID = 'rs-ncm-toast'
const LAUNCH_LOCK_MS = 3000

let lastLaunchAt = 0

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** PC 端自动播放协议：Base64 编码的 JSON 指令（内容全 ASCII，btoa 安全） */
function buildDesktopUri(id: string) {
  const cmd = JSON.stringify({ type: 'song', id, cmd: 'play' })
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
function launch(id: string) {
  const now = Date.now()
  if (now - lastLaunchAt < LAUNCH_LOCK_MS) return
  lastLaunchAt = now

  const appUrl = isMobile()
    ? `orpheus://song/${id}`
    : buildDesktopUri(id)
  const webUrl = `https://music.163.com/#/song?id=${id}`

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

  // 点击委托：捕获歌曲链接并改写为平台对应的播放协议
  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="orpheus://"]'
    )
    if (!link) return

    const match = SONG_RE.exec(link.getAttribute('href') ?? '')
    if (!match) return // 非歌曲协议（专辑/歌手等）不接管，走默认打开

    e.preventDefault()
    launch(match[1])
  })

  // 悬停时补一个说明 title（不想把提示写死进每个 markdown 链接）
  document.addEventListener('mouseover', (e) => {
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a[href^="orpheus://song/"]'
    )
    if (link && !link.title) {
      link.title = '在网易云音乐客户端播放（未安装则打开网页版）'
    }
  })
}
