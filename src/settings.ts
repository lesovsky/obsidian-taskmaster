import { App, PluginSettingTab, Setting } from 'obsidian';
import type TaskMasterPlugin from './main';
import { dataStore } from './stores/dataStore';

export class TaskMasterSettingTab extends PluginSettingTab {
  private plugin: TaskMasterPlugin;

  constructor(app: App, plugin: TaskMasterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Приоритет по умолчанию')
      .setDesc('Приоритет, назначаемый новым задачам')
      .addDropdown(dd =>
        dd
          .addOptions({ low: 'Низкий', medium: 'Средний', high: 'Высокий' })
          .setValue(this.plugin.data.settings.defaultPriority)
          .onChange(async (value) => {
            this.plugin.data.settings.defaultPriority = value as 'low' | 'medium' | 'high';
            dataStore.set(this.plugin.data);
            await this.plugin.savePluginData();
          })
      );
  }
}
