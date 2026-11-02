<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import { state } from '../stores/quickCommands.js'
import { utools } from '../api/env.js'
import { toastSuccess } from '../stores/useToast.js'

const result = computed(() => state.lastResult)

function copy() {
  if (!result.value || !result.value.output) return
  utools.copyText(result.value.output)
  toastSuccess('结果已复制到剪贴板')
}
</script>

<template>
  <Transition name="slide">
    <aside v-if="result" class="drawer">
      <header class="head">
        <AppIcon :name="result.ok ? 'check' : 'close'" :size="15" />
        <div class="grow">
          <p class="title truncate">{{ result.commandName || '执行结果' }}</p>
          <p class="message truncate" :class="{ bad: !result.ok }">{{ result.message }}</p>
        </div>
        <button v-if="result.output" class="btn btn-sm" @click="copy">
          <AppIcon name="copy" :size="13" />复制
        </button>
        <button class="btn-icon" title="关闭" @click="state.lastResult = null">
          <AppIcon name="close" :size="14" />
        </button>
      </header>
      <pre v-if="result.output" class="output scroll">{{ result.output }}</pre>
      <p v-else class="empty">该命令没有产生输出</p>
    </aside>
  </Transition>
</template>

<style scoped>
.drawer {
  flex: none;
  max-height: 42%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
}

.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.message {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.message.bad {
  color: var(--danger);
}

.output {
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
}

.empty {
  padding: 18px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-faint);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(100%);
}
</style>
