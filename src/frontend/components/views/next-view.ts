// Next task view

import { css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { StoreElement } from "../../base.ts";
import { store } from "../../store.ts";

@customElement("next-view")
export class NextView extends StoreElement {
  static override styles = css`
    :host {
      display: block;
    }

    .intro {
      text-align: center;
      margin-bottom: 32px;
    }

    .intro p {
      font-size: 14px;
      color: var(--md-sys-color-outline);
      margin: 0;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .spinner {
      width: 32px;
      height: 32px;
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

    .empty-state {
      border: 2px dashed var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-large);
      padding: 48px;
      text-align: center;
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      color: var(--md-sys-color-outline);
      margin: 0 auto 16px;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      margin: 0 0 8px;
    }

    .empty-text {
      font-size: 14px;
      color: var(--md-sys-color-outline);
      margin: 0;
    }

    .task-card {
      background: var(--md-sys-color-surface);
      border-radius: var(--md-sys-shape-corner-large);
      padding: 24px;
      box-shadow: var(--md-sys-elevation-level2);
      cursor: pointer;
      transition: box-shadow 0.15s;
    }

    .task-card:hover {
      box-shadow: var(--md-sys-elevation-level3);
    }

    .task-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .task-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
      margin: 0;
    }

    .task-notes {
      margin-top: 8px;
      color: var(--md-sys-color-on-surface-variant);
    }

    .priority-badge {
      font-size: 12px;
      font-weight: 500;
      padding: 4px 12px;
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

    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
      font-size: 14px;
      color: var(--md-sys-color-outline);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .context-tag {
      padding: 2px 8px;
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 12px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 24px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: var(--md-sys-shape-corner-medium);
      font-size: 14px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-complete {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    .btn-complete:hover {
      box-shadow: var(--md-sys-elevation-level2);
    }

    .btn-skip {
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
    }

    .btn-skip:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    .defer-select {
      padding: 12px 16px;
      border-radius: var(--md-sys-shape-corner-medium);
      border: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      cursor: pointer;
    }

    .defer-select:focus {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 2px;
    }
  `;

  @state()
  accessor deferOption = "";

  private handleDefer(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    if (value) {
      store.deferTask(value);
      this.deferOption = "";
    }
  }

  override render() {
    if (store.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
        </div>
      `;
    }

    if (!store.currentTask) {
      return html`
        <div class="intro">
          <p>Your most important task right now</p>
        </div>
        <div class="empty-state">
          <svg
            class="empty-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 class="empty-title">All caught up!</h3>
          <p class="empty-text">No pending tasks.</p>
        </div>
      `;
    }

    const task = store.currentTask;

    return html`
      <div class="intro">
        <p>Your most important task right now</p>
      </div>

      <div class="task-card" @click="${() =>
        store.setShowTaskForm(true, task)}">
        <div class="task-header">
          <div>
            <h2 class="task-title">${task.title}</h2>
            ${task.notes
              ? html`
                <p class="task-notes">${task.notes}</p>
              `
              : null}
          </div>
          ${task.priority
            ? html`
              <span class="priority-badge p${task.priority}">P${task
                .priority}</span>
            `
            : null}
        </div>

        <div class="task-meta">
          ${task.due_date
            ? html`
              <span class="meta-item">
                <svg
                  width="16"
                  height="16"
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
                ${store.formatDate(task.due_date)}
              </span>
            `
            : null} ${task.project_name
            ? html`
              <span class="meta-item">
                <span style="color: var(--md-sys-color-primary)">#</span>
                ${task.project_name}
              </span>
            `
            : null} ${(task.context_ids || []).map(
              (ctxId) =>
                html`
                  <span class="context-tag">${store.getContextName(
                    ctxId,
                  )}</span>
                `,
            )}
        </div>
      </div>

      <div class="actions">
        <button
          class="btn btn-complete"
          @click="${(e: Event) => {
            e.stopPropagation();
            store.completeTask();
          }}"
        >
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          Complete
        </button>
        <button
          class="btn btn-skip"
          @click="${(e: Event) => {
            e.stopPropagation();
            store.skipTask();
          }}"
        >
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
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
          Skip
        </button>
        <select
          class="defer-select"
          .value="${this.deferOption}"
          @change="${this.handleDefer}"
        >
          <option value="">Defer...</option>
          <option value="1h">1 hour</option>
          <option value="3h">3 hours</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="nextweek">Next week</option>
        </select>
      </div>
    `;
  }
}
