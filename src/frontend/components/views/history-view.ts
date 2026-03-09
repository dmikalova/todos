// History view with infinite scroll

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../../base.ts";
import { store } from "../../store.ts";

@customElement("history-view")
export class HistoryView extends StoreElement {
  static override styles = css`
    :host {
      display: block;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .history-item {
      background: var(--md-sys-color-surface);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 16px;
      cursor: pointer;
      transition: box-shadow 0.15s;
      box-shadow: var(--md-sys-elevation-level1);
    }

    .history-item:hover {
      box-shadow: var(--md-sys-elevation-level2);
    }

    .history-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .history-text {
      color: var(--md-sys-color-on-surface);
    }

    .history-text strong {
      font-weight: 500;
    }

    .history-action {
      color: var(--md-sys-color-outline);
    }

    .history-time {
      font-size: 12px;
      color: var(--md-sys-color-outline);
    }

    .empty {
      text-align: center;
      padding: 32px;
      color: var(--md-sys-color-outline);
    }

    .sentinel {
      height: 1px;
    }

    .loading-indicator {
      display: flex;
      justify-content: center;
      padding: 16px;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--md-sys-color-surface-container);
      border-top-color: var(--md-sys-color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  private observer: IntersectionObserver | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          store.fetchMoreHistory();
        }
      },
      { rootMargin: "200px" },
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = null;
  }

  override updated() {
    const sentinel = this.renderRoot.querySelector(".sentinel");
    if (sentinel && this.observer) {
      this.observer.disconnect();
      this.observer.observe(sentinel);
    }
  }

  private handleItemClick(taskId: string) {
    store.editTaskById(taskId);
  }

  override render() {
    const hasMore = store.history.length < store.historyTotal;

    return html`
      <div class="history-list">
        ${store.history.length === 0
          ? html`
            <div class="empty">No history yet</div>
          `
          : store.history.map(
            (entry) =>
              html`
                <div
                  class="history-item"
                  @click="${() => this.handleItemClick(entry.task_id)}"
                >
                  <div class="history-content">
                    <p class="history-text">
                      <strong>${entry.task_title || "Task"}</strong>
                      <span class="history-action"> — ${entry.action}</span>
                    </p>
                    <span class="history-time">${store.formatTime(
                      entry.created_at,
                    )}</span>
                  </div>
                </div>
              `,
          )} ${hasMore
          ? html`
            <div class="sentinel"></div>
            ${store.historyLoading
              ? html`
                <div class="loading-indicator">
                  <div class="spinner"></div>
                </div>
              `
              : null}
          `
          : null}
      </div>
    `;
  }
}
