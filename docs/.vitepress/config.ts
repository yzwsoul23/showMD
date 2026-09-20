import { defineConfig } from 'vitepress'

// 站点部署在 GitHub Pages 项目页 https://<OWNER>.github.io/<REPO>/
// 因此必须配置 base，仓库改名后同步修改此处
export default defineConfig({
  lang: 'zh-CN',
  title: '中文说唱档案',
  description: '中文说唱歌手开荒文稿、人物生涯与音乐作品目录',
  base: '/showMD/',
  cleanUrls: true,
  lastUpdated: true,
  // 多主题为手动切换（10 套阅读主题），禁用 VitePress 自带深浅色开关
  appearance: false,
  // _template.md 为新建艺人脚手架，_maintenance.md 为封存占位页模板，均不参与构建发布
  srcExclude: ['artists/_template.md', 'artists/_maintenance.md'],

  head: [
    ['meta', { name: 'theme-color', content: '#FAFAFA' }],
    // SVG favicon 内嵌图形并跟随系统深浅色：浅色标签为黑色、深色标签反白；
    // PNG 回退给不支持 SVG favicon 的旧浏览器
    ['link', { rel: 'icon', href: '/showMD/images/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'icon', href: '/showMD/images/favicon.png', type: 'image/png', sizes: '128x128' }],
    // 首屏防闪烁：CSS 加载前就把 localStorage 里的主题写到 <html data-theme>；
    // 无存储时默认 apple（Apple Books 风格）。键名与 theme-switcher.ts 保持一致。
    ['script', {},
      "(function(){try{var t=localStorage.getItem('rs-theme')||'apple';" +
      "document.documentElement.setAttribute('data-theme',t)}catch(e){" +
      "document.documentElement.setAttribute('data-theme','apple')}})()"]
  ],

  themeConfig: {
    logo: '/images/logo.png',
    siteTitle: '中文说唱档案',
    outline: {
      level: [2, 3],
      label: '目录导航'
    },
    smoothScroll: true,
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',

    nav: [
      { text: '首页', link: '/' },
      {
        text: '艺人档案',
        items: [
          { text: 'GAI 周延', link: '/artists/gai' },
          { text: 'GALI', link: '/artists/gali' },
          { text: '功夫胖 KungFu-Pen', link: '/artists/kungfu-pen' },
          { text: '李佳隆 JelloRio', link: '/artists/jellorio' },
          { text: '连麻 Swimming', link: '/artists/swimming' }
        ]
      },
      { text: '站点维护', link: '/guide/maintenance' },
      {
        text: 'GitHub',
        link: 'https://github.com/yzwsoul23/showMD'
      }
    ],

    sidebar: [
      {
        text: '艺人档案',
        collapsed: true,
        items: [
          { text: 'GAI 周延', link: '/artists/gai' },
          { text: 'GALI', link: '/artists/gali' },
          { text: '功夫胖 KungFu-Pen', link: '/artists/kungfu-pen' },
          { text: '李佳隆 JelloRio', link: '/artists/jellorio' },
          { text: '连麻 Swimming', link: '/artists/swimming' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yzwsoul23/showMD' }
    ],

    footer: {
      message: '文稿均由粉丝用爱发电整理，仅供学习交流',
      copyright: 'Copyright © 2026 中文说唱档案'
    }
  }
})
