// Project form modal

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../../store.ts";

@customElement("project-form")
export class ProjectForm extends LitElement {
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
      max-width: 24rem;
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

    input[type="text"] {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-small);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
    }

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
    color: "#4caf50",
    context_id: null as string | null,
  };

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingProject) {
      this.form = {
        name: store.editingProject.name,
        color: store.editingProject.color || "#4caf50",
        context_id: store.editingProject.context_id || null,
      };
    }
  }

  private close() {
    store.setShowProjectForm(false);
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    await store.saveProject({
      name: this.form.name,
      color: this.form.color,
      contextId: this.form.context_id || undefined,
    } as Record<string, unknown>);
  }

  private async handleDelete() {
    if (
      store.editingProject &&
      confirm("Delete this project? Tasks will be moved to Inbox.")
    ) {
      await store.deleteProject(store.editingProject.id);
    }
  }

  override render() {
    const isEditing = !!store.editingProject;

    return html`
      <div class="backdrop" @click="${this.close}"></div>
      <div class="modal">
        <h2>${isEditing ? "Edit Project" : "New Project"}</h2>

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
              placeholder="Project name"
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
            <label>Context</label>
            <select
              .value="${String(this.form.context_id || "")}"
              @change="${(e: Event) => (this.form = {
                ...this.form,
                context_id: (e.target as HTMLSelectElement).value
                  ? (e.target as HTMLSelectElement).value
                  : null,
              })}"
            >
              <option value="">None</option>
              ${store.contexts.map(
                (c) =>
                  html`
                    <option value="${c.id}">${c.name}</option>
                  `,
              )}
            </select>
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
