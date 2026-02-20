import type { PluginData } from './types';
import { DEFAULT_DATA, DEFAULT_SETTINGS } from './defaults';

export function migrateData(data: unknown): PluginData {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_DATA, boards: [{ ...DEFAULT_DATA.boards[0] }] };
  }

  const raw = data as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version < 1) {
    return { ...DEFAULT_DATA, boards: [{ ...DEFAULT_DATA.boards[0] }] };
  }

  let result = data as PluginData;

  if (version < 2) {
    result = {
      ...result,
      version: 2,
      settings: {
        ...DEFAULT_SETTINGS,
        ...result.settings,
        language: 'auto',
      },
    };
  }

  // Ensure cardView exists (backward compatibility for version 2 without this field)
  if (result.settings.cardView === undefined) {
    result.settings.cardView = DEFAULT_SETTINGS.cardView;
  }

  if (version < 3) {
    for (const board of result.boards) {
      if ((board as any).notes === undefined) {
        board.notes = '';
      }
      if ((board as any).notesCollapsed === undefined) {
        board.notesCollapsed = true;
      }
    }
    result.version = 3;
  }

  if (version < 4) {
    for (const board of result.boards) {
      if ((board as any).hiddenGroups === undefined) {
        (board as any).hiddenGroups = [];
      }
    }
    result.version = 4;
  }

  return result;
}
