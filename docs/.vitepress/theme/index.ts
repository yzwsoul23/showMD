import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { setupLightbox } from './lightbox'

export default {
  extends: DefaultTheme,
  enhanceApp() {
    // 图片点击放大（涉及 document，SSR 阶段不注册）
    if (!import.meta.env.SSR) {
      setupLightbox()
    }
  }
}
