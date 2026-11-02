<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import { state } from '../stores/quickCommands.js'
import { actionTypeName } from '../core/actions.js'

/* ------------------------------------------------------------------ 数据 */

const totalCommands = computed(() => state.commands.length)
const enabledCommands = computed(() => state.commands.filter((command) => command.enabled).length)
const totalRuns = computed(() =>
  state.commands.reduce((sum, command) => sum + (command.runCount || 0), 0)
)

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

const todayStart = startOfDay(new Date())

const todayRuns = computed(
  () => state.runLog.filter((entry) => entry.at >= todayStart).length
)

/** 最近 14 天的每日执行次数 */
const days = computed(() => {
  const result = []
  const base = startOfDay(new Date())
  for (let offset = 13; offset >= 0; offset -= 1) {
    const start = new Date(base)
    start.setDate(start.getDate() - offset)
    const end = startOfDay(new Date(start.getTime() + 24 * 60 * 60 * 1000))
    const count = state.runLog.filter(
      (entry) => entry.at >= start.getTime() && entry.at < end
    ).length
    result.push({
      key: start.toISOString().slice(0, 10),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      full: `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`,
      count
    })
  }
  return result
})

const maxDaily = computed(() => Math.max(0, ...days.value.map((day) => day.count)))
const peakDay = computed(() =>
  days.value.reduce((best, day) => (day.count > best.count ? day : best), days.value[0])
)

/** 柱高比例；全为 0 时不画柱 */
function barHeight(count) {
  if (!maxDaily.value) return 0
  return (count / maxDaily.value) * 100
}

/** 高频命令排行 */
const ranking = computed(() =>
  state.commands
    .filter((command) => command.runCount > 0)
    .sort((a, b) => b.runCount - a.runCount)
    .slice(0, 10)
)
const maxRuns = computed(() => Math.max(1, ...ranking.value.map((command) => command.runCount)))

/** 按动作类型分布 */
const byAction = computed(() => {
  const map = new Map()
  for (const command of state.commands) {
    const type = command.action?.type || 'unknown'
    map.set(type, (map.get(type) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([type, count]) => ({ type, count, name: actionTypeName(type) }))
    .sort((a, b) => b.count - a.count)
})

/** 最近执行记录 */
const recent = computed(() => state.runLog.slice(0, 8))

/* --------------------------------------------------------------- 交互层 */

const hover = ref(null)

function onBarEnter(day, event) {
  const target = event.currentTarget
  const rect = target.getBoundingClientRect()
  const parent = target.parentElement.getBoundingClientRect()
  hover.value = {
    day,
    x: rect.left - parent.left + rect.width / 2,
    y: rect.top - parent.top
  }
}

function onBarLeave() {
  hover.value = null
}

function formatTime(at) {
  const date = new Date(at)
  const today = startOfDay(new Date())
  const day = startOfDay(date)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (day === today) return `今天 ${time}`
  if (day === today - 24 * 60 * 60 * 1000) return `昨天 ${time}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
</script>

<template>
  <div class="stats-view scroll">
    <!-- KPI -->
    <div class="kpi-row">
      <div class="tile">
        <p class="tile-label">快命令总数</p>
        <p class="tile-value">{{ totalCommands }}</p>
        <p class="tile-sub">{{ enabledCommands }} 条已启用</p>
      </div>
      <div class="tile">
        <p class="tile-label">累计执行</p>
        <p class="tile-value">{{ totalRuns }}</p>
        <p class="tile-sub">含启用前记录</p>
      </div>
      <div class="tile">
        <p class="tile-label">今日执行</p>
        <p class="tile-value">{{ todayRuns }}</p>
        <p class="tile-sub">最近 {{ days.length }} 天趋势见下</p>
      </div>
    </div>

    <EmptyState
      v-if="!totalCommands"
      icon="chart"
      title="还没有可统计的数据"
      description="创建并执行快命令后，这里会显示使用趋势与高频排行"
    />

    <template v-else>
      <!-- 14 天柱状图 -->
      <section class="card">
        <header class="card-head">
          <div>
            <h4>每日执行次数</h4>
            <p class="card-sub">最近 {{ days.length }} 天 · 峰值 {{ peakDay.count }} 次（{{ peakDay.label }}）</p>
          </div>
        </header>
        <div class="chart-wrap">
          <div class="y-axis">
            <span class="tick">{{ maxDaily || '—' }}</span>
            <span class="tick">0</span>
          </div>
          <div class="plot">
            <div class="gridlines" aria-hidden="true">
              <span class="gridline top"></span>
              <span class="gridline mid"></span>
              <span class="gridline base"></span>
            </div>
            <div class="cols">
              <div
                v-for="day in days"
                :key="day.key"
                class="col"
                tabindex="0"
                :aria-label="`${day.full} 执行 ${day.count} 次`"
                @mouseenter="onBarEnter(day, $event)"
                @mouseleave="onBarLeave"
                @focus="onBarEnter(day, $event)"
                @blur="onBarLeave"
              >
                <div
                  class="bar"
                  :class="{ empty: !day.count, active: hover?.day?.key === day.key }"
                  :style="{ height: `${barHeight(day.count)}%` }"
                ></div>
              </div>
            </div>
            <div class="x-axis">
              <span v-for="day in days" :key="day.key" class="x-tick">{{ day.label }}</span>
            </div>

            <div
              v-if="hover"
              class="tooltip"
              :style="{ left: `${hover.x}px`, top: `${hover.y}px` }"
            >
              <span class="tip-value">{{ hover.day.count }} 次</span>
              <span class="tip-label">{{ hover.day.full }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 高频排行 -->
      <section class="card">
        <header class="card-head">
          <div>
            <h4>高频命令</h4>
            <p class="card-sub">按累计执行次数排序，最多显示 10 条</p>
          </div>
        </header>
        <p v-if="!ranking.length" class="placeholder">还没有执行记录</p>
        <ul v-else class="rank-list">
          <li v-for="command in ranking" :key="command.id" class="rank-item">
            <span class="rank-name truncate">{{ command.icon }} {{ command.name }}</span>
            <span class="rank-track">
              <span
                class="rank-bar"
                :style="{ width: `${(command.runCount / maxRuns) * 100}%` }"
              ></span>
            </span>
            <span class="rank-value">{{ command.runCount }}</span>
          </li>
        </ul>
      </section>

      <div class="two-col">
        <!-- 动作类型分布 -->
        <section class="card">
          <header class="card-head">
            <div>
              <h4>动作类型分布</h4>
              <p class="card-sub">共 {{ totalCommands }} 条快命令</p>
            </div>
          </header>
          <ul class="dist-list">
            <li v-for="item in byAction" :key="item.type" class="dist-item">
              <span class="dist-name truncate">{{ item.name }}</span>
              <span class="dist-track">
                <span
                  class="dist-bar"
                  :style="{ width: `${(item.count / totalCommands) * 100}%` }"
                ></span>
              </span>
              <span class="dist-value">{{ item.count }}</span>
            </li>
          </ul>
        </section>

        <!-- 最近执行 -->
        <section class="card">
          <header class="card-head">
            <div>
              <h4>最近执行</h4>
              <p class="card-sub">最新 {{ recent.length }} 条记录</p>
            </div>
          </header>
          <p v-if="!recent.length" class="placeholder">还没有执行记录</p>
          <ul v-else class="recent-list">
            <li v-for="entry in recent" :key="entry.at" class="recent-item">
              <AppIcon name="play" :size="12" />
              <span class="recent-name truncate">{{ entry.name }}</span>
              <span class="recent-time">{{ formatTime(entry.at) }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats-view {
  height: 100%;
  padding: 14px;
}

/* KPI ------------------------------------------------------------------ */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.tile {
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.tile-label {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.tile-value {
  margin: 2px 0 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--text);
}

.tile-sub {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-faint);
}

/* 卡片 ------------------------------------------------------------------ */
.card {
  margin-bottom: 12px;
  padding: 13px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-head h4 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.card-sub {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-faint);
}

.placeholder {
  margin: 0;
  padding: 14px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-faint);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* 柱状图 ---------------------------------------------------------------- */
.chart-wrap {
  display: flex;
  gap: 8px;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 18px;
  width: 26px;
  flex: none;
}

.tick {
  font-size: 10.5px;
  color: var(--chart-muted);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.plot {
  position: relative;
  flex: 1;
  min-width: 0;
}

.gridlines {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 18px;
}

.gridline {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--chart-grid);
}

.gridline.top {
  top: 0;
}

.gridline.mid {
  top: 50%;
}

.gridline.base {
  bottom: 0;
  background: var(--chart-baseline);
}

.cols {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 116px;
}

.col {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: default;
  outline: none;
}

.col:focus-visible .bar {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bar {
  width: 100%;
  max-width: 24px;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  background: var(--chart-series);
  transition: opacity 0.15s, filter 0.15s;
}

.bar.empty {
  background: var(--chart-grid);
}

.bar.active {
  filter: brightness(1.12);
}

.x-axis {
  display: flex;
  gap: 2px;
  margin-top: 4px;
}

.x-tick {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 9.5px;
  color: var(--chart-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
}

.tooltip {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
  pointer-events: none;
  white-space: nowrap;
}

.tip-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.tip-label {
  font-size: 10.5px;
  color: var(--text-muted);
}

/* 排行 ------------------------------------------------------------------ */
.rank-list,
.dist-list,
.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.rank-item,
.dist-item {
  display: flex;
  align-items: center;
  gap: 9px;
}

.rank-name,
.dist-name {
  width: 118px;
  flex: none;
  font-size: 12.5px;
  color: var(--text);
}

.rank-track,
.dist-track {
  flex: 1;
  min-width: 0;
  height: 8px;
  border-radius: 999px;
  background: var(--bg-sunken);
  overflow: hidden;
}

.rank-bar,
.dist-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--chart-series);
}

.rank-value,
.dist-value {
  width: 30px;
  flex: none;
  text-align: right;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-faint);
}

.recent-name {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--text);
}

.recent-time {
  flex: none;
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>
