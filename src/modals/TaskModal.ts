import { App, Modal } from 'obsidian';
import TaskFormContent from '../ui/TaskFormContent.svelte';
import type { Task, GroupId, Priority } from '../data/types';

export class TaskModal extends Modal {
  private component: TaskFormContent | null = null;
  private groupId: GroupId;
  private task: Task | null;
  private defaultPriority: Priority;
  private onSaveCallback: (task: Task) => void;
  private onDeleteCallback: (() => void) | null;

  constructor(
    app: App,
    groupId: GroupId,
    defaultPriority: Priority = 'medium',
    onSave: (task: Task) => void,
    task: Task | null = null,
    onDelete: (() => void) | null = null,
  ) {
    super(app);
    this.groupId = groupId;
    this.defaultPriority = defaultPriority;
    this.onSaveCallback = onSave;
    this.task = task;
    this.onDeleteCallback = onDelete;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    this.titleEl.setText(this.task ? 'Редактировать задачу' : 'Новая задача');

    this.component = new TaskFormContent({
      target: contentEl,
      props: {
        task: this.task,
        groupId: this.groupId,
        defaultPriority: this.defaultPriority,
        onSave: (task: Task) => {
          this.onSaveCallback(task);
          this.close();
        },
        onDelete: this.onDeleteCallback
          ? () => {
              this.onDeleteCallback!();
              this.close();
            }
          : null,
      },
    });
  }

  onClose(): void {
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }
}
