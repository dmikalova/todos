// Context tasks view

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../../base.ts";
import { store } from "../../store.ts";
import "../task-item.ts";

@customElement("context-view")
export class ContextView extends StoreElement {
  static override styles = css`
    :host {
      display: block;
    }

    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .filter-btn {
      padding: 6px 14px;
      border-radius: var(--md-sys-shape-corner-full);
      font-size: 13px;
      border: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      cursor: pointer;
      transition: all 0.15s;
    }

    .filter-btn.active {
      background: var(--md-sys-color-secondary-container);
      border-color: var(--md-sys-color-secondary);
      color: var(--md-sys-color-on-secondary-container);
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .empty {
      text-align: center;
      padding: 32px;
      color: var(--md-sys-color-outline);
    }

    .add-task-row {
      background: var(--md-sys-color-surface);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: box-shadow 0.15s;
      box-shadow: var(--md-sys-elevation-level1);
    }

    .add-task-row:hover {
      box-shadow: var(--md-sys-elevation-level2);
    }

    .add-circle {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--md-sys-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--md-sys-color-on-primary);
    }

    .add-task-label {
      color: var(--md-sys-color-outline);
      font-size: 16px;
    }
  `;

  private setFilter(value: string) {
    store.setTaskFilter({ completed: value });
    store.fetchContextTasks();
  }

  override render() {
    const filter = store.taskFilter.completed;

    return html`
      <div class="filter-bar">
        <button
          class="filter-btn ${filter === "false" ? "active" : ""}"
          @click="${() => this.setFilter("false")}"
        >
          active
        </button>
        <button
          class="filter-btn ${filter === "true" ? "active" : ""}"
          @click="${() => this.setFilter("true")}"
        >
          done
        </button>
        <button
          class="filter-btn ${filter === "" ? "active" : ""}"
          @click="${() => this.setFilter("")}"
        >
          all
        </button>
      </div>

      <div class="task-list">
        ${store.contextTasks.length === 0
          ? html`
            <div class="empty">no tasks in this context</div>
          `
          : store.contextTasks.map(
            (task) =>
              html`
                <task-item .task="${task}"></task-item>
              `,
          )}
        <div class="add-task-row" @click="${() => store.setShowTaskForm(true)}">
          <span class="add-circle">+</span>
          <span class="add-task-label">add task</span>
        </div>
      </div>
    `;
  }
}
