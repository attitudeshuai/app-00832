<template>
  <div class="scene-bar" role="toolbar" aria-label="场景预设栏">
    <div class="scene-bar-content">
      <div class="scene-scroll" role="tablist" aria-label="场景列表">
        <div
          v-for="scene in allScenes"
          :key="scene.id"
          class="scene-chip"
          :class="{
            'is-active': activeSceneId === scene.id,
            'is-default': scene.isDefault,
            'is-custom': !scene.isDefault
          }"
          role="tab"
          :aria-selected="activeSceneId === scene.id"
          :aria-label="`${scene.isDefault ? '默认' : '自定义'}场景：${scene.name}`"
          tabindex="0"
          @click="handleSelectScene(scene)"
          @keydown.enter="handleSelectScene(scene)"
          @keydown.space.prevent="handleSelectScene(scene)"
          @contextmenu.prevent="handleContextMenu($event, scene)"
        >
          <span class="scene-icon" aria-hidden="true">
            <el-icon v-if="scene.isDefault"><Star /></el-icon>
            <el-icon v-else><Collection /></el-icon>
          </span>
          <span class="scene-name">{{ scene.name }}</span>
          <el-dropdown
            trigger="click"
            @command="(cmd: string) => handleCommand(cmd, scene)"
            @click.stop
          >
            <span class="scene-actions" role="button" aria-label="场景操作" @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">
                  <el-icon><Edit /></el-icon>
                  重命名
                </el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <el-icon><Delete /></el-icon>
                  删除
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <el-button
        type="primary"
        plain
        round
        class="save-scene-btn"
        @click="openSaveDialog"
        :aria-label="'保存当前组合为新场景'"
      >
        <el-icon><Plus /></el-icon>
        <span class="hidden-sm">保存场景</span>
      </el-button>
    </div>
  </div>

  <el-dialog
    v-model="saveDialogVisible"
    title="保存为新场景"
    width="400px"
    :close-on-click-modal="false"
  >
    <el-form @submit.prevent>
      <el-form-item label="场景名称">
        <el-input
          v-model="newSceneName"
          placeholder="输入场景名称，如：深夜阅读"
          maxlength="20"
          show-word-limit
          autofocus
          @keyup.enter="confirmSaveScene"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="saveDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmSaveScene">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="renameDialogVisible"
    title="重命名场景"
    width="400px"
    :close-on-click-modal="false"
  >
    <el-form @submit.prevent>
      <el-form-item label="场景名称">
        <el-input
          v-model="renameName"
          placeholder="输入新的场景名称"
          maxlength="20"
          show-word-limit
          autofocus
          @keyup.enter="confirmRename"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="renameDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmRename">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAudioStore, type Scene } from '@/stores/audioStore'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Star, Collection, MoreFilled, Plus, Edit, Delete } from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'switch-scene', scene: Scene): void
}>()

const store = useAudioStore()

const activeSceneId = computed(() => store.activeSceneId)
const allScenes = computed(() => [...store.defaultScenes, ...store.customScenes])

const saveDialogVisible = ref(false)
const newSceneName = ref('')
const renameDialogVisible = ref(false)
const renameName = ref('')
const renamingScene = ref<Scene | null>(null)

function handleSelectScene(scene: Scene) {
  emit('switch-scene', scene)
}

// 保留右键菜单占位以便后续扩展，目前不做特殊限制
function handleContextMenu(_e: MouseEvent, _scene: Scene) {
  // no-op：所有场景都可通过下拉菜单进行重命名/删除
}

function handleCommand(cmd: string, scene: Scene) {
  if (cmd === 'rename') {
    renamingScene.value = scene
    renameName.value = scene.name
    renameDialogVisible.value = true
  } else if (cmd === 'delete') {
    const message = scene.isDefault
      ? `「${scene.name}」是默认推荐场景，删除后将不再出现在场景栏中（仍可通过清除浏览器数据恢复）。确定删除吗？`
      : `确定要删除场景「${scene.name}」吗？此操作不可撤销。`
    ElMessageBox.confirm(message, '删除场景', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }).then(() => {
      store.deleteScene(scene.id)
    }).catch(() => {})
  }
}

function openSaveDialog() {
  const playingCount = store.tracks.filter(t => t.isPlaying).length
  if (playingCount === 0) {
    ElMessage.warning('请先选择至少一个音效再保存场景')
    return
  }
  newSceneName.value = ''
  saveDialogVisible.value = true
}

function confirmSaveScene() {
  const name = newSceneName.value.trim()
  if (!name) {
    ElMessage.warning('请输入场景名称')
    return
  }
  store.saveCurrentAsScene(name)
  saveDialogVisible.value = false
}

function confirmRename() {
  const name = renameName.value.trim()
  if (!name || !renamingScene.value) {
    ElMessage.warning('请输入场景名称')
    return
  }
  store.renameScene(renamingScene.value.id, name)
  renameDialogVisible.value = false
  renamingScene.value = null
}
</script>

<style scoped lang="scss">
.scene-bar {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 0;
  position: sticky;
  top: 72px;
  z-index: 40;
}

.scene-bar-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.scene-scroll {
  flex: 1;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.scene-chip {
  display: inline-flex;
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
  white-space: nowrap;
  transition: all 0.25s ease;
  flex-shrink: 0;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
    color: #e2e8f0;
    transform: translateY(-1px);
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(129, 140, 248, 0.2));
    border-color: var(--el-color-primary);
    color: #fff;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
  }

  &.is-default .scene-icon {
    color: #fbbf24;
  }

  &.is-custom .scene-icon {
    color: #818cf8;
  }

  .scene-icon {
    font-size: 14px;
    display: flex;
    align-items: center;
  }

  .scene-name {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scene-actions {
    display: flex;
    align-items: center;
    margin-left: 4px;
    padding: 2px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  &:hover .scene-actions {
    opacity: 1;
  }
}

.save-scene-btn {
  flex-shrink: 0;
  font-weight: 600;
  padding: 10px 18px;
  height: auto;

  .el-icon {
    margin-right: 6px;
  }
}

@media (max-width: 640px) {
  .scene-bar-content {
    padding: 0 16px;
    gap: 10px;
  }

  .scene-chip {
    padding: 6px 12px;
    font-size: 13px;

    .scene-name {
      max-width: 70px;
    }
  }

  .save-scene-btn {
    padding: 8px 12px;

    .hidden-sm {
      display: none;
    }

    .el-icon {
      margin-right: 0;
    }
  }
}
</style>
