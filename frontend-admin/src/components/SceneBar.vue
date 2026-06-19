<template>
  <div class="scene-bar" role="toolbar" aria-label="场景预设栏">
    <div class="scene-bar-content">
      <div class="scene-scroll-wrapper">
        <div class="scene-section">
          <span class="section-label">场景</span>
          <div class="scene-list">
            <div
              v-for="scene in store.scenes"
              :key="scene.id"
              class="scene-chip-wrapper"
            >
              <button
                class="scene-chip"
                :class="{ 'is-active': store.activeSceneId === scene.id, 'is-loading': store.isTransitioning, 'is-default': scene.isDefault }"
                :disabled="store.isTransitioning"
                @click="handleSelectScene(scene)"
                :aria-label="`切换到${scene.name}场景`"
                :aria-pressed="store.activeSceneId === scene.id"
              >
                <el-icon class="scene-icon" aria-hidden="true">
                  <component :is="getIconComponent(scene.icon)" />
                </el-icon>
                <span class="scene-name">{{ scene.name }}</span>
              </button>
              <el-dropdown trigger="click" @command="(cmd: string) => handleSceneAction(cmd, scene)">
                <button class="scene-more-btn" :aria-label="`${scene.name}场景选项`" @click.stop>
                  <el-icon aria-hidden="true"><MoreFilled /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename" :icon="Edit">
                      重命名
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" :icon="Delete" divided>
                      删除场景
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>

      <div class="scene-actions">
        <el-tooltip
          :content="store.hasActiveTracks ? '保存当前场景' : '请先选择至少一个音效'"
          placement="bottom"
        >
          <span>
            <el-button
              type="primary"
              :icon="Plus"
              circle
              size="default"
              class="save-scene-btn"
              :disabled="store.isTransitioning || !store.hasActiveTracks"
              @click="openSaveDialog"
              aria-label="保存当前场景"
            />
          </span>
        </el-tooltip>
      </div>
    </div>

    <el-dialog
      v-model="saveDialogVisible"
      title="保存场景"
      width="400px"
      :close-on-click-modal="false"
      class="scene-dialog"
    >
      <el-form @submit.prevent="handleSaveScene">
        <el-form-item label="场景名称">
          <el-input
            v-model="newSceneName"
            placeholder="输入场景名称"
            maxlength="20"
            show-word-limit
            ref="sceneNameInput"
            @keyup.enter="handleSaveScene"
          />
        </el-form-item>
        <el-form-item label="选择图标">
          <div class="icon-picker">
            <button
              v-for="icon in iconOptions"
              :key="icon"
              type="button"
              class="icon-option"
              :class="{ 'is-selected': selectedIcon === icon }"
              @click="selectedIcon = icon"
              :aria-label="`选择${icon}图标`"
            >
              <el-icon :size="20">
                <component :is="getIconComponent(icon)" />
              </el-icon>
            </button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveScene" :disabled="!newSceneName.trim()">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="renameDialogVisible"
      title="重命名场景"
      width="400px"
      :close-on-click-modal="false"
      class="scene-dialog"
    >
      <el-form @submit.prevent="handleRenameScene">
        <el-form-item label="场景名称">
          <el-input
            v-model="renameName"
            placeholder="输入新名称"
            maxlength="20"
            show-word-limit
            ref="renameInputRef"
            @keyup.enter="handleRenameScene"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleRenameScene" :disabled="!renameName.trim()">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAudioStore, type ScenePreset } from '@/stores/audioStore'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { Plus, Edit, Delete, MoreFilled, Star } from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'apply-scene', scene: ScenePreset): void
}>()

const store = useAudioStore()

const saveDialogVisible = ref(false)
const renameDialogVisible = ref(false)
const newSceneName = ref('')
const selectedIcon = ref('Star')
const renameName = ref('')
const renamingScene = ref<ScenePreset | null>(null)
const sceneNameInput = ref()
const renameInputRef = ref()

const iconOptions = ['Star', 'Moon', 'Sunny', 'Coffee', 'Cloudy', 'PartlyCloudy', 'IceCream', 'Headset', 'Lightning', 'Pouring', 'Sunrise', 'Sunset', 'MagicStick']

const getIconComponent = (iconName: string) => {
  const IconComponent = (ElementPlusIconsVue as any)[iconName]
  if (IconComponent) {
    return IconComponent
  }
  return Star
}

const handleSelectScene = (scene: ScenePreset) => {
  if (store.isTransitioning) return
  emit('apply-scene', scene)
}

const openSaveDialog = () => {
  if (!store.hasActiveTracks) {
    ElMessage.warning('请先选择至少一个音效')
    return
  }
  newSceneName.value = ''
  selectedIcon.value = 'Star'
  saveDialogVisible.value = true
  nextTick(() => {
    sceneNameInput.value?.focus()
  })
}

const handleSaveScene = () => {
  const name = newSceneName.value.trim()
  if (!name) {
    ElMessage.warning('请输入场景名称')
    return
  }

  try {
    store.saveCurrentAsScene(name, selectedIcon.value)
    saveDialogVisible.value = false
  } catch {
  }
}

const handleSceneAction = (command: string, scene: ScenePreset) => {
  if (command === 'rename') {
    renamingScene.value = scene
    renameName.value = scene.name
    renameDialogVisible.value = true
    nextTick(() => {
      renameInputRef.value?.focus()
      renameInputRef.value?.select()
    })
  } else if (command === 'delete') {
    ElMessageBox.confirm(
      `确定要删除场景「${scene.name}」吗？此操作无法撤销。`,
      '删除场景',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    ).then(() => {
      store.deleteScene(scene.id)
    }).catch(() => {})
  }
}

const handleRenameScene = () => {
  const name = renameName.value.trim()
  if (!name || !renamingScene.value) {
    return
  }

  store.renameScene(renamingScene.value.id, name)
  renameDialogVisible.value = false
  renamingScene.value = null
}
</script>

<style scoped lang="scss">
.scene-bar {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 24px;
  position: sticky;
  top: 72px;
  z-index: 40;
}

.scene-bar-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.scene-scroll-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  gap: 24px;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.scene-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.section-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.scene-list {
  display: flex;
  gap: 8px;
  align-items: center;
}

.scene-chip-wrapper {
  display: flex;
  align-items: center;
}

.scene-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  padding-right: 8px;

  &:hover:not(:disabled) {
    background: rgba(129, 140, 248, 0.15);
    border-color: rgba(129, 140, 248, 0.3);
    color: #c7d2fe;
    transform: translateY(-1px);
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(129, 140, 248, 0.3), rgba(99, 102, 241, 0.2));
    border-color: var(--el-color-primary);
    color: #fff;
    box-shadow: 0 4px 12px rgba(129, 140, 248, 0.25);
  }

  &.is-default.is-active {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15));
    border-color: #f59e0b;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
  }

  &.is-loading {
    opacity: 0.6;
    cursor: wait;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .scene-icon {
    font-size: 16px;
  }
}

.scene-more-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -4px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }
}

.scene-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.save-scene-btn {
  width: 36px;
  height: 36px;
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-option {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(129, 140, 248, 0.15);
    color: #c7d2fe;
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    background: rgba(129, 140, 248, 0.2);
    color: #fff;
  }
}

:deep(.scene-dialog) {
  .el-dialog__body {
    padding-top: 16px;
  }
}

@media (max-width: 768px) {
  .scene-bar {
    padding: 10px 16px;
  }

  .scene-bar-content {
    gap: 12px;
  }

  .scene-section {
    gap: 8px;
  }

  .scene-chip {
    padding: 6px 12px;
    font-size: 13px;

    .scene-icon {
      font-size: 14px;
    }
  }

  .section-label {
    font-size: 11px;
  }
}
</style>
