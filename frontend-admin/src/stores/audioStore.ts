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

export interface SceneTrack {
  id: string
  volume: number
}

export interface ScenePreset {
  id: string
  name: string
  icon: string
  tracks: SceneTrack[]
  masterVolume: number
  isDefault: boolean
  createdAt: number
}

interface StoredPreferences {
  tracks: Array<{ id: string; volume: number }>
  masterVolume: number
  scenes?: ScenePreset[]
  deletedDefaultSceneIds?: string[]
  activeSceneId?: string | null
}

const STORAGE_KEY = 'dreamstream_preferences'

const DEFAULT_SCENES: ScenePreset[] = [
  {
    id: 'rainy-night',
    name: '雨夜安眠',
    icon: 'Pouring',
    tracks: [
      { id: 'rain', volume: 65 },
      { id: 'fire', volume: 25 }
    ],
    masterVolume: 75,
    isDefault: true,
    createdAt: 0
  },
  {
    id: 'deep-focus',
    name: '深度专注',
    icon: 'MagicStick',
    tracks: [
      { id: 'white-noise', volume: 45 },
      { id: 'piano', volume: 30 }
    ],
    masterVolume: 70,
    isDefault: true,
    createdAt: 0
  },
  {
    id: 'forest-dawn',
    name: '森林清晨',
    icon: 'Sunrise',
    tracks: [
      { id: 'forest', volume: 60 },
      { id: 'waves', volume: 20 }
    ],
    masterVolume: 70,
    isDefault: true,
    createdAt: 0
  },
  {
    id: 'ocean-waves',
    name: '海浪轻拍',
    icon: 'Sunset',
    tracks: [
      { id: 'waves', volume: 70 }
    ],
    masterVolume: 75,
    isDefault: true,
    createdAt: 0
  },
  {
    id: 'cozy-fire',
    name: '温暖篝火',
    icon: 'Lightning',
    tracks: [
      { id: 'fire', volume: 60 },
      { id: 'piano', volume: 20 }
    ],
    masterVolume: 70,
    isDefault: true,
    createdAt: 0
  }
]

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

export const useAudioStore = defineStore('audio', () => {
  const savedPrefs = loadPreferences()

  const defaultTracks: SoundTrack[] = [
    { id: 'rain', name: '雨声', icon: 'Pouring', url: '', volume: 50, isPlaying: false, category: 'nature' },
    { id: 'forest', name: '森林', icon: 'Sunrise', url: '', volume: 50, isPlaying: false, category: 'nature' },
    { id: 'fire', name: '篝火', icon: 'Lightning', url: '', volume: 50, isPlaying: false, category: 'nature' },
    { id: 'white-noise', name: '白噪音', icon: 'MagicStick', url: '', volume: 50, isPlaying: false, category: 'noise' },
    { id: 'piano', name: '轻钢琴', icon: 'Notification', url: '', volume: 50, isPlaying: false, category: 'music' },
    { id: 'waves', name: '海浪', icon: 'Sunset', url: '', volume: 50, isPlaying: false, category: 'nature' },
  ]

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

  const scenes = ref<ScenePreset[]>(loadScenes(savedPrefs.scenes, savedPrefs.deletedDefaultSceneIds))
  const deletedDefaultSceneIds = ref<string[]>(savedPrefs.deletedDefaultSceneIds ?? [])
  const activeSceneId = ref<string | null>(savedPrefs.activeSceneId ?? null)
  const isTransitioning = ref(false)

  function loadScenes(savedScenes?: ScenePreset[], deletedIds?: string[]): ScenePreset[] {
    const deleted = new Set(deletedIds ?? [])
    const result: ScenePreset[] = []
    const savedMap = new Map<string, ScenePreset>()

    if (savedScenes && Array.isArray(savedScenes)) {
      savedScenes.forEach(s => savedMap.set(s.id, { ...s }))
    }

    DEFAULT_SCENES.forEach(defaultScene => {
      if (deleted.has(defaultScene.id)) return
      if (savedMap.has(defaultScene.id)) {
        result.push(savedMap.get(defaultScene.id)!)
        savedMap.delete(defaultScene.id)
      } else {
        result.push({ ...defaultScene })
      }
    })

    savedMap.forEach(scene => result.push(scene))

    return result
  }

  const defaultScenes = computed(() => scenes.value.filter(s => s.isDefault))
  const customScenes = computed(() => scenes.value.filter(s => !s.isDefault))
  const activeScene = computed(() => scenes.value.find(s => s.id === activeSceneId.value) || null)

  const activeTracksCount = computed(() => tracks.value.filter(t => t.isPlaying).length)
  const hasActiveTracks = computed(() => activeTracksCount.value > 0)

  function generateSceneId(): string {
    return `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  function saveCurrentAsScene(name: string, icon: string = 'Star'): ScenePreset {
    const activeTracks = tracks.value
      .filter(t => t.isPlaying)
      .map(t => ({ id: t.id, volume: t.volume }))

    if (activeTracks.length === 0) {
      ElMessage.warning('请先选择至少一个音效')
      throw new Error('No active tracks')
    }

    const newScene: ScenePreset = {
      id: generateSceneId(),
      name,
      icon,
      tracks: activeTracks,
      masterVolume: masterVolume.value,
      isDefault: false,
      createdAt: Date.now()
    }

    scenes.value.push(newScene)
    activeSceneId.value = newScene.id
    ElMessage.success(`场景「${name}」已保存`)
    return newScene
  }

  function renameScene(sceneId: string, newName: string): void {
    const scene = scenes.value.find(s => s.id === sceneId)
    if (!scene) return

    scene.name = newName
    ElMessage.success('场景已重命名')
  }

  function deleteScene(sceneId: string): void {
    const sceneIndex = scenes.value.findIndex(s => s.id === sceneId)
    if (sceneIndex === -1) return

    const scene = scenes.value[sceneIndex]
    const wasDefault = scene.isDefault

    scenes.value.splice(sceneIndex, 1)

    if (wasDefault) {
      if (!deletedDefaultSceneIds.value.includes(sceneId)) {
        deletedDefaultSceneIds.value.push(sceneId)
      }
    }

    if (activeSceneId.value === sceneId) {
      activeSceneId.value = null
    }

    ElMessage.success(`场景「${scene.name}」已删除`)
  }

  function setActiveScene(sceneId: string | null): void {
    if (sceneId === null) {
      activeSceneId.value = null
      return
    }

    const scene = scenes.value.find(s => s.id === sceneId)
    if (scene) {
      activeSceneId.value = sceneId
    }
  }

  function getSceneById(sceneId: string): ScenePreset | undefined {
    return scenes.value.find(s => s.id === sceneId)
  }

  let saveTimeout: any = null
  const savePreferencesDebounced = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      const prefs: StoredPreferences = {
        tracks: tracks.value.map(t => ({ id: t.id, volume: t.volume })),
        masterVolume: masterVolume.value,
        scenes: scenes.value,
        deletedDefaultSceneIds: deletedDefaultSceneIds.value,
        activeSceneId: activeSceneId.value
      }
      savePreferences(prefs)
    }, 300)
  }

  watch(
    () => tracks.value.map(t => ({ id: t.id, volume: t.volume })),
    () => {
      savePreferencesDebounced()
    },
    { deep: true }
  )

  watch(masterVolume, () => {
    savePreferencesDebounced()
  })

  watch(scenes, () => {
    savePreferencesDebounced()
  }, { deep: true })

  watch(activeSceneId, () => {
    savePreferencesDebounced()
  })

  watch(deletedDefaultSceneIds, () => {
    savePreferencesDebounced()
  }, { deep: true })

  return {
    tracks,
    masterVolume,
    isGlobalPlaying,
    timerDuration,
    timerRemaining,
    activeTracksCount,
    hasActiveTracks,
    scenes,
    defaultScenes,
    customScenes,
    activeScene,
    activeSceneId,
    isTransitioning,
    saveCurrentAsScene,
    renameScene,
    deleteScene,
    setActiveScene,
    getSceneById
  }
})
