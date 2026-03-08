// Toast notifications component

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../base.ts";
import { store } from "../store.ts";

@customElement("todo-toasts")
export class TodoToasts extends StoreElement {
  static override styles = css`
    :host {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .toast {
      padding: 12px 24px;
      border-radius: var(--md-sys-shape-corner-medium);
      font-size: 14px;
      box-shadow: var(--md-sys-elevation-level3);
      animation: slideIn 0.2s ease;
      white-space: nowrap;
    }

    .toast.success {
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
    }

    .toast.error {
      background: var(--md-sys-color-error);
      color: var(--md-sys-color-on-error);
    }

    @keyframes slideIn {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;

  override render() {
    return html`
      ${store.toasts.map(
        (toast) =>
          html`
            <div class="toast ${toast.type}">${toast.message}</div>
          `,
      )}
    `;
  }
}
