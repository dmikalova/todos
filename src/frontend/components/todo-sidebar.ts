// Sidebar navigation component

import { css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "npm:@m3e/web@2/icon";
import "npm:@m3e/web@2/icon-button";
import { StoreElement } from "../base.ts";
import { NAV_LABELS, SECTION_LABELS } from "../labels.ts";
import { store } from "../store.ts";

@customElement("todo-sidebar")
export class TodoSidebar extends StoreElement {
  @state()
  accessor _draggingId: string | null = null;

  @state()
  accessor _dropIndex: number = -1;

  @state()
  accessor _dropDepth: number = 0;

  @state()
  accessor _sidebarWidth: number = 256;

  @state()
  accessor _isResizing: boolean = false;

  private _handleDragStart(e: DragEvent, projectId: string) {
    this._draggingId = projectId;
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", projectId);
  }

  private _handleDragEnd() {
    this._draggingId = null;
    this._dropIndex = -1;
    this._dropDepth = 0;
  }

  private _handleProjectListDragOver(e: DragEvent) {
    e.preventDefault();
    if (!this._draggingId) return;
    e.dataTransfer!.dropEffect = "move";

    const container = e.currentTarget as HTMLElement;
    const items = container.querySelectorAll(".item-row");
    const mouseY = e.clientY;
    const mouseX = e.clientX;

    // Find the gap closest to the mouse
    let closestIndex = 0;
    let closestDist = Infinity;

    // Check before first item
    if (items.length > 0) {
      const firstRect = items[0].getBoundingClientRect();
      const dist = Math.abs(mouseY - firstRect.top);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = 0;
      }
    }

    // Check between/after items
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const bottom = rect.bottom;
      const dist = Math.abs(mouseY - bottom);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i + 1;
      }
    }

    // Calculate depth based on horizontal position
    const containerRect = container.getBoundingClientRect();
    const relativeX = mouseX - containerRect.left - 20; // offset for padding
    const depth = Math.max(0, Math.min(4, Math.floor(relativeX / 16)));

    // Constrain depth: can't be deeper than the item above + 1
    const tree = store.projectTree;
    let maxDepth = 0;
    if (closestIndex > 0 && closestIndex <= tree.length) {
      const aboveEntry = tree[closestIndex - 1];
      if (aboveEntry) {
        maxDepth = aboveEntry.depth + 1;
      }
    }

    this._dropIndex = closestIndex;
    this._dropDepth = Math.min(depth, maxDepth);
  }

  private _handleProjectListDragLeave(e: DragEvent) {
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    this._dropIndex = -1;
  }

  private async _handleProjectListDrop(e: DragEvent) {
    e.preventDefault();
    const draggedId = e.dataTransfer!.getData("text/plain");
    const dropIndex = this._dropIndex;
    const dropDepth = this._dropDepth;

    this._draggingId = null;
    this._dropIndex = -1;
    this._dropDepth = 0;

    if (!draggedId) return;

    // Prevent dropping onto self or descendants
    const descendants = store.getDescendantIds(draggedId);

    const tree = store.projectTree;

    // Determine the new parent based on drop depth and position
    let newParentId: string | null = null;
    let sortOrder = 0;

    if (dropDepth === 0) {
      // Top-level drop
      newParentId = null;
    } else {
      // Find the parent: walk backwards from dropIndex to find an item at depth = dropDepth - 1
      for (let i = dropIndex - 1; i >= 0; i--) {
        if (tree[i].depth === dropDepth - 1) {
          newParentId = tree[i].project.id;
          break;
        }
      }
    }

    // Prevent circular drops
    if (
      newParentId &&
      (newParentId === draggedId || descendants.includes(newParentId))
    ) {
      return;
    }

    // Calculate sort_order: count siblings before this position
    const siblings = tree.filter(
      (entry) =>
        entry.depth === dropDepth &&
        (entry.project.parent_project_id ?? null) === newParentId &&
        entry.project.id !== draggedId,
    );

    // Find which sibling position this drop corresponds to
    let siblingIndex = 0;
    for (let i = 0; i < dropIndex; i++) {
      if (
        tree[i] &&
        tree[i].depth === dropDepth &&
        (tree[i].project.parent_project_id ?? null) === newParentId &&
        tree[i].project.id !== draggedId
      ) {
        siblingIndex++;
      }
    }

    sortOrder = siblingIndex;

    // Update sort orders: shift siblings after this position
    const updates: Promise<void>[] = [];
    for (let i = siblingIndex; i < siblings.length; i++) {
      if (siblings[i].project.sort_order <= sortOrder + i) {
        updates.push(
          store.moveProject(siblings[i].project.id, newParentId, i + 1),
        );
      }
    }

    await store.moveProject(draggedId, newParentId, sortOrder);
  }

  private _startResize(e: MouseEvent) {
    e.preventDefault();
    this._isResizing = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(400, ev.clientX));
      this._sidebarWidth = newWidth;
    };
    const onMouseUp = () => {
      this._isResizing = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  override connectedCallback() {
    super.connectedCallback();
    const saved = globalThis.localStorage?.getItem("tasks:sidebarWidth");
    if (saved) this._sidebarWidth = parseInt(saved, 10) || 256;
  }

  override updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (changed.has("_sidebarWidth")) {
      try {
        globalThis.localStorage?.setItem(
          "tasks:sidebarWidth",
          String(this._sidebarWidth),
        );
      } catch {
        // localStorage may not be available
      }
    }
  }

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
      background: var(--md-sys-color-surface-container-low);
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
        position: relative;
        transform: none;
        height: 100%;
      }
    }

    .resize-handle {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      cursor: col-resize;
      background: transparent;
      transition: background 0.15s;
      z-index: 10;
    }

    .resize-handle:hover,
    .resize-handle.active {
      background: var(--md-sys-color-primary);
    }

    .user-section {
      padding: 8px;
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

    .divider {
      margin: 4px 12px;
      border: none;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .nav-button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border: none;
      border-radius: var(--md-sys-shape-corner-small);
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      text-align: left;
      color: var(--md-sys-color-on-surface-variant);
      transition: background-color 0.15s;
      overflow: hidden;
    }

    .nav-button-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .nav-button:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    .nav-button.active {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .nav-button.add-task {
      color: var(--md-sys-color-on-surface-variant);
    }

    .nav-button m3e-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .count {
      font-size: 12px;
      color: var(--md-sys-color-outline);
      flex-shrink: 0;
    }

    .section {
      padding: 4px 8px;
    }

    .section-header {
      display: flex;
      align-items: center;
      padding: 6px 12px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--md-sys-color-outline);
      flex: 1;
    }

    .section-actions {
      display: flex;
      align-items: center;
      gap: 0;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .section-header:hover .section-actions {
      opacity: 1;
    }

    .section-action {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--md-sys-color-outline);
      padding: 0;
      outline: none;
      transition: background-color 0.15s;
    }

    .section-action:hover {
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface-variant);
    }

    .section-action m3e-icon {
      font-size: 16px;
      transition: transform 0.15s;
    }

    .section-action.collapsed m3e-icon {
      transform: rotate(180deg);
    }

    .item-row {
      display: flex;
      align-items: center;
    }

    .item-row .nav-button {
      flex: 1;
    }

    .rank-controls {
      display: flex;
      flex-direction: column;
      gap: 0;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .item-row:hover .rank-controls {
      opacity: 1;
    }

    .rank-btn {
      background: none;
      border: none;
      padding: 0 4px;
      font-size: 10px;
      line-height: 1;
      cursor: pointer;
      color: var(--md-sys-color-outline);
      border-radius: 4px;
    }

    .rank-btn:hover:not(:disabled) {
      color: var(--md-sys-color-on-surface);
      background: var(--md-sys-color-surface-container-high);
    }

    .rank-btn:disabled {
      opacity: 0.3;
      cursor: default;
    }

    .color-dot {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .color-dot::after {
      content: "";
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--dot-color);
    }

    .collapse-indicator {
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 50%;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.15s, background-color 0.15s;
      color: var(--md-sys-color-outline);
      flex-shrink: 0;
      cursor: pointer;
      padding: 0;
      outline: none;
    }

    .nav-button:hover .collapse-indicator {
      opacity: 1;
    }

    .collapse-indicator:hover {
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface-variant);
    }

    .collapse-indicator m3e-icon {
      font-size: 16px;
      transition: transform 0.15s;
    }

    .collapse-indicator.collapsed m3e-icon {
      transform: rotate(180deg);
    }

    .item-row.dragging {
      opacity: 0.4;
    }

    .drop-indicator {
      height: 2px;
      background: var(--md-sys-color-primary);
      border-radius: 1px;
      pointer-events: none;
      position: relative;
    }

    .drop-indicator::before {
      content: "";
      position: absolute;
      left: 0;
      top: -3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--md-sys-color-primary);
    }

    .section.scrollable {
      flex: 1;
      overflow-y: auto;
    }

    .bottom-section {
      padding: 8px;
    }
  `;

  override render() {
    const indent = (depth: number) => Math.min(depth, 4) * 16;

    return html`
      <aside
        class="${store.sidebarOpen ? "open" : ""}"
        style="width: ${this._sidebarWidth}px"
      >
        <div
          class="resize-handle ${this._isResizing ? "active" : ""}"
          @mousedown="${this._startResize}"
        >
        </div>

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
            <span class="user-name">${store.user?.name || store.user?.email ||
              "User"}</span>
          </div>
        </div>

        <hr class="divider" />

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button
            class="nav-button ${store.currentTab === "next" ? "active" : ""}"
            @click="${() => store.navigate("next")}"
          >
            <m3e-icon name="double_arrow" variant="rounded"></m3e-icon>
            <span class="nav-button-label">${NAV_LABELS.next}</span>
          </button>

          <button
            class="nav-button ${store.currentTab === "inbox" ? "active" : ""}"
            @click="${() => store.navigate("inbox")}"
          >
            <m3e-icon name="inbox" variant="rounded"></m3e-icon>
            <span class="nav-button-label">${NAV_LABELS.inbox}</span>
            ${store.inboxCount > 0
              ? html`
                <span class="count">${store.inboxCount}</span>
              `
              : null}
          </button>

          <button
            class="nav-button"
            @click="${() => {
              store.setShowSearch(true);
              store.setSidebarOpen(false);
            }}"
          >
            <m3e-icon name="search" variant="rounded"></m3e-icon>
            <span class="nav-button-label">${NAV_LABELS.search}</span>
          </button>

          <button
            class="nav-button add-task"
            @click="${() => {
              store.setShowTaskForm(true);
              store.setSidebarOpen(false);
            }}"
          >
            <m3e-icon name="add" variant="rounded"></m3e-icon>
            <span class="nav-button-label">${NAV_LABELS.addTask}</span>
          </button>
        </div>

        <hr class="divider" />

        <!-- Scrollable middle: Filters + Projects + Contexts -->
        <div class="section scrollable">
          <!-- Filters -->
          <div class="section-header">
            <span class="section-title">${SECTION_LABELS.filters}</span>
            <div class="section-actions">
              <button
                class="section-action"
                @click="${() => store.setShowFilterForm(true)}"
              >
                <m3e-icon name="add" variant="rounded"></m3e-icon>
              </button>
              <button
                class="section-action ${store.collapsedSections.has("filters")
                  ? "collapsed"
                  : ""}"
                @click="${() => store.toggleSectionCollapse("filters")}"
              >
                <m3e-icon name="expand_more" variant="rounded"></m3e-icon>
              </button>
            </div>
          </div>
          ${!store.collapsedSections.has("filters")
            ? html`
              ${store.savedFilters.map(
                (f) =>
                  html`
                    <button
                      class="nav-button ${store.currentTab === "filter" &&
                          store.selectedFilterId === f.id
                        ? "active"
                        : ""}"
                      @click="${() => store.navigate("filter", f.id)}"
                    >
                      <span
                        class="color-dot"
                        style="--dot-color: ${f.color ||
                          "var(--md-sys-color-tertiary)"}"
                      ></span>
                      <span class="nav-button-label">${f.name}</span>
                    </button>
                  `,
              )}
            `
            : null}

          <hr class="divider" />

          <!-- Projects -->
          <div class="section-header">
            <span class="section-title">${SECTION_LABELS.projects}</span>
            <div class="section-actions">
              <button
                class="section-action"
                @click="${() => store.setShowProjectForm(true)}"
              >
                <m3e-icon name="add" variant="rounded"></m3e-icon>
              </button>
              <button
                class="section-action ${store.collapsedSections.has("projects")
                  ? "collapsed"
                  : ""}"
                @click="${() => store.toggleSectionCollapse("projects")}"
              >
                <m3e-icon name="expand_more" variant="rounded"></m3e-icon>
              </button>
            </div>
          </div>
          ${!store.collapsedSections.has("projects")
            ? html`
              <div
                class="project-list"
                @dragover="${(e: DragEvent) =>
                  this._handleProjectListDragOver(e)}"
                @dragleave="${(e: DragEvent) =>
                  this._handleProjectListDragLeave(e)}"
                @drop="${(e: DragEvent) => this._handleProjectListDrop(e)}"
              >
                ${store.projectTree.map(
                  ({ project, depth }, index) =>
                    html`
                      ${this._dropIndex === index
                        ? html`
                          <div
                            class="drop-indicator"
                            style="margin-left: ${indent(this._dropDepth)}px"
                          >
                          </div>
                        `
                        : null}
                      <div
                        class="item-row ${this._draggingId === project.id
                          ? "dragging"
                          : ""}"
                        draggable="true"
                        @dragstart="${(e: DragEvent) =>
                          this._handleDragStart(e, project.id)}"
                        @dragend="${() => this._handleDragEnd()}"
                        style="padding-left: ${indent(depth)}px"
                      >
                        <button
                          class="nav-button ${store.currentTab === "project" &&
                              store.selectedProjectId === project.id
                            ? "active"
                            : ""}"
                          @click="${() =>
                            store.navigate("project", project.id)}"
                        >
                          <span
                            class="color-dot"
                            style="--dot-color: ${project.color || "#4caf50"}"
                          ></span>
                          <span class="nav-button-label">${project.name}</span>
                          ${store.hasChildren(project.id)
                            ? html`
                              <button
                                class="collapse-indicator ${store
                                    .collapsedProjectIds.has(
                                      project.id,
                                    )
                                  ? "collapsed"
                                  : ""}"
                                @click="${(e: Event) => {
                                  e.stopPropagation();
                                  store.toggleCollapse(project.id);
                                }}"
                              >
                                <m3e-icon
                                  name="expand_more"
                                  variant="rounded"
                                ></m3e-icon>
                              </button>
                            `
                            : null} ${project.task_count
                            ? html`
                              <span class="count">${project.task_count}</span>
                            `
                            : null}
                        </button>
                      </div>
                    `,
                )} ${this._dropIndex === store.projectTree.length
                  ? html`
                    <div
                      class="drop-indicator"
                      style="margin-left: ${indent(this._dropDepth)}px"
                    >
                    </div>
                  `
                  : null}
              </div>
            `
            : null}

          <hr class="divider" />

          <!-- Contexts -->
          <div class="section-header">
            <span class="section-title">${SECTION_LABELS.contexts}</span>
            <div class="section-actions">
              <button
                class="section-action"
                @click="${() => store.setShowContextForm(true)}"
              >
                <m3e-icon name="add" variant="rounded"></m3e-icon>
              </button>
              <button
                class="section-action ${store.collapsedSections.has("contexts")
                  ? "collapsed"
                  : ""}"
                @click="${() => store.toggleSectionCollapse("contexts")}"
              >
                <m3e-icon name="expand_more" variant="rounded"></m3e-icon>
              </button>
            </div>
          </div>
          ${!store.collapsedSections.has("contexts")
            ? html`
              ${store.contexts.map(
                (context, index) =>
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
                          style="--dot-color: ${context.color || "#F48FB1"}"
                        ></span>
                        <span class="nav-button-label">${context.name}</span>
                      </button>
                      <span class="rank-controls">
                        <button
                          class="rank-btn"
                          ?disabled="${index === 0}"
                          @click="${(e: Event) => {
                            e.stopPropagation();
                            const ids = store.contexts.map((c) => c.id);
                            [ids[index - 1], ids[index]] = [
                              ids[index],
                              ids[index - 1],
                            ];
                            store.reorderContexts(ids);
                          }}"
                        >
                          ▲
                        </button>
                        <button
                          class="rank-btn"
                          ?disabled="${index === store.contexts.length - 1}"
                          @click="${(e: Event) => {
                            e.stopPropagation();
                            const ids = store.contexts.map((c) => c.id);
                            [ids[index], ids[index + 1]] = [
                              ids[index + 1],
                              ids[index],
                            ];
                            store.reorderContexts(ids);
                          }}"
                        >
                          ▼
                        </button>
                      </span>
                    </div>
                  `,
              )}
            `
            : null}
        </div>

        <hr class="divider" />

        <!-- Bottom Links -->
        <div class="bottom-section">
          <button
            class="nav-button ${store.currentTab === "history" ? "active" : ""}"
            @click="${() => store.navigate("history")}"
          >
            <m3e-icon name="history" variant="rounded"></m3e-icon>
            <span class="nav-button-label">${NAV_LABELS.history}</span>
          </button>
          <button
            class="nav-button ${store.currentTab === "settings"
              ? "active"
              : ""}"
            @click="${() => store.navigate("settings")}"
          >
            <m3e-icon name="settings" variant="rounded"></m3e-icon>
            <span class="nav-button-label">${NAV_LABELS.settings}</span>
          </button>
        </div>
      </aside>
    `;
  }
}
