<script setup>
/**
 * 队伍区 —— 数量无上限（§2.2 / §6 决策3）
 * ------------------------------------------------------------
 * 两种视图（用户 v0.3 改名）：
 *   · 配队页面（默认）：一列 × 多行，未点开的队伍缩成小头像片，
 *                       点某支队伍才把它展开成完整立绘卡
 *   · 全队预览：多列 × 多行的紧凑头像片总览，一眼看所有队伍阵容
 *               （v0.3 起底部的「全队伍预览区」已移除，功能并到这里）
 * 队伍数量：填满后自动追加一支空队伍，不需要手动「新建队伍」。
 * 队伍顺序：拖队头握把可调换次序，拖动时相邻队伍之间会显示插入分界线。
 */
import { computed } from 'vue'
import TeamCard from './TeamCard.vue'
import { useGameStore } from '@/stores/game.js'
import { teamDrag } from '@/composables/useDrag.js'

const props = defineProps({
  cardWidth: { type: Number, default: 132 },
})

const emit = defineEmits(['toast'])

const store = useGameStore()

const layout = computed(() => store.ui.layout)
const isGrid = computed(() => layout.value === 'grid')

const totalSlots = computed(() => store.teams.length * 3)
const usedSlots = computed(() => store.teams.reduce((a, t) => a + t.slots.filter(Boolean).length, 0))

/** 配队页面下：只有被点开的那支队是展开的；全队预览下全部紧凑拼成网格 */
function compactOf(teamId) {
  if (isGrid.value) return true
  return store.selectedTeamId !== teamId
}

function toggleLayout() {
  store.setLayout(isGrid.value ? 'list' : 'grid')
  emit('toast', { type: 'ok', text: isGrid.value ? '已回到配队页面' : '已切到全队预览' })
}

/** 一键重置本期体力 */
function resetStamina() {
  if (!store.teams.some((t) => t.slots.some(Boolean))) {
    emit('toast', { type: 'warn', text: '当前没有已上阵的角色' })
    return
  }
  const ok = window.confirm(
    '确定重置本期体力？\n将清空所有队伍中的角色分配，删掉空队伍并只保留「配队1」，使全部角色恢复满体力。',
  )
  if (!ok) return
  const n = store.resetStamina()
  emit('toast', { type: 'ok', text: `已重置体力，清空 ${n} 个上阵位置，队伍已重置为「配队1」` })
}
</script>

<template>
  <section class="board" :class="{ 'is-grid': isGrid }">
    <header class="board__head">
      <h2 class="board__title">
        队伍区
        <span class="tag">{{ store.teams.length }} 支队伍</span>
        <span class="tag">已上阵 {{ usedSlots }} / {{ totalSlots }}</span>
      </h2>

      <div class="board__actions">
        <button
          class="btn btn--sm"
          type="button"
          title="清空所有队伍中的角色分配，使全部角色恢复满体力"
          @click="resetStamina"
        >
          重置本期体力
        </button>

        <button
          class="board__layout"
          type="button"
          :title="isGrid ? '回到配队页面（一列，点开某队编辑）' : '切换到全队预览（多列，一眼看所有队伍）'"
          :aria-pressed="isGrid"
          @click="toggleLayout"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <template v-if="isGrid">
              <rect x="1" y="1" width="6" height="6" rx="1.2" fill="currentColor" />
              <rect x="9" y="1" width="6" height="6" rx="1.2" fill="currentColor" />
              <rect x="1" y="9" width="6" height="6" rx="1.2" fill="currentColor" />
              <rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" />
            </template>
            <template v-else>
              <rect x="1" y="2.5" width="14" height="4" rx="1.2" fill="currentColor" />
              <rect x="1" y="9.5" width="14" height="4" rx="1.2" fill="currentColor" />
            </template>
          </svg>
          {{ isGrid ? '切换配队页面' : '切换全队预览' }}
        </button>
      </div>
    </header>

    <div
      class="board__grid"
      :style="{
        gridTemplateColumns: isGrid
          ? 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))'
          : 'minmax(0, 1fr)',
      }"
    >
      <!--
        队伍换序的插入线（v0.6 重写）。
        由网格容器统一渲染一个元素、top 用实测像素值，而不是画在各队伍卡片的
        伪元素上 —— 后者会因为 `.team` 没有 position:relative 而跑到别处。
      -->
      <div
        v-if="teamDrag.active && teamDrag.lineY !== null"
        class="board__dropline"
        :style="{ top: teamDrag.lineY + 'px' }"
        aria-hidden="true"
      />

      <TeamCard
        v-for="(t, i) in store.teams"
        :key="t.id"
        :team="t"
        :index="i"
        :card-width="cardWidth"
        :compact="compactOf(t.id)"
        :selectable="!isGrid"
        :expanded="!compactOf(t.id)"
        @toast="emit('toast', $event)"
        @select="store.toggleTeamSelected(t.id)"
      />
    </div>
  </section>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.board__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.board__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
}

/* 右上角操作组：重置体力 + 视图切换 */
.board__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 金色的视图切换按钮 */
.board__layout {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border-radius: 99px;
  border: 1px solid var(--gold);
  background: linear-gradient(180deg, rgba(246, 231, 176, 0.22), rgba(187, 159, 94, 0.16));
  color: var(--gold-bright);
  font-size: 12.5px;
  font-weight: 700;
  box-shadow: 0 0 12px -3px rgba(240, 224, 160, 0.85), inset 0 0 10px -4px rgba(246, 231, 176, 0.9);
  transition: all 0.16s var(--ease);
}
.board__layout:hover {
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-soft));
  color: #1a1408;
  box-shadow: 0 0 16px -2px rgba(240, 224, 160, 0.95);
}
.board__layout[aria-pressed='true'] {
  background: linear-gradient(180deg, var(--gold-bright), var(--gold));
  color: #1a1408;
}

.board__grid {
  display: grid;
  gap: 10px;
  align-items: start;
  /* 插入线要相对网格定位，所以这里必须是定位上下文 */
  position: relative;
}
.board:not(.is-grid) .board__grid {
  gap: 8px;
}

/* 队伍换序的插入线：横跨整个网格宽度，居中在目标边界上 */
.board__dropline {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  margin-top: -1.5px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--gold-bright) 10%,
    var(--gold-bright) 90%,
    transparent 100%
  );
  box-shadow: 0 0 10px 1px rgba(240, 224, 160, 0.9);
  pointer-events: none;
  z-index: 9;
}
</style>
