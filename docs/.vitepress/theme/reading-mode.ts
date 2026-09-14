/**
 * 「放大 RE」阅读模式：
 * 做 RE 视频时把档案放屏幕右下角，字太小看不清。
 * 点击按钮后收起左侧边栏、缩窄右侧目录、正文撑满页面。
 */

const STORAGE_KEY = 'rs-reading-mode'

export function setupReadingMode() {
  if (typeof document === 'undefined') return

  const btn = document.createElement('button')
  btn.className = 'rs-reading-toggle'
  btn.type = 'button'
  btn.setAttribute('aria-label', '放大 RE')
  btn.innerHTML = '<span class="rs-reading-toggle__icon">⤢</span><span class="rs-reading-toggle__text">放大</span>'
  document.body.append(btn)

  // 从 localStorage 恢复上次状态
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    document.documentElement.classList.add('rs-reading-mode')
    btn.classList.add('is-active')
  }

  btn.addEventListener('click', () => {
    const html = document.documentElement
    const enabled = html.classList.toggle('rs-reading-mode')
    btn.classList.toggle('is-active', enabled)
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  })
}
