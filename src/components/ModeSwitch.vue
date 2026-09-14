<script setup>
/**
 * 共鸣模态切换控件
 * ------------------------------------------------------------
 * 按用户附图复刻（原图 273×90，胶囊约 247×65）：
 *   · 左右两枚圆形徽记（直径 ≈ 0.95×控件高）
 *   · 中间一条连接带（高 ≈ 0.815×控件高），生效侧那一半是金色渐变、另一侧暗灰
 *   · 正中一枚四芒星（凹边菱形）金边、内部深色
 *   · 生效侧圆环为亮金 + 外发光；未生效侧为细灰环
 * 所有尺寸都按 --ms-h（控件高）等比推导，因此放在卡片上会自动缩放。
 */
import { computed } from 'vue'
import { modeByName } from '@/data/elements.js'

const props = defineProps({
  /** 模态名数组，长度 ≥ 2 */
  modes: { type: Array, required: true },
  /** 当前模态名 */
  modelValue: { type: String, default: '' },
  /** 是否在控件下方显示当前模态名 */
  showLabel: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'change'])

const list = computed(() => props.modes.slice(0, 2))
const activeIndex = computed(() => {
  const i = list.value.indexOf(props.modelValue)
  return i < 0 ? 0 : i
})

function iconOf(name) {
  return modeByName(name)?.icon || ''
}

function pick(i) {
  const name = list.value[i]
  if (!name || name === props.modelValue) return
  emit('update:modelValue', name)
  emit('change', name)
}
</script>

<template>
  <div class="ms" :class="{ 'is-b': activeIndex === 1 }" role="group" aria-label="共鸣模态切换">
    <div class="ms__track">
      <div class="ms__bar" aria-hidden="true">
        <span class="ms__bar-fill" />
        <span class="ms__bar-sheen" />
        <span class="ms__bar-line" />
      </div>

      <svg class="ms__star" viewBox="0 0 100 116" aria-hidden="true">
        <path
          class="ms__star-outer"
          d="M50 0 Q57 43 100 58 Q57 73 50 116 Q43 73 0 58 Q43 43 50 0 Z"
        />
        <path
          class="ms__star-inner"
          d="M50 29 Q53.5 50.5 75 58 Q53.5 65.5 50 87 Q46.5 65.5 25 58 Q46.5 50.5 50 29 Z"
        />
      </svg>

      <button
        v-for="(m, i) in list"
        :key="m"
        type="button"
        class="ms__side"
        :class="[i === 0 ? 'ms__side--a' : 'ms__side--b', { 'is-on': activeIndex === i }]"
        :title="`切换到「${m}」${activeIndex === i ? '（当前）' : ''}`"
        :aria-pressed="activeIndex === i"
        @click.stop="pick(i)"
      >
        <img v-if="iconOf(m)" class="ms__icon" :src="iconOf(m)" :alt="m" draggable="false" />
      </button>
    </div>

    <span v-if="showLabel && list[activeIndex]" class="ms__label">{{ list[activeIndex] }}</span>
  </div>
</template>

<style scoped>
.ms {
  --ms-h: 30px;
  --ms-w: calc(var(--ms-h) * 3.8);
  --ms-r: calc(var(--ms-h) * 0.475);

  --gold-hi: #f6e7b0;
  --gold-mid: #d8c184;
  --gold-lo: #9d8442;

  position: relative;
  width: var(--ms-w);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--ms-h) * 0.1);
  user-select: none;
}

.ms__track {
  position: relative;
  width: var(--ms-w);
  height: var(--ms-h);
}

/* ---------------- 连接带 ---------------- */
.ms__bar {
  position: absolute;
  left: var(--ms-r);
  right: var(--ms-r);
  top: calc(var(--ms-h) * 0.0925);
  bottom: calc(var(--ms-h) * 0.0925);
  border-radius: 99px;
  overflow: hidden;
  background: linear-gradient(90deg, #3c3d44 0%, #33343b 50%, #2b2c33 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

/* 生效侧的那一半铺金色 */
.ms__bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50%;
  background: linear-gradient(90deg, var(--gold-mid) 0%, var(--gold-lo) 70%, rgba(157, 132, 66, 0.45) 100%);
  transition: transform 0.3s var(--ease);
}
.ms.is-b .ms__bar-fill {
  transform: translateX(100%);
}

/* 上下亮边（附图里带子有立体感） */
.ms__bar-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.04) 30%,
    rgba(0, 0, 0, 0) 50%,
    rgba(255, 255, 255, 0.05) 78%,
    rgba(255, 255, 255, 0.2) 100%
  );
  pointer-events: none;
}

/* 贯穿中央的一道细亮线 */
.ms__bar-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  transform: translateY(-50%);
  background: linear-gradient(
    90deg,
    rgba(255, 246, 214, 0.85) 0%,
    rgba(255, 246, 214, 0.5) 40%,
    rgba(190, 190, 200, 0.28) 62%,
    rgba(160, 160, 170, 0.18) 100%
  );
  pointer-events: none;
}

/* ---------------- 中央四芒星 ---------------- */
.ms__star {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--ms-h) * 0.84);
  height: calc(var(--ms-h) * 0.97);
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 0 calc(var(--ms-h) * 0.1) rgba(240, 224, 160, 0.55));
  z-index: 2;
}
.ms__star-outer {
  fill: var(--gold-hi);
}
.ms__star-inner {
  fill: #23242b;
}

/* ---------------- 两端圆形徽记 ---------------- */
.ms__side {
  position: absolute;
  top: 0;
  width: calc(var(--ms-h) * 0.95);
  height: calc(var(--ms-h) * 0.95);
  padding: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: radial-gradient(circle at 50% 42%, #0a0b0f 0%, #0e1015 58%, #191b21 100%);
  transition: box-shadow 0.25s var(--ease), transform 0.15s var(--ease);
  z-index: 3;
}
.ms__side--a {
  left: 0;
}
.ms__side--b {
  right: 0;
}
.ms__side:active {
  transform: scale(0.94);
}

/* 未生效：细灰环 */
.ms__side {
  box-shadow: 0 0 0 1.8px rgba(186, 188, 198, 0.62), inset 0 0 6px rgba(0, 0, 0, 0.9);
}
/* 生效：香槟金圆环 + 外发光 */
.ms__side.is-on {
  box-shadow: 0 0 0 2.5px var(--gold-hi), 0 0 calc(var(--ms-h) * 0.35) calc(var(--ms-h) * 0.06)
      rgba(240, 224, 160, 0.85),
    inset 0 0 calc(var(--ms-h) * 0.25) rgba(240, 224, 160, 0.35);
}

.ms__icon {
  width: 58%;
  height: 58%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  opacity: 0.78;
  transition: opacity 0.25s var(--ease), filter 0.25s var(--ease);
}
.ms__side.is-on .ms__icon {
  opacity: 1;
  filter: drop-shadow(0 0 calc(var(--ms-h) * 0.08) rgba(255, 240, 190, 0.75));
}

/* ---------------- 名称标签 ---------------- */
/* 文字保留，但加一层深色底，压在立绘/光带上也看得清 */
.ms__label {
  padding: calc(var(--ms-h) * 0.03) calc(var(--ms-h) * 0.2);
  border-radius: 99px;
  font-size: calc(var(--ms-h) * 0.42);
  line-height: 1.35;
  color: var(--gold-hi);
  background: rgba(10, 11, 15, 0.8);
  border: 1px solid rgba(246, 231, 176, 0.35);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
  white-space: nowrap;
  letter-spacing: 0.02em;
  backdrop-filter: blur(2px);
}
</style>
