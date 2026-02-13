import { Plugin } from 'obsidian';
import type { PluginData } from './data/types';
import { DEFAULT_DATA } from './data/defaults';
import { migrateData } from './data/migration';
import { cleanupCompletedTasks, cleanupOrphanedTasks } from './data/cleanup';
import { TaskMasterView, VIEW_TYPE } from './view';
import { TaskMasterSettingTab } from './settings';
import { dataStore } from './stores/dataStore';
import { uiStore } from './stores/uiStore';
import { pluginStore } from './stores/pluginStore';
import { setLocale } from './i18n';

export default class TaskMasterPlugin extends Plugin {
  data: PluginData = { ...DEFAULT_DATA };

  async onload(): Promise<void> {
    await this.loadPluginData();
    setLocale(this.data.settings.language);

    pluginStore.set(this);
    dataStore.set(this.data);
    uiStore.update(ui => ({ ...ui, activeBoardId: this.data.boards[0]?.id ?? '' }));

    this.registerView(VIEW_TYPE, (leaf) => new TaskMasterView(leaf));

    this.addRibbonIcon('layout-dashboard', 'TaskMaster', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-taskmaster',
      name: 'Open TaskMaster board',
      callback: () => this.activateView(),
    });

    this.addSettingTab(new TaskMasterSettingTab(this.app, this));

    // Hourly auto-cleanup of completed tasks past retention
    this.registerInterval(window.setInterval(() => {
      const current = this.data;
      for (const board of current.boards) {
        cleanupCompletedTasks(board, current.tasks);
      }
      cleanupOrphanedTasks(current);
      dataStore.set(current);
      this.savePluginData();
    }, 60 * 60 * 1000));
  }

  async loadPluginData(): Promise<void> {
    const raw = await this.loadData();
    this.data = migrateData(raw);

    for (const board of this.data.boards) {
      cleanupCompletedTasks(board, this.data.tasks);
    }
    cleanupOrphanedTasks(this.data);

    await this.saveData(this.data);
  }

  async savePluginData(): Promise<void> {
    await this.saveData(this.data);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
