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
  // 唱片店主题为纯浅色设计，禁用暗色模式避免两套变量打架
  appearance: false,
  // 模板文件仅作新建艺人时的脚手架，不参与构建发布
  srcExclude: ['artists/_template.md'],

  head: [
    ['meta', { name: 'theme-color', content: '#f6efe1' }],
    ['link', { rel: 'icon', href: '/showMD/images/favicon.svg', type: 'image/svg+xml' }]
  ],

  themeConfig: {
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
      },
      {
        text: '站点维护',
        collapsed: true,
        items: [
          { text: '内容维护教程', link: '/guide/maintenance' }
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
