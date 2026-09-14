<script setup>
/**
 * 顶栏：期次（只读，由后台设定）、角色持有、分享导出、昼夜切换；后台入口仅管理员可见
 * 用户 v0.3 反馈：去掉「强化 N」标签与右侧那组统计数字（与队伍区重复）。
 */
import { computed } from 'vue'
import { useGameStore } from '@/stores/game.js'
import { THEME_ICONS } from '@/data/elements.js'

const emit = defineEmits(['share', 'admin', 'toast', 'ownership'])

const store = useGameStore()

const periodName = computed(() => store.currentPeriod?.name || '')
const periodNote = computed(() => store.currentPeriod?.sourceNote || '')
</script>

<template>
  <header class="hd">
    <div class="hd__brand">
      <span class="hd__mark">终</span>
      <div class="hd__titles">
        <h1 class="hd__title">鸣潮·终焉矩阵</h1>
        <p class="hd__sub">配队模拟器</p>
      </div>
      <!-- v0.4：明暗切换从右侧挪到标题旁；v0.5：换成用户提供的太阳/月亮图标 -->
      <button
        class="hd__theme"
        type="button"
        :title="store.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        @click="store.toggleTheme()"
      >
        <img
          class="hd__theme-icon"
          :src="store.theme === 'dark' ? THEME_ICONS.dark : THEME_ICONS.light"
          :alt="store.theme === 'dark' ? '深色模式' : '浅色模式'"
          draggable="false"
        />
      </button>
    </div>

    <!-- 期次：只读，居中展示；名称由管理员在后台录入，用户改不了 -->
    <div class="hd__period" :title="periodNote || '期次名称由管理员在后台设定'">
      <span class="hd__period-name">{{ periodName }}</span>
    </div>

    <span class="hd__spacer" />

    <div class="hd__actions">
      <button
        class="btn btn--sm"
        type="button"
        title="回到「选择你已有的角色」页，可随时修改持有名单"
        @click="emit('ownership')"
      >
        角色持有（{{ store.ownedCharacters.length }}）
      </button>
      <!-- 后台管理入口：只有 URL 带 #admin 时才出现 -->
      <button
        v-if="store.isAdmin"
        class="btn btn--sm hd__admin"
        type="button"
        title="管理员入口（URL 带 #admin 时才显示）"
        @click="emit('admin')"
      >
        后台管理
      </button>
      <button class="btn btn--sm btn--primary" type="button" @click="emit('share')">导出 / 分享</button>
    </div>
  </header>
</template>

<style scoped>
.hd {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 10px 18px;
  background: linear-gradient(180deg, rgba(187, 159, 94, 0.09), transparent);
  border-bottom: 1px solid var(--line-soft);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 40;
  background-color: var(--panel);
}

/* 期次：绝对定位到顶栏正中（v0.4 用户要求） */
.hd__period {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  padding: 4px 18px;
  border-radius: 99px;
  border: 1px solid var(--gold);
  background: linear-gradient(180deg, rgba(246, 231, 176, 0.12), rgba(187, 159, 94, 0.06));
  cursor: default;
  pointer-events: auto;
}
/* 期次只读：名称由管理员后台录入，用户不可更改 */
.hd__period-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--gold-soft);
  letter-spacing: 0.06em;
  white-space: nowrap;
}
@media (max-width: 1080px) {
  .hd__period {
    position: static;
    transform: none;
  }
}

.hd__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hd__mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  font-size: 17px;
  font-weight: 800;
  color: var(--accent-text);
  background: linear-gradient(145deg, var(--gold-bright), var(--gold));
  box-shadow: 0 0 14px -3px var(--gold);
}
.hd__title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1.2;
}
.hd__sub {
  font-size: 11px;
  color: var(--text-faint);
  letter-spacing: 0.22em;
}

.hd__spacer {
  flex: 1;
}

.hd__admin {
  border-color: var(--gold);
  color: var(--gold-bright);
}

.hd__actions {
  display: flex;
  gap: 7px;
  align-items: center;
}
/* 明暗切换：素材是白/浅色描边，所以垫一层深色圆盘，浅色主题下也看得清 */
.hd__theme {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: radial-gradient(circle at 50% 40%, #262a34 0%, #14161c 100%);
  cursor: pointer;
  transition: all 0.16s var(--ease);
}
.hd__theme:hover {
  border-color: var(--gold);
  box-shadow: 0 0 12px -2px rgba(240, 224, 160, 0.75);
  transform: translateY(-1px);
}
.hd__theme-icon {
  width: 74%;
  height: 74%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
}

@media (max-width: 900px) {
  .hd__stats {
    display: none;
  }
}
</style>
