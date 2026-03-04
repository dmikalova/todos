// Settings view

import { css, html, LitElement } from "lit";
import { customElement, query } from "lit/decorators.js";
import { store } from "../../store.ts";

@customElement("settings-view")
export class SettingsView extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .settings-card {
      background: var(--md-sys-color-surface);
      border-radius: var(--md-sys-shape-corner-large);
      padding: 24px;
      box-shadow: var(--md-sys-elevation-level1);
    }

    h2 {
      font-size: 18px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      margin: 0 0 16px;
    }

    .section {
      padding: 16px 0;
    }

    .section + .section {
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    h3 {
      font-size: 14px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
      margin: 0 0 8px;
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

    .btn-primary {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    .btn-primary:hover {
      box-shadow: var(--md-sys-elevation-level2);
    }

    .btn-secondary {
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
    }

    .btn-secondary:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    .description {
      font-size: 12px;
      color: var(--md-sys-color-outline);
      margin-top: 8px;
    }

    input[type="file"] {
      display: none;
    }
  `;

  @query("#import-file")
  accessor fileInput!: HTMLInputElement;

  private handleExport() {
    store.exportData();
  }

  private handleImportClick() {
    this.fileInput.click();
  }

  private handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      store.importData(file);
      input.value = "";
    }
  }

  override render() {
    return html`
      <div class="settings-card">
        <h2>Data Management</h2>

        <div class="section">
          <h3>Export</h3>
          <button class="btn btn-primary" @click="${this.handleExport}">
            Export All Data
          </button>
          <p class="description">
            Download all tasks, projects, and contexts as JSON
          </p>
        </div>

        <div class="section">
          <h3>Import</h3>
          <input
            type="file"
            id="import-file"
            accept=".json"
            @change="${this.handleFileChange}"
          />
          <button class="btn btn-secondary" @click="${this.handleImportClick}">
            Import Data
          </button>
          <p class="description">
            Import tasks and settings from a JSON export file
          </p>
        </div>
      </div>
    `;
  }
}
