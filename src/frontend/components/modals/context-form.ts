// Context form modal

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../../store.ts";

interface TimeWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

@customElement("context-form")
export class ContextForm extends LitElement {
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
      max-width: 28rem;
      max-height: 90vh;
      overflow-y: auto;
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
    input[type="time"],
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-small);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
    }

    input:focus,
    select:focus {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: -1px;
    }

    .color-picker {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    input[type="color"] {
      width: 40px;
      height: 40px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-small);
      cursor: pointer;
    }

    .color-value {
      font-size: 14px;
      color: var(--md-sys-color-outline);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
    }

    .add-btn {
      font-size: 12px;
      color: var(--md-sys-color-primary);
      background: transparent;
      border: none;
      cursor: pointer;
    }

    .add-btn:hover {
      text-decoration: underline;
    }

    .description {
      font-size: 11px;
      color: var(--md-sys-color-outline);
      margin-bottom: 8px;
    }

    .time-window {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .time-window select {
      width: auto;
      flex-shrink: 0;
    }

    .time-window input {
      width: auto;
      flex: 1;
    }

    .remove-btn {
      padding: 8px;
      background: transparent;
      border: none;
      color: var(--md-sys-color-outline);
      cursor: pointer;
      border-radius: var(--md-sys-shape-corner-small);
    }

    .remove-btn:hover {
      color: var(--md-sys-color-error);
      background: var(--md-sys-color-surface-container);
    }

    .empty-windows {
      font-size: 13px;
      color: var(--md-sys-color-outline);
      font-style: italic;
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
  accessor form = {
    name: "",
    color: "#2196f3",
    timeWindows: [] as TimeWindow[],
  };

  private dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingContext) {
      this.form = {
        name: store.editingContext.name,
        color: store.editingContext.color || "#2196f3",
        timeWindows: store.editingContext.time_windows
          ? JSON.parse(JSON.stringify(store.editingContext.time_windows))
          : [],
      };
    }
  }

  private close() {
    store.setShowContextForm(false);
  }

  private addTimeWindow() {
    this.form = {
      ...this.form,
      timeWindows: [
        ...this.form.timeWindows,
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
      ],
    };
  }

  private removeTimeWindow(index: number) {
    this.form = {
      ...this.form,
      timeWindows: this.form.timeWindows.filter((_, i) => i !== index),
    };
  }

  private updateTimeWindow(
    index: number,
    field: keyof TimeWindow,
    value: string | number,
  ) {
    const windows = [...this.form.timeWindows];
    windows[index] = { ...windows[index], [field]: value };
    this.form = { ...this.form, timeWindows: windows };
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    await store.saveContext({
      name: this.form.name,
      color: this.form.color,
      time_windows: this.form.timeWindows.length > 0
        ? this.form.timeWindows
        : undefined,
    });
  }

  private async handleDelete() {
    if (
      store.editingContext &&
      confirm("Delete this context? Tasks will have their context removed.")
    ) {
      await store.deleteContext(store.editingContext.id);
    }
  }

  override render() {
    const isEditing = !!store.editingContext;

    return html`
      <div class="backdrop" @click="${this.close}"></div>
      <div class="modal">
        <h2>${isEditing ? "Edit Context" : "New Context"}</h2>

        <form @submit="${this.handleSubmit}">
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              .value="${this.form.name}"
              @input="${(e: Event) => (this.form = {
                ...this.form,
                name: (e.target as HTMLInputElement).value,
              })}"
              required
              placeholder="Context name"
            />
          </div>

          <div class="form-group">
            <label>Color</label>
            <div class="color-picker">
              <input
                type="color"
                .value="${this.form.color}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  color: (e.target as HTMLInputElement).value,
                })}"
              />
              <span class="color-value">${this.form.color}</span>
            </div>
          </div>

          <div class="form-group">
            <div class="section-header">
              <span class="section-title">Time Windows</span>
              <button
                type="button"
                class="add-btn"
                @click="${this.addTimeWindow}"
              >
                + Add Window
              </button>
            </div>
            <p class="description">
              Define when this context is active (e.g., work hours)
            </p>

            ${this.form.timeWindows.length === 0
              ? html`
                <p class="empty-windows">
                  No time windows (always active)
                </p>
              `
              : this.form.timeWindows.map(
                (tw, i) =>
                  html`
                    <div class="time-window">
                      <select
                        .value="${String(tw.dayOfWeek)}"
                        @change="${(e: Event) =>
                          this.updateTimeWindow(
                            i,
                            "dayOfWeek",
                            parseInt((e.target as HTMLSelectElement).value),
                          )}"
                      >
                        ${this.dayNames.map(
                          (name, idx) =>
                            html`
                              <option value="${idx}">${name}</option>
                            `,
                        )}
                      </select>
                      <input
                        type="time"
                        .value="${tw.startTime}"
                        @input="${(e: Event) =>
                          this.updateTimeWindow(
                            i,
                            "startTime",
                            (e.target as HTMLInputElement).value,
                          )}"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        .value="${tw.endTime}"
                        @input="${(e: Event) =>
                          this.updateTimeWindow(
                            i,
                            "endTime",
                            (e.target as HTMLInputElement).value,
                          )}"
                      />
                      <button
                        type="button"
                        class="remove-btn"
                        @click="${() => this.removeTimeWindow(i)}"
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  `,
              )}
          </div>

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
              <button type="button" class="btn btn-cancel" @click="${this
                .close}">
                Cancel
              </button>
              <button type="submit" class="btn btn-save">Save</button>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
