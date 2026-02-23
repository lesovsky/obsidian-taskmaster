// Mock implementation of Obsidian API for test harness.
// Replaces 'obsidian' module at build time via esbuild plugin.

export class App {
  workspace = {
    getLeavesOfType: (_type: string) => [] as WorkspaceLeaf[],
    revealLeaf: (_leaf: WorkspaceLeaf) => {},
    getLeaf: (_mode?: string) => new WorkspaceLeaf(),
  };
}

export class WorkspaceLeaf {
  view: unknown = null;
  async setViewState(_state: unknown): Promise<void> {}
}

export class Plugin {
  app: App;

  constructor() {
    this.app = new App();
  }

  async loadData(): Promise<unknown> {
    const raw = localStorage.getItem('tm-test-data');
    return raw ? JSON.parse(raw) : null;
  }

  async saveData(data: unknown): Promise<void> {
    localStorage.setItem('tm-test-data', JSON.stringify(data));
  }

  registerView(_type: string, _fn: unknown): void {}
  addRibbonIcon(_icon: string, _title: string, _fn: unknown): void {}
  addCommand(_cmd: unknown): void {}
  addSettingTab(_tab: unknown): void {}
  registerInterval(_id: unknown): void {}
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  private _overlay: HTMLElement | null = null;

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'modal-content';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'modal-title';
  }

  open(): void {
    const overlay = document.createElement('div');
    overlay.className = 'tm-test-modal-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center';

    const container = document.createElement('div');
    container.className = 'modal';
    container.style.cssText =
      'background:var(--background-primary,#fff);border-radius:8px;padding:16px;min-width:400px;max-width:600px;max-height:80vh;overflow-y:auto';

    container.appendChild(this.titleEl);
    container.appendChild(this.contentEl);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    this.onOpen();
  }

  close(): void {
    this.onClose();
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }

  onOpen(): void {}
  onClose(): void {}
}

export class ItemView {
  containerEl: HTMLElement;
  app: App;
  leaf: WorkspaceLeaf;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = new App();
    // Obsidian's ItemView has containerEl with two children; index [1] is the content pane
    this.containerEl = document.createElement('div');
    this.containerEl.appendChild(document.createElement('div')); // [0] header
    this.containerEl.appendChild(document.createElement('div')); // [1] content
  }

  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  registerEvent(_event: unknown): void {}
}

export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: HTMLElement;

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

// Fluent builder for settings UI — no-op in tests
export class Setting {
  private _el: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this._el = document.createElement('div');
    containerEl.appendChild(this._el);
  }

  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }

  addDropdown(cb: (dd: DropdownComponent) => unknown): this {
    cb(new DropdownComponent(this._el));
    return this;
  }

  addText(cb: (t: TextComponent) => unknown): this {
    cb(new TextComponent(this._el));
    return this;
  }

  addToggle(cb: (t: ToggleComponent) => unknown): this {
    cb(new ToggleComponent(this._el));
    return this;
  }
}

class DropdownComponent {
  private _el: HTMLSelectElement;

  constructor(parent: HTMLElement) {
    this._el = document.createElement('select');
    parent.appendChild(this._el);
  }

  addOptions(opts: Record<string, string>): this {
    for (const [val, label] of Object.entries(opts)) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      this._el.appendChild(opt);
    }
    return this;
  }

  setValue(val: string): this {
    this._el.value = val;
    return this;
  }

  onChange(fn: (val: string) => unknown): this {
    this._el.addEventListener('change', () => fn(this._el.value));
    return this;
  }
}

class TextComponent {
  private _el: HTMLInputElement;

  constructor(parent: HTMLElement) {
    this._el = document.createElement('input');
    parent.appendChild(this._el);
  }

  setValue(val: string): this { this._el.value = val; return this; }
  setPlaceholder(ph: string): this { this._el.placeholder = ph; return this; }

  onChange(fn: (val: string) => unknown): this {
    this._el.addEventListener('input', () => fn(this._el.value));
    return this;
  }
}

class ToggleComponent {
  private _el: HTMLInputElement;

  constructor(parent: HTMLElement) {
    this._el = document.createElement('input');
    this._el.type = 'checkbox';
    parent.appendChild(this._el);
  }

  setValue(val: boolean): this { this._el.checked = val; return this; }

  onChange(fn: (val: boolean) => unknown): this {
    this._el.addEventListener('change', () => fn(this._el.checked));
    return this;
  }
}
