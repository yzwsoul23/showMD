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
  gap: 20px;
  padding: 24px 24px 48px;
  max-width: 1152px;
  margin: 0 auto;
}

.artist-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.artist-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.artist-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background-color: var(--vp-c-bg-alt);
}

.artist-meta {
  min-width: 0;
}

.artist-name {
  margin: 0 0 6px;
  font-size: 18px;
  border: none;
  padding: 0;
}

.artist-tags {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.artist-bio {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (max-width: 640px) {
  .artist-grid {
    grid-template-columns: 1fr;
    padding: 16px 16px 32px;
  }
}
</style>
