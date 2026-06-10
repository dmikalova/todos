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
import "../ui/chip-picker.ts";
import { store } from "../../store.ts";

interface TaskFormData {
  title: string;
  priority: number;
  due_date: string;
  project_id: string | null;
  context_ids: string[];
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
      background: var(--md-sys-color-surface-container-lowest);
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

    .form-group > label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 8px;
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
      align-items: center;
      margin-top: 24px;
    }

    .delete-button {
      --md-sys-color-primary: var(--md-sys-color-error);
    }

    .confirm-dialog {
      position: fixed;
      inset: 0;
      margin: auto;
      border: none;
      padding: 24px;
      width: min(24rem, calc(100vw - 48px));
      background: var(--md-sys-color-surface-container-lowest);
      color: var(--md-sys-color-on-surface);
      border-radius: var(--md-sys-shape-corner-extra-large);
      box-shadow: var(--md-sys-elevation-level5);
      outline: none;
      z-index: 100;
    }

    .confirm-dialog::backdrop {
      background: rgba(0, 0, 0, 0.6);
    }

    .confirm-dialog h3 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 400;
    }

    .confirm-dialog p {
      margin: 0 0 24px;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 14px;
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `;

  @state()
  accessor showConfirmDiscard = false;

  @state()
  accessor showConfirmDelete = false;

  @state()
  accessor form: TaskFormData = {
    title: "",
    priority: 3,
    due_date: "",
    project_id: null,
    context_ids: [],
    recurrence_type: null,
    recurrence_interval: 1,
    recurrence_days: [],
  };

  @state()
  accessor invalidFields: Set<string> = new Set();

  private initialForm: string = "";

  private handleFieldInvalid = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.id) {
      this.invalidFields = new Set([...this.invalidFields, input.id]);
    }
  };

  private handleFieldInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.id) return;
    if (input.id === "task-title") {
      input.setCustomValidity("");
    }
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
        context_ids: t.context_ids || [],
        recurrence_type: t.recurrence_type || null,
        recurrence_interval: t.recurrence_interval || 1,
        recurrence_days: t.recurrence_days || [],
      };
    } else if (store.currentTab === "context" && store.selectedContextId) {
      this.form.context_ids = [store.selectedContextId];
    } else if (store.selectedProjectId) {
      this.form.project_id = store.selectedProjectId;
    }
    this.initialForm = JSON.stringify(this.form);
    this.addEventListener("invalid", this.handleFieldInvalid, true);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("invalid", this.handleFieldInvalid, true);
  }

  override async firstUpdated() {
    const dialog = this.renderRoot.querySelector("dialog");
    dialog?.showModal();
    await this.updateComplete;
    requestAnimationFrame(() => {
      this.renderRoot
        .querySelector<HTMLTextAreaElement>("#task-title")
        ?.focus();
    });
    dialog?.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("showConfirmDiscard") && this.showConfirmDiscard) {
      const confirmDialog = this.renderRoot.querySelector(
        ".confirm-dialog.discard",
      ) as HTMLDialogElement | null;
      if (confirmDialog && !confirmDialog.open) {
        confirmDialog.showModal();
        confirmDialog.addEventListener("cancel", (e) => {
          e.preventDefault();
          this.cancelDiscard();
        });
      }
    }
    if (changed.has("showConfirmDelete") && this.showConfirmDelete) {
      const confirmDialog = this.renderRoot.querySelector(
        ".confirm-dialog.delete",
      ) as HTMLDialogElement | null;
      if (confirmDialog && !confirmDialog.open) {
        confirmDialog.showModal();
        confirmDialog.addEventListener("cancel", (e) => {
          e.preventDefault();
          this.showConfirmDelete = false;
        });
      }
    }
  }

  private close() {
    if (this.hasUnsavedChanges()) {
      this.showConfirmDiscard = true;
      return;
    }
    store.setShowTaskForm(false);
  }

  private confirmDiscard() {
    this.showConfirmDiscard = false;
    store.setShowTaskForm(false);
  }

  private cancelDiscard() {
    this.showConfirmDiscard = false;
  }

  private hasUnsavedChanges(): boolean {
    return JSON.stringify(this.form) !== this.initialForm;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    const titleEl = this.renderRoot.querySelector(
      "#task-title",
    ) as HTMLTextAreaElement | null;
    if (!this.form.title.trim()) {
      titleEl?.setCustomValidity("title is required");
      titleEl?.reportValidity();
      return;
    }
    await store.saveTask(
      {
        title: this.form.title.trim(),
        priority: this.form.priority,
        dueDate: this.form.due_date || null,
        projectId: this.form.project_id || null,
        contextIds: this.form.context_ids,
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

  private handleDelete() {
    this.showConfirmDelete = true;
  }

  private async confirmDelete() {
    this.showConfirmDelete = false;
    if (store.editingTask) {
      await store.deleteTask(store.editingTask.id);
    }
  }

  private handleDaysChange(e: Event) {
    const segmentedButton = e.currentTarget as HTMLElement;
    const segments = segmentedButton.querySelectorAll("m3e-button-segment");
    const recurrence_days: number[] = [];
    segments.forEach((seg) => {
      if ((seg as HTMLElement & { checked: boolean }).checked) {
        recurrence_days.push(Number(seg.getAttribute("data-value")));
      }
    });
    this.form = { ...this.form, recurrence_days };
  }

  override render() {
    const isEditing = !!store.editingTask;
    const weekDays = [
      { value: 0, label: "sun" },
      { value: 1, label: "mon" },
      { value: 2, label: "tue" },
      { value: 3, label: "wed" },
      { value: 4, label: "thu" },
      { value: 5, label: "fri" },
      { value: 6, label: "sat" },
    ];

    return html`
      <dialog
        @click="${(e: Event) => {
          if ((e.target as HTMLElement).nodeName === "DIALOG") this.close();
        }}"
      >
        <h2>${isEditing ? "edit task" : "create task"}</h2>
        <form
          @submit="${this.handleSubmit}"
          @input="${this.handleFieldInput}"
          @keydown="${(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              this.handleSubmit(e);
            }
          }}"
        >
          <div class="form-group">
            <m3e-form-field
              variant="outlined"
              float-label="always"
              hide-subscript="${ifDefined(this.hideSubscript("task-title"))}"
            >
              <label slot="label" for="task-title">task</label>
              <textarea
                id="task-title"
                rows="1"
                .value="${this.form.title}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  title: (e.target as HTMLTextAreaElement).value,
                })}"
                placeholder="task title"
              ></textarea>
            </m3e-form-field>
            <m3e-textarea-autosize for="task-title"></m3e-textarea-autosize>
          </div>

          <div class="form-group">
            <m3e-form-field
              variant="outlined"
              float-label="always"
              hide-subscript="${ifDefined(
                this.hideSubscript("project-select"),
              )}"
            >
              <label slot="label" for="project-select">project</label>
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
                  .project_id}">inbox</m3e-option>
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

          ${store.contexts.length > 0
            ? html`
              <div class="form-group">
                <label
                  style="display: block; font-size: 12px; font-weight: 500; color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px;"
                >contexts</label>
                <chip-picker
                  .items="${store.contexts.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color || "#F48FB1",
                  }))}"
                  .selectedIds="${this.form.context_ids}"
                  placeholder="add context..."
                  defaultColor="#F48FB1"
                  @change="${(e: CustomEvent<{ selectedIds: string[] }>) => {
                    this.form = {
                      ...this.form,
                      context_ids: e.detail.selectedIds,
                    };
                  }}"
                ></chip-picker>
                ${this.form.project_id && this.form.context_ids.length === 0
                  ? html`
                    <div
                      style="font-size: 12px; color: var(--md-sys-color-outline); margin-top: 4px;"
                    >
                      inherits from project
                    </div>
                  `
                  : null}
              </div>
            `
            : null}

          <div class="form-group">
            <m3e-form-field
              variant="outlined"
              float-label="always"
              hide-subscript="${ifDefined(this.hideSubscript("due-date"))}"
            >
              <label slot="label" for="due-date">due date</label>
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
            <m3e-form-field
              variant="outlined"
              float-label="always"
              hide-subscript="${ifDefined(
                this.hideSubscript("recurrence-select"),
              )}"
            >
              <label slot="label" for="recurrence-select">recurrence</label>
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
                <m3e-option
                  value="none"
                  ?selected="${!this.form.recurrence_type}"
                >none</m3e-option>
                <m3e-option
                  value="daily"
                  ?selected="${this.form.recurrence_type === "daily"}"
                >daily</m3e-option>
                <m3e-option
                  value="weekly"
                  ?selected="${this.form.recurrence_type === "weekly"}"
                >weekly</m3e-option>
                <m3e-option
                  value="monthly"
                  ?selected="${this.form.recurrence_type === "monthly"}"
                >monthly</m3e-option>
                <m3e-option
                  value="yearly"
                  ?selected="${this.form.recurrence_type === "yearly"}"
                >yearly</m3e-option>
              </m3e-select>
            </m3e-form-field>
          </div>

          ${this.form.recurrence_type
            ? html`
              <div class="form-group">
                <div class="recurrence-interval">
                  <m3e-form-field
                    variant="outlined"
                    float-label="always"
                    hide-subscript="${ifDefined(
                      this.hideSubscript("interval"),
                    )}"
                  >
                    <label slot="label" for="interval">every</label>
                    <input
                      id="interval"
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
                    @change="${this.handleDaysChange}"
                  >
                    ${weekDays.map(
                      (day) =>
                        html`
                          <m3e-button-segment
                            .checked="${this.form.recurrence_days.includes(
                              day.value,
                            )}"
                            data-value="${day.value}"
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

          <div class="form-group">
            <label>priority</label>
            <m3e-segmented-button class="priority">
              ${[1, 2, 3].map(
                (p) =>
                  html`
                    <m3e-button-segment
                      class="p${p}"
                      value="${p}"
                      .checked="${this.form.priority === p}"
                      @click="${() => {
                        this.form = { ...this.form, priority: p };
                      }}"
                    >
                      P${p}
                    </m3e-button-segment>
                  `,
              )}
            </m3e-segmented-button>
          </div>

          <div class="actions">
            <div>
              ${isEditing
                ? html`
                  <m3e-button
                    class="delete-button"
                    variant="text"
                    type="button"
                    @click="${this.handleDelete}"
                  >
                    <m3e-icon
                      slot="icon"
                      name="delete"
                      variant="rounded"
                    ></m3e-icon>
                    delete
                  </m3e-button>
                `
                : null}
            </div>
            <m3e-button variant="filled" type="submit">
              <m3e-icon slot="icon" name="save" variant="rounded"></m3e-icon>
              save
            </m3e-button>
          </div>
        </form>
      </dialog>

      ${this.showConfirmDiscard
        ? html`
          <dialog
            class="confirm-dialog discard"
            @click="${(e: Event) => {
              if (
                (e.target as HTMLElement).classList.contains("confirm-dialog")
              ) {
                this.cancelDiscard();
              }
            }}"
          >
            <h3>discard unsaved changes?</h3>
            <div class="confirm-actions">
              <m3e-button
                variant="text"
                type="button"
                @click="${this.cancelDiscard}"
              >
                continue editing
              </m3e-button>
              <m3e-button
                class="discard-button"
                variant="filled"
                type="button"
                @click="${this.confirmDiscard}"
              >
                discard
              </m3e-button>
            </div>
          </dialog>
        `
        : null} ${this.showConfirmDelete
        ? html`
          <dialog
            class="confirm-dialog delete"
            @click="${(e: Event) => {
              if (
                (e.target as HTMLElement).classList.contains("confirm-dialog")
              ) {
                this.showConfirmDelete = false;
              }
            }}"
          >
            <h3>Delete task ${this.form.title}?</h3>
            <div class="confirm-actions">
              <m3e-button
                variant="text"
                type="button"
                @click="${() => {
                  this.showConfirmDelete = false;
                }}"
              >
                cancel
              </m3e-button>
              <m3e-button
                class="discard-button"
                variant="filled"
                type="button"
                @click="${this.confirmDelete}"
              >
                delete
              </m3e-button>
            </div>
          </dialog>
        `
        : null}
    `;
  }
}
