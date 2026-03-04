// Due tasks view

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../../base.ts";
import { store } from "../../store.ts";
import "../task-item.ts";

@customElement("due-view")
export class DueView extends StoreElement {
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
  `;

  override render() {
    return html`
      <div class="task-list">
        ${store.dueTasks.length === 0
          ? html`
            <div class="empty">No tasks with due dates</div>
          `
          : store.dueTasks.map(
            (task) =>
              html`
                <task-item .task="${task}"></task-item>
              `,
          )}
      </div>
    `;
  }
}
