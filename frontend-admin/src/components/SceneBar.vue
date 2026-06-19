<template>
  <div class="scene-bar" role="region" aria-label="场景预设栏">
    <div class="scene-bar-content">
      <div class="scene-scroll-wrapper" ref="scrollWrapper">
        <div class="scene-list" role="listbox" aria-label="场景列表">
          <div
            v-for="scene in store.scenes"
            :key="scene.id"
            class="scene-chip"
            :class="{
              'is-active': store.activeSceneId === scene.id,
              'is-built-in': scene.isBuiltIn,
              'is-transitioning': store.isTransitioning
            }"
            role="option"
            :aria-selected="store.activeSceneId === scene.id"
            :aria-label="`场景：${scene.name}${scene.isBuiltIn ? '（推荐）' : ''}`"
            @click="handleSelectScene(scene)"
          >
            <el-icon class="scene-icon" aria-hidden="true">
              <component :is="getIconComponent(scene.icon)" />
            </el-icon>
            <span class="scene-name">{{ scene.name }}</span>
            <el-dropdown
              trigger="click"
              @click.stop
              @command="(cmd: string) => handleCommand(cmd, scene)"
            >
              <el-icon class="scene-more" @click.stop aria-label="场景操作">
                <MoreFilled />
              </el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">
                    <el-icon><Edit /></el-icon>重命名
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <el-icon><Delete /></el-icon>删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <div class="scene-actions">
        <el-button
          text
          size="small"
          class="restore-btn"
          @click="handleRestoreDefault"
          aria-label="恢复默认场景"
        >
          <el-icon aria-hidden="true"><RefreshRight /></el-icon>
          <span class="hidden-xs">恢复默认</span>
        </el-button>
        <el-button
          type="primary"
          plain
          round
          size="default"
          class="save-btn"
          :disabled="!hasActiveTracks || store.isTransitioning"
          @click="openSaveDialog"
          aria-label="保存当前场景"
        >
          <el-icon aria-hidden="true"><Plus /></el-icon>
          <span class="hidden-xs">保存场景</span>
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="saveDialogVisible"
      title="保存新场景"
      width="400px"
      :close-on-click-modal="false"
      class="scene-dialog"
    >
      <el-form label-position="top">
        <el-form-item label="场景名称">
          <el-input
            v-model="newSceneName"
            placeholder="请输入场景名称"
            maxlength="20"
            show-word-limit
            @keyup.enter="handleSaveScene"
            ref="sceneNameInput"
          />
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
      <el-form label-position="top">
        <el-form-item label="场景名称">
          <el-input
            v-model="renameName"
            placeholder="请输入新名称"
            maxlength="20"
            show-word-limit
            @keyup.enter="handleRename"
            ref="renameInput"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleRename" :disabled="!renameName.trim()">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useAudioStore, type Scene } from '@/stores/audioStore'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const props = defineProps<{
  onApplyScene: (scene: Scene) => Promise<void>
  onGetCurrentTracks: () => Array<{ id: string; volume: number }>
}>()

const store = useAudioStore()

const saveDialogVisible = ref(false)
const renameDialogVisible = ref(false)
const newSceneName = ref('')
const renameName = ref('')
const editingScene = ref<Scene | null>(null)
const sceneNameInput = ref()
const renameInput = ref()
const scrollWrapper = ref<HTMLElement | null>(null)

const hasActiveTracks = computed(() => store.tracks.some(t => t.isPlaying && t.volume > 0))

const getIconComponent = (iconName: string) => {
  const IconComponent = (ElementPlusIconsVue as any)[iconName]
  if (IconComponent) return IconComponent
  return ElementPlusIconsVue.Star
}

const handleSelectScene = (scene: Scene) => {
  if (store.isTransitioning) return
  if (store.activeSceneId === scene.id) return
  props.onApplyScene(scene)
}

const handleCommand = async (command: string, scene: Scene) => {
  if (command === 'rename') {
    editingScene.value = scene
    renameName.value = scene.name
    renameDialogVisible.value = true
    await nextTick()
    renameInput.value?.focus()
  } else if (command === 'delete') {
    const builtInTip = scene.isBuiltIn ? '（这是推荐场景，删除后可通过「恢复默认」找回）' : ''
    try {
      await ElMessageBox.confirm(
        `确定要删除场景「${scene.name}」吗？${builtInTip}`,
        '删除场景',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger'
        }
      )
      store.deleteScene(scene.id)
    } catch {
    }
  }
}

const handleRestoreDefault = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要恢复所有默认推荐场景吗？您自定义的场景不会受影响。',
      '恢复默认场景',
      {
        confirmButtonText: '恢复',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    store.restoreDefaultScenes()
  } catch {
  }
}

const openSaveDialog = async () => {
  newSceneName.value = ''
  saveDialogVisible.value = true
  await nextTick()
  sceneNameInput.value?.focus()
}

const handleSaveScene = () => {
  const name = newSceneName.value.trim()
  if (!name) return
  const tracks = props.onGetCurrentTracks()
  if (tracks.length === 0) return
  const result = store.saveCurrentAsScene(name, tracks)
  if (result) {
    saveDialogVisible.value = false
  }
}

const handleRename = () => {
  const name = renameName.value.trim()
  if (!name || !editingScene.value) return
  const success = store.renameScene(editingScene.value.id, name)
  if (success) {
    renameDialogVisible.value = false
    editingScene.value = null
  }
}
</script>

<style scoped lang="scss">
.scene-bar {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: sticky;
  top: 72px;
  z-index: 40;
  padding: 12px 0;
  overflow: hidden;
}

.scene-bar-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.scene-scroll-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
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
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(129, 140, 248, 0.2));
    border-color: var(--el-color-primary);
    color: #fff;
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.3);
  }

  &.is-built-in {
    .scene-icon {
      color: #fbbf24;
    }
  }

  &.is-transitioning {
    pointer-events: none;
    opacity: 0.7;
  }

  .scene-icon {
    font-size: 16px;
  }

  .scene-more {
    font-size: 14px;
    opacity: 0;
    margin-left: 4px;
    transition: opacity 0.2s;
    padding: 2px;
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  &:hover .scene-more {
    opacity: 1;
  }
}

.scene-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.restore-btn {
  color: #94a3b8;
  font-weight: 500;

  &:hover {
    color: var(--el-color-primary);
  }

  :deep(.el-icon) {
    margin-right: 4px;
  }
}

.save-btn {
  font-weight: 500;

  :deep(.el-icon) {
    margin-right: 4px;
  }
}

:deep(.scene-dialog) {
  .el-dialog__header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 16px;
  }
}

@media (max-width: 768px) {
  .scene-bar {
    top: 72px;
    padding: 8px 0;
  }

  .scene-bar-content {
    padding: 0 16px;
    gap: 8px;
  }

  .scene-chip {
    padding: 6px 12px;
    font-size: 13px;
  }

  .hidden-xs {
    display: none;
  }
}
</style>
