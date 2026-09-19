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
  <a
    v-for="artist in artists"
    :key="artist.id"
    class="artist-card"
    :href="withBase(`/artists/${artist.id}`)"
  >
    <img
      class="artist-avatar"
      :src="withBase(artist.avatar)"
      :alt="`${artist.name} 头像`"
      loading="lazy"
    />
    <div class="artist-meta">
      <h2 class="artist-name">{{ artist.name }}</h2>
      <p class="artist-tags">
        <span>{{ artist.region }}</span>
        <template v-if="artist.label"> · {{ artist.label }}</template>
        <template v-if="artist.debutYear"> · {{ artist.debutYear }} 出道</template>
      </p>
      <p class="artist-bio">{{ artist.bio }}</p>
    </div>
  </a>
</div>

<style scoped>
.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px 20px;
  padding: 8px 24px 56px;
  max-width: 1152px;
  margin: 0 auto;
}

.artist-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background-color: var(--vp-c-bg-soft);
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.artist-card:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

/* 桌面端：封面占满卡宽（1:1），信息收在下方，整列卡片高度一致 */
.artist-avatar {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background-color: var(--vp-c-bg-alt);
}

.artist-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px 16px;
}

.artist-name {
  margin: 0;
  font-size: 17px;
  line-height: 1.4;
  border: none;
  padding: 0;
}

.artist-tags {
  margin: 0;
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.artist-bio {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

/* 移动端：单列紧凑横排——小方头像在左，文字在右 */
@media (max-width: 640px) {
  .artist-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 4px 16px 40px;
  }

  .artist-card {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
  }

  .artist-card:hover {
    transform: none;
  }

  .artist-avatar {
    width: 76px;
    height: 76px;
    flex-shrink: 0;
    border-radius: 10px;
  }

  .artist-meta {
    gap: 4px;
    padding: 0;
  }

  .artist-name {
    font-size: 15.5px;
  }

  .artist-tags {
    font-size: 12px;
  }

  .artist-bio {
    font-size: 12.5px;
    -webkit-line-clamp: 2;
  }
}
</style>
