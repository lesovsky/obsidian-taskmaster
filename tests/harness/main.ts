// Test harness entry point.
// Mounts App.svelte with mock Obsidian API and exposes window.__test for Playwright.

// 1. HTMLElement polyfills — must be FIRST, before any imports
(HTMLElement.prototype as any).empty = function (): void {
  this.innerHTML = '';
};
(HTMLElement.prototype as any).setText = function (text: string): void {
  this.textContent = text;
};
(HTMLElement.prototype as any).createEl = function <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: { text?: string; cls?: string; attr?: Record<string, string> },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs?.text) el.textContent = attrs.text;
  if (attrs?.cls) el.className = attrs.cls;
  if (attrs?.attr) {
    for (const [k, v] of Object.entries(attrs.attr)) {
      el.setAttribute(k, v);
    }
  }
  this.appendChild(el);
  return el;
};
(HTMLElement.prototype as any).addClass = function (cls: string): void {
  this.classList.add(cls);
};
(HTMLElement.prototype as any).removeClass = function (cls: string): void {
  this.classList.remove(cls);
};
(HTMLElement.prototype as any).toggleClass = function (cls: string, force?: boolean): void {
  this.classList.toggle(cls, force);
};
(HTMLElement.prototype as any).hasClass = function (cls: string): boolean {
  return this.classList.contains(cls);
};

// 2. window.moment stub — prevents detectLocale crash on 'auto' setting
(window as any).moment = { locale: () => 'en' };

// 3. Imports (after polyfills)
import { get } from 'svelte/store';
import { Plugin as MockPlugin } from './obsidian-mock';
import { dataStore, moveTask as storeMoveTask, updateSettings as storeUpdateSettings } from '../../src/stores/dataStore';
import { uiStore } from '../../src/stores/uiStore';
import { pluginStore } from '../../src/stores/pluginStore';
import { migrateData } from '../../src/data/migration';
import { locale } from '../../src/i18n';
import type { GroupId, Settings } from '../../src/data/types';
import App from '../../src/ui/App.svelte';

// 4. Initialise stores from clean state
const mockPlugin = new MockPlugin();
const freshData = migrateData(null);
freshData.settings.language = 'en';

pluginStore.set(mockPlugin as any);
dataStore.set(freshData);
uiStore.update(ui => ({ ...ui, activeBoardId: freshData.boards[0]?.id ?? '' }));
locale.set('en');

// 5. Mount App
new App({ target: document.getElementById('app')! });

// 6. window.__test API
declare global {
  interface Window {
    __test: {
      resetData(partial?: object): void;
      getDataStore(): ReturnType<typeof get<typeof dataStore>>;
      moveTask(taskId: string, from: GroupId, to: GroupId, index?: number): void;
      updateSettings(settings: Partial<Settings>): void;
    };
  }
}

window.__test = {
  resetData(partial?: object): void {
    // a) Cancel pending toast timers to prevent cross-test leakage
    const ui = get(uiStore);
    for (const toast of ui.toasts) {
      clearTimeout(toast.timerId);
    }

    // b) Clear persisted data
    localStorage.removeItem('tm-test-data');

    // c) Build data:
    //    - versioned snapshots (have 'version' field) → migrate directly so all migration steps run
    //    - settings overrides (no 'version') → fresh data + deepMerge
    let data: ReturnType<typeof migrateData>;
    if (partial && 'version' in (partial as Record<string, unknown>)) {
      data = migrateData(partial);
    } else {
      data = migrateData(null);
      if (partial) data = deepMerge(data, partial);
    }
    // Force locale to English regardless of settings.language
    data.settings.language = 'en';
    locale.set('en');

    // d) Ensure hiddenGroups is empty on all boards
    for (const board of data.boards) {
      if (!board.hiddenGroups) board.hiddenGroups = [];
    }

    // e) Reset all three stores
    pluginStore.set(mockPlugin as any);
    dataStore.set(data);
    uiStore.set({ activeBoardId: data.boards[0]?.id ?? '', toasts: [] });
  },

  getDataStore() {
    return get(dataStore);
  },

  moveTask(taskId: string, from: GroupId, to: GroupId, index = 0): void {
    storeMoveTask(taskId, from, to, index);
  },

  updateSettings(settings: Partial<Settings>): void {
    storeUpdateSettings(settings);
  },
};

// Minimal deep merge: handles one level of nested objects (arrays replaced wholesale)
function deepMerge<T extends object>(base: T, override: object): T {
  const result = { ...base } as any;
  for (const [key, val] of Object.entries(override)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof (result as any)[key] === 'object') {
      (result as any)[key] = deepMerge((result as any)[key], val);
    } else {
      (result as any)[key] = val;
    }
  }
  return result;
}

