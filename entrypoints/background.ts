export default defineBackground(() => {
  let isRestoringSession = false;
  let initializationTimeout: ReturnType<typeof setTimeout> | null = null;
  let settings = {
    startupDelay: 15000,
    pinnedGroups: ['arc-tabs'] as string[],
  };

  async function initializeArcTabsGroup() {
    try {
      const groups = await browser.tabGroups.query({ title: 'arc-tabs' });
      if (groups.length === 0) {
        await createArcTabsGroup();
      }
    } catch (error) {
      console.error('Error initializing arc-tabs group:', error);
    }
  }

  async function createArcTabsGroup() {
    try {
      const tab = await browser.tabs.create({ url: 'chrome://newtab', active: false });
      await new Promise(resolve => setTimeout(resolve, 100));
      const groupId = await browser.tabs.group({ tabIds: tab.id! });
      await browser.tabGroups.update(groupId, {
        title: 'arc-tabs',
        color: 'grey',
        collapsed: true,
      });
      const notPinnedTabs = await browser.tabs.query({ pinned: false });
      await browser.tabs.move(tab.id!, { index: notPinnedTabs[0].index });
    } catch (error) {
      console.error('Error creating arc-tabs group:', error);
    }
  }

  browser.tabGroups.onRemoved.addListener((group) => {
    if (group.title === 'arc-tabs') {
      setTimeout(initializeArcTabsGroup, 1000);
    }
  });

  browser.storage.sync.get({ startupDelay: 15000, pinnedGroups: ['arc-tabs'] }, (loadedSettings) => {
    settings = {
      startupDelay: (loadedSettings.startupDelay as number) || 15000,
      pinnedGroups: loadedSettings.pinnedGroups ? Object.values(loadedSettings.pinnedGroups) : ['arc-tabs'],
    };
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.startupDelay) settings.startupDelay = changes.startupDelay.newValue as number;
    if (changes.pinnedGroups) settings.pinnedGroups = Object.keys(changes.pinnedGroups.newValue as object).length !== 0 ? Object.values(changes.pinnedGroups.newValue as object) : ['arc-tabs'];
  });

  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'updateSettings') {
      settings.startupDelay = request.startupDelay;
      if (isRestoringSession && initializationTimeout) {
        clearTimeout(initializationTimeout);
        initializationTimeout = setTimeout(() => {
          isRestoringSession = false;
        }, settings.startupDelay);
      }
      sendResponse({ success: true });
    }

    if (request.action === 'movePinnedGroupsToStart') {
      movePinnedGroupsToStart().then(() => sendResponse({ success: true }));
      return true;
    }

    if (request.action === 'createArcGroup') {
      initializeArcTabsGroup().then(() => sendResponse({ success: true }));
      return true;
    }

    return true;
  });

  browser.runtime.onStartup.addListener(() => {
    isRestoringSession = true;
    if (initializationTimeout) clearTimeout(initializationTimeout);
    initializationTimeout = setTimeout(() => {
      console.log('working')
      isRestoringSession = false;
    }, settings.startupDelay);
  });

  browser.tabs.onCreated.addListener(async (tab) => {
    if (isRestoringSession) return;

    if (tab.openerTabId !== undefined && tab.pendingUrl !== 'chrome://newtab/') {
      const openerTab = await browser.tabs.get(tab.openerTabId);
      if (!openerTab.pinned) return;
    }

    setTimeout(() => {
      browser.tabs.get(tab.id!, (currentTab) => {
        if (currentTab && !browser.runtime.lastError) {
          moveTabAfterGroups(currentTab.id!);
        }
      });
    }, 100);
  });

  browser.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return;
    if (details.transitionType !== 'auto_bookmark') return;
    if (isRestoringSession) return;

    const { url, tabId } = details;

    try {
      await browser.tabs.goBack(tabId);
    } catch {
      await browser.tabs.update(tabId, { url: 'chrome://newtab' });
    }

    await browser.tabs.create({ url, active: true });
  });

  async function movePinnedGroupsToStart() {
    try {
      const { pinnedGroups: pinnedTitles } = settings;
      if (!pinnedTitles?.length) return;

      const allTabs = await browser.tabs.query({});
      const startIndex = allTabs.filter(t => t.pinned).length;
      const allGroups = await browser.tabGroups.query({});

      const groupsToMove = pinnedTitles
        .map(title => allGroups.find(g => g.title === title))
        .filter(Boolean)
        .reverse() as Browser.tabGroups.TabGroup[];

      for (const group of groupsToMove) {
        await browser.tabGroups.move(group.id, { index: startIndex });
      }
    } catch (error) {
      console.error('Error moving groups:', error);
    }
  }

  async function findPositionAfterGroups(): Promise<number> {
    const { pinnedGroups: pinnedTitles } = settings;
    if (!pinnedTitles?.length) return 0;

    const allGroups = await browser.tabGroups.query({});
    const pinnedIds = new Set(
      allGroups.filter(g => pinnedTitles.includes(g.title!)).map(g => g.id)
    );

    if (pinnedIds.size === 0) return 0;

    const tabs = await browser.tabs.query({});
    let maxIndex = -1;
    tabs.forEach(tab => {
      if (pinnedIds.has(tab.groupId!) && tab.index > maxIndex) {
        maxIndex = tab.index;
      }
    });

    return maxIndex >= 0 ? maxIndex + 1 : 0;
  }

  async function moveTabAfterGroups(tabId: number) {
    try {
      const targetIndex = await findPositionAfterGroups();
      await browser.tabs.move(tabId, { index: targetIndex });

      // Dirty hack to counteract tab bar auto-scroll:
      // focus the first non-pinned tab (moves scroll there), then re-focus target
      const notPinnedTabs = await browser.tabs.query({ pinned: false });
      await focusTab(notPinnedTabs[0].index);
      await focusTab(targetIndex);
    } catch (error) {
      console.error('Error moving tab:', error);
    }
  }

  async function focusTab(tabIndex: number) {
    try {
      const tabs = await browser.tabs.query({ index: tabIndex });
      if (tabs[0]) {
        await browser.tabs.update(tabs[0].id!, { active: true });
      }
    } catch (error) {
      console.log('Could not switch to tab:', error);
    }
  }

  console.log('arc-tabs extension started');
});
