import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'arc-tabs',
    description: 'Opens new tabs below pinned tab groups',
    permissions: ['tabs', 'tabGroups', 'storage'],
  },
});
