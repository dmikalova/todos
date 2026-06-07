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

  override render() {
    return html`
      <div class="task-list">
        ${store.projectTasks.map(
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
