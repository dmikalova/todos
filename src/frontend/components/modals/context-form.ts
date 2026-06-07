// Context form modal

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import "npm:@m3e/web@2/button";
import "npm:@m3e/web@2/form-field";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/icon-button";
import "npm:@m3e/web@2/option";
import "npm:@m3e/web@2/select";
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
      display: contents;
    }

    dialog {
      position: fixed;
      inset: 0;
      margin: auto;
      border: none;
      padding: 24px;
      width: min(36rem, calc(100vw - 48px));
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

    .form-group {
      margin-bottom: 16px;
    }

    m3e-form-field {
      width: 100%;
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

    .time-window m3e-select {
      width: auto;
      flex-shrink: 0;
    }

    .time-window input {
      width: auto;
      flex: 1;
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
    }

    .delete-button {
      --md-sys-color-primary: var(--md-sys-color-error);
    }
  `;

  @state()
  accessor form = {
    name: "",
    color: "#CE93D8",
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
        color: store.editingContext.color || "#CE93D8",
        timeWindows: store.editingContext.time_windows
          ? JSON.parse(JSON.stringify(store.editingContext.time_windows))
          : [],
      };
    }
  }

  override async firstUpdated() {
    const dialog = this.renderRoot.querySelector("dialog");
    dialog?.showModal();
    await this.updateComplete;
    requestAnimationFrame(() => {
      this.renderRoot.querySelector<HTMLInputElement>("#context-name")?.focus();
    });
    dialog?.addEventListener("close", () => this.close());
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
      name: this.form.name.trim(),
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
      <dialog
        @click="${(e: Event) => {
          if ((e.target as HTMLElement).nodeName === "DIALOG") this.close();
        }}"
      >
        <h2>${isEditing ? "Edit Context" : "New Context"}</h2>

        <form
          @submit="${this.handleSubmit}"
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
              hide-subscript="always"
            >
              <label slot="label" for="context-name">Name</label>
              <input
                id="context-name"
                type="text"
                .value="${this.form.name}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  name: (e.target as HTMLInputElement).value,
                })}"
                required
                placeholder="Context name"
              />
            </m3e-form-field>
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
              <m3e-button
                variant="text"
                type="button"
                @click="${this.addTimeWindow}"
              >
                + Add Window
              </m3e-button>
            </div>
            <p class="description">
              Define when this context is active (e.g., work hours)
            </p>

            ${this.form.timeWindows.length === 0
              ? html`
                <p class="empty-windows">No time windows (always active)</p>
              `
              : this.form.timeWindows.map(
                (tw, i) =>
                  html`
                    <div class="time-window">
                      <m3e-select
                        @change="${(e: Event) => {
                          const select = e.target as HTMLElement & {
                            value: string;
                          };
                          this.updateTimeWindow(
                            i,
                            "dayOfWeek",
                            parseInt(select.value),
                          );
                        }}"
                      >
                        <m3e-icon
                          slot="arrow"
                          name="arrow_drop_down_circle"
                          variant="rounded"
                        ></m3e-icon>
                        ${this.dayNames.map(
                          (name, idx) =>
                            html`
                              <m3e-option
                                value="${idx}"
                                ?selected="${tw.dayOfWeek === idx}"
                              >${name}</m3e-option>
                            `,
                        )}
                      </m3e-select>
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
                      <m3e-icon-button
                        type="button"
                        @click="${() => this.removeTimeWindow(i)}"
                      >
                        <m3e-icon name="close" variant="rounded"></m3e-icon>
                      </m3e-icon-button>
                    </div>
                  `,
              )}
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
                    Delete
                  </m3e-button>
                `
                : null}
            </div>
            <m3e-button variant="filled" type="submit"> Save </m3e-button>
          </div>
        </form>
      </dialog>
    `;
  }
}
