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
      height: 100vh;
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
      min-height: 0;
      overflow: hidden;
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

    .page-heading {
      margin-bottom: 24px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--md-sys-color-outline);
      margin-bottom: 4px;
    }

    .breadcrumb-sep {
      opacity: 0.5;
    }

    h1.page-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      color: var(--md-sys-color-on-surface);
      line-height: 1.2;
    }

    h1.page-title.editable {
      cursor: pointer;
      display: inline-block;
      border-radius: 4px;
      padding: 2px 4px;
      margin-left: -4px;
      transition: background 0.15s;
    }

    h1.page-title.editable:hover {
      background: var(--md-sys-color-surface-container-high);
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

  private handleTitleClick() {
    if (store.currentTab === "project") {
      const project = store.projects.find(
        (p) => p.id === store.selectedProjectId,
      );
      if (project) store.setShowProjectForm(true, project);
    } else if (store.currentTab === "context") {
      const context = store.contexts.find(
        (c) => c.id === store.selectedContextId,
      );
      if (context) store.setShowContextForm(true, context);
    }
  }

  private renderPageHeading() {
    const breadcrumb = store.currentBreadcrumb;
    const title = store.currentPageTitle;
    const editable = store.currentTitleEditable;
    return html`
      <div class="page-heading">
        ${breadcrumb
          ? html`
            <div class="breadcrumb">
              <span>${breadcrumb}</span>
              <span class="breadcrumb-sep">/</span>
            </div>
          `
          : null}
        <h1
          class="page-title ${editable ? "editable" : ""}"
          @click="${editable ? this.handleTitleClick : null}"
          title="${editable ? "Click to edit" : ""}"
        >
          ${title}
        </h1>
      </div>
    `;
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
          <div class="content">
            ${this.renderPageHeading()} ${this.renderCurrentView()}
          </div>
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
