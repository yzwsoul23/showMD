import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { setupLightbox } from './lightbox'
import { setupImgBlocks } from './doc-enhance'

export default {
  extends: DefaultTheme,
  enhanceApp() {
    if (!import.meta.env.SSR) {
      setupImgBlocks()
      setupLightbox()
    }
  }
}
