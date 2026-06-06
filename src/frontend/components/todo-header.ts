// Header component - mobile hamburger only; page titles render inline in views

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/icon-button";
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

    @media (min-width: 1024px) {
      :host {
        display: none;
      }
    }
  `;

  override render() {
    return html`
      <header>
        <m3e-icon-button
          @click="${() => store.setSidebarOpen(!store.sidebarOpen)}"
        >
          <m3e-icon name="menu" variant="rounded"></m3e-icon>
        </m3e-icon-button>
      </header>
    `;
  }
}
