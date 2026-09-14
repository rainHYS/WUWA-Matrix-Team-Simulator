<script setup>
/**
 * 角色头像（正方形裁切）
 * 优先用 `_头像.png` 素材（256×256）；缺失时退回立绘并把取景上移，
 * 保证「心 / 锁瞑 / 自定义角色」也有像样的占位。
 */
import { computed } from 'vue'
import { avatarUrl, portraitUrl, hasAvatar, DEFAULT_ART } from '@/data/roster.js'
import { useGameStore } from '@/stores/game.js'

const props = defineProps({
  char: { type: Object, required: true },
  /** 尺寸（CSS 长度），默认 44px */
  size: { type: String, default: '44px' },
  /** 圆角：'50%' 或具体长度 */
  radius: { type: String, default: '50%' },
})

const store = useGameStore()

const useAvatar = computed(() => !props.char.custom && hasAvatar(props.char.id))

const style = computed(() => {
  const sizeVars = { '--av-size': props.size, '--av-radius': props.radius }
  const customAvatar = store.customAssetUrl(props.char.id, 'avatar')
  const customPortrait = store.customAssetUrl(props.char.id, 'portrait')

  // ① 管理员上传过头像 → 直接用
  if (customAvatar) {
    return {
      ...sizeVars,
      backgroundImage: `url("${customAvatar}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
    }
  }
  // ② 有内置头像素材 → 用
  if (useAvatar.value) {
    return {
      ...sizeVars,
      backgroundImage: `url("${avatarUrl(props.char.id)}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
    }
  }
  // ③ 管理员上传过立绘但没头像 → 裁立绘
  if (customPortrait) {
    const a = { ...DEFAULT_ART, ...(props.char.art || {}) }
    return {
      ...sizeVars,
      backgroundImage: `url("${customPortrait}")`,
      backgroundSize: `${Math.round(a.scale * 1.72)}% auto`,
      backgroundPosition: `${a.x}% 0%`,
    }
  }
  // ④ 自定义角色且什么都没有 → 属性色渐变兜底
  if (props.char.custom) {
    return {
      ...sizeVars,
      backgroundImage: `linear-gradient(150deg, ${props.char.elementHex}66, #14161c)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  // ⑤ 有立绘无头像 → 裁立绘上部
  const a = { ...DEFAULT_ART, ...(props.char.art || {}) }
  return {
    ...sizeVars,
    backgroundImage: `url("${portraitUrl(props.char.id)}")`,
    backgroundSize: `${Math.round(a.scale * 1.72)}% auto`,
    backgroundPosition: `${a.x}% 0%`,
  }
})
</script>

<template>
  <span class="av" :style="style" role="img" :aria-label="char.name" />
</template>

<style scoped>
.av {
  display: block;
  width: var(--av-size);
  height: var(--av-size);
  border-radius: var(--av-radius);
  background-repeat: no-repeat;
  background-color: #191b21;
  flex: 0 0 auto;
}
</style>
