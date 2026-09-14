<script setup>
import { toasts, dismissToast } from '@/composables/useToast.js'
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast--${t.type}`"
        @click="dismissToast(t.id)"
      >
        <span class="toast__icon">{{
          t.type === 'ok' ? '✓' : t.type === 'warn' ? '!' : t.type === 'error' ? '×' : 'i'
        }}</span>
        <span class="toast__text">{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 78vw;
  padding: 8px 16px 8px 10px;
  border-radius: 99px;
  background: var(--panel-3);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-2);
  font-size: 13px;
  pointer-events: auto;
  cursor: pointer;
}
.toast__icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: #0e1016;
  background: var(--text-dim);
}
.toast--ok .toast__icon {
  background: var(--ok);
}
.toast--warn .toast__icon {
  background: var(--warn);
}
.toast--error .toast__icon {
  background: var(--danger);
  color: #fff;
}
.toast--ok {
  border-color: color-mix(in srgb, var(--ok) 45%, var(--line));
}
.toast--warn {
  border-color: color-mix(in srgb, var(--warn) 45%, var(--line));
}
.toast__text {
  color: var(--text);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}
</style>
