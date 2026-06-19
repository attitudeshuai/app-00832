import { ref, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAudioStore, type SoundTrack, type Scene } from '@/stores/audioStore'
import { useAudioGenerator, type GeneratedAudio } from './useAudioGenerator'

export function useAudioEngine() {
  const store = useAudioStore()
  const audioGenerator = useAudioGenerator()

  const audioContext = ref<AudioContext | null>(null)
  const gainNodes = new Map<string, GainNode>()
  const audioElements = new Map<string, HTMLAudioElement>()
  const generatedSources = new Map<string, GeneratedAudio>()
  const masterGain = ref<GainNode | null>(null)

  let timerInterval: any = null
  let fadeTimeouts: any[] = []

  // 初始化音频引擎
  const initAudioContext = () => {
    if (!audioContext.value) {
      try {
        // @ts-ignore - 兼容性处理
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) {
          ElMessage.error({
            message: '您的浏览器不支持音频播放功能，请使用 Chrome、Firefox 或 Safari 最新版本',
            duration: 5000,
            showClose: true
          })
          return
        }

        audioContext.value = new AudioContextClass()

        // 创建主音量节点
        masterGain.value = audioContext.value.createGain()
        masterGain.value.connect(audioContext.value.destination)
        masterGain.value.gain.value = store.masterVolume / 100

        // 设置 Media Session
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
            // Media Session 设置失败不影响功能，静默处理
          }
        }
      } catch {
        ElMessage.error({
          message: '音频引擎初始化失败，请刷新页面重试',
          duration: 5000,
          showClose: true
        })
        return
      }
    }

    // 恢复 Context (浏览器策略可能挂起)
    if (audioContext.value && audioContext.value.state === 'suspended') {
      audioContext.value.resume().catch(() => {
        ElMessage.warning({
          message: '音频播放已暂停，请点击播放按钮继续',
          duration: 3000,
          showClose: true
        })
      })
    }
  }

  // 播放/暂停单个轨道
  const toggleTrack = (trackId: string) => {
    initAudioContext()
    const track = store.tracks.find(t => t.id === trackId)
    if (!track) return

    // 检查实际播放状态：需要同时满足 track.isPlaying 和 isGlobalPlaying
    const isActuallyPlaying = track.isPlaying && store.isGlobalPlaying

    if (isActuallyPlaying) {
      // 实际正在播放，停止
      stopTrackAudio(trackId)
      track.isPlaying = false
    } else {
      // 未播放或主音量暂停，开始播放
      // 如果主音量是暂停的，先停止所有其他轨道，只播放当前点击的轨道
      if (!store.isGlobalPlaying) {
        // 停止所有其他轨道（包括当前轨道，如果之前有残留状态）
        store.tracks.forEach(t => {
          if (t.id !== trackId && t.isPlaying) {
            stopTrackAudio(t.id)
            t.isPlaying = false
          }
        })
        // 如果当前轨道之前有残留状态，也先清理
        if (track.isPlaying) {
          stopTrackAudio(trackId)
        }
        // 启动主音量
        store.isGlobalPlaying = true
        if (audioContext.value?.state === 'suspended') {
          audioContext.value.resume()
        }
      } else {
        // 主音量正在播放，但当前轨道未播放
        // 如果当前轨道有残留状态，先清理
        if (track.isPlaying) {
          stopTrackAudio(trackId)
        }
      }

      // 播放当前轨道
      playTrackAudio(track)
      track.isPlaying = true
    }

    updateGlobalState()
  }

  // 内部：播放逻辑 - 优先使用生成的音频，失败则尝试外部 URL
  const playTrackAudio = async (track: SoundTrack, startSilent: boolean = false) => {
    if (!audioContext.value || !masterGain.value) return

    if (audioElements.has(track.id) || generatedSources.has(track.id)) return

    const initialGain = startSilent ? 0 : track.volume / 100

    try {
      const generated = audioGenerator.generateAudioForTrack(audioContext.value, track.id)

      const trackGain = audioContext.value.createGain()
      trackGain.gain.value = initialGain

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
        }
      }

      generatedSources.set(track.id, generated)
      gainNodes.set(track.id, trackGain)

    } catch (error) {
      try {
        ElMessage.warning({
          message: `${track.name} 加载失败，已切换到默认音效`,
          duration: 3000,
          showClose: true
        })

        const fallback = audioGenerator.generateWhiteNoise(audioContext.value)
        const trackGain = audioContext.value.createGain()
        trackGain.gain.value = initialGain
        fallback.connect(trackGain)
        trackGain.connect(masterGain.value)
        fallback.start(0)
        generatedSources.set(track.id, { source: fallback })
        gainNodes.set(track.id, trackGain)
      } catch (fallbackError) {
        ElMessage.error({
          message: `无法播放 ${track.name}，请稍后重试`,
          duration: 4000,
          showClose: true
        })
        track.isPlaying = false
        updateGlobalState()
      }
    }
  }

  // 内部：停止逻辑
  const stopTrackAudio = (trackId: string) => {
    // 停止外部音频
    const audio = audioElements.get(trackId)
    if (audio) {
      audio.pause()
      audio.currentTime = 0 // 重置播放位置
      audioElements.delete(trackId)
    }

    // 停止生成的音频
    const generated = generatedSources.get(trackId)
    if (generated) {
      // 先停止 LFO 振荡器（如果存在），因为它可能还在调制滤波器
      if (generated.lfo) {
        try {
          // 先停止 LFO（停止后会自动断开连接）
          if ('stop' in generated.lfo && typeof generated.lfo.stop === 'function') {
            generated.lfo.stop(0)
          }
          // 然后断开 LFO 的所有连接
          if ('disconnect' in generated.lfo && typeof generated.lfo.disconnect === 'function') {
            generated.lfo.disconnect()
          }
        } catch (e) {
          // 忽略已停止的源
        }
      }

      // 停止音频源
      if (generated.source) {
        try {
          // 先停止音频源
          if ('stop' in generated.source && typeof generated.source.stop === 'function') {
            generated.source.stop(0)
          }
          // 然后断开所有连接
          if ('disconnect' in generated.source && typeof generated.source.disconnect === 'function') {
            generated.source.disconnect()
          }
        } catch (e) {
          // 忽略已停止的源
        }
      }

      // 断开滤波器连接（停止后断开）
      if (generated.filter) {
        try {
          generated.filter.disconnect()
        } catch (e) {
          // 忽略错误
        }
      }

      // 断开增益节点连接（停止后断开）
      if (generated.gain) {
        try {
          generated.gain.disconnect()
        } catch (e) {
          // 忽略错误
        }
      }

      generatedSources.delete(trackId)
    }

    // 断开并删除增益节点
    const gainNode = gainNodes.get(trackId)
    if (gainNode) {
      try {
        gainNode.disconnect()
      } catch (e) {
        // 忽略错误
      }
      gainNodes.delete(trackId)
    }
  }

  // 更新音量
  const updateTrackVolume = (trackId: string, volume: number) => {
    const gainNode = gainNodes.get(trackId)
    if (gainNode && audioContext.value) {
      gainNode.gain.setTargetAtTime(volume / 100, audioContext.value.currentTime, 0.1)
    }
  }

  // 更新主音量
  const updateMasterVolume = (volume: number) => {
    if (masterGain.value && audioContext.value) {
      masterGain.value.gain.setTargetAtTime(volume / 100, audioContext.value.currentTime, 0.1)
    }
  }

  // 全局播放/暂停
  const toggleGlobalPlay = (forceState?: boolean) => {
    initAudioContext()
    const newState = forceState !== undefined ? forceState : !store.isGlobalPlaying
    store.isGlobalPlaying = newState

    if (newState) {
      // 检查是否有任何音轨在播放
      const hasPlayingTracks = store.tracks.some(t => t.isPlaying)

      // 如果没有音轨在播放，自动选择一个默认音轨（白噪音）开始播放
      if (!hasPlayingTracks) {
        const defaultTrack = store.tracks.find(t => t.id === 'white-noise') || store.tracks[0]
        if (defaultTrack) {
          defaultTrack.isPlaying = true
          playTrackAudio(defaultTrack)
        }
      } else {
        // 恢复所有状态为 playing 的轨道
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
            // 生成的音频已经启动，只需要确保 context 是 running 状态
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
      // 暂停所有，但不改变 track.isPlaying 状态（为了恢复）
      audioElements.forEach(audio => {
        audio.pause()
      })
      // 生成的音频通过停止/启动控制，这里只暂停外部音频
      // 但我们可以通过暂停 AudioContext 来暂停所有生成的音频
      if (audioContext.value?.state === 'running') {
        audioContext.value.suspend().catch(() => {
          // 暂停失败通常是浏览器策略问题，静默处理即可
          // 不影响用户体验，不需要提示
        })
      }
    }
  }

  // 计时器逻辑
  const startTimer = (minutes: number) => {
    if (timerInterval) clearInterval(timerInterval)
    store.timerDuration = minutes
    store.timerRemaining = minutes * 60

    // 使用更精确的时间控制
    const startTime = Date.now()
    const targetTime = startTime + (minutes * 60 * 1000)

    timerInterval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000))

      if (remaining > 0) {
        store.timerRemaining = remaining

        // 最后 1 分钟渐弱
        if (remaining <= 60 && masterGain.value && audioContext.value) {
          const fadeVolume = (remaining / 60) * (store.masterVolume / 100)
          masterGain.value.gain.setTargetAtTime(fadeVolume, audioContext.value.currentTime, 0.1)
        }
      } else {
        // 时间到，确保剩余时间为 0
        store.timerRemaining = 0

        // 清除定时器
        clearInterval(timerInterval)
        timerInterval = null

        // 停止所有音频
        store.isGlobalPlaying = false
        audioElements.forEach(audio => audio.pause())

        // 停止所有生成的音频
        generatedSources.forEach((gen) => {
          if ('stop' in gen.source && typeof gen.source.stop === 'function') {
            try {
              gen.source.stop(0)
            } catch (e) {}
          }
          if (gen.lfo && 'stop' in gen.lfo && typeof gen.lfo.stop === 'function') {
            try {
              gen.lfo.stop(0)
            } catch (e) {}
          }
        })

        // 重置计时器状态
        store.timerDuration = null
        store.timerRemaining = null

        // 恢复音量以便下次播放
        if (masterGain.value && audioContext.value) {
          masterGain.value.gain.value = store.masterVolume / 100
        }
      }
    }, 100) // 每 100ms 检查一次，提高精度
  }

  const cancelTimer = () => {
      if (timerInterval) clearInterval(timerInterval)
      store.timerDuration = null
      store.timerRemaining = null
      if (masterGain.value && audioContext.value) {
          masterGain.value.gain.value = store.masterVolume / 100
      }
  }

  const updateGlobalState = () => {
    store.isGlobalPlaying = store.tracks.some(t => t.isPlaying)
  }

  const clearFadeTimeouts = () => {
    fadeTimeouts.forEach(t => clearTimeout(t))
    fadeTimeouts = []
  }

  const fadeOutAllTracks = (duration: number = 500): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioContext.value || gainNodes.size === 0) {
        resolve()
        return
      }

      const currentTime = audioContext.value.currentTime
      const playingTrackIds = Array.from(gainNodes.keys())

      if (playingTrackIds.length === 0) {
        resolve()
        return
      }

      playingTrackIds.forEach(trackId => {
        const gainNode = gainNodes.get(trackId)
        if (gainNode) {
          gainNode.gain.cancelScheduledValues(currentTime)
          gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime)
          gainNode.gain.linearRampToValueAtTime(0, currentTime + duration / 1000)
        }
      })

      const timeout = setTimeout(() => {
        playingTrackIds.forEach(trackId => {
          stopTrackAudio(trackId)
          const track = store.tracks.find(t => t.id === trackId)
          if (track) track.isPlaying = false
        })
        resolve()
      }, duration + 50)
      fadeTimeouts.push(timeout)
    })
  }

  const fadeInTracks = async (sceneTracks: Array<{ id: string; volume: number }>, duration: number = 800) => {
    initAudioContext()
    if (!audioContext.value || !masterGain.value) return

    store.isGlobalPlaying = true

    const validTracks = sceneTracks
      .map(st => {
        const track = store.tracks.find(t => t.id === st.id)
        return track ? { track, targetVolume: st.volume } : null
      })
      .filter(Boolean) as Array<{ track: SoundTrack; targetVolume: number }>

    validTracks.forEach(({ track, targetVolume }) => {
      track.volume = targetVolume
      track.isPlaying = true
    })

    await Promise.all(validTracks.map(({ track }) => playTrackAudio(track, true)))

    const currentTime = audioContext.value.currentTime
    const fadeEndTime = currentTime + duration / 1000

    validTracks.forEach(({ track, targetVolume }) => {
      const gainNode = gainNodes.get(track.id)
      if (gainNode) {
        gainNode.gain.cancelScheduledValues(currentTime)
        gainNode.gain.setValueAtTime(0, currentTime)
        gainNode.gain.linearRampToValueAtTime(targetVolume / 100, fadeEndTime)
      }
    })

    updateGlobalState()
  }

  const applyScene = async (scene: Scene) => {
    if (store.isTransitioning) return
    store.setTransitioning(true)
    store.setActiveScene(scene.id)

    try {
      await fadeOutAllTracks(600)

      await new Promise(resolve => setTimeout(resolve, 100))

      await fadeInTracks(scene.tracks, 800)
    } finally {
      store.setTransitioning(false)
    }
  }

  const getCurrentTrackStates = (): Array<{ id: string; volume: number }> => {
    return store.tracks
      .filter(t => t.isPlaying && t.volume > 0)
      .map(t => ({ id: t.id, volume: t.volume }))
  }

  watch(() => store.masterVolume, (newVal) => updateMasterVolume(newVal))

  onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval)
    clearFadeTimeouts()
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
    applyScene,
    getCurrentTrackStates
  }
}
