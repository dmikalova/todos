// Project form modal

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import "npm:@m3e/web@2/button";
import "npm:@m3e/web@2/form-field";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/option";
import "npm:@m3e/web@2/select";
import { store } from "../../store.ts";

@customElement("project-form")
export class ProjectForm extends LitElement {
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

    m3e-form-field {
      width: 100%;
      --m3e-form-field-label-top: -9px;
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

    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }

    .delete-button {
      --md-sys-color-primary: var(--md-sys-color-error);
    }

    .context-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .context-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      border: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
      cursor: pointer;
      transition: all 0.15s;
    }

    .context-chip.selected {
      background: var(--md-sys-color-secondary-container);
      border-color: var(--md-sys-color-secondary);
      color: var(--md-sys-color-on-secondary-container);
    }

    .context-chip:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    .context-chip.selected:hover {
      background: var(--md-sys-color-secondary-container);
      opacity: 0.85;
    }

    .inherited-hint {
      font-size: 12px;
      color: var(--md-sys-color-outline);
      margin-top: 4px;
    }
  `;

  @state()
  accessor form = {
    name: "",
    color: "#4CAF50",
    context_ids: [] as string[],
    parent_project_id: null as string | null,
  };

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingProject) {
      this.form = {
        name: store.editingProject.name,
        color: (store.editingProject.color || "#4CAF50").toUpperCase(),
        context_ids: store.editingProject.context_ids || [],
        parent_project_id: store.editingProject.parent_project_id || null,
      };
    }
  }

  override async firstUpdated() {
    const dialog = this.renderRoot.querySelector("dialog");
    dialog?.showModal();
    await this.updateComplete;
    requestAnimationFrame(() => {
      this.renderRoot.querySelector<HTMLInputElement>("#project-name")?.focus();
    });
    dialog?.addEventListener("close", () => this.close());
  }

  private close() {
    store.setShowProjectForm(false);
  }

  private _getAvailableParents() {
    const editingId = store.editingProject?.id;
    if (!editingId) {
      // New project — all projects are valid parents
      return store.projects;
    }
    // Exclude self and descendants
    const excludeIds = new Set([
      editingId,
      ...store.getDescendantIds(editingId),
    ]);
    return store.projects.filter((p) => !excludeIds.has(p.id));
  }

  private _getInheritedContextLabel(): string {
    // For new projects: check if selected parent has contexts
    if (this.form.parent_project_id) {
      const parent = store.projects.find(
        (p) => p.id === this.form.parent_project_id,
      );
      if (parent && parent.context_ids.length > 0) {
        const names = parent.context_ids
          .map((id) => store.getContextName(id))
          .filter(Boolean)
          .join(", ");
        return `inherits: ${names}`;
      }
    }
    return "";
  }

  private _toggleContext(contextId: string) {
    const ids = this.form.context_ids.includes(contextId)
      ? this.form.context_ids.filter((id) => id !== contextId)
      : [...this.form.context_ids, contextId];
    this.form = { ...this.form, context_ids: ids };
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    await store.saveProject({
      name: this.form.name.trim(),
      color: this.form.color,
      contextIds: this.form.context_ids,
      parentProjectId: this.form.parent_project_id,
    } as Record<string, unknown>);
  }

  private async handleDelete() {
    if (
      store.editingProject &&
      confirm("delete this project? tasks will be moved to inbox.")
    ) {
      await store.deleteProject(store.editingProject.id);
    }
  }

  override render() {
    const isEditing = !!store.editingProject;

    return html`
      <dialog
        @click="${(e: Event) => {
          if ((e.target as HTMLElement).nodeName === "DIALOG") this.close();
        }}"
      >
        <div class="dialog-header">
          <h2>${isEditing ? "edit project" : "create project"}</h2>
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
              <label slot="label" for="parent-select">parent project</label>
              <m3e-select
                id="parent-select"
                @change="${(e: Event) => {
                  const select = e.target as HTMLElement & { value: string };
                  this.form = {
                    ...this.form,
                    parent_project_id: select.value === "none"
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
                  ?selected="${!this.form.parent_project_id}"
                >none</m3e-option>
                ${this._getAvailableParents().map(
                  (p) =>
                    html`
                      <m3e-option
                        value="${p.id}"
                        ?selected="${this.form.parent_project_id === p.id}"
                      >${p.name}</m3e-option>
                    `,
                )}
              </m3e-select>
            </m3e-form-field>
          </div>

          <div class="form-group">
            <m3e-form-field
              variant="outlined"
              float-label="always"
              hide-subscript="always"
            >
              <label slot="label" for="project-name">project name</label>
              <input
                id="project-name"
                type="text"
                .value="${this.form.name}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  name: (e.target as HTMLInputElement).value,
                })}"
                required
                placeholder="project name"
              />
            </m3e-form-field>
          </div>

          <div class="form-group">
            <label
              style="display: block; font-size: 12px; font-weight: 500; color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px;"
            >contexts</label>
            <div class="context-chips">
              ${store.contexts.map(
                (c) =>
                  html`
                    <button
                      type="button"
                      class="context-chip ${this.form.context_ids.includes(c.id)
                        ? "selected"
                        : ""}"
                      @click="${() => this._toggleContext(c.id)}"
                    >
                      <span
                        style="width: 8px; height: 8px; border-radius: 50%; background: ${c
                          .color || "#F48FB1"}"
                      ></span>
                      ${c.name}
                    </button>
                  `,
              )}
            </div>
            ${this._getInheritedContextLabel()
              ? html`
                <div class="inherited-hint">${this
                  ._getInheritedContextLabel()}</div>
              `
              : null}
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
    `;
  }
}
