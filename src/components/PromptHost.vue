<script setup>
import { nextTick, ref, watch } from 'vue'
import { promptState, resolvePrompt } from '../stores/usePrompt.js'
import AppIcon from './AppIcon.vue'

const inputRef = ref(null)
const localValue = ref('')

watch(
  () => promptState.open,
  async (open) => {
    if (!open) return
    localValue.value = promptState.value
    await nextTick()
    if (inputRef.value) inputRef.value.focus()
  }
)

function submit() {
  resolvePrompt(localValue.value)
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !promptState.multiline) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="promptState.open" class="overlay" @click.self="resolvePrompt(null)">
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <AppIcon name="text" :size="16" />
          <h3>{{ promptState.title }}</h3>
        </div>
        <p v-if="promptState.message" class="dialog-message">{{ promptState.message }}</p>
        <textarea
          v-if="promptState.multiline"
          ref="inputRef"
          v-model="localValue"
          class="textarea"
          rows="4"
          :placeholder="promptState.placeholder"
          @keydown="onKeydown"
        ></textarea>
        <input
          v-else
          ref="inputRef"
          v-model="localValue"
          class="input"
          :placeholder="promptState.placeholder"
          @keydown="onKeydown"
        />
        <div class="dialog-actions">
          <button class="btn" @click="resolvePrompt(null)">{{ promptState.cancelText }}</button>
          <button class="btn btn-primary" @click="submit">{{ promptState.confirmText }}</button>
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
  max-width: 420px;
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
}

.dialog-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.dialog-message {
  margin: 12px 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
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
