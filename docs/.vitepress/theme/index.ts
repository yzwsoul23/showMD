import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { setupLightbox } from './lightbox'
import { setupImgBlocks } from './doc-enhance'
import { setupReadingMode } from './reading-mode'
import { setupSidebarCollapse } from './sidebar-collapse'
import { setupNcmJump } from './ncm-jump'
import { setupQqJump } from './qqmusic-jump'

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (!import.meta.env.SSR) {
      setupImgBlocks()
      setupLightbox()
      setupReadingMode()
      setupSidebarCollapse(router)
      setupNcmJump()
      setupQqJump()
    }
  }
}
