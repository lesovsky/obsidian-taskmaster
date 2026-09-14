import { Notice } from 'obsidian';
import { get } from 'svelte/store';
import { dataStore } from '../stores/dataStore';
import { t, groupLabels } from '../i18n';
import { formatFollowUpNotice } from '../logic/followUps';
import { resolveGroupTitle } from './groupTitle';

/**
 * Shows one Obsidian notice about `count` follow-up tasks spawned into the backlog of the board:
 * its current display name, plus a suffix when the backlog is hidden there. Nothing for count 0
 * or a board that no longer exists. Call after the store operation has returned.
 */
export function showFollowUpNotice(boardId: string, count: number): void {
  if (count === 0) return;
  const board = get(dataStore).boards.find(b => b.id === boardId);
  const backlog = board?.groups?.backlog;
  if (!board || !backlog) return;

  const tr = get(t);
  const title = resolveGroupTitle(backlog.title ?? '', get(groupLabels).backlog);
  const hiddenSuffix = board.hiddenGroups.includes('backlog') ? tr('followUps.noticeHidden') : null;
  // A string message is rendered as text by Obsidian, so a markup-like title stays literal.
  new Notice(formatFollowUpNotice(tr('followUps.noticeCreated'), title, count, hiddenSuffix));
}
