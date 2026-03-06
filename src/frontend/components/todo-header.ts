// Header component - mobile hamburger only; page titles render inline in views

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
      padding: 8px 16px;
      display: flex;
      align-items: center;
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
      :host {
        display: none;
      }
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
      </header>
    `;
  }
}
