// Saved filter view - shows tasks matching a saved filter's criteria

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../../base.ts";
import { store } from "../../store.ts";
import "../task-item.ts";

@customElement("filter-view")
export class FilterView extends StoreElement {
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
      padding: 32px 0;
      color: var(--md-sys-color-outline);
    }
  `;

  override render() {
    const filter = store.selectedFilter;
    if (!filter) {
      return html`
        <div class="empty">filter not found</div>
      `;
    }

    const tasks = store.filteredTasks;
    return html`
      <div class="task-list">
        ${tasks.length === 0
          ? html`
            <div class="empty">this filter has no tasks</div>
          `
          : tasks.map(
            (task) =>
              html`
                <task-item .task="${task}"></task-item>
              `,
          )}
      </div>
    `;
  }
}
