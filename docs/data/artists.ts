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
  /**
   * 档案维护中标记。
   * true 时：主页卡片禁用点击并叠加「档案维护中」角标（头像保持原色）；
   * docs/artists/<id>.md 已由 `npm run maintain` 替换为占位页，原文加密存档于 _drafts/。
   */
  maintenance?: boolean
}

export const artists: Artist[] = [
  {
    id: 'gai',
    name: 'GAI 周延',
    alias: ['周延', 'Double G'],
    region: '重庆',
    label: '种梦音乐 D.M.G',
    avatar: '/images/avatars/gai.webp',
    debutYear: 2012,
    bio: 'GOSH 初代成员，2017 年《中国有嘻哈》全国总冠军，江湖流说唱代表人物，代表作《苦行僧》《华夏》。',
    songs: [
      { title: '一百零八', year: 2016, role: '演唱' },
      { title: '苦行僧', year: 2016, role: '演唱 (feat. 功夫胖)' },
      { title: '空城计', year: 2016, role: '演唱' },
      { title: '光宗耀祖', year: 2018, role: '专辑' },
      { title: '华夏', year: 2019, role: '演唱' },
      { title: '烻', year: 2020, role: '专辑' },
      { title: '杜康', year: 2022, role: '专辑' },
      { title: 'Real G', year: 2026, role: '专辑' }
    ]
  },
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
    id: 'jellorio',
    name: '李佳隆 JelloRio',
    alias: ['JelloRio'],
    region: '四川南充',
    label: 'Born Legend',
    avatar: '/images/avatars/jellorio.webp',
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
    id: 'swimming',
    name: '连麻 Swimming',
    alias: ['孙一民'],
    region: '成都',
    label: '声闻聚将',
    avatar: '/images/avatars/swimming.webp',
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
