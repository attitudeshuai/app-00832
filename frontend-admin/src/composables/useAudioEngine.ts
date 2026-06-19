import { ref, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAudioStore, type SoundTrack, type ScenePreset } from '@/stores/audioStore'
import { useAudioGenerator, type GeneratedAudio } from './useAudioGenerator'

const FADE_DURATION = 0.8
const TRANSITION_GAP = 0.2

export function useAudioEngine() {
  const store = useAudioStore()
  const audioGenerator = useAudioGenerator()

  const audioContext = ref<AudioContext | null>(null)
  const gainNodes = new Map<string, GainNode>()
  const audioElements = new Map<string, HTMLAudioElement>()
  const generatedSources = new Map<string, GeneratedAudio>()
  const masterGain = ref<GainNode | null>(null)
  const isApplyingScene = ref(false)

  let timerInterval: any = null

  const initAudioContext = (): boolean => {
    if (!audioContext.value) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) {
          ElMessage.error({
            message: '您的浏览器不支持音频播放功能，请使用 Chrome、Firefox 或 Safari 最新版本',
            duration: 5000,
            showClose: true
          })
          return false
        }

        audioContext.value = new AudioContextClass()

        masterGain.value = audioContext.value.createGain()
        masterGain.value.connect(audioContext.value.destination)
        masterGain.value.gain.value = store.masterVolume / 100

        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'DreamStream 混音',
              artist: '助眠应用',
              album: '放松音乐',
              artwork: [{ src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }]
            });

            navigator.mediaSession.setActionHandler('play', () => toggleGlobalPlay(true));
            navigator.mediaSession.setActionHandler('pause', () => toggleGlobalPlay(false));
          } catch {
          }
        }
      } catch {
        audioContext.value = null
        masterGain.value = null
        ElMessage.error({
          message: '音频引擎初始化失败，请刷新页面重试',
          duration: 5000,
          showClose: true
        })
        return false
      }
    }

    if (audioContext.value && audioContext.value.state === 'suspended') {
      audioContext.value.resume().catch(() => {
        ElMessage.warning({
          message: '音频播放已暂停，请点击播放按钮继续',
          duration: 3000,
          showClose: true
        })
      })
    }

    return true
  }

  const fadeOutTrack = (trackId: string, duration: number = FADE_DURATION): Promise<void> => {
    return new Promise((resolve) => {
      const gainNode = gainNodes.get(trackId)
      if (!gainNode || !audioContext.value) {
        stopTrackAudio(trackId)
        resolve()
        return
      }

      const currentTime = audioContext.value.currentTime
      gainNode.gain.cancelScheduledValues(currentTime)
      const currentGain = gainNode.gain.value
      gainNode.gain.setValueAtTime(currentGain, currentTime)
      gainNode.gain.linearRampToValueAtTime(0, currentTime + duration)

      setTimeout(() => {
        stopTrackAudio(trackId)
        resolve()
      }, duration * 1000)
    })
  }

  const fadeInTrack = (track: SoundTrack, duration: number = FADE_DURATION): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioContext.value || !masterGain.value) {
        resolve()
        return
      }

      if (audioElements.has(track.id) || generatedSources.has(track.id)) {
        const gainNode = gainNodes.get(track.id)
        if (gainNode && audioContext.value) {
          const currentTime = audioContext.value.currentTime
          gainNode.gain.cancelScheduledValues(currentTime)
          gainNode.gain.setValueAtTime(0, currentTime)
          gainNode.gain.linearRampToValueAtTime(track.volume / 100, currentTime + duration)
        }
        resolve()
        return
      }

      playTrackAudioInternal(track, true)
      
      const gainNode = gainNodes.get(track.id)
      if (gainNode && audioContext.value) {
        const currentTime = audioContext.value.currentTime
        gainNode.gain.cancelScheduledValues(currentTime)
        gainNode.gain.setValueAtTime(0, currentTime)
        gainNode.gain.linearRampToValueAtTime(track.volume / 100, currentTime + duration)
      }
      
      setTimeout(resolve, duration * 1000)
    })
  }

  const toggleTrack = (trackId: string) => {
    if (!initAudioContext()) return

    const track = store.tracks.find(t => t.id === trackId)
    if (!track) return

    const isActuallyPlaying = track.isPlaying && store.isGlobalPlaying

    if (isActuallyPlaying) {
      stopTrackAudio(trackId)
      track.isPlaying = false
      if (store.activeSceneId) {
        store.setActiveScene(null)
      }
    } else {
      if (!store.isGlobalPlaying) {
        store.tracks.forEach(t => {
          if (t.id !== trackId && t.isPlaying) {
            stopTrackAudio(t.id)
            t.isPlaying = false
          }
        })
        if (track.isPlaying) {
          stopTrackAudio(trackId)
        }
        store.isGlobalPlaying = true
        if (audioContext.value?.state === 'suspended') {
          audioContext.value.resume()
        }
      } else {
        if (track.isPlaying) {
          stopTrackAudio(trackId)
        }
      }

      playTrackAudio(track)
      track.isPlaying = true
      store.setActiveScene(null)
    }

    updateGlobalState()
  }

  const playTrackAudioInternal = async (track: SoundTrack, startSilent: boolean = false) => {
    if (!audioContext.value || !masterGain.value) return false

    if (audioElements.has(track.id) || generatedSources.has(track.id)) return true

    try {
      const generated = audioGenerator.generateAudioForTrack(audioContext.value, track.id)

      const trackGain = audioContext.value.createGain()
      trackGain.gain.value = startSilent ? 0 : track.volume / 100

      let lastNode: AudioNode = generated.source

      if (generated.filter) {
        generated.source.connect(generated.filter)
        lastNode = generated.filter
      }

      if (generated.gain) {
        lastNode.connect(generated.gain)
        lastNode = generated.gain
      }

      lastNode.connect(trackGain)
      trackGain.connect(masterGain.value)

      if ('start' in generated.source && typeof generated.source.start === 'function') {
        try {
          generated.source.start(0)
        } catch (e) {
          ElMessage.error({
            message: `无法启动 ${track.name} 音频`,
            duration: 3000,
            showClose: true
          })
          track.isPlaying = false
          updateGlobalState()
          return false
        }
      }

      generatedSources.set(track.id, generated)
      gainNodes.set(track.id, trackGain)
      return true

    } catch (error) {
      try {
        ElMessage.warning({
          message: `${track.name} 加载失败，已切换到默认音效`,
          duration: 3000,
          showClose: true
        })

        const fallback = audioGenerator.generateWhiteNoise(audioContext.value)
        const trackGain = audioContext.value.createGain()
        trackGain.gain.value = startSilent ? 0 : track.volume / 100
        fallback.connect(trackGain)
        trackGain.connect(masterGain.value)
        fallback.start(0)
        generatedSources.set(track.id, { source: fallback })
        gainNodes.set(track.id, trackGain)
        return true
      } catch (fallbackError) {
        ElMessage.error({
          message: `无法播放 ${track.name}，请稍后重试`,
          duration: 4000,
          showClose: true
        })
        track.isPlaying = false
        updateGlobalState()
        return false
      }
    }
  }

  const playTrackAudio = async (track: SoundTrack): Promise<boolean> => {
    return playTrackAudioInternal(track, false)
  }

  const stopTrackAudio = (trackId: string) => {
    const audio = audioElements.get(trackId)
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioElements.delete(trackId)
    }

    const generated = generatedSources.get(trackId)
    if (generated) {
      if (generated.lfo) {
        try {
          if ('stop' in generated.lfo && typeof generated.lfo.stop === 'function') {
            generated.lfo.stop(0)
          }
          if ('disconnect' in generated.lfo && typeof generated.lfo.disconnect === 'function') {
            generated.lfo.disconnect()
          }
        } catch (e) {
        }
      }

      if (generated.source) {
        try {
          if ('stop' in generated.source && typeof generated.source.stop === 'function') {
            generated.source.stop(0)
          }
          if ('disconnect' in generated.source && typeof generated.source.disconnect === 'function') {
            generated.source.disconnect()
          }
        } catch (e) {
        }
      }

      if (generated.filter) {
        try {
          generated.filter.disconnect()
        } catch (e) {
        }
      }

      if (generated.gain) {
        try {
          generated.gain.disconnect()
        } catch (e) {
        }
      }

      generatedSources.delete(trackId)
    }

    const gainNode = gainNodes.get(trackId)
    if (gainNode) {
      try {
        gainNode.disconnect()
      } catch (e) {
      }
      gainNodes.delete(trackId)
    }
  }

  const updateTrackVolume = (trackId: string, volume: number, immediate: boolean = false) => {
    if (isApplyingScene.value) return
    
    const gainNode = gainNodes.get(trackId)
    if (gainNode && audioContext.value) {
      if (immediate) {
        gainNode.gain.value = volume / 100
      } else {
        gainNode.gain.setTargetAtTime(volume / 100, audioContext.value.currentTime, 0.1)
      }
    }
  }

  const updateMasterVolume = (volume: number, immediate: boolean = false) => {
    if (isApplyingScene.value) return
    
    if (masterGain.value && audioContext.value) {
      if (immediate) {
        masterGain.value.gain.value = volume / 100
      } else {
        masterGain.value.gain.setTargetAtTime(volume / 100, audioContext.value.currentTime, 0.1)
      }
    }
  }

  const toggleGlobalPlay = (forceState?: boolean) => {
    if (!initAudioContext()) return

    const newState = forceState !== undefined ? forceState : !store.isGlobalPlaying
    store.isGlobalPlaying = newState

    if (newState) {
      const hasPlayingTracks = store.tracks.some(t => t.isPlaying)

      if (!hasPlayingTracks) {
        const defaultTrack = store.tracks.find(t => t.id === 'white-noise') || store.tracks[0]
        if (defaultTrack) {
          defaultTrack.isPlaying = true
          playTrackAudio(defaultTrack)
        }
      } else {
        store.tracks.forEach(track => {
          if (track.isPlaying && !audioElements.has(track.id) && !generatedSources.has(track.id)) {
            playTrackAudio(track)
          } else if (track.isPlaying && audioElements.has(track.id)) {
            const audio = audioElements.get(track.id)
            if (audio) {
              audio.play().catch(() => {
                ElMessage.warning({
                  message: `恢复播放 ${track.name} 失败，请重新点击播放`,
                  duration: 3000,
                  showClose: true
                })
                track.isPlaying = false
                updateGlobalState()
              })
            }
          } else if (track.isPlaying && generatedSources.has(track.id)) {
            if (audioContext.value?.state === 'suspended') {
              audioContext.value.resume()
            }
          }
        })
      }

      if (audioContext.value?.state === 'suspended') {
        audioContext.value.resume()
      }
    } else {
      audioElements.forEach(audio => {
        audio.pause()
      })
      if (audioContext.value?.state === 'running') {
        audioContext.value.suspend().catch(() => {
        })
      }
    }
  }

  const applyScene = async (scene: ScenePreset): Promise<boolean> => {
    if (!initAudioContext()) {
      return false
    }
    
    if (store.isTransitioning) return false
    if (!audioContext.value || !masterGain.value) {
      ElMessage.error('音频引擎不可用，无法切换场景')
      return false
    }
    
    store.isTransitioning = true
    isApplyingScene.value = true
    
    try {
      const currentPlayingTracks = store.tracks.filter(t => t.isPlaying)
      
      const fadeOutPromises = currentPlayingTracks.map(t => fadeOutTrack(t.id, FADE_DURATION))
      await Promise.all(fadeOutPromises)
      
      store.tracks.forEach(t => {
        t.isPlaying = false
      })
      
      await new Promise(resolve => setTimeout(resolve, TRANSITION_GAP * 1000))
      
      store.masterVolume = scene.masterVolume
      const currentTime = audioContext.value.currentTime
      masterGain.value.gain.cancelScheduledValues(currentTime)
      masterGain.value.gain.setValueAtTime(scene.masterVolume / 100, currentTime)
      
      const sceneTrackData = scene.tracks
        .map(st => {
          const track = store.tracks.find(t => t.id === st.id)
          return track ? { track, volume: st.volume } : null
        })
        .filter((item): item is { track: SoundTrack; volume: number } => item !== null)
      
      store.isGlobalPlaying = true
      if (audioContext.value.state === 'suspended') {
        await audioContext.value.resume()
      }
      
      const fadeInPromises = sceneTrackData.map(({ track, volume }) => {
        track.volume = volume
        track.isPlaying = true
        return fadeInTrack(track, FADE_DURATION)
      })
      await Promise.all(fadeInPromises)
      
      sceneTrackData.forEach(({ track, volume }) => {
        const gainNode = gainNodes.get(track.id)
        if (gainNode && audioContext.value) {
          const endTime = audioContext.value.currentTime
          gainNode.gain.cancelScheduledValues(endTime)
          gainNode.gain.setValueAtTime(volume / 100, endTime)
        }
      })
      
      store.setActiveScene(scene.id)
      
      ElMessage.success(`已切换到「${scene.name}」`)
      return true
    } catch (error) {
      ElMessage.error('场景切换失败，请重试')
      return false
    } finally {
      store.isTransitioning = false
      isApplyingScene.value = false
      updateGlobalState()
    }
  }

  const startTimer = (minutes: number) => {
    if (timerInterval) clearInterval(timerInterval)
    store.timerDuration = minutes
    store.timerRemaining = minutes * 60

    const startTime = Date.now()
    const targetTime = startTime + (minutes * 60 * 1000)

    timerInterval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000))

      if (remaining > 0) {
        store.timerRemaining = remaining

        if (remaining <= 60 && masterGain.value && audioContext.value && !isApplyingScene.value) {
          const fadeVolume = (remaining / 60) * (store.masterVolume / 100)
          masterGain.value.gain.setTargetAtTime(fadeVolume, audioContext.value.currentTime, 0.1)
        }
      } else {
        store.timerRemaining = 0

        clearInterval(timerInterval)
        timerInterval = null

        store.isGlobalPlaying = false

        const trackIdsToStop = Array.from(gainNodes.keys())
        trackIdsToStop.forEach(id => stopTrackAudio(id))

        audioElements.forEach(audio => {
          audio.pause()
          audio.currentTime = 0
        })
        audioElements.clear()

        store.tracks.forEach(t => t.isPlaying = false)

        store.timerDuration = null
        store.timerRemaining = null

        if (masterGain.value && audioContext.value && !isApplyingScene.value) {
          masterGain.value.gain.cancelScheduledValues(audioContext.value.currentTime)
          masterGain.value.gain.setValueAtTime(store.masterVolume / 100, audioContext.value.currentTime)
        }
      }
    }, 100)
  }

  const cancelTimer = () => {
      if (timerInterval) clearInterval(timerInterval)
      store.timerDuration = null
      store.timerRemaining = null
      if (masterGain.value && audioContext.value && !isApplyingScene.value) {
          const ct = audioContext.value.currentTime
          masterGain.value.gain.cancelScheduledValues(ct)
          masterGain.value.gain.setValueAtTime(store.masterVolume / 100, ct)
      }
  }

  const updateGlobalState = () => {
    store.isGlobalPlaying = store.tracks.some(t => t.isPlaying)
  }

  watch(() => store.masterVolume, (newVal) => updateMasterVolume(newVal))
  
  watch(
    () => store.tracks.map(t => ({ id: t.id, volume: t.volume, isPlaying: t.isPlaying })),
    (newTracks, oldTracks) => {
      if (isApplyingScene.value) return
      
      newTracks.forEach((track, idx) => {
        const old = oldTracks?.[idx]
        if (old && track.volume !== old.volume) {
          updateTrackVolume(track.id, track.volume)
        }
      })
    },
    { deep: true }
  )

  onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval)
    audioElements.forEach(audio => audio.pause())
    generatedSources.forEach((gen) => {
      if ('stop' in gen.source && typeof gen.source.stop === 'function') {
        try {
          gen.source.stop(0)
        } catch (e) {}
      }
    })
    audioContext.value?.close()
  })

  return {
    initAudioContext,
    toggleTrack,
    updateTrackVolume,
    toggleGlobalPlay,
    startTimer,
    cancelTimer,
    applyScene
  }
}
