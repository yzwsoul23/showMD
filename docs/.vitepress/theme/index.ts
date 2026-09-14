import DefaultTheme from 'vitepress/theme'
// 站酷庆科黄油体：嘻哈艺术风标题字体（仅简体子集 + 拉丁子集，按需加载）
import '@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css'
import '@fontsource/zcool-qingke-huangyou/latin-400.css'
import './custom.css'
import { setupLightbox } from './lightbox'
import { setupImgBlocks } from './doc-enhance'
import { setupReadingMode } from './reading-mode'
import { setupSidebarCollapse } from './sidebar-collapse'

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (!import.meta.env.SSR) {
      setupImgBlocks()
      setupLightbox()
      setupReadingMode()
      setupSidebarCollapse(router)
    }
  }
}
