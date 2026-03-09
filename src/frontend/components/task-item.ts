// Reusable task list item component

import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { store, type Task } from "../store.ts";

@customElement("task-item")
export class TaskItem extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .task-card {
      background: var(--md-sys-color-surface);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: box-shadow 0.15s;
      box-shadow: var(--md-sys-elevation-level1);
    }

    .task-card:hover {
      box-shadow: var(--md-sys-elevation-level2);
    }

    .checkbox {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--md-sys-color-outline);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: pointer;
      transition: all 0.15s;
      background: transparent;
      padding: 0;
    }

    .checkbox:hover {
      border-color: var(--md-sys-color-primary);
    }

    .checkbox.completed {
      background: var(--md-sys-color-primary);
      border-color: var(--md-sys-color-primary);
    }

    .checkbox.p1 {
      border-color: var(--priority-1-color);
    }
    .checkbox.p2 {
      border-color: var(--priority-2-color);
    }
    .checkbox.p3 {
      border-color: var(--priority-3-color);
    }

    .check-icon {
      width: 12px;
      height: 12px;
      color: var(--md-sys-color-on-primary);
    }

    .content {
      flex: 1;
      min-width: 0;
    }

    .title {
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      margin: 0;
    }

    .title.completed {
      text-decoration: line-through;
      color: var(--md-sys-color-outline);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
      font-size: 12px;
      color: var(--md-sys-color-outline);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meta-item.overdue {
      color: var(--md-sys-color-error);
    }

    .priority-badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: var(--md-sys-shape-corner-full);
    }

    .priority-badge.p1 {
      background: #ffebee;
      color: var(--priority-1-color);
    }
    .priority-badge.p2 {
      background: #fff3e0;
      color: var(--priority-2-color);
    }
    .priority-badge.p3 {
      background: #e3f2fd;
      color: var(--priority-3-color);
    }
    .priority-badge.p4 {
      background: var(--md-sys-color-surface-container);
      color: var(--priority-4-color);
    }
  `;

  @property({ type: Object })
  accessor task!: Task;

  private handleCheckboxClick(e: Event) {
    e.stopPropagation();
    store.toggleComplete(this.task);
  }

  private handleCardClick() {
    store.setShowTaskForm(true, this.task);
  }

  override render() {
    const isCompleted = !!this.task.completed_at;
    const isOverdue = this.task.due_date &&
      store.isOverdue(this.task.due_date) && !isCompleted;

    return html`
      <div class="task-card" @click="${() => this.handleCardClick()}">
        <button
          class="checkbox ${isCompleted
            ? "completed"
            : `p${this.task.priority}`}"
          @click="${(e: Event) => this.handleCheckboxClick(e)}"
        >
          ${isCompleted
            ? html`
              <svg class="check-icon" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            `
            : null}
        </button>

        <div class="content">
          <p class="title ${isCompleted ? "completed" : ""}">
            ${this.task.title}
          </p>
          <div class="meta">
            ${this.task.due_date
              ? html`
                <span class="meta-item ${isOverdue ? "overdue" : ""}">
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  ${store.formatDate(this.task.due_date)}
                </span>
              `
              : null} ${this.task.project_name
              ? html`
                <span class="meta-item">
                  <span style="color: var(--md-sys-color-primary)">#</span>
                  ${this.task.project_name}
                </span>
              `
              : null}
          </div>
        </div>

        ${this.task.priority
          ? html`
            <span class="priority-badge p${this.task.priority}">
              P${this.task.priority}
            </span>
          `
          : null}
      </div>
    `;
  }
}
