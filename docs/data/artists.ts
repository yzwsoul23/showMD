/**
 * 艺人核心数据源
 * 每个艺人对应 docs/artists/<id>.md 与 docs/public/images/<id>/ 下的图片资源
 */

export interface ArtistSong {
  /** 作品名（专辑可用括号标注） */
  title: string
  /** 发行年份 */
  year: number
  /** 担任角色，如 '演唱'、'专辑'、'制作人' */
  role: string
}

export interface Artist {
  /** 对应 docs/artists/ 下的 MD 文件名，如 'gali' */
  id: string
  /** 艺名 */
  name: string
  /** 曾用名/别名 */
  alias?: string[]
  /** 地区，如 '成都' */
  region: string
  /** 厂牌 */
  label?: string
  /** 头像路径（站点内 public 目录的绝对路径） */
  avatar: string
  /** 出道年份 */
  debutYear?: number
  /** 一句话简介，用于首页卡片与页面描述 */
  bio: string
  /** 代表作品列表 */
  songs: ArtistSong[]
}

export const artists: Artist[] = [
  {
    id: 'gali',
    name: 'GALI',
    alias: ['蒋文涵'],
    region: '上海',
    label: 'BASE',
    avatar: '/images/avatars/gali.webp',
    debutYear: 2016,
    bio: '2017 年以 diss 曲《珍珠幻象》成名，代表作《70%》与专辑《亚特兰蒂斯》。',
    songs: [
      { title: '珍珠幻象 (Illusion Freestyle)', year: 2017, role: '演唱' },
      { title: 'VINTAGE（EP）', year: 2018, role: '专辑' },
      { title: '70%', year: 2019, role: '演唱' },
      { title: '亚特兰蒂斯', year: 2022, role: '专辑' }
    ]
  },
  {
    id: 'kungfu-pen',
    name: '功夫胖 KungFu-Pen',
    alias: ['C-BLOCK', '施逸凡'],
    region: '长沙',
    label: 'Sup Music',
    avatar: '/images/avatars/kungfu-pen.webp',
    debutYear: 2007,
    bio: 'C-BLOCK 成员，2007 年长沙地下 MC Battle 冠军，江湖流说唱代表人物。',
    songs: [
      { title: '江湖流', year: 2015, role: '演唱' },
      { title: '一代', year: 2018, role: '演唱' }
    ]
  },
  {
    id: 'lijialong',
    name: '李佳隆 JelloRio',
    alias: ['JelloRio'],
    region: '四川南充',
    label: 'Born Legend',
    avatar: '/images/avatars/lijialong.webp',
    debutYear: 2015,
    bio: '《中国新说唱 2020》总冠军，国内 Auto-tune 代表人物，《星球坠落》原唱之一。',
    songs: [
      { title: '月儿圆', year: 2017, role: '演唱' },
      { title: '星球坠落', year: 2018, role: '演唱 (feat. 艾热)' },
      { title: 'BERRY', year: 2019, role: '演唱 (feat. Asen)' },
      { title: 'JELLO/REAL', year: 2019, role: '专辑' },
      { title: '传奇', year: 2022, role: '专辑' },
      { title: 'GUOXIA', year: 2024, role: '专辑' }
    ]
  },
  {
    id: 'lianma',
    name: '连麻 Swimming',
    alias: ['孙一民'],
    region: '成都',
    label: '声闻聚将',
    avatar: '/images/avatars/lianma.webp',
    debutYear: 2013,
    bio: '成都说唱歌手，与双胞胎弟弟隼 JinJiBeWater 并称，代表作《丢人吗》《Yuppie》。',
    songs: [
      { title: '丢人吗', year: 2020, role: '演唱' },
      { title: 'Yuppie（雅痞）', year: 2020, role: '专辑' },
      { title: 'CHUNGHWA', year: 2021, role: '专辑' },
      { title: '邻家小丈夫', year: 2024, role: '专辑' }
    ]
  }
]
