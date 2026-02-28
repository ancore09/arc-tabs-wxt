<script lang="ts" setup>
import { ref, onMounted } from 'vue';

const startupDelay = ref(15000);
const pinnedGroups = ref<string[]>(['arc-tabs']);
const groupNameInput = ref('');
const status = ref({ message: '', type: '' as 'success' | 'error' | '', visible: false });

onMounted(() => {
  browser.storage.sync.get({ startupDelay: 15000, pinnedGroups: ['arc-tabs'] }, (s) => {
    console.log(s)
    startupDelay.value = s.startupDelay as number;
    pinnedGroups.value = s.pinnedGroups ? Object.values(s.pinnedGroups) as string[] : ['arc-tabs'];
    updateSliderFill();
  });
});

function delaySeconds() {
  return Math.round(startupDelay.value / 1000);
}

function updateSliderFill() {
  const min = 10000, max = 60000;
  const pct = ((startupDelay.value - min) / (max - min)) * 100;
  document.documentElement.style.setProperty('--slider-fill', pct + '%');
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

function saveSettings() {
  const delay = startupDelay.value;
  if (delay < 10000 || delay > 60000) {
    showStatus('Valid range: 10000–60000 ms', 'error');
    return;
  }
  browser.storage.sync.set({ startupDelay: delay, pinnedGroups: pinnedGroups.value }, () => {
    showStatus('Settings saved!', 'success');
    browser.runtime.sendMessage({ action: 'updateSettings', startupDelay: delay });
  });
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
  <div class="container">
    <div class="header">
      <h1>Arc Tabs</h1>
      <p>Long live the Arc browser</p>
    </div>

    <div class="content">
      <!-- Startup delay -->
      <div class="setting-group">
        <div class="setting-label">
          <span>Startup delay</span>
          <div class="info-icon">
            i
            <div class="info-tooltip">
              <p>How long the extension is disabled after browser launch.</p>
              <p>Prevents moving tabs while the browser restores the previous session.</p>
            </div>
          </div>
        </div>
        <div class="slider-container">
          <input
            type="range"
            id="startupDelay"
            min="10000"
            max="60000"
            step="1000"
            v-model.number="startupDelay"
            @input="updateSliderFill"
          />
          <div class="slider-value">
            <span>{{ delaySeconds() }}</span><span class="slider-unit">s</span>
          </div>
        </div>
      </div>

      <!-- Pinned groups -->
      <div class="setting-group">
        <div class="setting-label">
          <span>Pinned groups</span>
          <div class="info-icon">
            i
            <div class="info-tooltip">
              <p>New tabs open after the last tab in these groups.</p>
              <p>Groups not in this list are ignored when calculating the position.</p>
            </div>
          </div>
        </div>
        <div class="chips-container">
          <div class="chips-input-row">
            <input
              type="text"
              v-model="groupNameInput"
              class="group-name-input"
              placeholder="Group name…"
              @keydown.enter="addGroup"
            />
            <button class="btn-add" @click="addGroup">+</button>
          </div>
          <div class="chips-list" v-if="pinnedGroups.length">
            <div class="chip" v-for="name in pinnedGroups" :key="name">
              <span>{{ name }}</span>
              <button class="chip-remove" @click="removeGroup(name)">×</button>
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary" @click="saveSettings">Save settings</button>

      <div class="action-row">
        <button class="btn btn-secondary" @click="createArcGroup">Create arc-tabs group</button>
        <div class="info-icon">
          i
          <div class="info-tooltip tip-left-up">
            <p>Creates an arc-tabs tab group with one empty tab for scroll control.</p>
            <p>If deleted, the group is recreated automatically.</p>
            <p>To remove it permanently — disable the extension and delete the group manually.</p>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" style="margin-top: 8px;" @click="movePinnedGroups">
        Move groups to start
      </button>

      <div
        class="status"
        :class="[status.type, { show: status.visible }]"
      >{{ status.message }}</div>
    </div>

    <div class="footer">v1.0 · by angrechko</div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 320px;
  background: linear-gradient(145deg, #5b67d8 0%, #6d3fa0 100%);
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #fff;
  overflow: hidden;
}

#app {
  all: unset;
}
</style>

<style scoped>
.container {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  margin: 10px;
  padding: 22px 20px 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.header {
  text-align: center;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 20px;
}

.header h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: #fff;
}

.header p {
  font-size: 11px;
  opacity: 0.5;
  margin-top: 4px;
  letter-spacing: 0.2px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(255, 255, 255, 0.55);
}

.info-icon {
  position: relative;
  cursor: help;
  width: 15px;
  height: 15px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-style: italic;
  font-weight: 700;
  flex-shrink: 0;
  transition: background 0.2s;
  z-index: 5;
}

.info-icon:hover {
  background: rgba(255, 255, 255, 0.28);
}

.info-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  background: rgba(15, 8, 35, 0.93);
  color: rgba(255, 255, 255, 0.88);
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  line-height: 1.55;
  width: 210px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
  z-index: 100;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.info-tooltip p + p {
  margin-top: 6px;
}

.info-icon:hover .info-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.info-tooltip.tip-left {
  left: auto;
  right: 0;
  transform: translateX(0) translateY(-4px);
}

.info-icon:hover .info-tooltip.tip-left {
  transform: translateX(0) translateY(0);
}

.info-tooltip.tip-left-up {
  top: auto;
  bottom: calc(100% + 8px);
  left: auto;
  right: 0;
  transform: translateX(0) translateY(4px);
}

.info-icon:hover .info-tooltip.tip-left-up {
  transform: translateX(0) translateY(0);
}

.setting-group {
  margin-bottom: 20px;
}

.slider-container {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 14px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.slider-value {
  min-width: 36px;
  text-align: center;
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
}

.slider-unit {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.8;
}

input[type="range"] {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.9) var(--slider-fill, 10%),
    rgba(255, 255, 255, 0.2) var(--slider-fill, 10%),
    rgba(255, 255, 255, 0.2) 100%
  );
  outline: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  transition: transform 0.15s, box-shadow 0.15s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}

.chips-container {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(236, 0, 140, 0.25);
  border: 1px solid rgba(236, 0, 140, 0.35);
  border-radius: 20px;
  padding: 3px 6px 3px 10px;
  font-size: 12px;
  font-weight: 500;
}

.chip-remove {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.chip-remove:hover {
  color: #fff;
}

.chips-input-row {
  display: flex;
  gap: 8px;
}

.group-name-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 7px 11px;
  color: #fff;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.group-name-input:focus {
  border-color: rgba(255, 255, 255, 0.35);
}

.group-name-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.btn-add {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  color: #fff;
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  padding: 0 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add:hover {
  background: rgba(255, 255, 255, 0.22);
}

.btn {
  width: 100%;
  border: none;
  padding: 11px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.15px;
  transition: transform 0.12s, opacity 0.15s, box-shadow 0.15s;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: linear-gradient(135deg, #ec008c, #fc6767);
  color: #fff;
  box-shadow: 0 4px 16px rgba(236, 0, 140, 0.35);
  margin-bottom: 10px;
}

.btn-primary:hover {
  box-shadow: 0 6px 20px rgba(236, 0, 140, 0.5);
  opacity: 0.93;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.17);
}

.action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-row .btn {
  flex: 1;
}

.status {
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 12px;
  text-align: center;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: opacity 0.3s, max-height 0.3s, margin-top 0.3s;
}

.status.show {
  opacity: 1;
  max-height: 60px;
  margin-top: 13px;
}

.status.success {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.status.error {
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  font-size: 11px;
  opacity: 0.35;
  letter-spacing: 0.3px;
}
</style>
