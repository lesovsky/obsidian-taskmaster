import { ItemView, WorkspaceLeaf } from 'obsidian';
import App from './ui/App.svelte';

export const VIEW_TYPE = 'taskmaster-board';

export class TaskMasterView extends ItemView {
  private component: App | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'TaskMaster';
  }

  getIcon(): string {
    return 'layout-dashboard';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('taskmaster-root');

    this.component = new App({
      target: container,
    });
  }

  async onClose(): Promise<void> {
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }
}
