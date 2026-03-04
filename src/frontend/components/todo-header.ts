// Header component

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../base.ts";
import { store } from "../store.ts";

@customElement("todo-header")
export class TodoHeader extends StoreElement {
  static override styles = css`
    :host {
      display: block;
    }

    header {
      background: var(--md-sys-color-surface);
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .menu-btn {
      display: block;
      border: none;
      background: transparent;
      color: var(--md-sys-color-on-surface-variant);
      cursor: pointer;
      padding: 8px;
      border-radius: var(--md-sys-shape-corner-small);
    }

    .menu-btn:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    @media (min-width: 1024px) {
      .menu-btn {
        display: none;
      }
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo {
      width: 24px;
      height: 24px;
      color: var(--md-sys-color-primary);
    }

    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      color: var(--md-sys-color-on-surface);
    }
  `;

  override render() {
    return html`
      <header>
        <button
          class="menu-btn"
          @click="${() => store.setSidebarOpen(!store.sidebarOpen)}"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div class="title-area">
          <svg class="logo" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <h1>${store.currentPageTitle}</h1>
        </div>
      </header>
    `;
  }
}
