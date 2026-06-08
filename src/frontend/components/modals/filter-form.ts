// Filter form modal

import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "npm:@m3e/web@2/button";
import "npm:@m3e/web@2/form-field";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/segmented-button";
import { type FilterCriteria, store } from "../../store.ts";

interface DueDateForm {
  enabled: boolean;
  amount: number;
  unit: "days" | "weeks" | "months" | "years";
}

interface FilterFormState {
  name: string;
  color: string;
  priorities: number[];
  projects: string[];
  dueDate: DueDateForm;
}

@customElement("filter-form")
export class FilterForm extends LitElement {
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
      width: min(32rem, calc(100vw - 48px));
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
      margin: 0;
      font-size: 24px;
      font-weight: 400;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 8px;
    }

    m3e-form-field {
      width: 100%;
      --m3e-form-field-label-top: -9px;
    }

    m3e-segmented-button {
      width: 100%;
    }

    m3e-segmented-button m3e-button-segment {
      flex: 1;
      min-width: 0;
      --m3e-segmented-button-icon-size: 0;
      --m3e-segmented-button-spacing: 0;
      --m3e-segmented-button-with-icon-padding-start: 1rem;
    }

    m3e-segmented-button .p1[checked] {
      --m3e-segmented-button-selected-container-color: var(--priority-1-color);
    }
    m3e-segmented-button .p2[checked] {
      --m3e-segmented-button-selected-container-color: var(--priority-2-color);
    }
    m3e-segmented-button .p3[checked] {
      --m3e-segmented-button-selected-container-color: var(--priority-3-color);
    }

    .project-chip-input {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      background: var(--md-sys-color-surface);
      cursor: text;
      min-height: 44px;
    }

    .project-chip-input:focus-within {
      border-color: var(--md-sys-color-primary);
      outline: 1px solid var(--md-sys-color-primary);
    }

    .project-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      border: none;
    }

    .project-chip button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .project-chip button:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    .project-chip.selected {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 1px;
    }

    .project-chip-input input {
      flex: 1;
      min-width: 100px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      font-family: inherit;
      padding: 4px 0;
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

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .project-chip-input input[readonly] {
      flex: 0;
      min-width: 0;
      width: 0;
      padding: 0;
    }

    .project-chip-input input::placeholder {
      color: var(--md-sys-color-outline);
    }

    .project-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: 8px;
      box-shadow: var(--md-sys-elevation-level2);
      max-height: 200px;
      overflow-y: auto;
      z-index: 10;
    }

    .project-suggestions button {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }

    .project-suggestions button.highlighted {
      background: var(--md-sys-color-surface-container-highest);
    }

    .due-date-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .due-date-row input[type="number"] {
      width: 64px;
      padding: 8px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
    }

    .due-date-row select {
      padding: 8px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
    }

    .actions {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
    }

    .delete-button {
      --md-sys-color-primary: var(--md-sys-color-error);
    }

    .color-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: #fff;
      font-weight: 500;
      position: relative;
      overflow: hidden;
      transition: opacity 0.15s;
    }

    .color-pill:hover {
      opacity: 0.85;
    }

    .color-pill input[type="color"] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-row input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }
  `;

  @state()
  accessor form: FilterFormState = {
    name: "",
    color: "#7C4DFF",
    priorities: [],
    projects: [],
    dueDate: { enabled: false, amount: 0, unit: "days" },
  };

  @state()
  accessor _showProjectSuggestions = false;

  @state()
  accessor _projectQuery = "";

  @state()
  accessor _highlightedIndex = -1;

  @state()
  accessor _selectedChipIndex = -1;

  @state()
  accessor _showConfirmDiscard = false;

  private _blurTimeout: ReturnType<typeof setTimeout> | null = null;
  private _initialForm: string = "";

  get _filteredProjects() {
    const available = store.projects.filter(
      (p) => !this.form.projects.includes(p.id),
    );
    if (!this._projectQuery) return available;
    const q = this._projectQuery.toLowerCase();
    return available.filter((p) => p.name.toLowerCase().includes(q));
  }

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingFilter) {
      const f = store.editingFilter;
      const criteria = f.filter;
      this.form = {
        name: f.name,
        color: (f.color || "#7C4DFF").toUpperCase(),
        priorities: criteria.priorities || [],
        projects: criteria.projects || [],
        dueDate: criteria.dueDateWithin
          ? { enabled: true, ...criteria.dueDateWithin }
          : { enabled: false, amount: 0, unit: "days" },
      };
    }
    this._initialForm = JSON.stringify(this.form);
  }

  override async firstUpdated() {
    const dialog = this.renderRoot.querySelector("dialog");
    dialog?.showModal();
    await this.updateComplete;
    requestAnimationFrame(() => {
      this.renderRoot.querySelector<HTMLInputElement>("#filter-name")?.focus();
    });
    dialog?.addEventListener("close", () => this.close());
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("_showConfirmDiscard") && this._showConfirmDiscard) {
      const confirmDialog = this.renderRoot.querySelector(
        ".confirm-dialog",
      ) as HTMLDialogElement | null;
      if (confirmDialog && !confirmDialog.open) {
        confirmDialog.showModal();
        confirmDialog.addEventListener("cancel", (e) => {
          e.preventDefault();
          this._cancelDiscard();
        });
      }
    }
  }

  private close() {
    if (this._hasUnsavedChanges()) {
      this._showConfirmDiscard = true;
      return;
    }
    store.setShowFilterForm(false);
  }

  private _hasUnsavedChanges(): boolean {
    return JSON.stringify(this.form) !== this._initialForm;
  }

  private _confirmDiscard() {
    this._showConfirmDiscard = false;
    store.setShowFilterForm(false);
  }

  private _cancelDiscard() {
    this._showConfirmDiscard = false;
  }

  private handlePriorityChange(e: Event) {
    const segmentedButton = e.currentTarget as HTMLElement;
    const segments = segmentedButton.querySelectorAll("m3e-button-segment");
    const priorities: number[] = [];
    segments.forEach((seg) => {
      if ((seg as HTMLElement & { checked: boolean }).checked) {
        priorities.push(Number(seg.getAttribute("data-value")));
      }
    });
    this.form = { ...this.form, priorities };
  }

  private handleProjectInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this._projectQuery = input.value;
    this._showProjectSuggestions = true;
    this._highlightedIndex = 0;
  }

  private _handleBlur = () => {
    this._blurTimeout = setTimeout(() => {
      this._showProjectSuggestions = false;
      this._highlightedIndex = -1;
      this._blurTimeout = null;
    }, 150);
  };

  private handleProjectFocus() {
    if (this._blurTimeout) {
      clearTimeout(this._blurTimeout);
      this._blurTimeout = null;
    }
    this._showProjectSuggestions = true;
    this._highlightedIndex = 0;
  }

  private selectProject(id: string) {
    const newProjects = this.form.projects.includes(id)
      ? this.form.projects
      : [...this.form.projects, id];
    this.form = { ...this.form, projects: newProjects };

    this._projectQuery = "";
    this._highlightedIndex = 0;

    // Cancel any pending blur timeout since we're keeping focus
    if (this._blurTimeout) {
      clearTimeout(this._blurTimeout);
      this._blurTimeout = null;
    }

    // Focus input after render (element may change when last project added)
    this._showProjectSuggestions = store.projects.some(
      (p) => !newProjects.includes(p.id),
    );
    this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector<HTMLInputElement>(
        "#project-input",
      );
      if (input) {
        input.value = "";
        input.focus();
      }
    });
  }

  private handleProjectKeydown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement;
    const filtered = this._filteredProjects;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._highlightedIndex = Math.min(
        this._highlightedIndex + 1,
        filtered.length - 1,
      );
      this._selectedChipIndex = -1;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this._highlightedIndex = Math.max(this._highlightedIndex - 1, -1);
      this._selectedChipIndex = -1;
    } else if (e.key === "Enter" && this._highlightedIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      const project = filtered[this._highlightedIndex];
      if (project) this.selectProject(project.id);
    } else if (
      e.key === "Enter" &&
      this._showProjectSuggestions &&
      filtered.length > 0
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.selectProject(filtered[0].id);
    } else if (e.key === "Tab" && this._showProjectSuggestions) {
      // Close suggestions on tab so focus moves naturally without selecting a suggestion button
      this._showProjectSuggestions = false;
      this._highlightedIndex = -1;
    } else if (
      e.key === "ArrowLeft" &&
      input.selectionStart === 0 &&
      this.form.projects.length > 0
    ) {
      e.preventDefault();
      if (this._selectedChipIndex === -1) {
        this._selectedChipIndex = this.form.projects.length - 1;
      } else if (this._selectedChipIndex > 0) {
        this._selectedChipIndex--;
      } else {
        this._selectedChipIndex = -1;
      }
    } else if (e.key === "ArrowRight" && this._selectedChipIndex >= 0) {
      e.preventDefault();
      if (this._selectedChipIndex < this.form.projects.length - 1) {
        this._selectedChipIndex++;
      } else {
        this._selectedChipIndex = -1;
      }
    } else if (
      e.key === "Backspace" &&
      input.value === "" &&
      this.form.projects.length > 0
    ) {
      e.preventDefault();
      const removeIndex = this._selectedChipIndex >= 0
        ? this._selectedChipIndex
        : this.form.projects.length - 1;
      const newProjects = this.form.projects.filter(
        (_, i) => i !== removeIndex,
      );
      this.form = { ...this.form, projects: newProjects };
      if (this._selectedChipIndex >= 0) {
        this._selectedChipIndex = Math.min(
          this._selectedChipIndex,
          newProjects.length - 1,
        );
        if (newProjects.length === 0) this._selectedChipIndex = -1;
      }
      this._showProjectSuggestions = true;
      if (this._blurTimeout) {
        clearTimeout(this._blurTimeout);
        this._blurTimeout = null;
      }
      this.updateComplete.then(() => {
        const newInput = this.renderRoot.querySelector<HTMLInputElement>(
          "#project-input",
        );
        if (newInput) newInput.focus();
      });
    } else if (e.key === "Escape") {
      this._showProjectSuggestions = false;
      this._highlightedIndex = -1;
      this._selectedChipIndex = -1;
    } else {
      // Any other key typed resets chip selection
      this._selectedChipIndex = -1;
    }
  }

  private removeProject(id: string) {
    this.form = {
      ...this.form,
      projects: this.form.projects.filter((p) => p !== id),
    };
  }

  private handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.form.name.trim()) return;

    const criteria: FilterCriteria = {};
    if (this.form.priorities.length > 0) {
      criteria.priorities = this.form.priorities;
    }
    if (this.form.projects.length > 0) {
      criteria.projects = this.form.projects;
    }
    if (this.form.dueDate.enabled) {
      criteria.dueDateWithin = {
        amount: this.form.dueDate.amount,
        unit: this.form.dueDate.unit,
      };
    }

    store.saveFilter({
      name: this.form.name.trim(),
      color: this.form.color,
      criteria,
    });
  }

  private handleDelete() {
    if (store.editingFilter) {
      store.deleteFilter(store.editingFilter.id);
    }
  }

  override render() {
    const isEditing = !!store.editingFilter;
    const priorityLabels = [
      { value: 1, label: "P1" },
      { value: 2, label: "P2" },
      { value: 3, label: "P3" },
    ];

    const availableProjects = store.projects.filter(
      (p) => !this.form.projects.includes(p.id),
    );

    return html`
      <dialog
        @click="${(e: Event) => {
          if ((e.target as HTMLElement).nodeName === "DIALOG") this.close();
        }}"
      >
        <div class="dialog-header">
          <h2>${isEditing ? "edit filter" : "create filter"}</h2>
          <label class="color-pill" style="background: ${this.form.color}">
            <span>${this.form.color.toUpperCase()}</span>
            <input
              type="color"
              .value="${this.form.color}"
              @input="${(e: Event) => (this.form = {
                ...this.form,
                color: (e.target as HTMLInputElement).value.toUpperCase(),
              })}"
            />
          </label>
        </div>

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
              <label slot="label" for="filter-name">filter name</label>
              <input
                id="filter-name"
                type="text"
                .value="${this.form.name}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  name: (e.target as HTMLInputElement).value,
                })}"
                required
                placeholder="filter name"
              />
            </m3e-form-field>
          </div>

          <div class="form-group">
            <label>projects</label>
            <div
              class="project-chip-input"
              @click="${() =>
                this.renderRoot
                  .querySelector<HTMLInputElement>("#project-input")
                  ?.focus()}"
            >
              ${this.form.projects.map((id, idx) => {
                const project = store.projects.find((p) => p.id === id);
                const color = project?.color || "#4caf50";
                return project
                  ? html`
                    <span
                      class="project-chip ${idx === this._selectedChipIndex
                        ? "selected"
                        : ""}"
                      style="background: ${color}"
                    >
                      ${project.name}
                      <button
                        type="button"
                        tabindex="-1"
                        @click="${() => this.removeProject(id)}"
                      >
                        ×
                      </button>
                    </span>
                  `
                  : nothing;
              })} ${availableProjects.length > 0
                ? html`
                  <input
                    id="project-input"
                    type="text"
                    autocomplete="off"
                    placeholder="add project..."
                    @input="${this.handleProjectInput}"
                    @focus="${this.handleProjectFocus}"
                    @keydown="${this.handleProjectKeydown}"
                    @blur="${this._handleBlur}"
                  />
                `
                : html`
                  <input
                    id="project-input"
                    type="text"
                    autocomplete="off"
                    readonly
                    @focus="${this.handleProjectFocus}"
                    @keydown="${this.handleProjectKeydown}"
                    @blur="${this._handleBlur}"
                  />
                `} ${this._showProjectSuggestions &&
                  this._filteredProjects.length > 0
                ? html`
                  <div class="project-suggestions">
                    ${this._filteredProjects.map(
                      (p, i) =>
                        html`
                          <button
                            type="button"
                            class="${i === this._highlightedIndex
                              ? "highlighted"
                              : ""}"
                            @mouseenter="${() => {
                              this._highlightedIndex = i;
                            }}"
                            @mouseleave="${() => {
                              this._highlightedIndex = -1;
                            }}"
                            @mousedown="${(e: MouseEvent) => {
                              e.preventDefault();
                              this.selectProject(p.id);
                            }}"
                          >
                            ${p.name}
                          </button>
                        `,
                    )}
                  </div>
                `
                : nothing}
            </div>
          </div>

          <div class="form-group">
            <label>due date</label>
            <div class="checkbox-row">
              <input
                type="checkbox"
                id="due-enabled"
                .checked="${this.form.dueDate.enabled}"
                @change="${(e: Event) => (this.form = {
                  ...this.form,
                  dueDate: {
                    ...this.form.dueDate,
                    enabled: (e.target as HTMLInputElement).checked,
                  },
                })}"
              />
              <label for="due-enabled" style="margin-bottom:0"
              >filter by due date</label>
            </div>
            ${this.form.dueDate.enabled
              ? html`
                <div class="due-date-row" style="margin-top: 8px">
                  <span>due within</span>
                  <input
                    type="number"
                    .value="${String(this.form.dueDate.amount)}"
                    @input="${(e: Event) => (this.form = {
                      ...this.form,
                      dueDate: {
                        ...this.form.dueDate,
                        amount:
                          parseInt((e.target as HTMLInputElement).value) ||
                          0,
                      },
                    })}"
                  />
                  <select
                    .value="${this.form.dueDate.unit}"
                    @change="${(e: Event) => (this.form = {
                      ...this.form,
                      dueDate: {
                        ...this.form.dueDate,
                        unit: (e.target as HTMLSelectElement).value as
                          | "days"
                          | "weeks"
                          | "months"
                          | "years",
                      },
                    })}"
                  >
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                    <option value="years">years</option>
                  </select>
                  <span>from today</span>
                </div>
              `
              : nothing}
          </div>

          <div class="form-group">
            <label>priorities</label>
            <m3e-segmented-button multi @change="${this.handlePriorityChange}">
              ${priorityLabels.map(
                ({ value, label }) =>
                  html`
                    <m3e-button-segment
                      class="p${value}"
                      data-value="${value}"
                      .checked="${this.form.priorities.includes(value)}"
                    >
                      ${label}
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

      ${this._showConfirmDiscard
        ? html`
          <dialog
            class="confirm-dialog"
            @click="${(e: Event) => {
              if (
                (e.target as HTMLElement).classList.contains("confirm-dialog")
              ) {
                this._cancelDiscard();
              }
            }}"
          >
            <h3>discard unsaved changes?</h3>
            <div class="confirm-actions">
              <m3e-button
                variant="text"
                type="button"
                @click="${this._cancelDiscard}"
              >
                continue editing
              </m3e-button>
              <m3e-button
                variant="filled"
                type="button"
                @click="${this._confirmDiscard}"
              >
                discard
              </m3e-button>
            </div>
          </dialog>
        `
        : null}
    `;
  }
}
