<script setup>
/**
 * 紧凑角色卡（头像片）
 * ------------------------------------------------------------
 * 用于「左侧配队区未选中时自动缩小」的紧凑态：
 *   · 只留头像（用 `_头像.png`，缺图退回立绘裁切）
 *   · 一圈属性色描边 —— 漂泊者四形态共用同一张头像，没有这圈颜色就分不出属性
 *   · 右下角缩小放置的模态角标（仅对该角色有模态时出现）
 * 不含任何文字，缩到很小也能认出是谁。
 */
import { computed } from 'vue'
import CharAvatar from './CharAvatar.vue'
import { modeByName } from '@/data/elements.js'
import { hexToRgba } from '@/utils/color.js'
import { useGameStore } from '@/stores/game.js'

const props = defineProps({
  char: { type: Object, required: true },
  /** 头像边长 */
  size: { type: String, default: '56px' },
  /** 是否可拖拽 */
  draggable: { type: Boolean, default: false },
  /** 槽位序号角标 */
  slotLabel: { type: [String, Number], default: '' },
})

const emit = defineEmits(['dragstart', 'dragend', 'click'])

const store = useGameStore()

const mode = computed(() => store.modeOf(props.char.id))
const hasModes = computed(() => (props.char.modes || []).length > 1)
const modeIcon = computed(() => modeByName(mode.value)?.icon || '')
const remaining = computed(() => store.remainingOf(props.char.id))
const limit = computed(() => store.limitOf(props.char.id))

const style = computed(() => ({
  '--chip': props.size,
  '--el': props.char.elementHex,
  '--el-55': hexToRgba(props.char.elementHex, 0.55),
  '--el-25': hexToRgba(props.char.elementHex, 0.25),
}))

/* v0.3：去掉「名字｜属性 / 体力」这类原生 title 字段描述，
   只保留由父组件传入的操作提示（如「点击放回角色池」）。 */

function onDragStart(e) {
  emit('dragstart', e)
}
</script>

<template>
  <div
    class="chip"
    :class="{ 'is-low': remaining <= 0 }"
    :style="style"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="emit('dragend', $event)"
    @click="emit('click', $event)"
  >
    <CharAvatar class="chip__av" :char="char" :size="'var(--chip)'" radius="9px" />

    <span v-if="slotLabel !== ''" class="chip__no">{{ slotLabel }}</span>

    <span v-if="hasModes && modeIcon" class="chip__mode" :title="`模态：${mode}`">
      <img :src="modeIcon" :alt="mode" draggable="false" />
    </span>
  </div>
</template>

<style scoped>
.chip {
  position: relative;
  width: var(--chip);
  height: var(--chip);
  flex: 0 0 auto;
  border-radius: 11px;
  box-shadow: 0 0 0 2px var(--el-55), 0 0 8px -2px var(--el-55);
  cursor: pointer;
  transition: transform 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px var(--el), 0 0 12px -1px var(--el-55);
}
.chip.is-low {
  filter: grayscale(0.5) brightness(0.9);
}

.chip__av {
  width: 100%;
  height: 100%;
  border-radius: 9px;
  overflow: hidden;
}

.chip__no {
  position: absolute;
  left: -3px;
  top: -3px;
  width: 17px;
  height: 17px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  color: #14161c;
  background: var(--gold-soft);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* 模态角标：缩小放在右下角 */
.chip__mode {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 46%;
  height: 46%;
  min-width: 18px;
  min-height: 18px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: radial-gradient(circle at 50% 40%, #0a0b0f 0%, #14161c 70%, #1d2028 100%);
  box-shadow: 0 0 0 1.5px var(--gold), 0 0 8px -2px rgba(240, 224, 160, 0.9);
}
.chip__mode img {
  width: 74%;
  height: 74%;
  object-fit: contain;
  display: block;
}
</style>
