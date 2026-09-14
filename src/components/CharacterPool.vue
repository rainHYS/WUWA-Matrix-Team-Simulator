<script setup>
/**
 * 角色池
 * ------------------------------------------------------------
 * · 展示全部可用角色；体力耗尽变灰、不可拖拽（§2.6）
 * · 卡片支持 hover / drag-over 选中态（§2.8，仅角色池卡片生效）
 * · 点击卡片 = 自动入队（放进第一支还有空位、且未上阵该角色的队伍）
 * · 空白池区域 = 拖回角色池（把角色从队伍移除，§2.1）
 */
import { computed } from 'vue'
import CharacterCard from './CharacterCard.vue'
import { ELEMENTS } from '@/data/elements.js'
import { useGameStore } from '@/stores/game.js'
import { drag, beginDrag, endDrag, setHoverCard, clearOverSlot, writeDataTransfer } from '@/composables/useDrag.js'

const props = defineProps({
  /** 每张卡片的宽度（px），由父级按可用空间传入 */
  cardWidth: { type: Number, default: 128 },
})

const emit = defineEmits(['toast'])

const store = useGameStore()

/**
 * 体力还没用完的角色。
 * 用户 2026-09-11 反馈：用尽的角色直接从池里下掉，不要一直摆着灰卡让人来回翻。
 */
const usableCharacters = computed(() => store.ownedCharacters.filter((c) => store.remainingOf(c.id) > 0))

/** 已用尽被移出池子的角色（只用于给个数字提示，避免用户以为角色丢了） */
const exhaustedList = computed(() => store.ownedCharacters.filter((c) => store.remainingOf(c.id) <= 0))

const elTabs = computed(() => {
  const counts = new Map()
  const usable = usableCharacters.value
  for (const c of usable) counts.set(c.element, (counts.get(c.element) || 0) + 1)
  return [
    { key: 'all', name: '全部', hex: '#bb9f5e', count: usable.length },
    ...ELEMENTS.map((e) => ({ key: e.key, name: e.name, hex: e.hex, count: counts.get(e.name) || 0 })),
  ]
})

const poolList = computed(() => {
  const kw = store.ui.keyword.trim().toLowerCase()
  // 只显示「已持有」且「体力未用尽」的角色
  let list = usableCharacters.value.slice()
  if (store.ui.elementFilter !== 'all') {
    list = list.filter((c) => c.elementKey === store.ui.elementFilter)
  }
  if (kw) {
    list = list.filter(
      (c) => c.name.toLowerCase().includes(kw) || c.element.toLowerCase().includes(kw),
    )
  }
  const sort = store.ui.sort
  if (sort === 'star') {
    list.sort((a, b) => b.star - a.star || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  } else if (sort === 'remaining') {
    list.sort((a, b) => store.remainingOf(b.id) - store.remainingOf(a.id) || b.star - a.star)
  } else if (sort === 'assigned') {
    list.sort((a, b) => (store.usedCountMap.get(b.id) || 0) - (store.usedCountMap.get(a.id) || 0))
  }
  return list
})

const assignedCount = computed(() => poolList.value.filter((c) => store.usedCountMap.get(c.id)).length)
const hasOpenSlot = computed(() => store.teams.some((t) => t.slots.some((s) => !s)))

function toast(type, text) {
  emit('toast', { type, text })
}

/** 该角色已上阵的队伍名（用于提示文案） */
function teamNameOf(charId) {
  const t = store.teams.find((x) => x.slots.includes(charId))
  return t?.name || ''
}

/* ---------------- 拖拽 ---------------- */
function onDragStart(char, e) {
  if (store.isExhausted(char.id)) {
    e.preventDefault()
    return
  }
  beginDrag({ charId: char.id })
  writeDataTransfer(e, char.id)
}

/** 选中态：hover 与 drag-over 共用同一套视觉（§2.8） */
function onCardEnter(char) {
  setHoverCard(char.id)
}
function onCardLeave(char) {
  if (drag.hoverCardId === char.id) setHoverCard(null)
}
function onCardDragOver(char, e) {
  if (!drag.active) return
  e.preventDefault()
  // 必须拦住冒泡，否则外层 .pool__grid 的 dragover 会立刻把高亮清掉
  e.stopPropagation()
  setHoverCard(char.id)
  clearOverSlot()
}

function onPoolDragOver() {
  // 拖到角色池空白区 —— 清除卡片高亮与槽位高亮，标记为"移出队伍"
  if (drag.active) {
    setHoverCard(null)
    clearOverSlot()
  }
}

function onDropToPool() {
  if (!drag.active) return
  if (drag.fromTeamId) {
    store.removeCard(drag.fromTeamId, drag.fromIndex)
    const c = store.char(drag.charId)
    toast('ok', `已将「${c?.name || ''}」移出队伍`)
  }
  endDrag()
}

/* ---------------- 点击自动入队 ---------------- */
/** 找第一支「还有空位」且「尚未上阵该角色」的队伍 */
function firstOpenSlot(charId) {
  for (const t of store.teams) {
    if (t.slots.includes(charId)) continue
    const i = t.slots.findIndex((s) => !s)
    if (i >= 0) return { teamId: t.id, index: i, teamName: t.name }
  }
  return null
}

function onCardClick(char) {
  if (store.isExhausted(char.id)) {
    const tn = teamNameOf(char.id)
    toast('warn', tn ? `「${char.name}」已在「${tn}」上阵，体力已用尽` : `「${char.name}」体力已用尽`)
    return
  }
  const slot = firstOpenSlot(char.id)
  if (!slot) {
    if (!hasOpenSlot.value) toast('warn', '所有队伍都满了，先新建一支队伍')
    else toast('warn', `「${char.name}」已在本队伍中，换个槽位或新建队伍`)
    return
  }
  const res = store.moveCard({ charId: char.id, toTeamId: slot.teamId, toIndex: slot.index })
  if (res.ok) {
    // v0.4：点进哪支队，哪支队就成为焦点（自动展开），其他队伍收缩
    store.focusTeam(slot.teamId)
    toast('ok', `「${char.name}」已加入「${slot.teamName}」`)
  } else if (res.code === 'EXHAUSTED') toast('warn', `「${char.name}」体力已用尽`)
  else if (res.code === 'DUPLICATE_IN_TEAM') toast('warn', `「${slot.teamName}」中已有「${char.name}」`)
  else toast('warn', '无法入队：槽位或体力受限')
}
</script>

<template>
  <section class="pool panel" :style="{ '--card-w-pool': cardWidth + 'px' }">
    <header class="pool__head">
      <h2 class="pool__title">
        角色池
        <span class="tag">可上场 {{ poolList.length }}</span>
        <span class="tag">已入队 {{ assignedCount }}</span>
        <span
          v-if="exhaustedList.length"
          class="tag pool__exhausted"
          :title="`已用尽体力的角色会从池中移出：${exhaustedList.map((c) => c.name).join('、')}`"
        >
          已用尽移出 {{ exhaustedList.length }}
        </span>
      </h2>

      <div class="pool__tools">
        <input
          v-model="store.ui.keyword"
          class="input pool__search"
          type="search"
          placeholder="搜索角色名 / 属性…"
          aria-label="搜索角色"
        />
        <select v-model="store.ui.sort" class="input pool__sort" aria-label="排序方式">
          <option value="default">默认顺序</option>
          <option value="star">按星级</option>
          <option value="remaining">按剩余体力</option>
          <option value="assigned">按入队状态</option>
        </select>
      </div>
    </header>

    <nav class="pool__tabs" aria-label="属性筛选">
      <button
        v-for="t in elTabs"
        :key="t.key"
        type="button"
        class="pool__tab"
        :class="{ 'is-on': store.ui.elementFilter === t.key }"
        :style="{ '--el': t.hex }"
        @click="store.ui.elementFilter = t.key"
      >
        <i class="pool__tab-dot" />{{ t.name }}
        <span class="pool__tab-n">{{ t.count }}</span>
      </button>
    </nav>

    <p class="pool__tip faint">
      <b>点击卡片</b>自动入队；也可以<b>拖拽</b>到指定队伍槽位。体力用尽的角色会自动从池中移出。
    </p>

    <div
      class="pool__grid"
      :class="{ 'is-dropzone': drag.active && drag.fromTeamId }"
      @dragover.prevent="onPoolDragOver"
      @drop.prevent="onDropToPool"
    >
      <div
        v-for="c in poolList"
        :key="c.id"
        class="pool__cell"
        @mouseenter="onCardEnter(c)"
        @mouseleave="onCardLeave(c)"
        @dragover="onCardDragOver(c, $event)"
        @click="onCardClick(c)"
      >
        <CharacterCard
          :char="c"
          variant="pool"
          draggable
          :selected="drag.hoverCardId === c.id"
          @dragstart="onDragStart(c, $event)"
          @dragend="endDrag"
        />
      </div>

      <p v-if="!poolList.length" class="pool__empty faint">
        <template v-if="exhaustedList.length && exhaustedList.length >= store.ownedCharacters.length">
          所有角色体力都已用尽 —— 点队伍区的「重置本期体力」恢复。
        </template>
        <template v-else>没有匹配的角色，试试换个属性或关键词。</template>
      </p>
    </div>
  </section>
</template>

<style scoped>
.pool {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 12px 6px;
}

.pool__head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.pool__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
}
.pool__tools {
  display: flex;
  gap: 8px;
}
.pool__search {
  width: 180px;
}
.pool__sort {
  width: 128px;
}

.pool__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line-soft);
}
.pool__tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--text-dim);
  font-size: 12.5px;
  transition: all 0.15s var(--ease);
}
.pool__tab:hover {
  border-color: var(--el);
  color: var(--text);
}
.pool__tab.is-on {
  background: var(--el);
  border-color: var(--el);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 0 10px -2px var(--el);
}
.pool__tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el);
  box-shadow: 0 0 6px var(--el);
}
.pool__tab.is-on .pool__tab-dot {
  background: #fff;
  box-shadow: 0 0 6px #fff;
}
.pool__tab-n {
  opacity: 0.75;
  font-size: 11px;
}

.pool__tip {
  margin-bottom: 8px;
  font-size: 11.5px;
}
.pool__tip b {
  color: var(--accent);
}

/* 已用尽移出的提示：别让人以为是角色丢了 */
.pool__exhausted {
  border-color: var(--warn);
  color: var(--warn);
  cursor: help;
}

.pool__grid {
  position: relative;
  flex: 1;
  min-height: 120px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-w-pool), 1fr));
  gap: 16px 14px;
  align-content: start;
  padding: 8px 2px 16px;
  border-radius: var(--radius);
  transition: background 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.pool__grid.is-dropzone {
  background: rgba(187, 159, 94, 0.05);
  box-shadow: inset 0 0 0 1px rgba(187, 159, 94, 0.28);
}

.pool__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 让放大后的卡片（含描边与辉光）不被相邻单元盖住 */
  isolation: isolate;
}
.pool__cell:hover {
  z-index: 6;
}

.pool__empty {
  grid-column: 1 / -1;
  padding: 26px 0;
  text-align: center;
}
</style>
