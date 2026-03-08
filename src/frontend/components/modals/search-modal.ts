// Search modal for finding tasks

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store, type Task } from "../../store.ts";

@customElement("search-modal")
export class SearchModal extends LitElement {
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
      background: var(--md-sys-color-surface);
      border-radius: var(--md-sys-shape-corner-extra-large);
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
      padding: 16px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .search-icon {
      color: var(--md-sys-color-outline);
      flex-shrink: 0;
    }

    input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 18px;
      color: var(--md-sys-color-on-surface);
      outline: none;
    }

    input::placeholder {
      color: var(--md-sys-color-outline);
    }

    .close-btn {
      padding: 8px;
      background: transparent;
      border: none;
      color: var(--md-sys-color-outline);
      cursor: pointer;
      border-radius: var(--md-sys-shape-corner-small);
    }

    .close-btn:hover {
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
    }

    .results {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .result-item:hover {
      background: var(--md-sys-color-surface-container);
    }

    .result-item.completed {
      opacity: 0.6;
    }

    .result-icon {
      width: 20px;
      height: 20px;
      border: 2px solid var(--md-sys-color-outline);
      border-radius: 50%;
      flex-shrink: 0;
    }

    .result-item.completed .result-icon {
      background: var(--md-sys-color-primary);
      border-color: var(--md-sys-color-primary);
    }

    .result-content {
      flex: 1;
      min-width: 0;
    }

    .result-title {
      font-size: 14px;
      color: var(--md-sys-color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-item.completed .result-title {
      text-decoration: line-through;
    }

    .result-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .meta-tag {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 9999px;
      background: var(--md-sys-color-surface-container-high);
      color: var(--md-sys-color-on-surface-variant);
    }

    .meta-tag.project {
      background: var(--tag-color, var(--md-sys-color-primary-container));
      color: var(--md-sys-color-on-primary-container);
    }

    .meta-tag.context {
      background: var(--tag-color, var(--md-sys-color-secondary-container));
      color: var(--md-sys-color-on-secondary-container);
    }

    .meta-tag.due {
      font-size: 11px;
    }

    .meta-tag.overdue {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
    }

    .no-results {
      padding: 32px 16px;
      text-align: center;
      color: var(--md-sys-color-outline);
    }

    .hint {
      font-size: 13px;
      color: var(--md-sys-color-outline);
      padding: 12px 16px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .kbd {
      font-size: 11px;
      padding: 2px 6px;
      background: var(--md-sys-color-surface-container-high);
      border-radius: 4px;
      font-family: monospace;
    }
  `;

  @state()
  accessor query = "";
  @state()
  accessor results: Task[] = [];

  private inputRef: HTMLInputElement | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.search();
    // Focus input when modal opens
    setTimeout(() => this.inputRef?.focus(), 100);
    // Listen for Escape key
    document.addEventListener("keydown", this.handleKeydown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this.close();
    }
  };

  private close() {
    store.setShowSearch(false);
  }

  private search() {
    const q = this.query.toLowerCase().trim();
    if (!q) {
      // Show recent tasks when no query
      this.results = store.tasks
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 10);
    } else {
      // Filter tasks by title or notes
      this.results = store.tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)),
      );
    }
  }

  private handleInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    this.search();
  }

  private selectTask(task: Task) {
    store.setShowTaskForm(true, task);
    this.close();
  }

  private getProject(task: Task) {
    return task.project_id
      ? store.projects.find((p) => p.id === task.project_id)
      : null;
  }

  private getContext(task: Task) {
    return task.context_id
      ? store.contexts.find((c) => c.id === task.context_id)
      : null;
  }

  private formatDate(date: string | null) {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dOnly = new Date(d);
    dOnly.setHours(0, 0, 0, 0);
    const isOverdue = dOnly < now;

    const formatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return { text: formatted, isOverdue };
  }

  override render() {
    return html`
      <div class="backdrop" @click="${this.close}"></div>
      <div class="modal">
        <div class="search-header">
          <svg
            class="search-icon"
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            .value="${this.query}"
            @input="${this.handleInput}"
            @ref="${(el: HTMLInputElement) => (this.inputRef = el)}"
          />
          <button class="close-btn" @click="${this.close}">
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
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
            : this.results.map((task) => {
              const project = this.getProject(task);
              const context = this.getContext(task);
              const due = this.formatDate(task.due_date ?? null);

              return html`
                <div
                  class="result-item ${task.completed_at ? "completed" : ""}"
                  @click="${() => this.selectTask(task)}"
                >
                  <div class="result-icon"></div>
                  <div class="result-content">
                    <div class="result-title">${task.title}</div>
                    ${project || context || due
                      ? html`
                        <div class="result-meta">
                          ${project
                            ? html`
                              <span
                                class="meta-tag project"
                                style="--tag-color: ${project.color}22"
                              >
                                ${project.name}
                              </span>
                            `
                            : null} ${context
                            ? html`
                              <span
                                class="meta-tag context"
                                style="--tag-color: ${context.color}22"
                              >
                                @${context.name}
                              </span>
                            `
                            : null} ${due
                            ? html`
                              <span
                                class="meta-tag due ${due.isOverdue
                                  ? "overdue"
                                  : ""}"
                              >
                                ${due.text}
                              </span>
                            `
                            : null}
                        </div>
                      `
                      : null}
                  </div>
                </div>
              `;
            })}
        </div>

        <div class="hint">
          <span class="kbd">↵</span> to select <span class="kbd">Esc</span> to close
        </div>
      </div>
    `;
  }
}
