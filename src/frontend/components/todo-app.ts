// Main todo app component

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/icon-button";
import "npm:@m3e/web@2/segmented-button";
import { StoreElement } from "../base.ts";
import { store } from "../store.ts";

// Import all components
import "./modals/context-form.ts";
import "./modals/filter-form.ts";
import "./modals/project-form.ts";
import "./modals/search-modal.ts";
import "./modals/task-form.ts";
import "./todo-header.ts";
import "./todo-sidebar.ts";
import "./todo-toasts.ts";
import "./views/context-view.ts";
import "./views/due-view.ts";
import "./views/filter-view.ts";
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
      // max-width: 48rem;
      margin: 0 auto;
    }

    .page-heading {
      margin-bottom: 24px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 16px;
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

    .title-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--md-sys-color-on-surface-variant);
      flex-shrink: 0;
    }

    .title-dot {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .title-dot::after {
      content: "";
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--dot-color);
    }

    .filter-placeholder {
      visibility: hidden;
    }

    .title-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .edit-button {
      color: var(--md-sys-color-on-surface-variant);
    }

    m3e-segmented-button.view-filter {
      width: auto;
    }

    m3e-segmented-button.view-filter m3e-button-segment {
      --m3e-segmented-button-icon-size: 0;
      --m3e-segmented-button-spacing: 0;
      --m3e-segmented-button-with-icon-padding-start: 0.75rem;
      --m3e-segmented-button-padding-start: 0.75rem;
      --m3e-segmented-button-padding-end: 0.75rem;
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

    // Global keyboard shortcuts
    globalThis.addEventListener?.("keydown", this.handleKeydown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    globalThis.removeEventListener?.("keydown", this.handleKeydown);
  }

  private handleKeydown = (e: KeyboardEvent) => {
    // Ignore when typing in inputs or when modals are open
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    ) {
      return;
    }

    if (
      store.showTaskForm ||
      store.showProjectForm ||
      store.showContextForm ||
      store.showFilterForm ||
      store.showSearch
    ) {
      return;
    }

    if (e.key === "a" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      store.setShowTaskForm(true);
    } else if (e.key === "s" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      store.setShowSearch(true);
    }
  };

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
    } else if (store.currentTab === "filter") {
      const filter = store.selectedFilter;
      if (filter) store.setShowFilterForm(true, filter);
    }
  }

  private renderPageIcon() {
    switch (store.currentTab) {
      case "next":
        return html`
          <m3e-icon
            class="title-icon"
            name="double_arrow"
            variant="rounded"
          ></m3e-icon>
        `;
      case "inbox":
        return html`
          <m3e-icon
            class="title-icon"
            name="inbox"
            variant="rounded"
          ></m3e-icon>
        `;
      case "due":
        return html`
          <m3e-icon
            class="title-icon"
            name="event"
            variant="rounded"
          ></m3e-icon>
        `;
      case "history":
        return html`
          <m3e-icon
            class="title-icon"
            name="history"
            variant="rounded"
          ></m3e-icon>
        `;
      case "settings":
        return html`
          <m3e-icon
            class="title-icon"
            name="settings"
            variant="rounded"
          ></m3e-icon>
        `;
      case "project": {
        const project = store.projects.find(
          (p) => p.id === store.selectedProjectId,
        );
        if (!project) return null;
        return html`
          <span
            class="title-dot"
            style="${styleMap({
              "--dot-color": project.color || "#4caf50",
            })}"
          ></span>
        `;
      }
      case "context": {
        const context = store.contexts.find(
          (c) => c.id === store.selectedContextId,
        );
        if (!context) return null;
        return html`
          <span
            class="title-dot"
            style="${styleMap({
              "--dot-color": context.color || "#FDD835",
            })}"
          ></span>
        `;
      }
      case "filter":
        return html`
          <m3e-icon
            class="title-icon"
            name="filter_list"
            variant="rounded"
          ></m3e-icon>
        `;
      default:
        return null;
    }
  }

  private get showFilter(): boolean {
    return ["inbox", "project", "context", "filter"].includes(store.currentTab);
  }

  private handleFilterChange(value: string) {
    store.setTaskFilter({ completed: value });
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
        <div class="title-row">
          ${this.renderPageIcon()}
          <h1 class="page-title">${title}</h1>
          <div class="title-actions">
            ${editable
              ? html`
                <m3e-icon-button
                  class="edit-button"
                  @click="${this.handleTitleClick}"
                >
                  <m3e-icon name="edit" variant="rounded"></m3e-icon>
                </m3e-icon-button>
              `
              : null}
            <m3e-segmented-button
              class="view-filter ${this.showFilter ? "" : "filter-placeholder"}"
              @change="${(e: Event) => {
                const segment = e.target as HTMLElement & { value: string };
                if (segment.value !== undefined) {
                  this.handleFilterChange(segment.value);
                }
              }}"
            >
              <m3e-button-segment
                value="true"
                .checked="${store.taskFilter.completed === "true"}"
              >done</m3e-button-segment>
              <m3e-button-segment
                value=""
                .checked="${store.taskFilter.completed === ""}"
              >all</m3e-button-segment>
              <m3e-button-segment
                value="false"
                .checked="${store.taskFilter.completed === "false"}"
              >next</m3e-button-segment>
            </m3e-segmented-button>
          </div>
        </div>
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
      case "filter":
        return html`
          <filter-view></filter-view>
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
        : null} ${store.showFilterForm
        ? html`
          <filter-form></filter-form>
        `
        : null} ${store.showSearch
        ? html`
          <search-modal></search-modal>
        `
        : null}
    `;
  }
}
