// 声明 window.AudioContext 类型兼容性
interface Window {
  webkitAudioContext: typeof AudioContext
}
