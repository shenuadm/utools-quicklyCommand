<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  icon: { type: String, default: 'layers' },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' }
})
</script>

<template>
  <div class="empty">
    <div class="empty-icon"><AppIcon :name="icon" :size="26" :stroke-width="1.5" /></div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-desc">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 44px 20px;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: var(--bg-sunken);
  color: var(--text-faint);
}

.empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.empty-desc {
  margin: 0;
  max-width: 340px;
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
