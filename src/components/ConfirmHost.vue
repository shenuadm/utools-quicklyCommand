<script setup>
import { confirmState, resolveConfirm } from '../stores/useConfirm.js'
import AppIcon from './AppIcon.vue'
</script>

<template>
  <Transition name="fade">
    <div v-if="confirmState.open" class="overlay" @click.self="resolveConfirm(false)">
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <AppIcon name="info" :size="16" />
          <h3>{{ confirmState.title }}</h3>
        </div>
        <p v-if="confirmState.message" class="dialog-message">{{ confirmState.message }}</p>
        <p v-if="confirmState.detail" class="dialog-detail">{{ confirmState.detail }}</p>
        <div class="dialog-actions">
          <button class="btn" @click="resolveConfirm(false)">{{ confirmState.cancelText }}</button>
          <button
            class="btn"
            :class="confirmState.danger ? 'btn-danger' : 'btn-primary'"
            @click="resolveConfirm(true)"
          >
            {{ confirmState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
}

.dialog {
  width: 100%;
  max-width: 380px;
  padding: 18px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
}

.dialog-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}

.dialog-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.dialog-message {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  white-space: pre-wrap;
}

.dialog-detail {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  font-family: var(--mono);
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-break: break-all;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
