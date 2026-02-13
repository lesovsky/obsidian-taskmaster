import { writable } from 'svelte/store';
import type { Plugin } from 'obsidian';

export const pluginStore = writable<Plugin | null>(null);
