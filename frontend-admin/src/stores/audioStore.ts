import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

export interface SoundTrack {
  id: string
  name: string
  icon: string
  url: string
  volume: number
  isPlaying: boolean
  category: 'nature' | 'noise' | 'music'
}

export interface ScenePreset {
  id: string
  name: string
  icon: string
  isDefault: boolean
  tracks: Array<{ id: string; volume: number; isPlaying: boolean }>
  masterVolume: number
  createdAt: number
}

interface StoredPreferences {
  tracks: Array<{ id: string; volume: number }>
  masterVolume: number
  customScenes?: ScenePreset[]
}

const STORAGE_KEY = 'dreamstream_preferences'
const SCENES_STORAGE_KEY = 'dreamstream_scenes'

function loadPreferences(): Partial<StoredPreferences> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
  }
  return {}
}

function loadCustomScenes(): ScenePreset[] {
  try {
    const stored = localStorage.getItem(SCENES_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
  }
  return []
}

let saveErrorShown = false
function savePreferences(preferences: StoredPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    saveErrorShown = false
  } catch {
    if (!saveErrorShown) {
      ElMessage.warning({
        message: '无法保存设置，请检查浏览器是否允许本地存储',
        duration: 4000,
        showClose: true
      })
      saveErrorShown = true
    }
  }
}

function saveCustomScenes(scenes: ScenePreset[]) {
  try {
    localStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(scenes))
    saveErrorShown = false
  } catch {
    if (!saveErrorShown) {
      ElMessage.warning({
        message: '无法保存场景，请检查浏览器是否允许本地存储',
        duration: 4000,
        showClose: true
      })
      saveErrorShown = true
    }
  }
}

const defaultScenes: ScenePreset[] = [
  {
    id: 'rain-night',
    name: '雨夜安眠',
    icon: 'Pouring',
    isDefault: true,
    tracks: [
      { id: 'rain', volume: 70, isPlaying: true },
      { id: 'piano', volume: 30, isPlaying: true }
    ],
    masterVolume: 75,
    createdAt: 0
  },
  {
    id: 'forest-dawn',
    name: '森林清晨',
    icon: 'Sunrise',
    isDefault: true,
    tracks: [
      { id: 'forest', volume: 65, isPlaying: true },
      { id: 'piano', volume: 25, isPlaying: true }
    ],
    masterVolume: 70,
    createdAt: 0
  },
  {
    id: 'fireplace',
    name: '温暖篝火',
    icon: 'Lightning',
    isDefault: true,
    tracks: [
      { id: 'fire', volume: 75, isPlaying: true },
      { id: 'forest', volume: 30, isPlaying: true }
    ],
    masterVolume: 65,
    createdAt: 0
  },
  {
    id: 'ocean-waves',
    name: '海浪轻拍',
    icon: 'Sunset',
    isDefault: true,
    tracks: [
      { id: 'waves', volume: 80, isPlaying: true },
      { id: 'white-noise', volume: 20, isPlaying: true }
    ],
    masterVolume: 70,
    createdAt: 0
  },
  {
    id: 'focus-white',
    name: '专注白噪',
    icon: 'MagicStick',
    isDefault: true,
    tracks: [
      { id: 'white-noise', volume: 55, isPlaying: true }
    ],
    masterVolume: 60,
    createdAt: 0
  },
  {
    id: 'piano-relax',
    name: '钢琴放松',
    icon: 'Notification',
    isDefault: true,
    tracks: [
      { id: 'piano', volume: 60, isPlaying: true },
      { id: 'rain', volume: 25, isPlaying: true }
    ],
    masterVolume: 65,
    createdAt: 0
  }
]

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
  const timerDuration = ref<number | null>(null)
  const timerRemaining = ref<number | null>(null)
  const activeSceneId = ref<string | null>(null)
  const isTransitioning = ref(false)

  const savedCustomScenes = loadCustomScenes()
  const customScenes = ref<ScenePreset[]>(savedCustomScenes)

  const allScenes = computed(() => [...defaultScenes, ...customScenes.value])
  const activeTracksCount = computed(() => tracks.value.filter(t => t.isPlaying).length)
  const activeScene = computed(() => allScenes.value.find(s => s.id === activeSceneId.value) || null)

  let savePrefsTimeout: any = null
  let saveScenesTimeout: any = null

  const savePreferencesDebounced = () => {
    if (savePrefsTimeout) clearTimeout(savePrefsTimeout)
    savePrefsTimeout = setTimeout(() => {
      const prefs: StoredPreferences = {
        tracks: tracks.value.map(t => ({ id: t.id, volume: t.volume })),
        masterVolume: masterVolume.value
      }
      savePreferences(prefs)
    }, 300)
  }

  const saveScenesDebounced = () => {
    if (saveScenesTimeout) clearTimeout(saveScenesTimeout)
    saveScenesTimeout = setTimeout(() => {
      saveCustomScenes(customScenes.value)
    }, 300)
  }

  watch(
    () => tracks.value.map(t => ({ id: t.id, volume: t.volume })),
    () => savePreferencesDebounced(),
    { deep: true }
  )

  watch(masterVolume, () => savePreferencesDebounced())
  watch(customScenes, () => saveScenesDebounced(), { deep: true })

  const saveCurrentAsScene = (name: string, icon: string = 'Star') => {
    const newScene: ScenePreset = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      icon,
      isDefault: false,
      tracks: tracks.value
        .filter(t => t.isPlaying)
        .map(t => ({ id: t.id, volume: t.volume, isPlaying: true })),
      masterVolume: masterVolume.value,
      createdAt: Date.now()
    }
    customScenes.value.push(newScene)
    activeSceneId.value = newScene.id
    ElMessage.success(`场景「${newScene.name}」已保存`)
    return newScene
  }

  const renameScene = (sceneId: string, newName: string) => {
    const scene = customScenes.value.find(s => s.id === sceneId)
    if (scene && !scene.isDefault) {
      scene.name = newName.trim()
      ElMessage.success('场景已重命名')
    }
  }

  const deleteScene = (sceneId: string) => {
    const index = customScenes.value.findIndex(s => s.id === sceneId)
    if (index !== -1) {
      const scene = customScenes.value[index]
      if (!scene.isDefault) {
        customScenes.value.splice(index, 1)
        if (activeSceneId.value === sceneId) {
          activeSceneId.value = null
        }
        ElMessage.success(`场景「${scene.name}」已删除`)
      }
    }
  }

  const prepareSceneTransition = (sceneId: string) => {
    const scene = allScenes.value.find(s => s.id === sceneId)
    if (!scene) return null
    isTransitioning.value = true
    return scene
  }

  const applySceneState = (sceneId: string) => {
    const scene = allScenes.value.find(s => s.id === sceneId)
    if (!scene) return

    activeSceneId.value = sceneId
    masterVolume.value = scene.masterVolume

    tracks.value.forEach(track => {
      const sceneTrack = scene.tracks.find(st => st.id === track.id)
      if (sceneTrack) {
        track.isPlaying = sceneTrack.isPlaying
        track.volume = sceneTrack.volume
      } else {
        track.isPlaying = false
      }
    })

    isTransitioning.value = false
  }

  const finishSceneTransition = () => {
    isTransitioning.value = false
  }

  const clearActiveScene = () => {
    activeSceneId.value = null
  }

  return {
    tracks,
    masterVolume,
    isGlobalPlaying,
    timerDuration,
    timerRemaining,
    activeTracksCount,
    customScenes,
    allScenes,
    activeSceneId,
    activeScene,
    isTransitioning,
    saveCurrentAsScene,
    renameScene,
    deleteScene,
    prepareSceneTransition,
    applySceneState,
    finishSceneTransition,
    clearActiveScene
  }
})
