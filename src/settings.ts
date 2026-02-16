import { App, PluginSettingTab, Setting } from 'obsidian';
import { get } from 'svelte/store';
import type TaskMasterPlugin from './main';
import { dataStore } from './stores/dataStore';
import { t, setLocale } from './i18n';
import type { LanguageSetting } from './i18n/types';

export class TaskMasterSettingTab extends PluginSettingTab {
  private plugin: TaskMasterPlugin;

  constructor(app: App, plugin: TaskMasterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const tr = get(t);

    new Setting(containerEl)
      .setName(tr('settings.language'))
      .setDesc(tr('settings.languageDesc'))
      .addDropdown(dd =>
        dd
          .addOptions({
            auto: tr('settings.langAuto'),
            en: tr('settings.langEn'),
            ru: tr('settings.langRu'),
          })
          .setValue(this.plugin.data.settings.language)
          .onChange(async (value) => {
            this.plugin.data.settings.language = value as LanguageSetting;
            setLocale(value as LanguageSetting);
            dataStore.set(this.plugin.data);
            await this.plugin.savePluginData();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(tr('settings.cardView'))
      .setDesc(tr('settings.cardViewDesc'))
      .addDropdown(dd =>
        dd
          .addOptions({
            default: tr('settings.cardViewDefault'),
            compact: tr('settings.cardViewCompact'),
          })
          .setValue(this.plugin.data.settings.cardView)
          .onChange(async (value) => {
            this.plugin.data.settings.cardView = value as 'default' | 'compact';
            dataStore.set(this.plugin.data);
            await this.plugin.savePluginData();
          })
      );

    new Setting(containerEl)
      .setName(tr('settings.defaultPriority'))
      .setDesc(tr('settings.defaultPriorityDesc'))
      .addDropdown(dd =>
        dd
          .addOptions({
            low: tr('priority.low'),
            medium: tr('priority.medium'),
            high: tr('priority.high'),
          })
          .setValue(this.plugin.data.settings.defaultPriority)
          .onChange(async (value) => {
            this.plugin.data.settings.defaultPriority = value as 'low' | 'medium' | 'high';
            dataStore.set(this.plugin.data);
            await this.plugin.savePluginData();
          })
      );
  }
}
