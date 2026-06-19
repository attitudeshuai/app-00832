<template>
  <div class="app-container">
    <header class="app-header" role="banner">
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon" aria-hidden="true">
            <el-icon :size="24" color="#fff" aria-hidden="true"><Moon /></el-icon>
          </div>
          <h1 role="heading" aria-level="1">DreamStream</h1>
        </div>
        <div class="tagline hidden-xs" role="text" aria-label="应用标语">
          专业助眠应用
        </div>
      </div>
    </header>

    <SceneBar @switch-scene="handleSwitchScene" />

    <main class="main-content" role="main" aria-label="主要内容区域">
      <div class="hero-section" v-if="false">
        <h2 role="heading" aria-level="2">打造您的睡眠环境</h2>
        <p>混合环境音效，为您营造完美的放松与睡眠氛围。</p>
      </div>

      <el-row :gutter="24" class="sound-grid" role="list" aria-label="音效列表">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="track in store.tracks" :key="track.id" class="mb-4" role="listitem">
          <SoundCard
            :track="track"
            :on-toggle="handleTrackToggle"
            :on-volume-change="handleTrackVolumeChange"
          />
        </el-col>
      </el-row>
    </main>

    <PlayerBar
      @toggle="toggleGlobalPlay"
      @set-timer="startTimer"
      @cancel-timer="cancelTimer"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAudioStore } from '@/stores/audioStore'
import { useAudioEngine } from '@/composables/useAudioEngine'
import SoundCard from '@/components/SoundCard.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import SceneBar from '@/components/SceneBar.vue'
import { Moon } from '@element-plus/icons-vue'

const store = useAudioStore()
const {
  initAudioContext,
  toggleTrack,
  updateTrackVolume,
  toggleGlobalPlay,
  startTimer,
  cancelTimer,
  switchToScene
} = useAudioEngine()

const handleTrackToggle = (trackId: string) => {
  store.clearActiveScene()
  toggleTrack(trackId)
}

const handleTrackVolumeChange = (trackId: string, volume: number) => {
  store.clearActiveScene()
  updateTrackVolume(trackId, volume)
}

const handleSwitchScene = (sceneId: string) => {
  switchToScene(sceneId)
}

onMounted(() => {
  document.addEventListener('click', () => initAudioContext(), { once: true })
})
</script>

<style scoped lang="scss">
.app-container {
  background: radial-gradient(circle at top center, #1e293b 0%, #0f172a 100%);
  padding-bottom: 100px;
}

.app-header {
  height: 64px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;

    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #818cf8, #6366f1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      color: #f8fafc;
      letter-spacing: -0.5px;
    }
  }

  .tagline {
    color: #64748b;
    font-size: 14px;
    font-weight: 500;
  }
}

.hero-section {
  text-align: center;
  padding: 64px 0 48px;

  h2 {
    font-size: 42px;
    font-weight: 800;
    margin: 0 0 16px;
    background: linear-gradient(to right, #fff, #94a3b8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  p {
    color: #94a3b8;
    font-size: 18px;
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
  }
}

.main-content {
  padding-top: 24px;
}

.sound-grid {
  padding: 0 12px;
}

.mb-4 {
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .app-header {
    height: 56px;

    .header-content {
      padding: 0 16px;
    }

    .logo {
      h1 {
        font-size: 18px;
      }
    }
  }

  .main-content {
    padding-top: 16px;
  }

  .hero-section {
    padding: 40px 0 32px;

    h2 {
      font-size: 32px;
    }

    p {
      font-size: 16px;
      padding: 0 24px;
    }
  }

  .hidden-xs {
    display: none;
  }
}
</style>
