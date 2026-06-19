<template>
  <div class="scene-bar" role="region" aria-label="场景预设栏">
    <div class="scene-bar-content">
      <div class="scene-scroll-wrapper">
        <div class="scene-list" role="tablist" aria-label="场景列表">
          <button
            v-for="scene in store.allScenes"
            :key="scene.id"
            class="scene-chip"
            :class="{
              'is-active': store.activeSceneId === scene.id,
              'is-default': scene.isDefault,
              'is-transitioning': store.isTransitioning && store.activeSceneId === scene.id
            }"
            role="tab"
            :aria-selected="store.activeSceneId === scene.id"
            :aria-label="`切换到场景：${scene.name}`"
            :disabled="store.isTransitioning"
            @click="handleSelectScene(scene.id)"
          >
            <el-icon class="scene-icon" aria-hidden="true">
              <component :is="getIconComponent(scene.icon)" />
            </el-icon>
            <span class="scene-name">{{ scene.name }}</span>
            <el-icon
              v-if="!scene.isDefault"
              class="scene-menu-btn"
              aria-hidden="true"
              @click.stop="openSceneMenu(scene, $event)"
            >
              <MoreFilled />
            </el-icon>
          </button>
        </div>
      </div>

      <div class="scene-actions">
        <el-button
          type="primary"
          plain
          round
          size="small"
          class="save-scene-btn"
          :disabled="store.isTransitioning || activePlayingCount === 0"
          :aria-label="activePlayingCount === 0 ? '请先选择至少一个音效' : '保存当前组合为新场景'"
          @click="openSaveDialog"
        >
          <el-icon aria-hidden="true"><Plus /></el-icon>
          <span class="hidden-xs">保存场景</span>
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="saveDialogVisible"
      title="保存当前场景"
      width="420px"
      :close-on-click-modal="false"
      class="scene-dialog"
    >
      <el-form :model="saveForm" label-position="top">
        <el-form-item label="场景名称">
          <el-input
            v-model="saveForm.name"
            placeholder="输入场景名称，如「深夜阅读」"
            maxlength="20"
            show-word-limit
            ref="nameInputRef"
            @keyup.enter="handleSaveScene"
          />
        </el-form-item>
        <el-form-item label="选择图标">
          <div class="icon-picker">
            <button
              v-for="icon in availableIcons"
              :key="icon"
              type="button"
              class="icon-option"
              :class="{ 'is-selected': saveForm.icon === icon }"
              @click="saveForm.icon = icon"
            >
              <el-icon :size="20">
                <component :is="getIconComponent(icon)" />
              </el-icon>
            </button>
          </div>
        </el-form-item>
        <el-form-item label="当前组合">
          <div class="preview-tracks">
            <el-tag
              v-for="track in playingTracks"
              :key="track.id"
              size="small"
              type="info"
              class="track-tag"
            >
              {{ track.name }} · {{ track.volume }}%
            </el-tag>
            <span v-if="playingTracks.length === 0" class="empty-hint">请先选择音效</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!saveForm.name.trim()" @click="handleSaveScene">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="manageDialogVisible"
      title="管理场景"
      width="420px"
      class="scene-dialog"
    >
      <div class="manage-scene-info" v-if="editingScene">
        <div class="manage-scene-header">
          <el-icon class="manage-scene-icon" aria-hidden="true">
            <component :is="getIconComponent(editingScene.icon)" />
          </el-icon>
          <span class="manage-scene-name">{{ editingScene.name }}</span>
        </div>
        <el-form label-position="top" class="rename-form">
          <el-form-item label="重命名">
            <el-input
              v-model="renameName"
              placeholder="输入新名称"
              maxlength="20"
              show-word-limit
              @keyup.enter="handleRenameScene"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button type="danger" plain @click="handleDeleteScene">
          <el-icon aria-hidden="true"><Delete /></el-icon>
          删除场景
        </el-button>
        <el-button @click="manageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleRenameScene">
          确认重命名
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useAudioStore, type ScenePreset, type SoundTrack } from '@/stores/audioStore'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { Plus, MoreFilled, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const emit = defineEmits<{
  (e: 'switch-scene', sceneId: string): void
}>()

const store = useAudioStore()

const saveDialogVisible = ref(false)
const manageDialogVisible = ref(false)
const nameInputRef = ref()
const editingScene = ref<ScenePreset | null>(null)
const renameName = ref('')

const saveForm = ref({
  name: '',
  icon: 'Star'
})

const availableIcons = [
  'Star', 'Moon', 'Sunny', 'Cloudy', 'PartlyCloudy',
  'Pouring', 'Sunrise', 'Sunset', 'Lightning',
  'MagicStick', 'Notification', 'Coffee', 'Reading',
  'Headset', 'Microphone', 'IceCream'
]

const playingTracks = computed(() => store.tracks.filter((t: SoundTrack) => t.isPlaying))
const activePlayingCount = computed(() => playingTracks.value.length)

const getIconComponent = (iconName: string) => {
  return (ElementPlusIconsVue as any)[iconName] || ElementPlusIconsVue.Star
}

const handleSelectScene = (sceneId: string) => {
  if (store.isTransitioning) return
  if (store.activeSceneId === sceneId) return
  emit('switch-scene', sceneId)
}

const openSceneMenu = (scene: ScenePreset, event: MouseEvent) => {
  event.stopPropagation()
  editingScene.value = scene
  renameName.value = scene.name
  manageDialogVisible.value = true
}

const openSaveDialog = () => {
  if (activePlayingCount.value === 0) return
  saveForm.value = {
    name: '',
    icon: 'Star'
  }
  saveDialogVisible.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
  })
}

const handleSaveScene = () => {
  if (!saveForm.value.name.trim()) return
  store.saveCurrentAsScene(saveForm.value.name, saveForm.value.icon)
  saveDialogVisible.value = false
}

const handleRenameScene = () => {
  if (!editingScene.value || !renameName.value.trim()) return
  store.renameScene(editingScene.value.id, renameName.value)
  manageDialogVisible.value = false
  editingScene.value = null
}

const handleDeleteScene = () => {
  if (!editingScene.value) return
  ElMessageBox.confirm(
    `确定要删除场景「${editingScene.value.name}」吗？此操作无法撤销。`,
    '删除场景',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    if (editingScene.value) {
      store.deleteScene(editingScene.value.id)
      manageDialogVisible.value = false
      editingScene.value = null
    }
  }).catch(() => {})
}
</script>

<style scoped lang="scss">
.scene-bar {
  background: rgba(30, 41, 59, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 0;
  position: sticky;
  top: 64px;
  z-index: 40;
  backdrop-filter: blur(8px);
}

.scene-bar-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.scene-scroll-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(129, 140, 248, 0.3) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(129, 140, 248, 0.3);
    border-radius: 2px;

    &:hover {
      background: rgba(129, 140, 248, 0.5);
    }
  }
}

.scene-list {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  white-space: nowrap;
}

.scene-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  position: relative;

  &:hover:not(:disabled) {
    border-color: rgba(129, 140, 248, 0.4);
    color: #e2e8f0;
    background: rgba(129, 140, 248, 0.08);
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(129, 140, 248, 0.2), rgba(99, 102, 241, 0.15));
    border-color: var(--el-color-primary);
    color: #fff;
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);

    .scene-icon {
      color: var(--el-color-primary);
    }
  }

  &.is-default::after {
    content: '';
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
  }

  &.is-transitioning {
    pointer-events: none;
    opacity: 0.7;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.scene-icon {
  font-size: 16px;
  transition: color 0.25s ease;
}

.scene-menu-btn {
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-left: -4px;
  padding: 2px;
  border-radius: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.scene-chip:hover .scene-menu-btn {
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}

.save-scene-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-weight: 500;

  &:disabled {
    opacity: 0.4;
  }
}

:deep(.scene-dialog) {
  .el-dialog__header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 16px;
  }

  .el-dialog__body {
    padding-top: 20px;
  }
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-option {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(129, 140, 248, 0.4);
    color: #e2e8f0;
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    background: rgba(99, 102, 241, 0.15);
    color: var(--el-color-primary);
  }
}

.preview-tracks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
  align-items: center;
}

.track-tag {
  border-radius: 12px;
}

.empty-hint {
  color: #64748b;
  font-size: 13px;
}

.manage-scene-info {
  .manage-scene-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
    background: rgba(129, 140, 248, 0.08);
    border-radius: 12px;
  }

  .manage-scene-icon {
    font-size: 24px;
    color: var(--el-color-primary);
  }

  .manage-scene-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.rename-form {
  margin: 0;
}

@media (max-width: 768px) {
  .scene-bar {
    padding: 10px 0;
    top: 56px;
  }

  .scene-bar-content {
    padding: 0 16px;
    gap: 10px;
  }

  .scene-chip {
    padding: 6px 12px;
    font-size: 13px;
    gap: 6px;

    .scene-menu-btn {
      opacity: 0.7;
    }
  }

  .hidden-xs {
    display: none;
  }

  .save-scene-btn {
    padding: 6px 12px;
  }
}
</style>
