import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { setupLightbox } from './lightbox'
import { setupImgBlocks } from './doc-enhance'
import { setupReadingMode } from './reading-mode'
import { setupSidebarCollapse } from './sidebar-collapse'
import { setupNcmJump } from './ncm-jump'
import { setupThemeSwitcher } from './theme-switcher'

export default {
  extends: DefaultTheme,
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
