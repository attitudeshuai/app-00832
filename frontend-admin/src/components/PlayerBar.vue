<template>
  <div class="player-bar" role="toolbar" aria-label="播放控制栏">
    <div class="bar-content">
      <div class="left" role="group" aria-label="播放和音量控制">
        <el-button
          circle
          size="large"
          @click="toggleGlobal"
          :type="store.isGlobalPlaying ? 'primary' : 'default'"
          class="play-btn"
          :aria-label="store.isGlobalPlaying ? '暂停所有音效' : '播放所有音效'"
          role="button"
          tabindex="0"
          @keydown.enter="toggleGlobal"
          @keydown.space.prevent="toggleGlobal"
        >
          <el-icon :size="24" aria-hidden="true">
            <VideoPause v-if="store.isGlobalPlaying" />
            <VideoPlay v-else />
          </el-icon>
        </el-button>
        <div class="info hidden-xs-only" role="group" aria-label="主音量控制">
          <el-tooltip content="统一调节所有音效的总音量" placement="top">
            <span class="label" id="master-volume-label">主音量</span>
          </el-tooltip>
          <el-slider
            v-model="store.masterVolume"
            class="master-slider"
            :show-tooltip="false"
            aria-label="主音量滑块"
            :aria-labelledby="'master-volume-label'"
            :aria-valuemin="0"
            :aria-valuemax="100"
            :aria-valuenow="store.masterVolume"
            :aria-valuetext="`主音量${store.masterVolume}%`"
            tabindex="0"
            @input="handleMasterVolume"
          />
        </div>
      </div>

      <div class="center" role="status" aria-live="polite" aria-atomic="true">
        <transition name="fade">
          <div v-if="store.timerRemaining" class="timer-display" :aria-label="`睡眠计时器剩余时间：${formatTime(store.timerRemaining)}`">
            <el-icon class="mr-2" aria-hidden="true"><Timer /></el-icon>
            <span>{{ formatTime(store.timerRemaining) }} 后关闭</span>
          </div>
        </transition>
      </div>

      <div class="right" role="group" aria-label="计时器控制">
        <el-popover
          placement="top"
          :width="280"
          trigger="click"
          popper-class="timer-popper"
          v-model:visible="timerPopoverVisible"
        >
          <template #reference>
            <el-button
              :type="store.timerDuration ? 'primary' : 'default'"
              circle
              class="timer-btn"
              :aria-label="store.timerDuration ? `睡眠计时器已设置${store.timerDuration}分钟` : '设置睡眠计时器'"
              :aria-expanded="timerPopoverVisible"
              role="button"
              tabindex="0"
              @keydown.enter="timerPopoverVisible = !timerPopoverVisible"
              @keydown.space.prevent="timerPopoverVisible = !timerPopoverVisible"
            >
              <el-icon aria-hidden="true"><Timer /></el-icon>
            </el-button>
          </template>
          <div class="timer-popover" role="dialog" aria-labelledby="timer-dialog-title" aria-modal="true">
            <div class="timer-header">
              <el-icon class="timer-icon" aria-hidden="true"><Timer /></el-icon>
              <h4 id="timer-dialog-title" role="heading" aria-level="4">睡眠计时器</h4>
            </div>
            <div class="timer-description" role="text">
              {{ store.timerDuration ? `当前设置：${store.timerDuration} 分钟` : '选择自动关闭时间' }}
            </div>
            <div class="timer-grid" role="group" aria-label="计时器选项">
              <el-button
                size="default"
                :type="store.timerDuration === 15 ? 'primary' : 'default'"
                class="timer-option"
                aria-label="设置15分钟睡眠计时器"
                role="button"
                tabindex="0"
                @click="handleSetTimer(15)"
                @keydown.enter="handleSetTimer(15)"
                @keydown.space.prevent="handleSetTimer(15)"
              >
                <span class="timer-value">15</span>
                <span class="timer-unit">分钟</span>
              </el-button>
              <el-button
                size="default"
                :type="store.timerDuration === 30 ? 'primary' : 'default'"
                class="timer-option"
                aria-label="设置30分钟睡眠计时器"
                role="button"
                tabindex="0"
                @click="handleSetTimer(30)"
                @keydown.enter="handleSetTimer(30)"
                @keydown.space.prevent="handleSetTimer(30)"
              >
                <span class="timer-value">30</span>
                <span class="timer-unit">分钟</span>
              </el-button>
              <el-button
                size="default"
                :type="store.timerDuration === 60 ? 'primary' : 'default'"
                class="timer-option"
                aria-label="设置60分钟睡眠计时器"
                role="button"
                tabindex="0"
                @click="handleSetTimer(60)"
                @keydown.enter="handleSetTimer(60)"
                @keydown.space.prevent="handleSetTimer(60)"
              >
                <span class="timer-value">60</span>
                <span class="timer-unit">分钟</span>
              </el-button>
              <el-button
                size="default"
                type="danger"
                plain
                class="timer-option timer-cancel"
                aria-label="关闭睡眠计时器"
                role="button"
                tabindex="0"
                @click="handleCancelTimer"
                @keydown.enter="handleCancelTimer"
                @keydown.space.prevent="handleCancelTimer"
              >
                <el-icon aria-hidden="true"><Close /></el-icon>
                <span>关闭计时器</span>
              </el-button>
            </div>
          </div>
        </el-popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAudioStore } from '@/stores/audioStore'
import { VideoPlay, VideoPause, Timer, Close } from '@element-plus/icons-vue'

const store = useAudioStore()
const emit = defineEmits(['toggle', 'set-timer', 'cancel-timer'])

const timerPopoverVisible = ref(false)

const toggleGlobal = () => emit('toggle')
const setTimer = (min: number) => emit('set-timer', min)
const cancelTimer = () => emit('cancel-timer')

const handleSetTimer = (min: number) => {
  setTimer(min)
  timerPopoverVisible.value = false // 自动关闭弹窗
}

const handleCancelTimer = () => {
  cancelTimer()
  timerPopoverVisible.value = false // 自动关闭弹窗
}

const handleMasterVolume = (val: number | number[]) => {
  store.masterVolume = Array.isArray(val) ? val[0] : val
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 88px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
  padding: 0 24px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
}

.bar-content {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.left {
  display: flex;
  align-items: center;
  gap: 32px;
  flex: 1;

  .play-btn {
    width: 56px;
    height: 56px;
    font-size: 24px;
  }

  .info {
    width: 180px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .label {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
  }
}

.center {
  flex: 1;
  display: flex;
  justify-content: center;

  .timer-display {
    display: flex;
    align-items: center;
    gap: 8px;
    font-variant-numeric: tabular-nums;
    color: var(--el-color-primary);
    font-weight: 600;
    font-size: 16px;
    background: rgba(129, 140, 248, 0.1);
    padding: 8px 16px;
    border-radius: 20px;
  }
}

.right {
  flex: 1;
  display: flex;
  justify-content: flex-end;

  .timer-btn {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
}

.timer-popover {
  padding: 8px 0;
}

.timer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .timer-icon {
    font-size: 20px;
    color: var(--el-color-primary);
  }

  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.timer-description {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 16px;
  text-align: center;
  padding: 8px;
  background: rgba(129, 140, 248, 0.1);
  border-radius: 8px;
}

.timer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.timer-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  height: auto;
  min-height: 70px;
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .timer-value {
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }

  .timer-unit {
    font-size: 12px;
    opacity: 0.8;
  }

  &.timer-cancel {
    grid-column: 1 / -1;
    flex-direction: row;
    gap: 8px;
    min-height: 44px;
    padding: 12px;

    span {
      font-size: 14px;
    }
  }
}

:deep(.timer-popper) {
  background: var(--el-bg-color) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
  padding: 20px !important;
}

@media (max-width: 768px) {
  .hidden-xs-only {
    display: none !important;
  }

  .player-bar {
    height: 72px;
    padding: 0 16px;
  }

  .left .play-btn {
    width: 48px;
    height: 48px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
