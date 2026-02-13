import type { PluginData } from './types';
import { DEFAULT_DATA } from './defaults';

export function migrateData(data: unknown): PluginData {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_DATA, boards: [{ ...DEFAULT_DATA.boards[0] }] };
  }

  const raw = data as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version < 1) {
    return { ...DEFAULT_DATA, boards: [{ ...DEFAULT_DATA.boards[0] }] };
  }

  return data as PluginData;
}
