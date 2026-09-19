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
 * - 提示收起：从 App 返回浏览器时部分安卓 WebView（微信 X5 等）不触发
 *   visibilitychange，只触发 pageshow/focus，回页信号三件套任一到达即
 *   收起；「正在唤起…」纯提示另带兜底自灭定时器，信号全丢也不会永驻。
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
/** 「正在唤起…」纯提示的兜底自灭时长，须大于最长检测窗口（桌面 4s），
 *  避免自灭定时器与检测回调竞态；回页信号正常时会提前收起 */
const LAUNCHING_TOAST_MS = 6000

/** 各类型的网页版回退地址与中文叫法 */
const KIND_META: Record<NcmKind, { webPath: string; label: string }> = {
  song: { webPath: 'song', label: '歌曲' },
  album: { webPath: 'album', label: '专辑' },
  playlist: { webPath: 'playlist', label: '歌单' }
}

let lastLaunchAt = 0
/** 当前提示（正在唤起 / 确认气泡共用）的自动消失定时器 */
let autoHideTimer: ReturnType<typeof setTimeout> | undefined
/** 上一次唤起尝试注册的页面信号解绑函数，新尝试开始前先清场防泄漏/误伤 */
let teardownSignals: (() => void) | undefined

function clearAutoHideTimer() {
  if (autoHideTimer !== undefined) {
    clearTimeout(autoHideTimer)
    autoHideTimer = undefined
  }
}

/** 安排提示在 ms 后自动消失（同时解绑页面信号） */
function armAutoHide(ms: number) {
  clearAutoHideTimer()
  autoHideTimer = setTimeout(() => {
    autoHideTimer = undefined
    teardownSignals?.()
    teardownSignals = undefined
    hideToast()
  }, ms)
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
 * onOpen：用户点「转到网页版」时回调，用于解绑唤起阶段注册的页面信号。
 */
function showFallbackToast(webUrl: string, onOpen?: () => void) {
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
    clearAutoHideTimer()
    onOpen?.()
    window.location.href = webUrl
  })
  toast.append(msg, btn)
  // 强制一次重排后再加类，保证进场上浮动画能触发
  void toast.offsetHeight
  toast.classList.add('is-show')
  armAutoHide(FALLBACK_TOAST_MS)
}

/**
 * 唤起客户端并做网页版回退。
 * - PC 客户端冷启动要数秒才夺走浏览器焦点，桌面端检测窗口放宽到 4s，
 *   移动端切 App 很快，保持 2.5s；
 * - 判定「是否已离开」只信 document.hidden：浏览器弹外部协议确认条时
 *   window blur / hasFocus 都会误报，切到客户端时 document.hidden 才可靠；
 * - 收起提示的回页信号则三件套都监听（visible / pageshow / focus），
 *   因为微信 X5、部分安卓 WebView 拉起 App 返回时不触发 visibilitychange；
 * - 判定为未安装时不自动跳网页版，弹确认气泡让用户决定，误判场景下
 *   不点即可；所有信号都丢失时兜底自灭定时器也会把提示收掉。
 */
function launch(kind: NcmKind, id: string) {
  const now = Date.now()
  if (now - lastLaunchAt < LAUNCH_LOCK_MS) return
  lastLaunchAt = now

  // 清掉上一次尝试残留的页面信号监听与自灭定时器
  teardownSignals?.()
  teardownSignals = undefined
  clearAutoHideTimer()

  const meta = KIND_META[kind]
  const appUrl = isMobile()
    ? `orpheus://${kind}/${id}`
    : buildDesktopUri(kind, id)
  const webUrl = `https://music.163.com/#/${meta.webPath}?id=${id}`

  showToast('正在唤起网易云音乐客户端…')
  armAutoHide(LAUNCHING_TOAST_MS)

  // 回到页面的三类信号：visibilitychange=visible / pageshow / window focus。
  // 部分安卓 WebView（微信 X5 等）拉起外部 App 返回时不触发
  // visibilitychange，只触发 pageshow/focus，只监听前者提示会永驻
  const onVisible = () => {
    if (document.visibilityState === 'visible') dismiss()
  }
  const onReturn = () => dismiss()

  const unbind = () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', onReturn)
    window.removeEventListener('focus', onReturn)
  }
  const dismiss = () => {
    clearAutoHideTimer()
    teardownSignals = undefined
    unbind()
    hideToast()
  }
  teardownSignals = unbind

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', onReturn)
  window.addEventListener('focus', onReturn)

  window.location.href = appUrl

  window.setTimeout(() => {
    // 回页信号已触发、或已被新一次点击清场：不再操作提示
    if (teardownSignals === undefined) return
    // 先取消「正在唤起」的兜底自灭，按判定结果重新安排计时
    clearAutoHideTimer()
    if (document.hidden) {
      // 已切到客户端：等回页信号收起；信号全丢时再由兜底自灭收尾
      armAutoHide(LAUNCHING_TOAST_MS)
      return
    }
    // 不自动跳网页版：弹 5 秒确认气泡，点击才转；用户点按钮时解绑信号。
    // 若客户端其实刚被唤起、稍后才夺走焦点，用户切回浏览器时回页信号
    // 会自动收起气泡
    showFallbackToast(webUrl, () => {
      teardownSignals = undefined
      unbind()
    })
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

    // 拖选（桌面）或长按选择（移动端）选中了胶囊文字时，属于复制歌名场景：
    // 只阻止 orpheus:// 协议的默认跳转、不唤起客户端，保留用户选区；
    // 普通单击时 mousedown 会先把选区折叠，这里读到的是空选区，正常唤起
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().length > 0) {
      e.preventDefault()
      return
    }

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
