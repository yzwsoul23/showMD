import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'
import { setupLightbox } from './lightbox'
import { setupImgBlocks } from './doc-enhance'
import { setupReadingMode } from './reading-mode'
import { setupSidebarCollapse } from './sidebar-collapse'
import { setupNcmJump } from './ncm-jump'
import { setupThemeSwitcher } from './theme-switcher'

export default {
  extends: DefaultTheme,
  Layout() {
    // nav-bar-content-after：顶栏最右侧的锚点，主题切换按钮挂在这里。
    // 锚点必须由 Vue 渲染——若把原生 DOM 直接插进导航栏，生产环境
    // hydration 时会被当作多余节点移除（dev 正常、部署后按钮消失的根因）。
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h('div', { class: 'rs-theme-anchor' })
    })
  },
  enhanceApp({ router }) {
    if (!import.meta.env.SSR) {
      // 主题切换器最先注册：尽早把 <html data-theme> 与用户选择对齐
      setupThemeSwitcher()
      setupImgBlocks()
      setupLightbox()
      setupReadingMode()
      setupSidebarCollapse(router)
      setupNcmJump()
    }
  }
}
