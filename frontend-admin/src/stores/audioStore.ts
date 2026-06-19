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
  tracks: SceneTrack[]
  masterVolume: number
  isDefault: boolean
  createdAt: number
}

interface StoredPreferences {
  tracks: Array<{ id: string; volume: number }>
  masterVolume: number
  scenes: Scene[]
  activeSceneId: string | null
}

const STORAGE_KEY = 'dreamstream_preferences'
const SCENES_STORAGE_KEY = 'dreamstream_scenes'
// 已被用户删除的默认场景 ID，需要持久化以避免下次启动时被重新合并回来
const REMOVED_DEFAULTS_KEY = 'dreamstream_removed_default_scenes'

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function createDefaultScenes(): Scene[] {
  return [
    {
      id: 'default-rain',
      name: '雨夜安眠',
      tracks: [
        { id: 'rain', volume: 65 },
        { id: 'fire', volume: 25 }
      ],
      masterVolume: 75,
      isDefault: true,
      createdAt: 0
    },
    {
      id: 'default-forest',
      name: '森林清晨',
      tracks: [
        { id: 'forest', volume: 55 },
        { id: 'piano', volume: 20 }
      ],
      masterVolume: 70,
      isDefault: true,
      createdAt: 0
    },
    {
      id: 'default-ocean',
      name: '海浪轻抚',
      tracks: [
        { id: 'waves', volume: 60 },
        { id: 'white-noise', volume: 20 }
      ],
      masterVolume: 80,
      isDefault: true,
      createdAt: 0
    },
    {
      id: 'default-focus',
      name: '专注白噪',
      tracks: [
        { id: 'white-noise', volume: 45 },
        { id: 'piano', volume: 30 }
      ],
      masterVolume: 65,
      isDefault: true,
      createdAt: 0
    },
    {
      id: 'default-meditation',
      name: '冥想放松',
      tracks: [
        { id: 'piano', volume: 40 },
        { id: 'forest', volume: 35 }
      ],
      masterVolume: 60,
      isDefault: true,
      createdAt: 0
    }
  ]
}

function loadRemovedDefaults(): Set<string> {
  try {
    const stored = localStorage.getItem(REMOVED_DEFAULTS_KEY)
    if (stored) {
      return new Set(JSON.parse(stored) as string[])
    }
  } catch {
    // 静默处理
  }
  return new Set()
}

function saveRemovedDefaults(ids: Set<string>) {
  try {
    localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // 静默处理
  }
}

function loadScenes(): Scene[] {
  const removed = loadRemovedDefaults()
  try {
    const stored = localStorage.getItem(SCENES_STORAGE_KEY)
    if (stored) {
      // 现在所有场景（包括被重命名/编辑后的默认场景）都存在 SCENES_STORAGE_KEY 中
      const storedScenes = JSON.parse(stored) as Scene[]
      const defaultScenes = createDefaultScenes()
      // 仅补齐那些既未被存储、也未被用户删除过的默认场景
      const missingDefaults = defaultScenes.filter(
        d => !storedScenes.some(s => s.id === d.id) && !removed.has(d.id)
      )
      return [...missingDefaults, ...storedScenes]
    }
  } catch {
    // 静默处理
  }
  // 首次启动：返回未被删除过的默认场景
  return createDefaultScenes().filter(d => !removed.has(d.id))
}

function saveScenes(scenes: Scene[]) {
  try {
    // 现在持久化所有场景（包括被改名的默认场景），以保留用户的所有修改
    localStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(scenes))
  } catch {
    // 静默处理
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

  const scenes = ref<Scene[]>(loadScenes())
  const activeSceneId = ref<string | null>(savedPrefs.activeSceneId ?? null)

  const activeTracksCount = computed(() => tracks.value.filter(t => t.isPlaying).length)
  const activeScene = computed(() => scenes.value.find(s => s.id === activeSceneId.value) || null)
  const defaultScenes = computed(() => scenes.value.filter(s => s.isDefault))
  const customScenes = computed(() => scenes.value.filter(s => !s.isDefault))

  let saveTimeout: any = null
  const savePreferencesDebounced = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      const prefs: StoredPreferences = {
        tracks: tracks.value.map(t => ({ id: t.id, volume: t.volume })),
        masterVolume: masterVolume.value,
        scenes: scenes.value,
        activeSceneId: activeSceneId.value
      }
      savePreferences(prefs)
    }, 300)
  }

  let scenesSaveTimeout: any = null
  const saveScenesDebounced = () => {
    if (scenesSaveTimeout) clearTimeout(scenesSaveTimeout)
    scenesSaveTimeout = setTimeout(() => {
      saveScenes(scenes.value)
    }, 300)
  }

  watch(
    () => tracks.value.map(t => ({ id: t.id, volume: t.volume })),
    () => savePreferencesDebounced(),
    { deep: true }
  )

  watch(masterVolume, () => savePreferencesDebounced())
  watch(activeSceneId, () => savePreferencesDebounced())
  watch(scenes, () => saveScenesDebounced(), { deep: true })

  function saveCurrentAsScene(name: string) {
    const playingTracks = tracks.value
      .filter(t => t.isPlaying)
      .map(t => ({ id: t.id, volume: t.volume }))

    if (playingTracks.length === 0) {
      ElMessage.warning('请先选择至少一个音效再保存场景')
      return null
    }

    const newScene: Scene = {
      id: generateId(),
      name: name.trim(),
      tracks: playingTracks,
      masterVolume: masterVolume.value,
      isDefault: false,
      createdAt: Date.now()
    }

    scenes.value.push(newScene)
    activeSceneId.value = newScene.id
    ElMessage.success(`场景「${newScene.name}」已保存`)
    return newScene
  }

  function renameScene(sceneId: string, newName: string) {
    const scene = scenes.value.find(s => s.id === sceneId)
    if (!scene) return
    const trimmed = newName.trim()
    if (!trimmed) {
      ElMessage.warning('场景名称不能为空')
      return
    }
    scene.name = trimmed
    ElMessage.success('场景已重命名')
  }

  // 已删除的默认场景 ID 集合，仅在内存中维护，删除时同步写盘
  const removedDefaultIds = ref<Set<string>>(loadRemovedDefaults())

  function deleteScene(sceneId: string) {
    const idx = scenes.value.findIndex(s => s.id === sceneId)
    if (idx === -1) return
    const scene = scenes.value[idx]
    scenes.value.splice(idx, 1)
    if (activeSceneId.value === sceneId) {
      activeSceneId.value = null
    }
    // 默认场景被删除时记录其 ID，避免下次启动重新合并回来
    if (scene.isDefault) {
      removedDefaultIds.value.add(scene.id)
      saveRemovedDefaults(removedDefaultIds.value)
    }
    ElMessage.success(`场景「${scene.name}」已删除`)
  }

  function applySceneState(scene: Scene) {
    // 仅关闭非场景音轨的播放状态，保留它们用户原先调好的音量
    const sceneTrackIds = new Set(scene.tracks.map(st => st.id))
    tracks.value.forEach(t => {
      if (!sceneTrackIds.has(t.id)) {
        t.isPlaying = false
        // 不再重置 volume，保留用户的手动设置
      }
    })

    scene.tracks.forEach(st => {
      const track = tracks.value.find(t => t.id === st.id)
      if (track) {
        track.volume = st.volume
        track.isPlaying = true
      }
    })

    masterVolume.value = scene.masterVolume
    activeSceneId.value = scene.id
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
    defaultScenes,
    customScenes,
    saveCurrentAsScene,
    renameScene,
    deleteScene,
    applySceneState
  }
})
