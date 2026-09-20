---
layout: home

hero:
  name: 中文说唱档案
  text: 开荒文稿与音乐作品目录
  tagline: 粉丝用爱发电整理的中文说唱歌手人物志，基于 VitePress 的纯静态档案站
  actions:
    - theme: brand
      text: 浏览艺人档案
      link: /artists/gali
    - theme: alt
      text: GitHub 仓库
      link: https://github.com/yzwsoul23/showMD
---

<script setup>
import { withBase } from 'vitepress'
import { artists } from './data/artists'
</script>

<div class="artist-grid">
  <template v-for="artist in artists" :key="artist.id">
    <!-- 维护中：禁用点击，叠加角标，头像保持原色 -->
    <div
      v-if="artist.maintenance"
      class="artist-card artist-card--maintenance"
      :aria-label="`${artist.name} 档案维护中`"
      role="img"
    >
      <span class="artist-media">
        <img
          class="artist-avatar"
          :src="withBase(artist.avatar)"
          :alt="`${artist.name} 头像`"
          loading="lazy"
        />
        <span class="artist-maintenance-badge">档案维护中</span>
        <span class="artist-overlay">
          <span class="artist-overlay-bio">{{ artist.bio }}</span>
          <span class="artist-overlay-cta">档案正在重新编写中，敬请期待</span>
        </span>
        <span class="artist-name">{{ artist.name }}</span>
      </span>
    </div>
    <!-- 正常：可点击进档案页 -->
    <a
      v-else
      class="artist-card"
      :href="withBase(`/artists/${artist.id}`)"
      :aria-label="`查看 ${artist.name} 的档案`"
    >
      <span class="artist-media">
        <img
          class="artist-avatar"
          :src="withBase(artist.avatar)"
          :alt="`${artist.name} 头像`"
          loading="lazy"
        />
        <span class="artist-overlay">
          <span class="artist-overlay-tags">
            {{ artist.region }}<template v-if="artist.label"> · {{ artist.label }}</template><template v-if="artist.debutYear"> · {{ artist.debutYear }} 出道</template>
          </span>
          <span class="artist-overlay-bio">{{ artist.bio }}</span>
          <span class="artist-overlay-cta">查看完整档案 →</span>
        </span>
        <span class="artist-name">{{ artist.name }}</span>
      </span>
    </a>
  </template>
</div>

<style scoped>
.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 28px 24px;
  padding: 8px 24px 64px;
  max-width: 1152px;
  margin: 0 auto;
}

.artist-card {
  display: block;
  text-decoration: none;
}

/* 卡片主体：一张撑满的正方形人像 */
.artist-media {
  position: relative;
  display: block;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  background-color: var(--vp-c-bg-alt);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;
}

.artist-avatar {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease, filter 0.4s ease;
}

/* 底部常驻暗渐变，保证压在图上的名字可读 */
.artist-media::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.58));
  pointer-events: none;
}

/* 悬停浮层：图片模糊，简介浮现（名字保持可见） */
.artist-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  padding: 18px 18px 56px;
  color: #fff;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 30%, rgba(0, 0, 0, 0.72));
  opacity: 0;
  transition: opacity 0.35s ease;
}

.artist-overlay-tags {
  font-size: 12px;
  letter-spacing: 0.02em;
  opacity: 0.85;
}

.artist-overlay-bio {
  font-size: 13px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

.artist-overlay-cta {
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.92;
}

/* 名字压在图片底部，白色加大加粗 */
.artist-name {
  position: absolute;
  inset: auto 8px 14px;
  z-index: 2;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: center;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), 0 2px 10px rgba(0, 0, 0, 0.35);
}

/* 悬停效果只作用于有指针的设备；触屏点击直接进档案页 */
@media (hover: hover) {
  .artist-card:hover {
    text-decoration: none;
  }

  .artist-card:hover .artist-media {
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  }

  .artist-card:hover .artist-avatar {
    transform: scale(1.05);
    filter: blur(7px);
  }

  .artist-card:hover .artist-overlay {
    opacity: 1;
  }
}

/* 维护中卡片：禁用点击，鼠标变禁止符；头像保持原色，仅叠加角标 */
.artist-card--maintenance {
  cursor: not-allowed;
}

.artist-maintenance-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(180, 30, 30, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.artist-card:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 4px;
  border-radius: 14px;
}

.artist-card:focus-visible .artist-avatar {
  filter: blur(7px);
}

.artist-card:focus-visible .artist-overlay {
  opacity: 1;
}

/* 移动端：两列方形图网格，点击直接进档案 */
@media (max-width: 640px) {
  .artist-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px 14px;
    padding: 4px 16px 44px;
  }

  .artist-media {
    border-radius: 10px;
  }

  .artist-name {
    font-size: 15px;
    inset: auto 6px 9px;
  }
}
</style>
