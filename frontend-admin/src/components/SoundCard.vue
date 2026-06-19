<template>
  <el-card
    class="sound-card feature-card"
    :class="{ 'is-playing': isActuallyPlaying }"
    role="button"
    :aria-label="`${track.name}音效卡片，${isActuallyPlaying ? '正在播放' : '未播放'}`"
    :aria-pressed="isActuallyPlaying"
    tabindex="0"
    @click="togglePlay"
    @keydown.enter="togglePlay"
    @keydown.space.prevent="togglePlay"
  >
    <div class="card-content">
      <div class="icon-wrapper" aria-hidden="true">
        <el-icon :size="28" aria-hidden="true">
          <component :is="getIconComponent(track.icon)" />
        </el-icon>
      </div>
      <div class="info">
        <h3 role="heading" aria-level="3">{{ track.name }}</h3>
        <div class="controls" @click.stop role="group" :aria-label="`${track.name}音量控制`">
          <el-slider
            v-model="volume"
            :min="0"
            :max="100"
            size="small"
            :disabled="!isActuallyPlaying"
            :show-tooltip="isActuallyPlaying"
            :aria-label="`${track.name}音量，当前${volume}%`"
            :aria-valuemin="0"
            :aria-valuemax="100"
            :aria-valuenow="volume"
            :aria-disabled="!isActuallyPlaying"
            @input="handleVolumeChange"
          />
        </div>
      </div>
      <div class="status-indicator" role="status" :aria-live="isActuallyPlaying ? 'polite' : 'off'">
        <div class="equalizer" :class="{ 'is-active': isActuallyPlaying }" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <span class="sr-only">{{ isActuallyPlaying ? '正在播放' : '已停止' }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAudioStore, type SoundTrack } from '@/stores/audioStore'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const props = defineProps<{
  track: SoundTrack
  onToggle: (id: string) => void
  onVolumeChange: (id: string, val: number) => void
}>()

const store = useAudioStore()

// 计算实际播放状态：需要同时满足 track.isPlaying 和 isGlobalPlaying
const isActuallyPlaying = computed(() => {
  return props.track.isPlaying && store.isGlobalPlaying
})

const volume = ref(props.track.volume)

watch(() => props.track.volume, (newVal) => {
  volume.value = newVal
})

const togglePlay = () => {
  props.onToggle(props.track.id)
}

const handleVolumeChange = (val: number | number[]) => {
  // val is number | number[] in Element Plus, force it to number
  const numVal = Array.isArray(val) ? val[0] : val
  props.track.volume = numVal
  props.onVolumeChange(props.track.id, numVal)
}

// 获取图标组件，如果不存在则使用默认图标
const getIconComponent = (iconName: string) => {
  const IconComponent = (ElementPlusIconsVue as any)[iconName]
  if (IconComponent) {
    return IconComponent
  }
  // 如果图标不存在，返回默认图标
  return ElementPlusIconsVue.Headset || ElementPlusIconsVue.Cherry
}
</script>

<style scoped lang="scss">
.sound-card {
  cursor: pointer;
  position: relative;
  overflow: hidden;
  height: 100%;
  border-radius: 16px;
  transition: all 0.3s ease;

  &.is-playing {
    border: 1px solid var(--el-color-primary) !important;
    background: linear-gradient(145deg, #1e293b, #26334d) !important;
  }
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
  text-align: center;
  min-height: 200px; /* 固定最小高度防止抖动 */
}

.icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;

  :deep(.el-icon) {
    color: #94a3b8;
    transition: color 0.3s;
    font-size: 28px;
  }
}

.sound-card.is-playing .icon-wrapper :deep(.el-icon) {
  color: var(--el-color-primary);
}

.info {
  width: 100%;

  h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.controls {
  height: 32px; /* 固定高度防止抖动 */
  display: flex;
  align-items: center;
  opacity: 1;
  transition: opacity 0.3s ease;

  :deep(.el-slider) {
    opacity: 1;

    &.is-disabled {
      opacity: 0.3;
    }
  }
}

.status-indicator {
  min-height: 24px; /* 固定高度防止抖动 */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}

.equalizer {
  display: flex;
  gap: 4px;
  height: 16px;
  align-items: flex-end;
  justify-content: center;
  min-height: 16px; /* 固定高度 */

  span {
    width: 4px;
    background-color: rgba(129, 140, 248, 0.2);
    border-radius: 2px;
    transition: background-color 0.3s ease;

    &:nth-child(1) { height: 60%; }
    &:nth-child(2) { height: 100%; }
    &:nth-child(3) { height: 40%; }
  }

  &.is-active {
    span {
      background-color: var(--el-color-primary);
      animation: bounce 1s infinite ease-in-out;

      &:nth-child(1) { animation-delay: 0s; }
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }
}

@keyframes bounce {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1); }
}

/* 屏幕阅读器专用样式 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
