// Task form modal

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../../store.ts";

interface TaskFormData {
  title: string;
  notes: string;
  priority: number;
  due_date: string;
  project_id: string | null;
  recurrence_type: string | null;
  recurrence_interval: number;
  recurrence_days: number[];
}

@customElement("task-form")
export class TaskForm extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
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
      max-width: 32rem;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-content {
      padding: 24px;
    }

    h2 {
      font-size: 20px;
      font-weight: 500;
      margin: 0 0 24px;
      color: var(--md-sys-color-on-surface);
    }

    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 4px;
    }

    input[type="text"],
    input[type="date"],
    input[type="number"],
    textarea,
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-small);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      font-family: inherit;
    }

    input:focus,
    textarea:focus,
    select:focus {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: -1px;
    }

    textarea {
      resize: vertical;
      min-height: 80px;
    }

    .priority-buttons {
      display: flex;
      gap: 8px;
    }

    .priority-btn {
      flex: 1;
      padding: 8px;
      border: 2px solid transparent;
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .priority-btn.p1 {
      background: #ffebee;
      color: var(--priority-1-color);
    }
    .priority-btn.p1.selected {
      border-color: var(--priority-1-color);
    }
    .priority-btn.p2 {
      background: #fff3e0;
      color: var(--priority-2-color);
    }
    .priority-btn.p2.selected {
      border-color: var(--priority-2-color);
    }
    .priority-btn.p3 {
      background: #e3f2fd;
      color: var(--priority-3-color);
    }
    .priority-btn.p3.selected {
      border-color: var(--priority-3-color);
    }
    .priority-btn.p4 {
      background: var(--md-sys-color-surface-container);
      color: var(--priority-4-color);
    }
    .priority-btn.p4.selected {
      border-color: var(--priority-4-color);
    }

    .recurrence-interval {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .recurrence-interval input {
      width: 80px;
    }

    .day-buttons {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .day-btn {
      padding: 8px 12px;
      border: none;
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface-variant);
    }

    .day-btn.selected {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-save {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    .btn-save:hover {
      box-shadow: var(--md-sys-elevation-level2);
    }

    .btn-cancel {
      background: transparent;
      color: var(--md-sys-color-on-surface-variant);
    }

    .btn-cancel:hover {
      background: var(--md-sys-color-surface-container);
    }

    .btn-delete {
      background: transparent;
      color: var(--md-sys-color-error);
    }

    .btn-delete:hover {
      background: var(--md-sys-color-error-container);
    }
  `;

  @state()
  accessor form: TaskFormData = {
    title: "",
    notes: "",
    priority: 4,
    due_date: "",
    project_id: null,
    recurrence_type: null,
    recurrence_interval: 1,
    recurrence_days: [],
  };

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingTask) {
      const t = store.editingTask;
      this.form = {
        title: t.title,
        notes: t.notes || "",
        priority: t.priority,
        due_date: t.due_date ? t.due_date.split("T")[0] : "",
        project_id: t.project_id || null,
        recurrence_type: t.recurrence_type || null,
        recurrence_interval: t.recurrence_interval || 1,
        recurrence_days: t.recurrence_days || [],
      };
    } else if (store.selectedProjectId) {
      this.form.project_id = store.selectedProjectId;
    }
  }

  private close() {
    store.setShowTaskForm(false);
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    await store.saveTask(
      {
        title: this.form.title,
        description: this.form.notes || null,
        priority: this.form.priority,
        dueDate: this.form.due_date || null,
        projectId: this.form.project_id || null,
      },
      this.form.recurrence_type
        ? {
          frequency: this.form.recurrence_type,
          interval: this.form.recurrence_interval,
          daysOfWeek: this.form.recurrence_type === "weekly"
            ? this.form.recurrence_days
            : undefined,
        }
        : null,
    );
  }

  private async handleDelete() {
    if (store.editingTask && confirm("Delete this task?")) {
      await store.deleteTask(store.editingTask.id);
    }
  }

  private toggleDay(day: number) {
    const idx = this.form.recurrence_days.indexOf(day);
    if (idx === -1) {
      this.form = {
        ...this.form,
        recurrence_days: [...this.form.recurrence_days, day],
      };
    } else {
      this.form = {
        ...this.form,
        recurrence_days: this.form.recurrence_days.filter((d) => d !== day),
      };
    }
  }

  override render() {
    const isEditing = !!store.editingTask;
    const weekDays = [
      { value: 0, label: "Sun" },
      { value: 1, label: "Mon" },
      { value: 2, label: "Tue" },
      { value: 3, label: "Wed" },
      { value: 4, label: "Thu" },
      { value: 5, label: "Fri" },
      { value: 6, label: "Sat" },
    ];

    return html`
      <div class="backdrop" @click="${this.close}"></div>
      <div class="modal">
        <div class="modal-content">
          <h2>${isEditing ? "Edit Task" : "New Task"}</h2>

          <form @submit="${this.handleSubmit}">
            <div class="form-group">
              <label>Title</label>
              <input
                type="text"
                .value="${this.form.title}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  title: (e.target as HTMLInputElement).value,
                })}"
                required
                placeholder="Task title"
              />
            </div>

            <div class="form-group">
              <label>Notes</label>
              <textarea
                .value="${this.form.notes}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  notes: (e.target as HTMLTextAreaElement).value,
                })}"
                placeholder="Additional notes..."
              ></textarea>
            </div>

            <div class="form-group">
              <label>Priority</label>
              <div class="priority-buttons">
                ${[1, 2, 3, 4].map(
                  (p) =>
                    html`
                      <button
                        type="button"
                        class="priority-btn p${p} ${this.form.priority === p
                          ? "selected"
                          : ""}"
                        @click="${() => (this.form = {
                          ...this.form,
                          priority: p,
                        })}"
                      >
                        P${p}
                      </button>
                    `,
                )}
              </div>
            </div>

            <div class="form-group">
              <label>Due Date</label>
              <input
                type="date"
                .value="${this.form.due_date}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  due_date: (e.target as HTMLInputElement).value,
                })}"
              />
            </div>

            <div class="form-group">
              <label>Project</label>
              <select
                .value="${String(this.form.project_id || "")}"
                @change="${(e: Event) => (this.form = {
                  ...this.form,
                  project_id: (e.target as HTMLSelectElement).value
                    ? (e.target as HTMLSelectElement).value
                    : null,
                })}"
              >
                <option value="">Inbox</option>
                ${store.projects.map(
                  (p) =>
                    html`
                      <option value="${p.id}">${p.name}</option>
                    `,
                )}
              </select>
            </div>

            <div class="form-group">
              <label>Recurrence</label>
              <select
                .value="${this.form.recurrence_type || ""}"
                @change="${(e: Event) => (this.form = {
                  ...this.form,
                  recurrence_type: (e.target as HTMLSelectElement).value ||
                    null,
                })}"
              >
                <option value="">No recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            ${this.form.recurrence_type
              ? html`
                <div class="form-group">
                  <label>Repeat every</label>
                  <div class="recurrence-interval">
                    <input
                      type="number"
                      min="1"
                      .value="${String(this.form.recurrence_interval)}"
                      @input="${(e: Event) => (this.form = {
                        ...this.form,
                        recurrence_interval:
                          parseInt((e.target as HTMLInputElement).value) ||
                          1,
                      })}"
                    />
                    <span>
                      ${this.form.recurrence_type === "daily"
                        ? "day(s)"
                        : this.form.recurrence_type === "weekly"
                        ? "week(s)"
                        : this.form.recurrence_type === "monthly"
                        ? "month(s)"
                        : "year(s)"}
                    </span>
                  </div>
                </div>
              `
              : null} ${this.form.recurrence_type === "weekly"
              ? html`
                <div class="form-group">
                  <label>On days</label>
                  <div class="day-buttons">
                    ${weekDays.map(
                      (day) =>
                        html`
                          <button
                            type="button"
                            class="day-btn ${this.form.recurrence_days.includes(
                                day.value,
                              )
                              ? "selected"
                              : ""}"
                            @click="${() => this.toggleDay(day.value)}"
                          >
                            ${day.label}
                          </button>
                        `,
                    )}
                  </div>
                </div>
              `
              : null}

            <div class="actions">
              <div>
                ${isEditing
                  ? html`
                    <button
                      type="button"
                      class="btn btn-delete"
                      @click="${this.handleDelete}"
                    >
                      Delete
                    </button>
                  `
                  : null}
              </div>
              <div style="display: flex; gap: 8px;">
                <button
                  type="button"
                  class="btn btn-cancel"
                  @click="${this.close}"
                >
                  Cancel
                </button>
                <button type="submit" class="btn btn-save">Save</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}
