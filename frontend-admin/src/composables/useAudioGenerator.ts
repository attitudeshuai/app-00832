/**
 * 使用 Web Audio API 生成各种环境音
 * 每种音效都经过精心设计，与其标题特征匹配
 */

export interface GeneratedAudio {
  source: AudioNode
  filter?: BiquadFilterNode
  lfo?: OscillatorNode
  gain?: GainNode
}

export function useAudioGenerator() {
  /**
   * 生成棕噪音（比粉红噪音更低沉温暖）
   */
  function generateBrownNoise(audioContext: AudioContext): AudioBufferSourceNode {
    const bufferSize = audioContext.sampleRate * 4
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let lastOut = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 3.5
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }

  /**
   * 生成白噪音 - 柔和版本，适合助眠
   */
  function generateWhiteNoise(audioContext: AudioContext): AudioBufferSourceNode {
    const bufferSize = audioContext.sampleRate * 4
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < bufferSize; i++) {
        // 使用更柔和的白噪音算法
        data[i] = (Math.random() * 2 - 1) * 0.5
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }

  /**
   * 生成粉红噪音（更柔和，适合背景音）
   */
  function generatePinkNoise(audioContext: AudioContext): AudioBufferSourceNode {
    const bufferSize = audioContext.sampleRate * 4
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }

  /**
   * 🌧️ 雨声 - 真实的雨滴落在窗户和屋顶上的声音
   * 特点：有节奏的滴答声 + 持续的沙沙背景音
   */
  function generateRain(audioContext: AudioContext): GeneratedAudio {
    const bufferSize = audioContext.sampleRate * 6
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

      for (let i = 0; i < bufferSize; i++) {
        // 基础粉红噪音作为雨的背景
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        let sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08
        b6 = white * 0.115926

        // 添加随机雨滴声（高频短促的脉冲）
        if (Math.random() < 0.0008) {
          const dropIntensity = Math.random() * 0.3 + 0.1
          const dropLength = Math.floor(Math.random() * 800 + 200)
          for (let j = 0; j < dropLength && i + j < bufferSize; j++) {
            const envelope = Math.exp(-j / (dropLength * 0.15))
            const dropSound = (Math.random() * 2 - 1) * envelope * dropIntensity
            data[i + j] = (data[i + j] || 0) + dropSound
          }
        }

        data[i] = (data[i] || 0) + sample
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // 低通滤波器让雨声更柔和
    const mainFilter = audioContext.createBiquadFilter()
    mainFilter.type = 'lowpass'
    mainFilter.frequency.value = 4500
    mainFilter.Q.value = 0.5

    // 高通滤波器去除过低的隆隆声
    const highpass = audioContext.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 150
    highpass.Q.value = 0.3

    // 缓慢的音量调制，模拟雨势变化
    const lfo = audioContext.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08
    const lfoGain = audioContext.createGain()
    lfoGain.gain.value = 400
    lfo.connect(lfoGain)
    lfoGain.connect(mainFilter.frequency)
    lfo.start(0)

    source.connect(highpass)
    highpass.connect(mainFilter)

    return { source, filter: mainFilter, lfo }
  }

  /**
   * 🌊 海浪声 - 真实的海浪拍打沙滩的声音
   * 特点：有规律的起伏，浪花拍岸的冲击感
   */
  function generateWaves(audioContext: AudioContext): GeneratedAudio {
    const bufferSize = audioContext.sampleRate * 8
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let lastOut = 0

      for (let i = 0; i < bufferSize; i++) {
        // 棕噪音作为海浪的基础（低沉的隆隆声）
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02

        // 海浪的周期性起伏（约8-12秒一个周期）
        const wavePhase = (i / audioContext.sampleRate) * 0.1 * Math.PI * 2
        const waveCycle = Math.sin(wavePhase) * 0.5 + 0.5

        // 第二层更快的波浪
        const wavePhase2 = (i / audioContext.sampleRate) * 0.18 * Math.PI * 2
        const waveCycle2 = Math.sin(wavePhase2) * 0.3 + 0.5

        // 浪花拍岸时的高频成分
        const crashPhase = (i / audioContext.sampleRate) * 0.12 * Math.PI * 2
        const crashEnvelope = Math.pow(Math.max(0, Math.sin(crashPhase)), 4)
        const crashNoise = (Math.random() * 2 - 1) * crashEnvelope * 0.15

        const combined = waveCycle * waveCycle2
        data[i] = lastOut * 2.5 * combined + crashNoise
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // 低通滤波器，让海浪声更浑厚
    const mainFilter = audioContext.createBiquadFilter()
    mainFilter.type = 'lowpass'
    mainFilter.frequency.value = 800
    mainFilter.Q.value = 0.4

    // 添加一点共振，增加海浪的"轰隆"感
    const resonance = audioContext.createBiquadFilter()
    resonance.type = 'peaking'
    resonance.frequency.value = 200
    resonance.Q.value = 1
    resonance.gain.value = 3

    // 缓慢的频率调制，模拟海浪的自然变化
    const lfo = audioContext.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.05
    const lfoGain = audioContext.createGain()
    lfoGain.gain.value = 200
    lfo.connect(lfoGain)
    lfoGain.connect(mainFilter.frequency)
    lfo.start(0)

    source.connect(resonance)
    resonance.connect(mainFilter)

    return { source, filter: mainFilter, lfo }
  }

  /**
   * 🔥 篝火声 - 真实的木柴燃烧噼啪声
   * 特点：不规则的噼啪声 + 持续的低沉燃烧声
   */
  function generateFire(audioContext: AudioContext): GeneratedAudio {
    const bufferSize = audioContext.sampleRate * 6
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let lastOut = 0

      for (let i = 0; i < bufferSize; i++) {
        // 棕噪音作为火焰燃烧的低沉背景
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        let sample = lastOut * 1.5

        // 随机的噼啪声（木柴爆裂）
        if (Math.random() < 0.0015) {
          const crackleIntensity = Math.random() * 0.4 + 0.2
          const crackleLength = Math.floor(Math.random() * 600 + 100)
          for (let j = 0; j < crackleLength && i + j < bufferSize; j++) {
            // 快速衰减的高频脉冲
            const envelope = Math.exp(-j / (crackleLength * 0.08))
            const crackle = (Math.random() * 2 - 1) * envelope * crackleIntensity
            data[i + j] = (data[i + j] || 0) + crackle
          }
        }

        // 偶尔的较大爆裂声
        if (Math.random() < 0.0003) {
          const popIntensity = Math.random() * 0.5 + 0.3
          const popLength = Math.floor(Math.random() * 1500 + 500)
          for (let j = 0; j < popLength && i + j < bufferSize; j++) {
            const envelope = Math.exp(-j / (popLength * 0.1))
            const pop = (Math.random() * 2 - 1) * envelope * popIntensity
            data[i + j] = (data[i + j] || 0) + pop
          }
        }

        data[i] = (data[i] || 0) + sample
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // 带通滤波器，突出火焰的中高频特性
    const bandpass = audioContext.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 2000
    bandpass.Q.value = 0.8

    // 低频增强，增加火焰的温暖感
    const lowShelf = audioContext.createBiquadFilter()
    lowShelf.type = 'lowshelf'
    lowShelf.frequency.value = 300
    lowShelf.gain.value = 4

    // 轻微的频率调制，模拟火焰的跳动
    const lfo = audioContext.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.8
    const lfoGain = audioContext.createGain()
    lfoGain.gain.value = 300
    lfo.connect(lfoGain)
    lfoGain.connect(bandpass.frequency)
    lfo.start(0)

    source.connect(lowShelf)
    lowShelf.connect(bandpass)

    return { source, filter: bandpass, lfo }
  }

  /**
   * 🌲 森林环境音 - 鸟鸣、树叶沙沙、虫鸣的自然交响
   * 特点：多层次的自然声音，有远近感
   */
  function generateForest(audioContext: AudioContext): GeneratedAudio {
    const bufferSize = audioContext.sampleRate * 10
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

      for (let i = 0; i < bufferSize; i++) {
        // 柔和的粉红噪音作为风吹树叶的背景
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        let sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06
        b6 = white * 0.115926

        // 模拟鸟鸣（高频短促的音调）
        if (Math.random() < 0.0002) {
          const birdFreq = Math.random() * 2000 + 2000 // 2000-4000Hz
          const birdLength = Math.floor(Math.random() * 3000 + 1000)
          const birdChirps = Math.floor(Math.random() * 3) + 2

          for (let chirp = 0; chirp < birdChirps; chirp++) {
            const chirpStart = chirp * Math.floor(birdLength / birdChirps)
            const chirpLength = Math.floor(birdLength / birdChirps * 0.6)

            for (let j = 0; j < chirpLength && i + chirpStart + j < bufferSize; j++) {
              const t = j / audioContext.sampleRate
              const envelope = Math.sin(Math.PI * j / chirpLength) * 0.08
              const freqMod = birdFreq * (1 + Math.sin(t * 30) * 0.1)
              const bird = Math.sin(t * freqMod * Math.PI * 2) * envelope
              data[i + chirpStart + j] = (data[i + chirpStart + j] || 0) + bird
            }
          }
        }

        // 模拟虫鸣（持续的高频声音）
        const time = i / audioContext.sampleRate
        const cricketPhase = time * 4000 * Math.PI * 2
        const cricketEnvelope = (Math.sin(time * 8 * Math.PI * 2) * 0.5 + 0.5) * 0.02
        const cricket = Math.sin(cricketPhase) * cricketEnvelope

        data[i] = (data[i] || 0) + sample + cricket * 0.3
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // 低通滤波器，让森林声更柔和自然
    const mainFilter = audioContext.createBiquadFilter()
    mainFilter.type = 'lowpass'
    mainFilter.frequency.value = 6000
    mainFilter.Q.value = 0.3

    // 高通滤波器，去除过低的隆隆声
    const highpass = audioContext.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 80
    highpass.Q.value = 0.3

    // 非常缓慢的调制，模拟风的变化
    const lfo = audioContext.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.03
    const lfoGain = audioContext.createGain()
    lfoGain.gain.value = 800
    lfo.connect(lfoGain)
    lfoGain.connect(mainFilter.frequency)
    lfo.start(0)

    source.connect(highpass)
    highpass.connect(mainFilter)

    return { source, filter: mainFilter, lfo }
  }

  /**
   * 🎹 轻钢琴 - 舒缓的环境钢琴音乐
   * 特点：柔和的和弦进行，带有自然的泛音
   */
  function generatePiano(audioContext: AudioContext): GeneratedAudio {
    // 使用更丰富的和弦进行（Am7 - Fmaj7 - C - G）
    const chordProgressions = [
      [220.00, 261.63, 329.63, 392.00],  // Am7: A3, C4, E4, G4
      [174.61, 220.00, 261.63, 329.63],  // Fmaj7: F3, A3, C4, E4
      [130.81, 164.81, 196.00, 261.63],  // C: C3, E3, G3, C4
      [98.00, 123.47, 146.83, 196.00],   // G: G2, B2, D3, G3
    ]

    const oscillators: OscillatorNode[] = []
    const gains: GainNode[] = []
    const allNodes: AudioNode[] = []

    // 创建主增益节点
    const masterGain = audioContext.createGain()
    masterGain.gain.value = 0.4

    // 添加混响效果（使用卷积）
    const convolver = audioContext.createConvolver()
    const reverbLength = audioContext.sampleRate * 2
    const reverbBuffer = audioContext.createBuffer(2, reverbLength, audioContext.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = reverbBuffer.getChannelData(channel)
      for (let i = 0; i < reverbLength; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (reverbLength * 0.3))
      }
    }
    convolver.buffer = reverbBuffer

    // 低通滤波器，让钢琴音色更柔和温暖
    const filter = audioContext.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2500
    filter.Q.value = 0.5

    // 为每个和弦音符创建振荡器
    const currentChord = chordProgressions[0]
    currentChord.forEach((freq, index) => {
      // 基频振荡器
      const osc = audioContext.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      // 添加轻微的颤音
      const vibrato = audioContext.createOscillator()
      vibrato.type = 'sine'
      vibrato.frequency.value = 4 + Math.random() * 2
      const vibratoGain = audioContext.createGain()
      vibratoGain.gain.value = freq * 0.003
      vibrato.connect(vibratoGain)
      vibratoGain.connect(osc.frequency)
      vibrato.start(0)
      allNodes.push(vibrato)

      // 泛音（让音色更丰富）
      const harmonic = audioContext.createOscillator()
      harmonic.type = 'sine'
      harmonic.frequency.value = freq * 2
      const harmonicGain = audioContext.createGain()
      harmonicGain.gain.value = 0.008

      const gain = audioContext.createGain()
      // 不同音符使用不同音量，营造层次感
      const baseVolume = 0.025 - index * 0.004
      gain.gain.value = Math.max(0.01, baseVolume)

      osc.connect(gain)
      harmonic.connect(harmonicGain)
      harmonicGain.connect(gain)

      oscillators.push(osc)
      gains.push(gain)
      allNodes.push(harmonic)
    })

    // 连接所有增益到滤波器
    gains.forEach(g => g.connect(filter))

    // 干湿混合
    const dryGain = audioContext.createGain()
    dryGain.gain.value = 0.7
    const wetGain = audioContext.createGain()
    wetGain.gain.value = 0.3

    filter.connect(dryGain)
    filter.connect(convolver)
    convolver.connect(wetGain)

    dryGain.connect(masterGain)
    wetGain.connect(masterGain)

    // 创建包装节点
    const sourceNode = {
      start: (when?: number) => {
        oscillators.forEach(osc => osc.start(when || 0))
        allNodes.forEach(node => {
          if ('start' in node && typeof node.start === 'function') {
            try { node.start(when || 0) } catch(e) {}
          }
        })
      },
      stop: (when?: number) => {
        oscillators.forEach(osc => {
          try { osc.stop(when || 0) } catch (e) {}
        })
        allNodes.forEach(node => {
          if ('stop' in node && typeof node.stop === 'function') {
            try { node.stop(when || 0) } catch(e) {}
          }
        })
      },
      connect: (destination: AudioNode) => {
        masterGain.connect(destination)
      },
      disconnect: () => {
        masterGain.disconnect()
      }
    } as any as AudioNode

    return { source: sourceNode, filter, gain: masterGain }
  }

  /**
   * 生成柔和的白噪音（带滤波）- 用于助眠
   */
  function generateSoftWhiteNoise(audioContext: AudioContext): GeneratedAudio {
    const source = generateWhiteNoise(audioContext)

    // 低通滤波器让白噪音更柔和
    const filter = audioContext.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3000
    filter.Q.value = 0.5

    // 高通滤波器去除过低的频率
    const highpass = audioContext.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 100
    highpass.Q.value = 0.3

    source.connect(highpass)
    highpass.connect(filter)

    return { source, filter }
  }

  /**
   * 根据轨道 ID 生成对应的音频
   */
  function generateAudioForTrack(audioContext: AudioContext, trackId: string): GeneratedAudio {
    switch (trackId) {
      case 'white-noise':
        return generateSoftWhiteNoise(audioContext)
      case 'rain':
        return generateRain(audioContext)
      case 'waves':
        return generateWaves(audioContext)
      case 'fire':
        return generateFire(audioContext)
      case 'forest':
        return generateForest(audioContext)
      case 'piano':
        return generatePiano(audioContext)
      default:
        return { source: generatePinkNoise(audioContext) }
    }
  }

  return {
    generateAudioForTrack,
    generateWhiteNoise,
    generatePinkNoise,
    generateBrownNoise,
    generateRain,
    generateWaves,
    generateFire,
    generateForest,
    generatePiano
  }
}
