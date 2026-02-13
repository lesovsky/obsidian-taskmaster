import { writable, derived } from 'svelte/store';
import type { Locale, LanguageSetting, TranslationKey, Translations } from './types';
import type { GroupId } from '../data/types';
import { ru } from './ru';
import { en } from './en';

const dictionaries: Record<Locale, Translations> = { en, ru };

export const locale = writable<Locale>('en');

export const t = derived(locale, ($locale) => {
  const dict = dictionaries[$locale];
  return (key: TranslationKey): string => dict[key] ?? key;
});

export const groupLabels = derived(locale, ($locale) => {
  const dict = dictionaries[$locale];
  return {
    backlog: dict['group.backlog'],
    focus: dict['group.focus'],
    inProgress: dict['group.inProgress'],
    orgIntentions: dict['group.orgIntentions'],
    delegated: dict['group.delegated'],
    completed: dict['group.completed'],
  } as Record<GroupId, string>;
});

export function detectLocale(setting: LanguageSetting): Locale {
  if (setting !== 'auto') return setting;
  const obsLocale = window.moment?.locale?.() ?? 'en';
  return obsLocale.startsWith('ru') ? 'ru' : 'en';
}

export function setLocale(setting: LanguageSetting): void {
  locale.set(detectLocale(setting));
}

export type { TranslationKey, LanguageSetting, Locale } from './types';
