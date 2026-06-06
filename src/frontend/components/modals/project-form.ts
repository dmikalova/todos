// Project form modal

import "npm:@m3e/web@2/button";
import "npm:@m3e/web@2/form-field";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/option";
import "npm:@m3e/web@2/select";
import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
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

    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }
  `;

  @state()
  accessor form = {
    name: "",
    color: "#4caf50",
    context_id: null as string | null,
    parent_project_id: null as string | null,
  };

  override connectedCallback() {
    super.connectedCallback();
    if (store.editingProject) {
      this.form = {
        name: store.editingProject.name,
        color: store.editingProject.color || "#4caf50",
        context_id: store.editingProject.context_id || null,
        parent_project_id: store.editingProject.parent_project_id || null,
      };
    }
  }

  override firstUpdated() {
    const dialog = this.renderRoot.querySelector("dialog");
    dialog?.showModal();
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
    // For editing: check if parent chain has a context
    if (store.editingProject) {
      const inheritedId = store.resolveProjectContext({
        ...store.editingProject,
        context_id: null, // pretend no direct context to find inherited
      });
      if (inheritedId) {
        const name = store.getContextName(inheritedId);
        return `inherited: ${name}`;
      }
    }
    // For new projects: check if selected parent has context
    if (this.form.parent_project_id) {
      const parent = store.projects.find(
        (p) => p.id === this.form.parent_project_id,
      );
      if (parent) {
        const inheritedId = store.resolveProjectContext(parent);
        if (inheritedId) {
          const name = store.getContextName(inheritedId);
          return `inherited: ${name}`;
        }
      }
    }
    return "None";
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    await store.saveProject({
      name: this.form.name,
      color: this.form.color,
      contextId: this.form.context_id || undefined,
      parentProjectId: this.form.parent_project_id,
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
      <dialog @click="${(e: Event) => {
        if ((e.target as HTMLElement).nodeName === "DIALOG") this.close();
      }}">
        <h2>${isEditing ? "Edit Project" : "New Project"}</h2>

        <form @submit="${this.handleSubmit}">
          <div class="form-group">
            <m3e-form-field variant="outlined" hide-subscript="always">
              <label slot="label" for="project-name">Name</label>
              <input
                id="project-name"
                type="text"
                .value="${this.form.name}"
                @input="${(e: Event) => (this.form = {
                  ...this.form,
                  name: (e.target as HTMLInputElement).value,
                })}"
                required
                placeholder="Project name"
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
            <m3e-form-field variant="outlined" hide-subscript="always">
              <label slot="label" for="context-select">Context</label>
              <m3e-select
                id="context-select"
                @change="${(e: Event) => {
                  const select = e.target as HTMLElement & { value: string };
                  this.form = {
                    ...this.form,
                    context_id: select.value || null,
                  };
                }}"
              >
                <m3e-icon
                  slot="arrow"
                  name="arrow_drop_down_circle"
                  variant="rounded"
                ></m3e-icon>
                <m3e-option value="" selected>${this
                  ._getInheritedContextLabel()}</m3e-option>
                ${store.contexts.map(
                  (c) =>
                    html`
                      <m3e-option value="${c
                        .id}" ?selected="${this.form.context_id === c.id}">${c
                        .name}</m3e-option>
                    `,
                )}
              </m3e-select>
            </m3e-form-field>
          </div>

          <div class="form-group">
            <m3e-form-field variant="outlined" hide-subscript="always">
              <label slot="label" for="parent-select">Parent Project</label>
              <m3e-select
                id="parent-select"
                @change="${(e: Event) => {
                  const select = e.target as HTMLElement & { value: string };
                  this.form = {
                    ...this.form,
                    parent_project_id: select.value || null,
                  };
                }}"
              >
                <m3e-icon
                  slot="arrow"
                  name="arrow_drop_down_circle"
                  variant="rounded"
                ></m3e-icon>
                <m3e-option value="" selected>None</m3e-option>
                ${this._getAvailableParents().map(
                  (p) =>
                    html`
                      <m3e-option value="${p
                        .id}" ?selected="${this.form.parent_project_id ===
                        p.id}">${p.name}</m3e-option>
                    `,
                )}
              </m3e-select>
            </m3e-form-field>
          </div>

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
              <m3e-button
                variant="text"
                type="button"
                @click="${this.close}"
              >
                Cancel
              </m3e-button>
              <m3e-button variant="filled" type="submit">
                Save
              </m3e-button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}
