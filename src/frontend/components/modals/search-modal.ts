// Search modal for finding tasks

import { css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "npm:@m3e/web@2/icon";
import "../task-item.ts";
import { store, type Task } from "../../store.ts";
import { StoreElement } from "../../base.ts";

@customElement("search-modal")
export class SearchModal extends StoreElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 16px 16px;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }

    .modal {
      position: relative;
      background: var(--md-sys-color-surface-container-lowest);
      border-radius: 28px;
      box-shadow: var(--md-sys-elevation-level4);
      width: 100%;
      max-width: 36rem;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .search-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .search-header m3e-icon {
      color: var(--md-sys-color-outline);
      flex-shrink: 0;
      font-size: 22px;
    }

    .search-header input {
      flex: 1;
      font-size: 16px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      font-family: inherit;
    }

    .search-header input::placeholder {
      color: var(--md-sys-color-outline);
    }

    .results {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .result-wrapper {
      border-radius: var(--md-sys-shape-corner-medium);
      transition: outline 0.15s;
      outline: 2px solid transparent;
    }

    .result-wrapper.focused {
      outline: 2px solid var(--md-sys-color-primary);
    }

    .no-results {
      padding: 32px 16px;
      text-align: center;
      color: var(--md-sys-color-outline);
    }
  `;

  @state()
  accessor query = "";
  @state()
  accessor focusedIndex = 0;

  // Cached result IDs to keep stable ordering when tasks are toggled
  private _cachedQuery: string | null = null;
  private _cachedIds: string[] = [];

  private get results(): Task[] {
    const q = this.query.toLowerCase().trim();

    // Recompute order only when query changes
    if (q !== this._cachedQuery) {
      this._cachedQuery = q;
      if (!q) {
        this._cachedIds = [...store.tasks]
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          )
          .slice(0, 10)
          .map((t) => t.id);
      } else {
        this._cachedIds = store.tasks
          .filter((t) => t.title.toLowerCase().includes(q))
          .map((t) => t.id);
      }
    }

    // Return current task objects in cached order
    return this._cachedIds
      .map((id) => store.tasks.find((t) => t.id === id))
      .filter((t): t is Task => !!t);
  }

  override connectedCallback() {
    super.connectedCallback();
    // Listen for keyboard
    document.addEventListener("keydown", this.handleKeydown);
    // Focus input after first render
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector("input");
      input?.focus();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this.close();
    } else if (e.key === "Tab") {
      // Trap focus in input + toggle complete on highlighted task
      e.preventDefault();
      const task = this.results[this.focusedIndex];
      if (task) store.toggleComplete(task);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.focusedIndex = Math.min(
        this.focusedIndex + 1,
        this.results.length - 1,
      );
      this.scrollFocusedIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
      this.scrollFocusedIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const task = this.results[this.focusedIndex];
      if (task) this.selectTask(task);
    }
  };

  private scrollFocusedIntoView() {
    this.updateComplete.then(() => {
      const el = this.shadowRoot?.querySelector(".result-wrapper.focused");
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  private close() {
    store.setShowSearch(false);
  }

  private handleInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    this.focusedIndex = 0;
  }

  private handleResultClick() {
    // Close search if the task form was opened (card click, not checkbox)
    if (store.showTaskForm) {
      this.close();
    }
  }

  private selectTask(task: Task) {
    store.setShowTaskForm(true, task);
    this.close();
  }

  override render() {
    return html`
      <div class="backdrop" @click="${this.close}"></div>
      <div class="modal">
        <div class="search-header">
          <m3e-icon name="search" variant="rounded"></m3e-icon>
          <input
            type="text"
            placeholder="Search tasks..."
            .value="${this.query}"
            @input="${this.handleInput}"
          />
        </div>

        <div class="results">
          ${this.results.length === 0
            ? html`
              <div class="no-results">
                ${this.query
                  ? `No tasks matching "${this.query}"`
                  : "No tasks yet"}
              </div>
            `
            : this.results.map((task, i) =>
              html`
                <div
                  class="result-wrapper ${i === this.focusedIndex
                    ? "focused"
                    : ""}"
                  @click="${() => this.handleResultClick()}"
                >
                  <task-item .task="${task}"></task-item>
                </div>
              `
            )}
        </div>
      </div>
    `;
  }
}
