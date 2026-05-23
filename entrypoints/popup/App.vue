<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import ToggleSwitch from 'primevue/toggleswitch';
import InputNumber from 'primevue/inputnumber';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

const isDark = ref(localStorage.getItem('theme') !== 'light');

function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
}

const startupDelay = ref(15000);
const pinnedGroups = ref<string[]>(['arc-tabs']);
const groupNameInput = ref('');
const status = ref({ message: '', type: '' as 'success' | 'error' | '', visible: false });
const loaded = ref(false);

// --- Housekeeping ---
// Tier weights are fixed (50 / 30 / 20 %), MB values are user-configurable.
const ls = (key: string, def: number) => parseFloat(localStorage.getItem(key) ?? String(def));
const tierLowMb  = ref(ls('mem_tier_low',  70));   // 50 % of tabs
const tierMedMb  = ref(ls('mem_tier_med',  150));  // 30 % of tabs
const tierHighMb = ref(ls('mem_tier_high', 300));  // 20 % of tabs
const memRefGb   = ref(ls('mem_ref_gb',    8));    // bar fills at this value

watch(tierLowMb,  v => localStorage.setItem('mem_tier_low',  String(v)));
watch(tierMedMb,  v => localStorage.setItem('mem_tier_med',  String(v)));
watch(tierHighMb, v => localStorage.setItem('mem_tier_high', String(v)));
watch(memRefGb,   v => localStorage.setItem('mem_ref_gb',    String(v)));

const mbPerTab = computed(() =>
  0.5 * tierLowMb.value + 0.3 * tierMedMb.value + 0.2 * tierHighMb.value
);

const openTabCount   = ref(0);
const tabsToClose    = ref(5);
const estimatedMemGB = computed(() =>
  parseFloat(((openTabCount.value * mbPerTab.value) / 1024).toFixed(1))
);
const memPercent = computed(() =>
  Math.min(100, Math.round((estimatedMemGB.value / memRefGb.value) * 100))
);

function refreshStats() {
  browser.tabs.query({}).then(tabs => { openTabCount.value = tabs.length; });
}

async function closeOldestTabs() {
  const tabs = await browser.tabs.query({ pinned: false });
  const toClose = [...tabs]
    .sort((a, b) => b.index - a.index)
    .slice(0, tabsToClose.value);
  if (!toClose.length) return;
  await browser.tabs.remove(toClose.map(t => t.id!));
  refreshStats();
  showStatus(`Closed ${toClose.length} tab${toClose.length !== 1 ? 's' : ''}`, 'success');
}

// --- Active state ---
const isActive = ref(true);
const isRestoringSession = ref(false);
const activatesInSeconds = ref(0);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function startCountdown(ms: number) {
  activatesInSeconds.value = Math.ceil(ms / 1000);
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    activatesInSeconds.value = Math.max(0, activatesInSeconds.value - 1);
    if (activatesInSeconds.value === 0) {
      clearInterval(countdownInterval!);
      countdownInterval = null;
      isRestoringSession.value = false;
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  isRestoringSession.value = false;
  activatesInSeconds.value = 0;
}

const activeDescription = computed(() => {
  if (!isActive.value) return 'Tab management is off';
  if (isRestoringSession.value && activatesInSeconds.value > 0) return `Starting in ${activatesInSeconds.value}s…`;
  return 'Tab management is on';
});

function toggleActive() {
  isActive.value = !isActive.value;
  stopCountdown();
  browser.runtime.sendMessage({ action: 'setActive', isActive: isActive.value });
}

// --- Enable on startup ---
const enableOnStartup = ref(true);

const GROUP_COLORS: Record<string, string> = {
  grey:   '#9aa0a6',
  blue:   '#4285f4',
  red:    '#ea4335',
  yellow: '#fbbc04',
  green:  '#34a853',
  pink:   '#f97ef6',
  purple: '#af5cf7',
  cyan:   '#24c1e0',
  orange: '#fa903e',
};

const groupColorMap = ref<Record<string, string>>({});

async function loadGroupColors() {
  const groups = await browser.tabGroups.query({});
  const map: Record<string, string> = {};
  groups.forEach(g => { if (g.title && g.color) map[g.title] = g.color; });
  groupColorMap.value = map;
}

function groupDotStyle(name: string) {
  const chromeName = groupColorMap.value[name];
  const color = chromeName ? GROUP_COLORS[chromeName] : undefined;
  return color ? { background: color } : {};
}

const dragSrcIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number) { dragSrcIndex.value = index; }
function onDragOver(index: number) { dragOverIndex.value = index; }

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
  browser.storage.sync.get(
    { startupDelay: 15000, pinnedGroups: ['arc-tabs'], enableOnStartup: true },
    (s) => {
      startupDelay.value = s.startupDelay as number;
      pinnedGroups.value = s.pinnedGroups ? Object.values(s.pinnedGroups) as string[] : ['arc-tabs'];
      enableOnStartup.value = (s.enableOnStartup as boolean) ?? true;
      loaded.value = true;
    },
  );

  browser.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (!response) return;
    isActive.value = response.isActive as boolean;
    isRestoringSession.value = response.isRestoringSession as boolean;
    if (response.isRestoringSession && response.activatesIn > 0) {
      startCountdown(response.activatesIn as number);
    }
  });

  loadGroupColors();
  refreshStats();
});

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function persistSettings() {
  if (!loaded.value) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    browser.storage.sync.set(
      { startupDelay: startupDelay.value, pinnedGroups: pinnedGroups.value, enableOnStartup: enableOnStartup.value },
      () => {
        browser.runtime.sendMessage({
          action: 'updateSettings',
          startupDelay: startupDelay.value,
          enableOnStartup: enableOnStartup.value,
        });
      },
    );
  }, 300);
}

watch(startupDelay, persistSettings);
watch(pinnedGroups, persistSettings, { deep: true });
watch(enableOnStartup, persistSettings);

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

function moveToTop(index: number) {
  const items = [...pinnedGroups.value];
  items.unshift(items.splice(index, 1)[0]);
  pinnedGroups.value = items;
}

function moveToBottom(index: number) {
  const items = [...pinnedGroups.value];
  items.push(items.splice(index, 1)[0]);
  pinnedGroups.value = items;
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
      <div>
        <h2>Arc Tabs</h2>
        <small>Long live the Arc browser</small>
      </div>
      <Button
        :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
        text
        rounded
        @click="toggleTheme"
      />
    </div>

    <Tabs value="0">
      <TabList>
        <Tab value="0">Groups</Tab>
        <Tab value="1">Settings</Tab>
      </TabList>

      <TabPanels>

        <!-- Tab 1: Groups -->
        <TabPanel value="0">
          <div class="tab-content">

            <!-- Active toggle -->
            <div class="toggle-row" @click="toggleActive">
              <div class="toggle-label">
                <span>Active</span>
                <small :class="{ 'status-starting': isRestoringSession && isActive }">
                  {{ activeDescription }}
                </small>
              </div>
              <ToggleSwitch :modelValue="isActive" @update:modelValue="toggleActive" @click.stop />
            </div>

            <!-- Pinned groups -->
            <div class="setting-group">
              <label v-tooltip.bottom="'New tabs open after the last tab in these groups.'">
                Pinned groups
              </label>
              <div class="input-row">
                <InputText
                  v-model="groupNameInput"
                  placeholder="Add group…"
                  @keydown.enter="addGroup"
                  fluid
                />
                <Button icon="pi pi-plus" @click="addGroup" outlined />
              </div>
              <div class="groups-list" v-if="pinnedGroups.length">
                <div
                  v-for="(name, index) in pinnedGroups"
                  :key="name"
                  class="group-row"
                  :class="{ 'drag-over': dragOverIndex === index }"
                  draggable="true"
                  @dragstart="onDragStart(index)"
                  @dragover.prevent="onDragOver(index)"
                  @drop="onDrop"
                  @dragend="onDragEnd"
                >
                  <i class="pi pi-bars drag-handle"></i>
                  <span class="group-dot" :style="groupDotStyle(name)"></span>
                  <span class="group-name">{{ name }}</span>
                  <Button icon="pi pi-angle-double-up" text rounded size="small" v-tooltip.top="'Move to top'" @click="moveToTop(index)" :disabled="index === 0" />
                  <Button icon="pi pi-angle-double-down" text rounded size="small" v-tooltip.top="'Move to bottom'" @click="moveToBottom(index)" :disabled="index === pinnedGroups.length - 1" />
                  <Button icon="pi pi-times" text rounded size="small" @click="removeGroup(name)" />
                </div>
              </div>
            </div>

            <!-- Arrange groups -->
            <Button label="Arrange groups" severity="secondary" @click="movePinnedGroups" fluid />

            <!-- Housekeeping -->
            <div class="setting-group">
              <div class="section-header">
                <label>Housekeeping</label>
                <Button icon="pi pi-refresh" text rounded size="small" @click="refreshStats" />
              </div>
              <div class="mem-stats">
                <span>~<strong>{{ estimatedMemGB }} GB</strong> estimated</span>
                <span class="tab-count-badge">{{ openTabCount }} tabs</span>
              </div>
              <div class="mem-bar-track">
                <div
                  class="mem-bar-fill"
                  :class="{ 'mem-high': memPercent >= 80 }"
                  :style="{ width: memPercent + '%' }"
                />
              </div>
              <div class="close-controls">
                <span class="close-label">Close oldest</span>
                <div class="counter">
                  <Button icon="pi pi-minus" text rounded size="small" :disabled="tabsToClose <= 1" @click="tabsToClose--" />
                  <span class="counter-value">{{ tabsToClose }}</span>
                  <Button icon="pi pi-plus" text rounded size="small" :disabled="tabsToClose >= 50" @click="tabsToClose++" />
                </div>
                <Button label="Close tabs" severity="danger" outlined size="small" @click="closeOldestTabs" />
              </div>
            </div>

          </div>
        </TabPanel>

        <!-- Tab 2: Settings -->
        <TabPanel value="1">
          <div class="tab-content">

            <!-- Enable on startup -->
            <div class="toggle-row" @click="enableOnStartup = !enableOnStartup">
              <div class="toggle-label">
                <span>Enable on startup</span>
                <small>Auto-activate when Chrome launches</small>
              </div>
              <ToggleSwitch v-model="enableOnStartup" @click.stop />
            </div>

            <!-- Startup delay -->
            <div class="setting-group">
              <label v-tooltip.bottom="'How long the extension waits after browser launch before managing tabs. Prevents interference with session restore.'">
                Startup delay — <strong>{{ delaySeconds() }}s</strong>
              </label>
              <Slider v-model="startupDelay" :min="10000" :max="60000" :step="1000" fluid />
            </div>

            <!-- Memory estimation config -->
            <div class="setting-group section-gap">
              <label>Memory estimation</label>
              <div class="formula-grid">
                <span class="formula-tier">Light <small>(50%)</small></span>
                <InputNumber v-model="tierLowMb"  :min="1" :max="9999" suffix=" MB" :inputStyle="{ width: '72px' }" size="small" :allowEmpty="false" />
                <span class="formula-tier">Medium <small>(30%)</small></span>
                <InputNumber v-model="tierMedMb"  :min="1" :max="9999" suffix=" MB" :inputStyle="{ width: '72px' }" size="small" :allowEmpty="false" />
                <span class="formula-tier">Heavy <small>(20%)</small></span>
                <InputNumber v-model="tierHighMb" :min="1" :max="9999" suffix=" MB" :inputStyle="{ width: '72px' }" size="small" :allowEmpty="false" />
                <span class="formula-tier">Bar max</span>
                <InputNumber v-model="memRefGb"   :min="1" :max="128"  suffix=" GB" :inputStyle="{ width: '72px' }" size="small" :allowEmpty="false" />
              </div>
              <small class="formula-avg">~{{ mbPerTab.toFixed(0) }} MB avg per tab</small>
            </div>

            <!-- Create arc-tabs group -->
            <Button
              label="Create arc-tabs group"
              severity="secondary"
              @click="createArcGroup"
              fluid
              v-tooltip.top="'Creates an arc-tabs tab group with one empty tab for scroll control. If deleted, recreated automatically.'"
            />

          </div>
        </TabPanel>

      </TabPanels>
    </Tabs>

    <Message v-if="status.visible" :severity="status.type === 'success' ? 'success' : 'error'" :closable="false" class="status-msg">
      {{ status.message }}
    </Message>

    <div class="footer">v1.1 · by ancored</div>
  </div>
</template>

<style scoped>
.popup {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
}

/* Tab panel inner layout */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 16px 0;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Toggle rows */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  cursor: pointer;
  user-select: none;
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label span {
  font-size: 13px;
  font-weight: 500;
}

.toggle-label small {
  font-size: 11px;
  opacity: 0.5;
  transition: color 0.2s, opacity 0.2s;
}

.toggle-label small.status-starting {
  opacity: 0.8;
  color: var(--p-primary-color);
}

/* Slider */
:deep(.p-tabpanel) {
  padding: 0;
}

:deep(.p-tablist) {
  padding: 0 16px;
}

:deep(.p-slider-handle) {
  background: var(--p-primary-color) !important;
  border-color: var(--p-primary-color) !important;
}

/* Pinned groups */
.input-row {
  display: flex;
  gap: 8px;
}

.groups-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow-y: auto;
  max-height: 160px;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 10px;
  cursor: grab;
  transition: background 0.15s;
}

.group-row:not(:last-child) {
  border-bottom: 1px solid var(--p-surface-border);
}

.group-row:hover { background: var(--p-surface-hover); }
.group-row:active { cursor: grabbing; }

.group-row.drag-over {
  outline: 2px dashed var(--p-primary-color);
  outline-offset: -2px;
}

.drag-handle {
  opacity: 0.3;
  font-size: 12px;
}

.group-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--p-surface-400);
}

.group-name {
  flex: 1;
  font-size: 13px;
}

/* Housekeeping */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mem-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.tab-count-badge {
  opacity: 0.5;
  font-size: 11px;
}

.mem-bar-track {
  height: 6px;
  border-radius: 3px;
  background: var(--p-surface-border);
  overflow: hidden;
}

.mem-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--p-primary-color);
  transition: width 0.4s ease;
}

.mem-bar-fill.mem-high {
  background: var(--p-red-500, #ef4444);
}

.close-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-label {
  font-size: 12px;
  opacity: 0.7;
  flex: 1;
}

.counter {
  display: flex;
  align-items: center;
  gap: 2px;
}

.counter-value {
  font-size: 13px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
}

/* Memory estimation formula */
.formula-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px 12px;
}

.formula-tier {
  font-size: 12px;
}

.formula-tier small {
  opacity: 0.5;
  margin-left: 3px;
}

.formula-avg {
  font-size: 11px;
  opacity: 0.5;
}

.section-gap {
  margin-top: 8px;
}

/* Status message */
.status-msg {
  margin: 0 16px;
}

.footer {
  text-align: center;
  font-size: 11px;
  opacity: 0.4;
  padding: 8px 16px 16px;
}
</style>
