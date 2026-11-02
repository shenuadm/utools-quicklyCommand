<script setup>
import { toasts, dismiss } from '../stores/useToast.js'
import AppIcon from './AppIcon.vue'
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="item in toasts" :key="item.id" class="toast" :class="`toast-${item.type}`">
        <AppIcon
          :name="item.type === 'error' ? 'close' : item.type === 'success' ? 'check' : 'info'"
          :size="14"
        />
        <span class="toast-text">{{ item.message }}</span>
        <button class="toast-close" title="关闭" @click="dismiss(item.id)">
          <AppIcon name="close" :size="12" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 380px;
  padding: 9px 10px 9px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
  font-size: 13px;
  pointer-events: auto;
}

.toast-success {
  border-color: var(--success-soft);
  color: var(--success);
}

.toast-error {
  border-color: var(--danger-soft);
  color: var(--danger);
}

.toast-info {
  color: var(--text);
}

.toast-text {
  flex: 1;
  color: var(--text);
  word-break: break-word;
}

.toast-close {
  color: var(--text-faint);
  display: flex;
  padding: 2px;
  border-radius: 4px;
}

.toast-close:hover {
  color: var(--text);
  background: var(--bg-hover);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
