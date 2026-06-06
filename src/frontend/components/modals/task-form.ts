// Task form modal

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import "npm:@m3e/web@2/button";
import "npm:@m3e/web@2/datepicker";
import "npm:@m3e/web@2/form-field";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/icon-button";
import "npm:@m3e/web@2/option";
import "npm:@m3e/web@2/segmented-button";
import "npm:@m3e/web@2/select";
import "npm:@m3e/web@2/textarea-autosize";
import { store } from "../../store.ts";

interface TaskFormData {
  title: string;
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
      display: contents;
    }

    dialog {
      position: fixed;
      inset: 0;
      margin: auto;
      border: none;
      padding: 24px;
      width: min(48rem, calc(100vw - 48px));
      max-height: min(90vh, calc(100dvh - 48px));
      overflow-y: auto;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
      border-radius: var(--md-sys-shape-corner-extra-large);
      box-shadow: var(--md-sys-elevation-level4);
      outline: none;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }

    dialog h2 {
      margin: 0 0 16px;
      font-size: 24px;
      font-weight: 400;
    }

    form {
      padding-top: 8px;
    }

    .form-group {
      margin-bottom: 24px;
    }

    m3e-form-field {
      width: 100%;
    }

    m3e-form-field textarea {
      padding-block: 0.5rem;
    }

    m3e-datepicker {
      --m3e-datepicker-actions-padding-inline: 0;
    }

    m3e-segmented-button {
      width: 100%;
    }

    m3e-button-segment {
      flex: 1;
      text-align: center;
      --m3e-segmented-button-icon-size: 0;
      --m3e-segmented-button-spacing: 0;
      --m3e-segmented-button-with-icon-padding-start: 1rem;
    }

    m3e-segmented-button.priority m3e-button-segment {
      --m3e-segmented-button-selected-container-color: var(
        --md-sys-color-surface-container-high
      );
    }
    m3e-segmented-button.priority .p1[checked] {
      --m3e-segmented-button-selected-container-color: var(--priority-1-color);
    }
    m3e-segmented-button.priority .p2[checked] {
      --m3e-segmented-button-selected-container-color: var(--priority-2-color);
    }
    m3e-segmented-button.priority .p3[checked] {
      --m3e-segmented-button-selected-container-color: var(--priority-3-color);
    }

    .recurrence-interval {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .recurrence-interval m3e-form-field {
      width: auto;
      flex: 1;
      --m3e-form-field-suffix-spacing: 1rem;
    }

    .day-buttons {
      display: flex;
    }

    .day-buttons m3e-segmented-button {
      width: 100%;
    }

    .day-buttons m3e-button-segment {
      flex: 1;
      min-width: 0;
      --m3e-segmented-button-padding-start: 0;
      --m3e-segmented-button-padding-end: 0;
      --m3e-segmented-button-with-icon-padding-start: 0;
    }

    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }
  `;

  @state()
  accessor form: TaskFormData = {
    title: "",
    priority: 3,
    due_date: "",
    project_id: null,
    recurrence_type: null,
    recurrence_interval: 1,
    recurrence_days: [],
  };

  @state()
  accessor invalidFields: Set<string> = new Set();

  private handleFieldInvalid = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.id) {
      this.invalidFields = new Set([...this.invalidFields, input.id]);
    }
  };

  private handleFieldInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.id) return;
    if (!input.validity.valid) {
      if (!this.invalidFields.has(input.id)) {
        this.invalidFields = new Set([...this.invalidFields, input.id]);
      }
    } else if (this.invalidFields.has(input.id)) {
      const next = new Set(this.invalidFields);
      next.delete(input.id);
      this.invalidFields = next;
    }
  };

  private hideSubscript(fieldId: string): string | undefined {
    return this.invalidFields.has(fieldId) ? undefined : "always";
  }

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingTask) {
      const t = store.editingTask;
      this.form = {
        title: t.title,
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
    this.addEventListener("invalid", this.handleFieldInvalid, true);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("invalid", this.handleFieldInvalid, true);
  }

  override firstUpdated() {
    const dialog = this.renderRoot.querySelector("dialog");
    dialog?.showModal();
    dialog?.addEventListener("close", () => this.close());
  }

  private close() {
    store.setShowTaskForm(false);
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    await store.saveTask(
      {
        title: this.form.title,
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
      <dialog @click="${(e: Event) => {
        if ((e.target as HTMLElement).nodeName === "DIALOG") this.close();
      }}">
        <h2>${isEditing ? "edit task" : "new task"}</h2>
        <form @submit="${this.handleSubmit}" @input="${this.handleFieldInput}">
          <div class="form-group">
            <m3e-form-field variant="outlined" hide-subscript="${ifDefined(
              this.hideSubscript("task-title"),
            )}">
              <label slot="label" for="task-title">Task</label>
              <textarea
                id="task-title"
                rows="1"
                .value="${this.form.title}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  title: (e.target as HTMLTextAreaElement).value,
                })}"
                required
                placeholder="Task title"
              ></textarea>
            </m3e-form-field>
            <m3e-textarea-autosize for="task-title"></m3e-textarea-autosize>
          </div>

          <div class="form-group">
            <m3e-segmented-button
              class="priority"
              @change="${(e: Event) => {
                const segment = e.target as HTMLElement;
                const val = segment.getAttribute("value");
                if (val) {
                  this.form = { ...this.form, priority: parseInt(val) };
                }
              }}"
            >
              ${[1, 2, 3].map(
                (p) =>
                  html`
                    <m3e-button-segment
                      class="p${p}"
                      value="${p}"
                      .checked="${this.form.priority === p}"
                    >
                      P${p}
                    </m3e-button-segment>
                  `,
              )}
            </m3e-segmented-button>
          </div>

          <div class="form-group">
            <m3e-form-field variant="outlined" hide-subscript="${ifDefined(
              this.hideSubscript("due-date"),
            )}">
              <label slot="label" for="due-date">Due Date</label>
              <input
                id="due-date"
                autocomplete="off"
                .value="${this.form.due_date
                  ? new Date(
                    this.form.due_date + "T00:00:00",
                  ).toLocaleDateString()
                  : ""}"
                readonly
              />
              <m3e-icon-button slot="suffix">
                <m3e-icon name="calendar_today" variant="rounded"></m3e-icon>
                <m3e-datepicker-toggle
                  for="task-datepicker"
                ></m3e-datepicker-toggle>
              </m3e-icon-button>
            </m3e-form-field>
            <m3e-datepicker
              id="task-datepicker"
              .date="${this.form.due_date
                ? new Date(this.form.due_date + "T00:00:00")
                : null}"
              clearable
              @change="${(e: Event) => {
                const picker = e.target as HTMLElement & {
                  date: Date | null;
                };
                this.form = {
                  ...this.form,
                  due_date: picker.date
                    ? picker.date.toISOString().split("T")[0]
                    : "",
                };
              }}"
            ></m3e-datepicker>
          </div>

          <div class="form-group">
            <m3e-form-field variant="outlined" hide-subscript="${ifDefined(
              this.hideSubscript("project-select"),
            )}">
              <label slot="label" for="project-select">Project</label>
              <m3e-select
                id="project-select"
                @change="${(e: Event) => {
                  const select = e.target as HTMLElement & { value: string };
                  this.form = {
                    ...this.form,
                    project_id: select.value === "inbox"
                      ? null
                      : select.value || null,
                  };
                }}"
              >
                <m3e-icon
                  slot="arrow"
                  name="arrow_drop_down_circle"
                  variant="rounded"
                ></m3e-icon>
                <m3e-option value="inbox" ?selected="${!this.form
                  .project_id}">Inbox</m3e-option>
                ${store.projects.map(
                  (p) =>
                    html`
                      <m3e-option
                        value="${p.id}"
                        ?selected="${this.form.project_id === p.id}"
                      >${p.name}</m3e-option>
                    `,
                )}
              </m3e-select>
            </m3e-form-field>
          </div>

          <div class="form-group">
            <m3e-form-field variant="outlined" hide-subscript="${ifDefined(
              this.hideSubscript("recurrence-select"),
            )}">
              <label slot="label" for="recurrence-select">Recurrence</label>
              <m3e-select
                id="recurrence-select"
                @change="${(e: Event) => {
                  const select = e.target as HTMLElement & { value: string };
                  this.form = {
                    ...this.form,
                    recurrence_type: select.value === "none"
                      ? null
                      : select.value || null,
                  };
                }}"
              >
                <m3e-icon
                  slot="arrow"
                  name="arrow_drop_down_circle"
                  variant="rounded"
                ></m3e-icon>
                <m3e-option value="none" ?selected="${!this.form
                  .recurrence_type}">None</m3e-option>
                <m3e-option
                  value="daily"
                  ?selected="${this.form.recurrence_type === "daily"}"
                >Daily</m3e-option>
                <m3e-option
                  value="weekly"
                  ?selected="${this.form.recurrence_type === "weekly"}"
                >Weekly</m3e-option>
                <m3e-option
                  value="monthly"
                  ?selected="${this.form.recurrence_type === "monthly"}"
                >Monthly</m3e-option>
                <m3e-option
                  value="yearly"
                  ?selected="${this.form.recurrence_type === "yearly"}"
                >Yearly</m3e-option>
              </m3e-select>
            </m3e-form-field>
          </div>

          ${this.form.recurrence_type
            ? html`
              <div class="form-group">
                <div class="recurrence-interval">
                  <m3e-form-field variant="outlined" hide-subscript="${ifDefined(
                    this.hideSubscript("interval"),
                  )}">
                    <label slot="label" for="interval">Every</label>
                    <input
                      id="interval"
                      type="number"
                      min="1"
                      .value="${String(this.form.recurrence_interval)}"
                      @input="${(e: Event) => (this.form = {
                        ...this.form,
                        recurrence_interval: parseInt(
                          (e.target as HTMLInputElement).value,
                        ) || 1,
                      })}"
                    />
                    <span slot="suffix-text">
                      ${this.form.recurrence_type === "daily"
                        ? this.form.recurrence_interval === 1 ? "day" : "days"
                        : this.form.recurrence_type === "weekly"
                        ? this.form.recurrence_interval === 1 ? "week" : "weeks"
                        : this.form.recurrence_type === "monthly"
                        ? this.form.recurrence_interval === 1
                          ? "month"
                          : "months"
                        : this.form.recurrence_interval === 1
                        ? "year"
                        : "years"}
                    </span>
                  </m3e-form-field>
                </div>
              </div>
            `
            : null} ${this.form.recurrence_type === "weekly"
            ? html`
              <div class="form-group">
                <div class="day-buttons">
                  <m3e-segmented-button
                    multi
                    @change="${(e: Event) => {
                      const segment = e.target as HTMLElement;
                      const idx = [...segment.parentElement!.children].indexOf(
                        segment,
                      );
                      if (idx !== -1) this.toggleDay(idx);
                    }}"
                  >
                    ${weekDays.map(
                      (day) =>
                        html`
                          <m3e-button-segment
                            .checked="${this.form.recurrence_days.includes(
                              day.value,
                            )}"
                          >
                            ${day.label}
                          </m3e-button-segment>
                        `,
                    )}
                  </m3e-segmented-button>
                </div>
              </div>
            `
            : null}

          <div class="actions">
            <div>
              ${isEditing
                ? html`
                  <m3e-button
                    variant="text"
                    type="button"
                    style="--m3e-button-label-text-color: var(--md-sys-color-error)"
                    @click="${this.handleDelete}"
                  >
                    Delete
                  </m3e-button>
                `
                : null}
            </div>
            <div style="display: flex; gap: 8px;">
              <m3e-button variant="text" type="button" @click="${this.close}">
                Cancel
              </m3e-button>
              <m3e-button variant="filled" type="submit"> Save </m3e-button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}
