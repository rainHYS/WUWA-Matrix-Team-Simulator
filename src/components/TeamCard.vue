<script setup>
/**
 * 单支队伍（3 个槽位）
 * ------------------------------------------------------------
 * 拖拽落地规则（§2.1）：
 *   拖到空槽                 → 入队
 *   同队拖到已占用槽位        → 换序
 *   跨队拖到已占用槽位        → 提示「槽位已占用，请拖到空位」
 *   拖到角色池空白区          → 移出队伍
 *   体力为 0 拖入             → 提示体力不足
 *
 * 紧凑态（用户 2026-09-10 要求）：鼠标不在配队区时整队缩成小头像片，
 * 只留头像 + 属性色描边 + 右下角模态角标，不含任何文字；移入/拖拽时展开。
 *
 * 队伍顺序：拖队头的握把可把整支队伍拖到别的位置调换次序。
 */
import { ref, computed, nextTick } from 'vue'
import CharacterCard from './CharacterCard.vue'
import CharChip from './CharChip.vue'
import { useGameStore, SLOT_COUNT } from '@/stores/game.js'
import {
  drag,
  beginDrag,
  endDrag,
  setOverSlot,
  clearOverSlot,
  writeDataTransfer,
  teamDrag,
  beginTeamDrag,
  setTeamDragOver,
  endTeamDrag,
  writeTeamDataTransfer,
} from '@/composables/useDrag.js'

const props = defineProps({
  team: { type: Object, required: true },
  index: { type: Number, default: 0 },
  cardWidth: { type: Number, default: 132 },
  /** 紧凑态：整队缩成小头像片 */
  compact: { type: Boolean, default: false },
  /** 列表态下可通过点击展开/收起 */
  selectable: { type: Boolean, default: false },
  /** 当前是否展开（用于给标题加高亮） */
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['toast', 'reorder', 'select'])

const store = useGameStore()

const editing = ref(false)
const draftName = ref('')
const nameInput = ref(null)

const members = computed(() => props.team.slots.map((id) => (id ? store.char(id) : null)))
const filled = computed(() => members.value.filter(Boolean).length)
const isOver = (i) => drag.overTeamId === props.team.id && drag.overIndex === i
/** 拖到自己身上时淡化，做出「拿起来了」的感觉 */
const isDragging = computed(() => teamDrag.active && teamDrag.fromIndex === props.index)

function toast(type, text) {
  emit('toast', { type, text })
}

/** 点击队伍卡（列表态）→ 展开/收起。避开按钮与输入框，别抢它们的点击 */
function onRootClick(e) {
  if (!props.selectable) return
  if (e.target?.closest?.('button, input, a')) return
  emit('select')
}

/* ---------------- 队伍重命名 ---------------- */
function startRename() {
  draftName.value = props.team.name
  editing.value = true
  nextTick(() => nameInput.value?.select())
}

function commitRename() {
  const name = draftName.value.trim() || props.team.name
  store.renameTeam(props.team.id, name)
  editing.value = false
}

/* ---------------- 队伍顺序拖拽 ---------------- */
function onTeamDragStart(e) {
  beginTeamDrag(props.index)
  writeTeamDataTransfer(e)
}

function onTeamDragOver(e) {
  if (!teamDrag.active) {
    // v0.4：卡片拖到哪支队上，哪支队就展开（其他收缩），方便对位落槽
    if (drag.active && props.selectable && store.selectedTeamId !== props.team.id) {
      e.preventDefault()
      store.setSelectedTeam(props.team.id)
    }
    return
  }
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  /*
   * v0.7：插入线的位置改为「按插入下标算一个规范坐标」，而不是直接用被悬停队伍的
   * 上沿/下沿 —— 相邻两队的上沿与下沿之间隔着一个网格间隙，鼠标在边界附近轻微
   * 移动就会在两个值之间来回跳，看起来像线在卡片边框上弹。
   *
   * 规范坐标只由插入下标 k 决定（落在第 k 支队之前）：
   *   k = 0      → 第 1 支队上沿
   *   k = 队伍数  → 最后一支队下沿
   *   其它        → 第 k-1 支队下沿 与 第 k 支队上沿 的【中点】（即间隙正中）
   * 于是「悬停 A 的下半区」与「悬停 B 的上半区」得到同一个 k、同一个坐标，线不再跳。
   */
  const el = e.currentTarget
  const grid = el?.parentElement
  const rect = el?.getBoundingClientRect?.()
  const gridRect = grid?.getBoundingClientRect?.()
  if (!rect || !gridRect) {
    setTeamDragOver(props.index, 'top', null, null)
    return
  }
  const half = e.clientY >= rect.top + rect.height / 2 ? 'bottom' : 'top'
  const k = props.index + (half === 'bottom' ? 1 : 0)

  // k 落在自己原来占的槽位上 → 拖了等于没拖，不画线
  if (k === teamDrag.fromIndex || k === teamDrag.fromIndex + 1) {
    setTeamDragOver(props.index, half, null, k)
    return
  }

  const cards = [...grid.querySelectorAll('.team')]
  const bounds = (i) => cards[i]?.getBoundingClientRect?.()
  let y
  if (k <= 0) {
    y = bounds(0)?.top
  } else if (k >= cards.length) {
    y = bounds(cards.length - 1)?.bottom
  } else {
    const prev = bounds(k - 1)
    const next = bounds(k)
    y = prev && next ? (prev.bottom + next.top) / 2 : next?.top
  }
  setTeamDragOver(props.index, half, typeof y === 'number' ? y - gridRect.top : null, k)
}

function onTeamDrop(e) {
  if (!teamDrag.active) return
  e.preventDefault()
  e.stopPropagation()
  const from = teamDrag.fromIndex
  const k = teamDrag.insertIndex
  if (from !== null && k !== null) {
    // 「插入到原数组第 k 个元素之前」换算成「移动后的最终下标」
    const to = from < k ? k - 1 : k
    if (to !== from && store.moveTeam(from, to)) {
      toast('ok', `队伍已移到第 ${to + 1} 位`)
    }
  }
  endTeamDrag()
}

/* ---------------- 槽位拖拽 ---------------- */
function onDragStartFromSlot(i, e) {
  const id = props.team.slots[i]
  if (!id) return
  beginDrag({ charId: id, fromTeamId: props.team.id, fromIndex: i })
  writeDataTransfer(e, id)
}

function onDragOverSlot(i, e) {
  e.preventDefault()
  if (!drag.active) return
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  setOverSlot(props.team.id, i)
}

function onDragLeaveSlot(e) {
  if (e.currentTarget?.contains?.(e.relatedTarget)) return
  clearOverSlot()
}

function onDropSlot(i, e) {
  e.preventDefault()
  if (!drag.active) {
    toast('warn', '请从角色池拖拽卡片到槽位')
    return
  }
  const charId = drag.charId
  const name = store.char(charId)?.name || '角色'
  const res = store.moveCard({
    charId,
    fromTeamId: drag.fromTeamId,
    fromIndex: drag.fromIndex,
    toTeamId: props.team.id,
    toIndex: i,
  })

  if (res.ok) {
    // v0.4：落到哪支队，哪支队就成为焦点（自动展开），其他队伍收缩
    store.focusTeam(props.team.id)
    if (res.code !== 'NOOP') {
      toast('ok', res.swap ? `已调整「${name}」的站位` : `「${name}」已加入 ${props.team.name}`)
    }
  } else if (res.code === 'SLOT_OCCUPIED') {
    toast('warn', '槽位已占用，请拖到空位')
  } else if (res.code === 'EXHAUSTED') {
    toast('warn', `「${name}」体力已用尽，无法入队`)
  } else if (res.code === 'DUPLICATE_IN_TEAM') {
    toast('warn', `同一队伍中不能重复上阵「${name}」`)
  } else {
    toast('warn', '无法放入该槽位')
  }
  endDrag()
}

function clearTeam() {
  let n = 0
  props.team.slots.forEach((id, i) => {
    if (id) {
      store.removeCard(props.team.id, i)
      n += 1
    }
  })
  if (n) toast('ok', `已清空「${props.team.name}」`)
}

function removeTeam() {
  if (store.teams.length <= 1) {
    toast('warn', '至少保留一支队伍')
    return
  }
  store.removeTeam(props.team.id)
  toast('ok', `已删除「${props.team.name}」`)
}

/**
 * 点击角色立绘本身 → 把 TA 放回右侧角色池（移出队伍）。
 * 用户 2026-09-11 反馈：点立绘不该收缩卡片，而是退人。
 */
function removeSlot(i) {
  const c = store.char(props.team.slots[i])
  if (!c) return
  store.removeCard(props.team.id, i)
  toast('ok', `已把「${c.name}」放回角色池`)
}
</script>

<template>
  <article
    class="team"
    :class="{
      'is-compact': compact,
      'is-dragging': isDragging,
      'is-selectable': selectable,
      'is-expanded': selectable && expanded,
    }"
    :style="{ '--card-w-slot': cardWidth + 'px' }"
    @dragover="onTeamDragOver"
    @drop="onTeamDrop"
    @click="onRootClick"
  >
    <header class="team__head">
      <button
        class="team__grip"
        type="button"
        draggable="true"
        title="按住拖动调整队伍顺序（拖到两队之间放下）"
        aria-label="拖动调整队伍顺序"
        @dragstart="onTeamDragStart"
        @dragend="endTeamDrag"
      >
        <svg viewBox="0 0 10 16" width="9" height="14" aria-hidden="true">
          <circle cx="2.5" cy="3" r="1.4" fill="currentColor" />
          <circle cx="7.5" cy="3" r="1.4" fill="currentColor" />
          <circle cx="2.5" cy="8" r="1.4" fill="currentColor" />
          <circle cx="7.5" cy="8" r="1.4" fill="currentColor" />
          <circle cx="2.5" cy="13" r="1.4" fill="currentColor" />
          <circle cx="7.5" cy="13" r="1.4" fill="currentColor" />
        </svg>
      </button>

      <span class="team__idx">{{ index + 1 }}</span>

      <input
        v-if="editing"
        ref="nameInput"
        v-model="draftName"
        class="input team__name-input"
        maxlength="20"
        @blur="commitRename"
        @keydown.enter.prevent="commitRename"
        @keydown.esc="editing = false"
      />
      <button v-else class="team__name" type="button" title="点击重命名" @click="startRename">
        {{ team.name }}
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
          <path
            d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <span class="team__count">{{ filled }}/{{ SLOT_COUNT }}</span>
      <span class="team__spacer" />
      <button class="btn btn--sm btn--ghost" type="button" :disabled="!filled" @click="clearTeam">
        清空
      </button>
      <button class="btn btn--sm btn--ghost btn--danger" type="button" @click="removeTeam">删除</button>
    </header>

    <!-- 紧凑态：一排小头像片 -->
    <div v-if="compact" class="team__chips">
      <div
        v-for="i in SLOT_COUNT"
        :key="i"
        class="team__chip-slot"
        :class="{ 'is-over': isOver(i - 1) }"
        :data-slot="i - 1"
        @dragover="onDragOverSlot(i - 1, $event)"
        @dragleave="onDragLeaveSlot"
        @drop="onDropSlot(i - 1, $event)"
      >
        <CharChip
          v-if="team.slots[i - 1]"
          :char="store.char(team.slots[i - 1])"
          :size="'var(--chip-size)'"
          draggable
          :slot-label="i"
          title="点击放回角色池"
          @dragstart="onDragStartFromSlot(i - 1, $event)"
          @dragend="endDrag"
          @click.stop="removeSlot(i - 1)"
        />
        <span v-else class="team__chip-empty">{{ i }}</span>
      </div>
    </div>

    <!-- 完整态：3 张立绘卡 -->
    <div v-else class="team__slots">
      <div
        v-for="i in SLOT_COUNT"
        :key="i"
        class="team__slot"
        :class="{ 'is-over': isOver(i - 1), 'is-filled': !!team.slots[i - 1] }"
        :data-slot="i - 1"
        @dragover="onDragOverSlot(i - 1, $event)"
        @dragleave="onDragLeaveSlot"
        @drop="onDropSlot(i - 1, $event)"
      >
        <template v-if="team.slots[i - 1]">
          <div class="team__card-hit" title="点击立绘放回角色池" @click.stop="removeSlot(i - 1)">
            <CharacterCard
              :char="store.char(team.slots[i - 1])"
              variant="slot"
              draggable
              :slot-label="i"
              @dragstart="onDragStartFromSlot(i - 1, $event)"
              @dragend="endDrag"
            />
          </div>
        </template>
        <div v-else class="team__empty">
          <span class="team__empty-plus">+</span>
          <span class="team__empty-text">拖入角色</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.team {
  padding: 10px 12px 14px;
  transition: padding 0.2s var(--ease), box-shadow 0.15s var(--ease), border-color 0.15s var(--ease);
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--line-soft);
}
.team.is-compact {
  padding: 6px 10px 8px;
}
.team.is-selectable {
  cursor: pointer;
}
.team.is-selectable:hover {
  border-color: var(--line);
}
.team.is-expanded {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(187, 159, 94, 0.4), 0 4px 18px -8px rgba(187, 159, 94, 0.7);
}
/* ---------------- 拖动换序 ----------------
 * v0.6 起，插入线不再由本组件绘制 —— 交给 TeamBoard 在队伍网格里
 * 统一渲染一个 .board__dropline（位置由实测坐标给出）。
 * 这里只保留「被拖动的那支队淡化」这一处视觉。
 */
.team.is-dragging {
  opacity: 0.45;
}

.team__head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
}
.is-compact .team__head {
  margin-bottom: 6px;
}

.team__grip {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 18px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-faint);
  cursor: grab;
}
.team__grip:hover {
  color: var(--accent);
  background: var(--panel-2);
}
.team__grip:active {
  cursor: grabbing;
}

.team__idx {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-text);
  background: linear-gradient(180deg, var(--gold-soft), var(--gold));
}
.team__name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border: 1px dashed transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team__name:hover {
  border-color: var(--line);
  background: var(--panel-2);
}
.team__name-input {
  width: 160px;
  padding: 3px 7px;
  font-size: 14px;
  font-weight: 700;
}
.team__count {
  font-size: 11.5px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.team__spacer {
  flex: 1;
}

/* ---------------- 完整态 ---------------- */
.team__slots {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 10px;
  justify-content: start;
}
.team__slot {
  position: relative;
  border-radius: var(--card-radius);
  transition: box-shadow 0.15s var(--ease), background 0.15s var(--ease);
}
.team__slot.is-over {
  background: var(--slot-bg-hover);
  box-shadow: 0 0 0 2px var(--gold), 0 0 18px rgba(187, 159, 94, 0.45);
}
.team__empty {
  width: var(--card-w-slot);
  height: calc(var(--card-w-slot) * 1.66225);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: var(--card-radius);
  border: 1px dashed var(--slot-line);
  background: var(--slot-bg);
  color: var(--text-faint);
  transition: all 0.15s var(--ease);
}
.is-over .team__empty {
  border-color: var(--gold);
  color: var(--gold-soft);
}
.team__empty-plus {
  font-size: 24px;
  line-height: 1;
  opacity: 0.8;
}
.team__empty-text {
  font-size: 11.5px;
}
/* 立绘热区：点一下就放回角色池，但不触发卡片的收缩 */
.team__card-hit {
  border-radius: var(--card-radius);
  cursor: pointer;
}

/* ---------------- 紧凑态 ---------------- */
.team__chips {
  --chip-size: clamp(34px, calc(var(--card-w-slot) * 0.44), 62px);
  display: flex;
  align-items: center;
  gap: 9px;
}
.team__chip-slot {
  border-radius: 12px;
  padding: 3px;
  transition: box-shadow 0.15s var(--ease), background 0.15s var(--ease);
}
.team__chip-slot.is-over {
  background: var(--slot-bg-hover);
  box-shadow: 0 0 0 2px var(--gold);
}
.team__chip-empty {
  display: grid;
  place-items: center;
  width: var(--chip-size);
  height: var(--chip-size);
  border-radius: 11px;
  border: 1px dashed var(--slot-line);
  background: var(--slot-bg);
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 600;
}
</style>
