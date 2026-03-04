// Project tasks view

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../../base.ts";
import { store } from "../../store.ts";
import "../task-item.ts";

@customElement("project-view")
export class ProjectView extends StoreElement {
  static override styles = css`
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .filter-select {
      padding: 8px 12px;
      border-radius: var(--md-sys-shape-corner-small);
      border: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
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
  `;

  private handleFilterChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    store.setTaskFilter({ completed: value });
  }

  override render() {
    return html`
      <div class="toolbar">
        <select class="filter-select" @change="${this.handleFilterChange}">
          <option
            value="false"
            ?selected="${store.taskFilter.completed === "false"}"
          >
            Active
          </option>
          <option
            value="true"
            ?selected="${store.taskFilter.completed === "true"}"
          >
            Completed
          </option>
        </select>
      </div>

      <div class="task-list">
        ${store.projectTasks.length === 0
          ? html`
            <div class="empty">No tasks in this project</div>
          `
          : store.projectTasks.map(
            (task) =>
              html`
                <task-item .task="${task}"></task-item>
              `,
          )}
      </div>
    `;
  }
}
