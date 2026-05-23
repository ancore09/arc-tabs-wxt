# arc-tabs

A Chrome extension that replicates Arc Browser's tab management behaviour — new tabs always open after your pinned tab groups.

### Arc analogy

A bit of terminology first:
- **Pinned tabs** — what Arc calls "pinned" items. In this extension, "pinned" means Chrome tab groups that sit at the very beginning of the tab bar.
- **Temporary tabs** — what Arc calls "today" tabs (auto-archived over time). In this extension these are all tabs to the right of the pinned groups.

Example:

![](./images/pinned_groups.png)

Here the groups *arc-tabs*, *admin*, *grafana*, and *merge requests* are treated as pinned. Everything else is temporary.

### Features

- **New tab positioning.** When a new tab opens it is immediately moved to the position right after the last pinned group — exactly like Arc. The tab bar auto-scrolls to the new tab.
- **Startup delay.** To avoid moving tabs while Chrome restores the previous session, the extension disables itself for a configurable interval on launch. A live countdown is shown in the popup while the delay is active.
- **Manual activation toggle.** The extension can be turned on or off at any time from the popup. Clicking the toggle during the countdown skips the remaining delay immediately.
- **Pinned group management.** Define which groups count as pinned, reorder them by dragging, and restore the correct order with the "Arrange groups" button.
- **Housekeeping.** Shows the number of open tabs and an estimated memory footprint. A single click closes the N oldest tabs (non-pinned, highest tab index); the count is adjustable with − / + buttons.

### Installation

1. Configure Chrome:
    - Go to `chrome://flags/` and enable `vertical-tabs`
    - Go to `chrome://flags/` and disable `new-tab-adds-to-active-group`
2. Enable Developer mode in `chrome://extensions/`.
3. Clone this repository.
4. Build the extension:
    ```bash
    npm install
    npm run build
    ```
5. In `chrome://extensions/` click "Load unpacked" and select the `.output/chrome-mv3` folder.

### Usage

The extension works immediately after installation. The popup is split into two tabs.

#### Groups tab

![](./images/popup_v1.1_1.png)

- **Active** — enables/disables the extension. While the startup delay is running, a countdown is shown ("Starting in 12s…"). Clicking the toggle activates the extension instantly, skipping the remaining delay.
- **Pinned groups** — the list of tab groups treated as pinned. Groups can be added, removed, and reordered by dragging or with the ↑↓ buttons. Only these groups affect where new tabs are placed.
- **Arrange groups** — moves all pinned groups to the beginning of the tab bar in the configured order. Useful if the order gets disrupted.
- **Housekeeping** — shows open tab count and estimated memory usage (based on a statistical distribution). The "Close tabs" button closes the N oldest tabs (non-pinned); adjust N with the − / + counter.

#### Settings tab

![](./images/popup_v1.1_2.png)

- **Enable on startup** — when on, the extension auto-activates every time Chrome launches (after the startup delay). When off, the extension starts inactive and must be enabled manually.
- **Startup delay** — slider from 10 to 60 seconds. Controls how long the extension stays inactive after the browser starts.
- **Create arc-tabs group** — creates a tab group containing one blank tab, used as a scroll anchor hack. Keep it first in the pinned groups list. If deleted, the extension recreates it automatically.
- **Memory estimation** — configure the memory formula. Set the assumed size for three tab tiers (light 50% / medium 30% / heavy 20%) and the bar scale ("Bar max"). All values are stored locally in the browser.

### Technical notes

#### Tab bar scroll

Chrome has no built-in API for controlling tab bar scroll position. The workaround is a dirty hack: when a new tab opens, focus is shifted to the very first tab (triggering a scroll to the top), then immediately shifted back to the new tab. To reduce flicker, it is recommended to keep an `arc-tabs` group with a blank tab — the blank tab is used as the intermediate focus target and looks identical to a new tab page, making the flash barely noticeable.

When an `arc-tabs` group exists, the extension tracks it, keeps it at the front, and recreates it if deleted.

#### Memory estimation

Chrome's actual per-process memory is not accessible from stable channel extensions (`chrome.processes` API requires Dev/Canary). Instead, a statistical estimate is used: each tab is assigned an average memory size based on a configurable distribution (default: 50% of tabs × 70 MB + 30% × 150 MB + 20% × 300 MB ≈ 140 MB/tab). The formula can be adjusted in the Settings tab.
