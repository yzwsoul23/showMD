/**
 * 多主题切换器
 *
 * 导航栏右侧按钮 + 毛玻璃下拉面板，可切换 10 套阅读主题：
 *   apple / record / medium / paper / kindle / wechat
 *   sunset / gradient / dark / space
 *
 * - 默认主题：apple（Apple Books 风格）
 * - 通过 <html data-theme="xxx"> 切换，custom.css 据此覆盖 CSS 变量
 * - localStorage 持久化，键名 'rs-theme'
 * - 悬停选项时临时预览（不写入存储），点击才确认；收起面板恢复已选
 * - 同步 <meta name="theme-color">，移动端浏览器地址栏跟着变色
 * - 路由切换不重置主题（enhanceApp 只注册一次；导航栏 DOM 跨路由复用）
 */

const STORAGE_KEY = 'rs-theme'
const DEFAULT_THEME = 'apple'

interface ThemeOption {
  id: string
  label: string
  emoji: string
  hint: string
  /** 选项左侧双色圆点（一半强调色、一半底色） */
  dot: string
  /** 浏览器 UI 主题色（移动端地址栏） */
  meta: string
}

const THEMES: ThemeOption[] = [
  { id: 'apple',    label: 'Apple Books', emoji: '🍎', hint: '近白底 · Apple 蓝 · 负字距', dot: 'linear-gradient(135deg,#007AFF 48%,#E8E8ED 52%)', meta: '#FAFAFA' },
  { id: 'record',   label: '唱片店',      emoji: '🎵', hint: '牛皮纸 · 厂牌红 · 烫金黑胶', dot: 'linear-gradient(135deg,#a23525 48%,#ddcdae 52%)', meta: '#f6efe1' },
  { id: 'medium',   label: 'Medium',     emoji: '✍️', hint: '纯白底 · Medium 绿 · 衬线', dot: 'linear-gradient(135deg,#1a8917 48%,#E6E6E3 52%)', meta: '#ffffff' },
  { id: 'paper',    label: '护眼纸',      emoji: '🌿', hint: '米黄底 · 棕调 · 宽松行距',   dot: 'linear-gradient(135deg,#8B7355 48%,#E0D7C2 52%)', meta: '#F5F1E8' },
  { id: 'kindle',   label: 'Kindle',     emoji: '📖', hint: '纸张白 · 书脊棕 · 衬线',     dot: 'linear-gradient(135deg,#A0826D 48%,#E7DECA 52%)', meta: '#FBF8F1' },
  { id: 'wechat',   label: '微信读书',    emoji: '🌸', hint: '暖米底 · 微信橙',            dot: 'linear-gradient(135deg,#FF6B35 48%,#E5DBC5 52%)', meta: '#F6F1E7' },
  { id: 'sunset',   label: '暖阳',        emoji: '🌅', hint: '暖色渐变 · 橙调 · 磨砂',     dot: 'linear-gradient(135deg,#FF8C42 48%,#FFE0C4 52%)', meta: '#FFF9F0' },
  { id: 'gradient', label: '柔和渐变',    emoji: '🌊', hint: '淡紫径向渐变 · 靛蓝',        dot: 'linear-gradient(135deg,#7B68EE 48%,#E4DAFF 52%)', meta: '#F6F1FF' },
  { id: 'dark',     label: '深色',        emoji: '🌙', hint: '近黑底 · 高对比 · 夜间',     dot: 'linear-gradient(135deg,#0A84FF 48%,#2C2C2E 52%)', meta: '#161617' },
  { id: 'space',    label: '深空',        emoji: '🌌', hint: '深蓝渐变 · 星光蓝 · 夜间',   dot: 'linear-gradient(135deg,#64B5F6 48%,#0A0E27 52%)', meta: '#0A0E27' }
]

function applyTheme(id: string) {
  document.documentElement.setAttribute('data-theme', id)
  const meta = document.querySelector('meta[name="theme-color"]')
  const opt = THEMES.find(t => t.id === id)
  if (meta && opt) meta.setAttribute('content', opt.meta)
}

function getCurrentTheme(): string {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME
}

/** 创建一个按钮（导航栏圆形图标按钮） */
function createToggle(): HTMLElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'rs-theme-toggle'
  btn.title = '切换阅读主题'
  btn.setAttribute('aria-label', '切换阅读主题')
  btn.setAttribute('aria-haspopup', 'true')
  btn.setAttribute('aria-expanded', 'false')
  btn.innerHTML = '<span class="rs-theme-toggle__icon">🎨</span>'
  return btn
}

/** 创建下拉面板 */
function createPanel(): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'rs-theme-panel'
  panel.setAttribute('role', 'menu')
  panel.setAttribute('aria-label', '阅读主题选择')

  const title = document.createElement('div')
  title.className = 'rs-theme-panel__title'
  title.textContent = '阅读主题'
  panel.append(title)

  THEMES.forEach(opt => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'rs-theme-option'
    item.setAttribute('role', 'menuitemradio')
    item.dataset.theme = opt.id
    item.innerHTML =
      '<span class="rs-theme-option__dot" style="background:' + opt.dot + '" aria-hidden="true"></span>' +
      '<span class="rs-theme-option__emoji">' + opt.emoji + '</span>' +
      '<span class="rs-theme-option__body">' +
        '<span class="rs-theme-option__label">' + opt.label + '</span>' +
        '<span class="rs-theme-option__hint">' + opt.hint + '</span>' +
      '</span>' +
      '<span class="rs-theme-option__check" aria-hidden="true">✓</span>'
    panel.append(item)
  })

  return panel
}

/** 同步选中态：当前主题打勾、面板内 active 类、按钮 emoji */
function syncActive(panel: HTMLElement, toggle: HTMLElement) {
  const current = getCurrentTheme()
  panel.querySelectorAll<HTMLElement>('.rs-theme-option').forEach(el => {
    const isActive = el.dataset.theme === current
    el.classList.toggle('is-active', isActive)
    el.setAttribute('aria-checked', isActive ? 'true' : 'false')
  })
  const opt = THEMES.find(t => t.id === current)
  const iconEl = toggle.querySelector<HTMLElement>('.rs-theme-toggle__icon')
  if (iconEl && opt) iconEl.textContent = opt.emoji
}

export function setupThemeSwitcher() {
  if (typeof document === 'undefined') return
  if (document.querySelector('.rs-theme-toggle')) return

  // 1. 先把存储的主题应用到 <html>，与 head 内联脚本保持一致，避免闪烁
  const stored = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
  let savedTheme = stored
  applyTheme(stored)

  const toggle = createToggle()
  const panel = createPanel()

  // 2. 挂进顶栏最右侧的锚点（index.ts 通过 nav-bar-content-after 插槽渲染）。
  //    锚点是 Vue 自己的节点，hydration 完成后才可靠存在，用 rAF 重试等待；
  //    导航栏跨路由复用，挂载成功后无需再管。
  const wrap = document.createElement('div')
  wrap.className = 'rs-theme-wrap'
  wrap.append(toggle, panel)

  let mounted = false
  const tryMount = (retries = 600) => {
    if (mounted && wrap.isConnected) return
    const anchor = document.querySelector('.rs-theme-anchor')
    if (anchor) {
      anchor.append(wrap)
      mounted = true
      return
    }
    if (retries > 0) requestAnimationFrame(() => tryMount(retries - 1))
  }
  tryMount()

  syncActive(panel, toggle)

  const open = (state: boolean) => {
    panel.classList.toggle('is-open', state)
    toggle.classList.toggle('is-open', state)
    toggle.setAttribute('aria-expanded', state ? 'true' : 'false')
    // 未选择就收起：恢复之前已保存的主题（撤销悬停预览）
    if (!state) applyTheme(savedTheme)
  }

  toggle.addEventListener('click', e => {
    e.stopPropagation()
    open(!panel.classList.contains('is-open'))
  })

  panel.addEventListener('click', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.rs-theme-option')
    if (!target) return
    const id = target.dataset.theme!
    applyTheme(id)
    localStorage.setItem(STORAGE_KEY, id)
    savedTheme = id
    syncActive(panel, toggle)
    open(false)
  })

  // 悬停 / 键盘聚焦时临时预览主题（不持久化）
  panel.addEventListener('mouseover', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.rs-theme-option')
    if (target && target.dataset.theme) applyTheme(target.dataset.theme)
  })
  panel.addEventListener('focusin', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.rs-theme-option')
    if (target && target.dataset.theme) applyTheme(target.dataset.theme)
  })

  // 点击外部收起
  document.addEventListener('click', e => {
    if (!panel.contains(e.target as Node) && !toggle.contains(e.target as Node)) {
      open(false)
    }
  })

  // ESC 收起
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') open(false)
  })
}
