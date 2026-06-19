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

export interface Scene {
  id: string
  name: string
  icon: string
  tracks: SceneTrack[]
  isBuiltIn: boolean
  createdAt: number
}

interface StoredPreferences {
  tracks: Array<{ id: string; volume: number }>
  masterVolume: number
}

interface StoredScenes {
  scenes: Scene[]
  activeSceneId: string | null
}

const STORAGE_KEY = 'dreamstream_preferences'
const SCENE_STORAGE_KEY = 'dreamstream_scenes'
const ACTIVE_SCENE_KEY = 'dreamstream_active_scene'

const builtInScenes: Scene[] = [
  {
    id: 'scene-rain-forest',
    name: '雨林小憩',
    icon: 'Sunrise',
    tracks: [
      { id: 'rain', volume: 60 },
      { id: 'forest', volume: 45 }
    ],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'scene-campfire',
    name: '温暖篝火',
    icon: 'Lightning',
    tracks: [
      { id: 'fire', volume: 70 },
      { id: 'forest', volume: 30 }
    ],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'scene-ocean-waves',
    name: '海浪轻拍',
    icon: 'Sunset',
    tracks: [
      { id: 'waves', volume: 65 }
    ],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'scene-focus',
    name: '专注模式',
    icon: 'MagicStick',
    tracks: [
      { id: 'white-noise', volume: 40 },
      { id: 'piano', volume: 35 }
    ],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'scene-deep-sleep',
    name: '深度睡眠',
    icon: 'Moon',
    tracks: [
      { id: 'rain', volume: 50 },
      { id: 'white-noise', volume: 25 }
    ],
    isBuiltIn: true,
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

function loadScenesData(): StoredScenes {
  try {
    const storedScenes = localStorage.getItem(SCENE_STORAGE_KEY)
    const storedActive = localStorage.getItem(ACTIVE_SCENE_KEY)

    let customScenes: Scene[] = []
    let modifiedBuiltIns: Scene[] = []

    if (storedScenes) {
      const parsed = JSON.parse(storedScenes)
      customScenes = parsed.custom || []
      modifiedBuiltIns = parsed.builtIn || []
    }

    const mergedBuiltIns = builtInScenes.map(bi => {
      const modified = modifiedBuiltIns.find(m => m.id === bi.id)
      return modified ? { ...bi, ...modified, isBuiltIn: true } : bi
    })

    return {
      scenes: [...mergedBuiltIns, ...customScenes],
      activeSceneId: storedActive
    }
  } catch {
    return {
      scenes: [...builtInScenes],
      activeSceneId: null
    }
  }
}

function saveScenesData(scenes: Scene[], activeSceneId: string | null) {
  try {
    const customScenes = scenes.filter(s => !s.isBuiltIn)
    const modifiedBuiltIns = scenes
      .filter(s => s.isBuiltIn)
      .map(s => {
        const original = builtInScenes.find(b => b.id === s.id)
        if (!original) return null
        const hasChanges =
          s.name !== original.name ||
          JSON.stringify(s.tracks) !== JSON.stringify(original.tracks) ||
          s.icon !== original.icon
        return hasChanges ? s : null
      })
      .filter(Boolean) as Scene[]

    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify({
      custom: customScenes,
      builtIn: modifiedBuiltIns
    }))

    if (activeSceneId) {
      localStorage.setItem(ACTIVE_SCENE_KEY, activeSceneId)
    } else {
      localStorage.removeItem(ACTIVE_SCENE_KEY)
    }
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

export const useAudioStore = defineStore('audio', () => {
  const savedPrefs = loadPreferences()
  const sceneData = loadScenesData()

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

  const scenes = ref<Scene[]>(sceneData.scenes)
  const activeSceneId = ref<string | null>(sceneData.activeSceneId)
  const isTransitioning = ref(false)

  const activeTracksCount = computed(() => tracks.value.filter(t => t.isPlaying).length)
  const activeScene = computed(() => scenes.value.find(s => s.id === activeSceneId.value) || null)
  const builtInScenesList = computed(() => scenes.value.filter(s => s.isBuiltIn))
  const customScenesList = computed(() => scenes.value.filter(s => !s.isBuiltIn))

  let saveTimeout: any = null
  const savePreferencesDebounced = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      const prefs: StoredPreferences = {
        tracks: tracks.value.map(t => ({ id: t.id, volume: t.volume })),
        masterVolume: masterVolume.value
      }
      savePreferences(prefs)
    }, 300)
  }

  let sceneSaveTimeout: any = null
  const saveScenesDebounced = () => {
    if (sceneSaveTimeout) clearTimeout(sceneSaveTimeout)
    sceneSaveTimeout = setTimeout(() => {
      saveScenesData(scenes.value, activeSceneId.value)
    }, 300)
  }

  watch(
    () => tracks.value.map(t => ({ id: t.id, volume: t.volume })),
    () => savePreferencesDebounced(),
    { deep: true }
  )
  watch(masterVolume, () => savePreferencesDebounced())
  watch(scenes, saveScenesDebounced, { deep: true })
  watch(activeSceneId, saveScenesDebounced)

  function generateSceneId(): string {
    return `scene-custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  function isSceneNameTaken(name: string, excludeId?: string): boolean {
    return scenes.value.some(s => s.id !== excludeId && s.name.trim() === name.trim())
  }

  function saveCurrentAsScene(name: string, sceneTracks: SceneTrack[], icon: string = 'Star'): Scene | null {
    const trimmedName = name.trim()
    if (isSceneNameTaken(trimmedName)) {
      ElMessage.warning(`已存在名为「${trimmedName}」的场景，请换一个名称`)
      return null
    }

    const scene: Scene = {
      id: generateSceneId(),
      name: trimmedName,
      icon,
      tracks: sceneTracks.filter(t => t.volume > 0),
      isBuiltIn: false,
      createdAt: Date.now()
    }
    scenes.value.push(scene)
    activeSceneId.value = scene.id
    ElMessage.success(`场景「${trimmedName}」已保存`)
    return scene
  }

  function renameScene(id: string, newName: string): boolean {
    const scene = scenes.value.find(s => s.id === id)
    if (!scene) return false

    const trimmedName = newName.trim()
    if (isSceneNameTaken(trimmedName, id)) {
      ElMessage.warning(`已存在名为「${trimmedName}」的场景，请换一个名称`)
      return false
    }

    scene.name = trimmedName
    if (scene.isBuiltIn) {
      ElMessage.success(`预设场景已重命名为「${trimmedName}」，您可以随时恢复默认`)
    } else {
      ElMessage.success(`场景已重命名为「${trimmedName}」`)
    }
    return true
  }

  function deleteScene(id: string) {
    const index = scenes.value.findIndex(s => s.id === id)
    if (index > -1) {
      const scene = scenes.value[index]
      const name = scene.name
      const wasBuiltIn = scene.isBuiltIn
      scenes.value.splice(index, 1)
      if (activeSceneId.value === id) {
        activeSceneId.value = null
      }
      if (wasBuiltIn) {
        ElMessage.success(`预设场景「${name}」已删除，可通过「恢复默认」找回`)
      } else {
        ElMessage.success(`场景「${name}」已删除`)
      }
    }
  }

  function restoreDefaultScenes() {
    const existingCustom = scenes.value.filter(s => !s.isBuiltIn)
    const existingBuiltInIds = new Set(scenes.value.filter(s => s.isBuiltIn).map(s => s.id))
    const restoredBuiltIns = builtInScenes.filter(b => !existingBuiltInIds.has(b.id))
    scenes.value = [...builtInScenes, ...existingCustom]
    ElMessage.success(`已恢复 ${restoredBuiltIns.length} 个默认场景`)
  }

  function setActiveScene(id: string | null) {
    activeSceneId.value = id
  }

  function setTransitioning(value: boolean) {
    isTransitioning.value = value
  }

  function getSceneById(id: string): Scene | undefined {
    return scenes.value.find(s => s.id === id)
  }

  function updateSceneTracks(id: string, newTracks: SceneTrack[]) {
    const scene = scenes.value.find(s => s.id === id)
    if (scene) {
      scene.tracks = newTracks.filter(t => t.volume > 0)
    }
  }

  return {
    tracks,
    masterVolume,
    isGlobalPlaying,
    timerDuration,
    timerRemaining,
    activeTracksCount,
    scenes,
    activeSceneId,
    activeScene,
    isTransitioning,
    builtInScenesList,
    customScenesList,
    saveCurrentAsScene,
    renameScene,
    deleteScene,
    restoreDefaultScenes,
    setActiveScene,
    setTransitioning,
    getSceneById,
    updateSceneTracks
  }
})
