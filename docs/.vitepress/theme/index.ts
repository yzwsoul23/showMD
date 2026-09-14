import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { setupLightbox } from './lightbox'
import { setupImgBlocks } from './doc-enhance'
import { setupReadingMode } from './reading-mode'

export default {
  extends: DefaultTheme,
  enhanceApp() {
    if (!import.meta.env.SSR) {
      setupImgBlocks()
      setupLightbox()
      setupReadingMode()
    }
  }
}
