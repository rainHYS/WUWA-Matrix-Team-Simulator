<script setup>
/**
 * 「选择你已有的角色」页
 * ------------------------------------------------------------
 * 用户要求：不是所有人都有全角色，进入配队模拟器之前先让用户自行勾选。
 * 默认全选（老用户不受影响）；漂泊者四个属性形态各自独立勾选。
 */
import { computed, ref } from 'vue'
import CharAvatar from './CharAvatar.vue'
import { ELEMENTS } from '@/data/elements.js'
import { useGameStore } from '@/stores/game.js'

const emit = defineEmits(['toast'])

const store = useGameStore()

const keyword = ref('')
const elementFilter = ref('all')

const visible = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = store.characters.slice()
  if (elementFilter.value !== 'all') list = list.filter((c) => c.elementKey === elementFilter.value)
  if (kw) list = list.filter((c) => c.name.toLowerCase().includes(kw))
  return list
})

const groups = computed(() =>
  ELEMENTS.map((el) => {
    const rows = visible.value.filter((c) => c.elementKey === el.key)
    return {
      el,
      rows,
      total: rows.length,
      owned: rows.filter((c) => store.isOwned(c.id)).length,
    }
  }).filter((g) => g.rows.length),
)

const ownedTotal = computed(() => store.ownedCharacters.length)
const allOwned = computed(() => store.unownedCount === 0)

const tabs = computed(() => {
  const counts = new Map()
  for (const c of store.characters) counts.set(c.element, (counts.get(c.element) || 0) + 1)
  return [
    { key: 'all', name: '全部', hex: '#bb9f5e', count: store.characters.length },
    ...ELEMENTS.map((e) => ({ key: e.key, name: e.name, hex: e.hex, count: counts.get(e.name) || 0 })),
  ]
})

function toggleGroup(g) {
  const allOn = g.rows.every((c) => store.isOwned(c.id))
  store.setOwnedMany(
    g.rows.map((c) => c.id),
    !allOn,
  )
}

function selectAll() {
  store.selectAllOwned()
  emit('toast', { type: 'ok', text: '已全选 60 位角色' })
}

function clearAll() {
  if (!window.confirm('清空后将取消所有角色的持有，且会一并清空当前队伍编排。确定吗？')) return
  store.clearAllOwned()
  emit('toast', { type: 'warn', text: '已清空持有角色' })
}

function start() {
  if (ownedTotal.value === 0) {
    emit('toast', { type: 'warn', text: '至少选择 1 位角色才能开始配队' })
    return
  }
  store.confirmOwnership()
}
</script>

<template>
  <div class="own">
    <header class="own__head">
      <div class="own__brand">
        <span class="own__mark">终</span>
        <div>
          <h1 class="own__title">选择你已有的角色</h1>
          <p class="own__sub">终焉矩阵配队模拟器 · 角色池只显示你勾选的角色，之后可随时回来修改</p>
        </div>
      </div>

      <div class="own__countbox">
        <span class="own__count-num">{{ ownedTotal }}</span>
        <span class="own__count-of">/ {{ store.characters.length }}</span>
        <span class="own__count-label">已选角色</span>
      </div>
    </header>

    <div class="own__tools">
      <input v-model="keyword" class="input own__search" type="search" placeholder="搜索角色名…" />
      <div class="own__bulk">
        <button class="btn own__bulk-btn" type="button" @click="selectAll">
          <span class="own__bulk-ico">✓</span> 全选
        </button>
        <button class="btn own__bulk-btn" type="button" @click="clearAll">
          <span class="own__bulk-ico">✕</span> 全不选
        </button>
      </div>
      <nav class="own__tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="own__tab"
          :class="{ 'is-on': elementFilter === t.key }"
          :style="{ '--el': t.hex }"
          @click="elementFilter = t.key"
        >
          <i class="own__dot" />{{ t.name }}
          <span class="own__tab-n">{{ t.count }}</span>
        </button>
      </nav>
      <span v-if="!allOwned" class="tag own__partial">已排除 {{ store.unownedCount }} 位</span>
    </div>

    <div class="own__body">
      <section v-for="g in groups" :key="g.el.key" class="own__group">
        <button class="own__group-head" type="button" @click="toggleGroup(g)">
          <i class="own__dot" :style="{ '--el': g.el.hex }" />
          <span class="own__group-name">{{ g.el.name }}</span>
          <span class="own__group-n">{{ g.owned }}/{{ g.total }}</span>
          <span class="own__group-hint faint">点击整组切换</span>
        </button>

        <div class="own__cells">
          <button
            v-for="c in g.rows"
            :key="c.id"
            type="button"
            class="own__cell"
            :class="{ 'is-off': !store.isOwned(c.id) }"
            :style="{ '--el': c.elementHex }"
            :title="store.isOwned(c.id) ? `取消持有「${c.name}」` : `标记为持有「${c.name}」`"
            @click="store.toggleOwned(c.id)"
          >
            <CharAvatar :char="c" size="60px" radius="8px" />
            <span class="own__cell-name">{{ c.name }}</span>
            <span class="own__cell-star">{{ c.star }}★</span>
            <span class="own__check" aria-hidden="true">✓</span>
          </button>
        </div>
      </section>

      <p v-if="!groups.length" class="faint own__empty">没有匹配的角色。</p>
    </div>

    <!-- 底部固定操作条：把「开始配队」放大摆到最显眼的位置 -->
    <footer class="own__bar">
      <div class="own__bar-info">
        <span class="own__bar-num">{{ ownedTotal }}</span>
        <span class="own__bar-text">
          位角色已选<span class="own__bar-sub">（共 {{ store.characters.length }} 位，未选的不进角色池）</span>
        </span>
      </div>
      <button class="own__start" type="button" :disabled="ownedTotal === 0" @click="start">
        开始配队
        <span class="own__start-arrow">→</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.own {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 0;
  gap: 12px;
}

.own__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}
.own__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.own__mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  font-size: 21px;
  font-weight: 800;
  color: var(--accent-text);
  background: linear-gradient(145deg, var(--gold-bright), var(--gold));
  box-shadow: 0 0 16px -3px var(--gold);
}
.own__title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.own__sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
}

.own__tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-soft);
}
.own__search {
  width: 190px;
}
.own__tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.own__tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--text-dim);
  font-size: 12.5px;
}
.own__tab:hover {
  border-color: var(--el);
  color: var(--text);
}
.own__tab.is-on {
  background: var(--el);
  border-color: var(--el);
  color: #fff;
  font-weight: 600;
}
.own__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el);
  box-shadow: 0 0 6px var(--el);
}
.own__tab.is-on .own__dot {
  background: #fff;
  box-shadow: 0 0 6px #fff;
}
.own__tab-n {
  opacity: 0.75;
  font-size: 11px;
}
.own__partial {
  border-color: var(--warn);
  color: var(--warn);
}

.own__countbox {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 6px 16px;
  border-radius: 99px;
  border: 1px solid var(--gold);
  background: linear-gradient(180deg, rgba(246, 231, 176, 0.14), rgba(187, 159, 94, 0.08));
}
.own__count-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--gold-bright);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.own__count-of {
  font-size: 13px;
  color: var(--text-dim);
}
.own__count-label {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-faint);
}

/* 批量按钮：加大加粗，别再缩在角落 */
.own__bulk {
  display: flex;
  gap: 8px;
}
.own__bulk-btn {
  padding: 7px 16px;
  font-size: 13.5px;
  font-weight: 600;
  gap: 7px;
}
.own__bulk-ico {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  font-size: 11px;
  background: var(--panel-3);
  color: var(--accent);
}
.own__bulk-btn:hover .own__bulk-ico {
  background: var(--accent);
  color: var(--accent-text);
}

/* 底部固定操作条 */
.own__bar {
  position: sticky;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin: 14px -24px 0;
  padding: 12px 24px;
  background: var(--panel);
  border-top: 1px solid var(--line);
  box-shadow: 0 -8px 26px -12px rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
}
.own__bar-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.own__bar-num {
  font-size: 26px;
  font-weight: 800;
  color: var(--gold-bright);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.own__bar-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.own__bar-sub {
  margin-left: 6px;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-faint);
}
.own__start {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 13px 34px;
  border-radius: 12px;
  border: 1px solid var(--gold-bright);
  background: linear-gradient(180deg, var(--gold-bright), var(--gold));
  color: #1a1408;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.06em;
  box-shadow: 0 4px 20px -6px rgba(240, 224, 160, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
  transition: all 0.16s var(--ease);
}
.own__start:hover:not(:disabled) {
  filter: brightness(1.07);
  box-shadow: 0 6px 26px -6px rgba(240, 224, 160, 1);
  transform: translateY(-1px);
}
.own__start:active:not(:disabled) {
  transform: translateY(1px);
}
.own__start:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.own__start-arrow {
  font-size: 19px;
  line-height: 1;
}

.own__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.own__group-head {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
}
.own__group-head:hover {
  border-color: var(--line);
  background: var(--panel-2);
}
.own__group-name {
  font-size: 13.5px;
  font-weight: 700;
}
.own__group-n {
  font-size: 11.5px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.own__group-hint {
  font-size: 11px;
}

.own__cells {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.own__cell {
  position: relative;
  width: 82px;
  padding: 6px 4px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  transition: all 0.15s var(--ease);
}
.own__cell:hover {
  border-color: var(--el);
  transform: translateY(-2px);
}
.own__cell.is-off {
  opacity: 0.42;
  filter: grayscale(0.85);
}
.own__cell.is-off:hover {
  opacity: 0.7;
}
.own__cell-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.own__cell-star {
  font-size: 10px;
  color: var(--gold-soft);
}
.own__check {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 15px;
  height: 15px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  color: #10240f;
  background: var(--ok);
  opacity: 1;
  transition: opacity 0.15s var(--ease);
}
.own__cell.is-off .own__check {
  opacity: 0;
}

.own__empty {
  padding: 30px 0;
  text-align: center;
}
</style>
