// Main todo app component

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../base.ts";
import { store } from "../store.ts";

// Import all components
import "./modals/context-form.ts";
import "./modals/project-form.ts";
import "./modals/search-modal.ts";
import "./modals/task-form.ts";
import "./todo-header.ts";
import "./todo-sidebar.ts";
import "./todo-toasts.ts";
import "./views/context-view.ts";
import "./views/due-view.ts";
import "./views/history-view.ts";
import "./views/inbox-view.ts";
import "./views/next-view.ts";
import "./views/project-view.ts";
import "./views/settings-view.ts";

@customElement("todo-app")
export class TodoApp extends StoreElement {
  static override styles = css`
    :host {
      display: flex;
      min-height: 100vh;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 40;
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    main {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .content {
      max-width: 48rem;
      margin: 0 auto;
    }

    @media (min-width: 1024px) {
      .overlay {
        display: none;
      }
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    store.parseUrl();
    store.fetchAll();

    // Handle browser back/forward
    globalThis.addEventListener?.("popstate", () => store.parseUrl());
  }

  private handleOverlayClick() {
    store.setSidebarOpen(false);
  }

  private renderCurrentView() {
    switch (store.currentTab) {
      case "next":
        return html`
          <next-view></next-view>
        `;
      case "inbox":
        return html`
          <inbox-view></inbox-view>
        `;
      case "due":
        return html`
          <due-view></due-view>
        `;
      case "project":
        return html`
          <project-view></project-view>
        `;
      case "context":
        return html`
          <context-view></context-view>
        `;
      case "history":
        return html`
          <history-view></history-view>
        `;
      case "settings":
        return html`
          <settings-view></settings-view>
        `;
      default:
        return html`
          <next-view></next-view>
        `;
    }
  }

  override render() {
    return html`
      ${store.sidebarOpen
        ? html`
          <div class="overlay" @click="${this.handleOverlayClick}"></div>
        `
        : null}

      <todo-sidebar></todo-sidebar>

      <div class="main-area">
        <todo-header></todo-header>
        <todo-toasts></todo-toasts>

        <main>
          <div class="content">${this.renderCurrentView()}</div>
        </main>
      </div>

      ${store.showTaskForm
        ? html`
          <task-form></task-form>
        `
        : null} ${store.showProjectForm
        ? html`
          <project-form></project-form>
        `
        : null} ${store.showContextForm
        ? html`
          <context-form></context-form>
        `
        : null} ${store.showSearch
        ? html`
          <search-modal></search-modal>
        `
        : null}
    `;
  }
}
