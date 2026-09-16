/**
 * 「放大 RE」阅读模式：
 * 做 RE 视频时把档案放屏幕右下角，字太小看不清。
 * 点击按钮后收起左侧边栏、缩窄右侧目录、正文撑满页面。
 */

const STORAGE_KEY = 'rs-reading-mode'

/** 阅读模式只在桌面端（≥960px，侧栏/双栏布局）有意义 */
const desktopMQ =
  typeof window !== 'undefined' ? window.matchMedia('(min-width: 960px)') : null

export function setupReadingMode() {
  if (typeof document === 'undefined') return

  const btn = document.createElement('button')
  btn.className = 'rs-reading-toggle'
  btn.type = 'button'
  btn.setAttribute('aria-label', '放大 RE')
  btn.innerHTML = '<span class="rs-reading-toggle__icon">⤢</span><span class="rs-reading-toggle__text">放大</span>'
  document.body.append(btn)

  // 从 localStorage 恢复上次状态（仅桌面端；移动端按钮隐藏，也不该残留放大样式）
  const storedOn = localStorage.getItem(STORAGE_KEY) === '1'
  const syncMode = (on: boolean) => {
    document.documentElement.classList.toggle('rs-reading-mode', on && !!desktopMQ?.matches)
    btn.classList.toggle('is-active', on && !!desktopMQ?.matches)
  }
  syncMode(storedOn)

  // 跨越 960px 断点时即时同步：缩到移动端退出模式，拉回桌面端恢复
  desktopMQ?.addEventListener?.('change', () => syncMode(localStorage.getItem(STORAGE_KEY) === '1'))

  btn.addEventListener('click', () => {
    const html = document.documentElement
    const enabled = html.classList.toggle('rs-reading-mode')
    btn.classList.toggle('is-active', enabled)
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  })
}
