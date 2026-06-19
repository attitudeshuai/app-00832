import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

export interface SoundTrack {
  id: string
  name: string
  icon: string
  url: string // 实际项目中应为真实音频地址，这里用占位符
  volume: number
  isPlaying: boolean
  category: 'nature' | 'noise' | 'music'
}

interface StoredPreferences {
  tracks: Array<{ id: string; volume: number }>
  masterVolume: number
}

const STORAGE_KEY = 'dreamstream_preferences'

// 从 localStorage 加载用户偏好
function loadPreferences(): Partial<StoredPreferences> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // localStorage 加载失败（可能是被禁用或数据损坏），使用默认值
    // 静默处理，不影响用户体验
  }
  return {}
}

// 保存用户偏好到 localStorage
let saveErrorShown = false // 避免重复提示
function savePreferences(preferences: StoredPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    saveErrorShown = false // 保存成功，重置错误标志
  } catch {
    // localStorage 保存失败（可能是被禁用或存储空间已满）
    if (!saveErrorShown) {
      ElMessage.warning({
        message: '无法保存设置，请检查浏览器是否允许本地存储',
        duration: 4000,
        showClose: true
      })
      saveErrorShown = true // 避免重复提示
    }
  }
}

export const useAudioStore = defineStore('audio', () => {
  // 从 localStorage 加载保存的偏好
  const savedPrefs = loadPreferences()

  // 预设音频列表 - 使用 Web Audio API 生成，不依赖外部 URL
  // 图标选择说明：
  // - 雨声: Pouring (倾盆大雨图标)
  // - 森林: Sunrise (日出/自然图标，代表森林清晨)
  // - 篝火: Lightning (闪电/火焰感)
  // - 白噪音: MagicStick (魔法棒，代表助眠魔法)
  // - 轻钢琴: Notification (音符/铃声图标)
  // - 海浪: Sunset (日落海边图标)
  const defaultTracks: SoundTrack[] = [
    { id: 'rain', name: '雨声', icon: 'Pouring', url: '', volume: 50, isPlaying: false, category: 'nature' },
    { id: 'forest', name: '森林', icon: 'Sunrise', url: '', volume: 50, isPlaying: false, category: 'nature' },
    { id: 'fire', name: '篝火', icon: 'Lightning', url: '', volume: 50, isPlaying: false, category: 'nature' },
    { id: 'white-noise', name: '白噪音', icon: 'MagicStick', url: '', volume: 50, isPlaying: false, category: 'noise' },
    { id: 'piano', name: '轻钢琴', icon: 'Notification', url: '', volume: 50, isPlaying: false, category: 'music' },
    { id: 'waves', name: '海浪', icon: 'Sunset', url: '', volume: 50, isPlaying: false, category: 'nature' },
  ]

  // 恢复保存的音量设置
  const tracks = ref<SoundTrack[]>(
    defaultTracks.map(track => {
      const saved = savedPrefs.tracks?.find(t => t.id === track.id)
      return {
        ...track,
        volume: saved?.volume ?? track.volume
      }
    })
  )

  const masterVolume = ref(savedPrefs.masterVolume ?? 80)
  const isGlobalPlaying = ref(false)
  const timerDuration = ref<number | null>(null) // 分钟
  const timerRemaining = ref<number | null>(null) // 秒

  // 计算属性：当前播放的轨道数量
  const activeTracksCount = computed(() => tracks.value.filter(t => t.isPlaying).length)

  // 保存偏好到 localStorage（防抖处理，避免频繁写入）
  let saveTimeout: any = null
  const savePreferencesDebounced = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      const prefs: StoredPreferences = {
        tracks: tracks.value.map(t => ({ id: t.id, volume: t.volume })),
        masterVolume: masterVolume.value
      }
      savePreferences(prefs)
    }, 300) // 300ms 防抖
  }

  // 监听轨道音量变化
  watch(
    () => tracks.value.map(t => ({ id: t.id, volume: t.volume })),
    () => {
      savePreferencesDebounced()
    },
    { deep: true }
  )

  // 监听主音量变化
  watch(masterVolume, () => {
    savePreferencesDebounced()
  })

  return {
    tracks,
    masterVolume,
    isGlobalPlaying,
    timerDuration,
    timerRemaining,
    activeTracksCount
  }
})
