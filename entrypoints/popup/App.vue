<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';
import Chip from 'primevue/chip';
import Message from 'primevue/message';

const startupDelay = ref(15000);
const pinnedGroups = ref<string[]>(['arc-tabs']);
const groupNameInput = ref('');
const status = ref({ message: '', type: '' as 'success' | 'error' | '', visible: false });
const loaded = ref(false);

const dragSrcIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number) {
  dragSrcIndex.value = index;
}

function onDragOver(index: number) {
  dragOverIndex.value = index;
}

function onDrop() {
  if (dragSrcIndex.value !== null && dragOverIndex.value !== null && dragSrcIndex.value !== dragOverIndex.value) {
    const items = [...pinnedGroups.value];
    const [removed] = items.splice(dragSrcIndex.value, 1);
    items.splice(dragOverIndex.value, 0, removed);
    pinnedGroups.value = items;
  }
  dragSrcIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  dragSrcIndex.value = null;
  dragOverIndex.value = null;
}

onMounted(() => {
  browser.storage.sync.get({ startupDelay: 15000, pinnedGroups: ['arc-tabs'] }, (s) => {
    startupDelay.value = s.startupDelay as number;
    pinnedGroups.value = s.pinnedGroups ? Object.values(s.pinnedGroups) as string[] : ['arc-tabs'];
    loaded.value = true;
  });
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function persistSettings() {
  if (!loaded.value) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    browser.storage.sync.set({ startupDelay: startupDelay.value, pinnedGroups: pinnedGroups.value }, () => {
      browser.runtime.sendMessage({ action: 'updateSettings', startupDelay: startupDelay.value });
    });
  }, 300);
}

watch(startupDelay, persistSettings);
watch(pinnedGroups, persistSettings, { deep: true });

function delaySeconds() {
  return Math.round(startupDelay.value / 1000);
}

function addGroup() {
  const name = groupNameInput.value.trim();
  if (name && !pinnedGroups.value.includes(name)) {
    pinnedGroups.value.push(name);
  }
  groupNameInput.value = '';
}

function removeGroup(name: string) {
  pinnedGroups.value = pinnedGroups.value.filter(g => g !== name);
}


function createArcGroup() {
  browser.runtime.sendMessage({ action: 'createArcGroup' }, (response) => {
    if (response?.success) showStatus('Group arc-tabs created!', 'success');
  });
}

function movePinnedGroups() {
  browser.runtime.sendMessage({ action: 'movePinnedGroupsToStart' }, (response) => {
    if (response?.success) showStatus('Groups moved to start!', 'success');
  });
}

let statusTimeout: ReturnType<typeof setTimeout> | null = null;
function showStatus(message: string, type: 'success' | 'error') {
  status.value = { message, type, visible: true };
  if (statusTimeout) clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => { status.value.visible = false; }, 3000);
}
</script>

<template>
  <div class="popup">
    <div class="header">
      <h2>Arc Tabs</h2>
      <small>Long live the Arc browser</small>
    </div>

    <div class="content">
      <!-- Startup delay -->
      <div class="setting-group">
        <label
          v-tooltip.bottom="'How long the extension is disabled after browser launch. Prevents moving tabs while the browser restores the previous session.'"
        >
          Startup delay — <strong>{{ delaySeconds() }}s</strong>
        </label>
        <Slider v-model="startupDelay" :min="10000" :max="60000" :step="1000" fluid />
      </div>

      <!-- Pinned groups -->
      <div class="setting-group">
        <label
          v-tooltip.bottom="'New tabs open after the last tab in these groups. Groups not in this list are ignored.'"
        >
          Pinned groups
        </label>
        <div class="input-row">
          <InputText
            v-model="groupNameInput"
            placeholder="Group name…"
            @keydown.enter="addGroup"
            fluid
          />
          <Button label="+" @click="addGroup" outlined />
        </div>
        <div class="chips-list" v-if="pinnedGroups.length">
          <div
            v-for="(name, index) in pinnedGroups"
            :key="name"
            class="chip-wrapper"
            :class="{ 'drag-over': dragOverIndex === index }"
            draggable="true"
            @dragstart="onDragStart(index)"
            @dragover.prevent="onDragOver(index)"
            @drop="onDrop"
            @dragend="onDragEnd"
          >
            <Chip :label="name" removable @remove="removeGroup(name)" />
          </div>
        </div>
      </div>

      <div class="action-row">
        <Button label="Arrange groups" severity="secondary" @click="movePinnedGroups" fluid />

        <Button
          label="Create arc-tabs group"
          severity="secondary"
          @click="createArcGroup"
          fluid
          v-tooltip.top="'Creates an arc-tabs tab group with one empty tab for scroll control. If deleted, recreated automatically.'"
        />
      </div>

      <Message v-if="status.visible" :severity="status.type === 'success' ? 'success' : 'error'" :closable="false">
        {{ status.message }}
      </Message>
    </div>

    <div class="footer">v1.0 · by angrechko</div>
  </div>
</template>

<style scoped>
.popup {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-wrapper {
  cursor: grab;
}

.chip-wrapper:active {
  cursor: grabbing;
}

.chip-wrapper.drag-over {
  outline: 2px dashed var(--p-primary-color);
  border-radius: 16px;
}

.action-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer {
  text-align: center;
  font-size: 11px;
  opacity: 0.4;
}
</style>
