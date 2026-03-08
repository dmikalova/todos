// Sidebar navigation component

import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { StoreElement } from "../base.ts";
import { store } from "../store.ts";

@customElement("todo-sidebar")
export class TodoSidebar extends StoreElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }

    aside {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 16rem;
      background: var(--md-sys-color-surface-container-low);
      border-right: 1px solid var(--md-sys-color-outline-variant);
      display: flex;
      flex-direction: column;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
      z-index: 50;
    }

    aside.open {
      transform: translateX(0);
    }

    @media (min-width: 1024px) {
      :host {
        height: 100%;
      }

      aside {
        position: static;
        transform: none;
        height: 100%;
      }
    }

    .user-section {
      padding: 8px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      font-size: 14px;
      flex-shrink: 0;
      object-fit: cover;
    }

    .user-name {
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
    }

    .quick-actions {
      padding: 8px;
    }

    .nav-button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border: none;
      background: transparent;
      border-radius: var(--md-sys-shape-corner-small);
      cursor: pointer;
      font-size: 14px;
      color: var(--md-sys-color-on-surface-variant);
      transition: background-color 0.15s;
    }

    .nav-button:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    .nav-button.active {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .nav-button.add-task {
      color: var(--md-sys-color-primary);
    }

    .nav-button svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .count {
      margin-left: auto;
      font-size: 12px;
      color: var(--md-sys-color-outline);
    }

    .section {
      padding: 8px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--md-sys-color-outline);
    }

    .section-add {
      border: none;
      background: transparent;
      color: var(--md-sys-color-outline);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--md-sys-shape-corner-small);
    }

    .section-add:hover {
      color: var(--md-sys-color-on-surface-variant);
      background: var(--md-sys-color-surface-container-high);
    }

    .item-row {
      display: flex;
      align-items: center;
    }

    .item-row .nav-button {
      flex: 1;
      border-radius: var(--md-sys-shape-corner-small) 0 0
        var(--md-sys-shape-corner-small);
      }

      .item-edit {
        padding: 8px;
        border: none;
        background: transparent;
        color: var(--md-sys-color-outline);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s;
        border-radius: 0 var(--md-sys-shape-corner-small)
          var(--md-sys-shape-corner-small) 0;
        }

        .item-row:hover .item-edit {
          opacity: 1;
        }

        .item-edit:hover {
          background: var(--md-sys-color-surface-container-high);
          color: var(--md-sys-color-on-surface-variant);
        }

        .color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.25), inset 0 0 0 0 transparent;
        }

        .section.scrollable {
          flex: 1;
          overflow-y: auto;
        }

        .bottom-section {
          padding: 8px;
          border-top: 1px solid var(--md-sys-color-outline-variant);
        }
      `;

      override render() {
        return html`
          <aside class="${store.sidebarOpen ? "open" : ""}">
            <!-- User Section -->
            <div class="user-section">
              <div class="user-info">
                ${store.user?.picture
                  ? html`
                    <img
                      class="avatar"
                      src="${store.user.picture}"
                      alt="${store.user.name || store.user.email}"
                      referrerpolicy="no-referrer"
                    />
                  `
                  : html`
                    <div class="avatar">
                      ${(store.user?.name || store.user?.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  `}
                <span class="user-name">${store.user?.name ||
                  store.user?.email || "User"}</span>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
              <button
                class="nav-button add-task"
                @click="${() => {
                  store.setShowTaskForm(true);
                  store.setSidebarOpen(false);
                }}"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add task
              </button>

              <button
                class="nav-button"
                @click="${() => {
                  store.setShowSearch(true);
                  store.setSidebarOpen(false);
                }}"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </button>

              <button
                class="nav-button ${store.currentTab === "inbox"
                  ? "active"
                  : ""}"
                @click="${() => store.navigate("inbox")}"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                Inbox ${store.inboxCount > 0
                  ? html`
                    <span class="count">${store.inboxCount}</span>
                  `
                  : null}
              </button>

              <button
                class="nav-button ${store.currentTab === "next"
                  ? "active"
                  : ""}"
                @click="${() => store.navigate("next")}"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Next
              </button>
            </div>

            <!-- Filters -->
            <div class="section">
              <div class="section-header">
                <span class="section-title">Filters</span>
              </div>
              <button
                class="nav-button ${store.currentTab === "due" ? "active" : ""}"
                @click="${() => store.navigate("due")}"
              >
                <span
                  class="color-dot"
                  style="background: var(--md-sys-color-tertiary)"
                ></span>
                Due ${store.dueCount > 0
                  ? html`
                    <span class="count">${store.dueCount}</span>
                  `
                  : null}
              </button>
            </div>

            <!-- Projects -->
            <div class="section scrollable">
              <div class="section-header">
                <span class="section-title">Projects</span>
                <button
                  class="section-add"
                  @click="${() => store.setShowProjectForm(true)}"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>
              ${store.projects.map(
                (project) =>
                  html`
                    <div class="item-row">
                      <button
                        class="nav-button ${store.currentTab === "project" &&
                            store.selectedProjectId === project.id
                          ? "active"
                          : ""}"
                        @click="${() => store.navigate("project", project.id)}"
                      >
                        <span
                          class="color-dot"
                          style="background: ${project.color || "#4caf50"}"
                        ></span>
                        ${project.name} ${project.task_count
                          ? html`
                            <span class="count">${project.task_count}</span>
                          `
                          : null}
                      </button>
                      <button
                        class="item-edit"
                        @click="${(e: Event) => {
                          e.stopPropagation();
                          store.setShowProjectForm(true, project);
                        }}"
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                  `,
              )}

              <!-- Contexts -->
              <div class="section-header" style="margin-top: 16px;">
                <span class="section-title">Contexts</span>
                <button
                  class="section-add"
                  @click="${() => store.setShowContextForm(true)}"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>
              ${store.contexts.map(
                (context) =>
                  html`
                    <div class="item-row">
                      <button
                        class="nav-button ${store.currentTab === "context" &&
                            store.selectedContextId === context.id
                          ? "active"
                          : ""}"
                        @click="${() => store.navigate("context", context.id)}"
                      >
                        <span
                          class="color-dot"
                          style="background: ${context.color || "#2196f3"}"
                        ></span>
                        ${context.name}
                      </button>
                      <button
                        class="item-edit"
                        @click="${(e: Event) => {
                          e.stopPropagation();
                          store.setShowContextForm(true, context);
                        }}"
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                  `,
              )}
            </div>

            <!-- Bottom Links -->
            <div class="bottom-section">
              <button
                class="nav-button ${store.currentTab === "history"
                  ? "active"
                  : ""}"
                @click="${() => store.navigate("history")}"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                History
              </button>
              <button
                class="nav-button ${store.currentTab === "settings"
                  ? "active"
                  : ""}"
                @click="${() => store.navigate("settings")}"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
            </div>
          </aside>
        `;
      }
    }
