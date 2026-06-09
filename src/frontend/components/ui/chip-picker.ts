// Reusable chip picker component
// A searchable multi-select input that displays selected items as removable chips
// with a dropdown suggestion list for available options.

import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface ChipPickerItem {
  id: string;
  name: string;
  color?: string;
}

@customElement("chip-picker")
export class ChipPicker extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .chip-input {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      background: var(--md-sys-color-surface);
      cursor: text;
      min-height: 44px;
    }

    .chip-input:focus-within {
      border-color: var(--md-sys-color-primary);
      outline: 1px solid var(--md-sys-color-primary);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      border: none;
    }

    .chip.selected {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 1px;
    }

    .chip button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .chip button:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    .chip-input input {
      flex: 1;
      min-width: 100px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      font-family: inherit;
      padding: 4px 0;
    }

    .suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: 8px;
      box-shadow: var(--md-sys-elevation-level2);
      max-height: 200px;
      overflow-y: auto;
      z-index: 10;
    }

    .suggestions button {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }

    .suggestions button.highlighted {
      background: var(--md-sys-color-surface-container-highest);
    }
  `;

  /** All available items to choose from */
  @property({ type: Array })
  accessor items: ChipPickerItem[] = [];

  /** Currently selected item IDs */
  @property({ type: Array })
  accessor selectedIds: string[] = [];

  /** Placeholder text for the input */
  @property()
  accessor placeholder = "add...";

  /** Default color for chips without a color property */
  @property()
  accessor defaultColor = "#4caf50";

  @state()
  private accessor _query = "";

  @state()
  private accessor _showSuggestions = false;

  @state()
  private accessor _highlightedIndex = -1;

  @state()
  private accessor _selectedChipIndex = -1;

  private _blurTimeout: ReturnType<typeof setTimeout> | null = null;

  private get _availableItems(): ChipPickerItem[] {
    return this.items.filter((item) => !this.selectedIds.includes(item.id));
  }

  private get _filteredItems(): ChipPickerItem[] {
    const available = this._availableItems;
    if (!this._query) return available;
    const q = this._query.toLowerCase();
    return available.filter((item) => item.name.toLowerCase().includes(q));
  }

  private _handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this._query = input.value;
    this._showSuggestions = true;
    this._highlightedIndex = 0;
  }

  private _handleBlur = () => {
    this._blurTimeout = setTimeout(() => {
      this._showSuggestions = false;
      this._highlightedIndex = -1;
      this._blurTimeout = null;
    }, 150);
  };

  private _handleFocus() {
    if (this._blurTimeout) {
      clearTimeout(this._blurTimeout);
      this._blurTimeout = null;
    }
    this._showSuggestions = true;
    this._highlightedIndex = 0;
  }

  private _selectItem(id: string) {
    if (this.selectedIds.includes(id)) return;
    const newIds = [...this.selectedIds, id];
    this._emitChange(newIds);

    this._query = "";
    this._highlightedIndex = 0;

    if (this._blurTimeout) {
      clearTimeout(this._blurTimeout);
      this._blurTimeout = null;
    }

    this._showSuggestions = this.items.some((i) => !newIds.includes(i.id));
    this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector<HTMLInputElement>(
        ".chip-input input",
      );
      if (input) {
        input.value = "";
        input.focus();
      }
    });
  }

  private _removeItem(id: string) {
    const newIds = this.selectedIds.filter((i) => i !== id);
    this._emitChange(newIds);
  }

  private _handleKeydown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement;
    const filtered = this._filteredItems;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._highlightedIndex = Math.min(
        this._highlightedIndex + 1,
        filtered.length - 1,
      );
      this._selectedChipIndex = -1;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this._highlightedIndex = Math.max(this._highlightedIndex - 1, -1);
      this._selectedChipIndex = -1;
    } else if (e.key === "Enter" && this._highlightedIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      const item = filtered[this._highlightedIndex];
      if (item) this._selectItem(item.id);
    } else if (
      e.key === "Enter" &&
      this._showSuggestions &&
      filtered.length > 0
    ) {
      e.preventDefault();
      e.stopPropagation();
      this._selectItem(filtered[0].id);
    } else if (e.key === "Tab" && this._showSuggestions) {
      this._showSuggestions = false;
      this._highlightedIndex = -1;
    } else if (
      e.key === "ArrowLeft" &&
      input.selectionStart === 0 &&
      this.selectedIds.length > 0
    ) {
      e.preventDefault();
      if (this._selectedChipIndex === -1) {
        this._selectedChipIndex = this.selectedIds.length - 1;
      } else if (this._selectedChipIndex > 0) {
        this._selectedChipIndex--;
      } else {
        this._selectedChipIndex = -1;
      }
    } else if (e.key === "ArrowRight" && this._selectedChipIndex >= 0) {
      e.preventDefault();
      if (this._selectedChipIndex < this.selectedIds.length - 1) {
        this._selectedChipIndex++;
      } else {
        this._selectedChipIndex = -1;
      }
    } else if (
      e.key === "Backspace" &&
      input.value === "" &&
      this.selectedIds.length > 0
    ) {
      e.preventDefault();
      const removeIndex = this._selectedChipIndex >= 0
        ? this._selectedChipIndex
        : this.selectedIds.length - 1;
      const newIds = this.selectedIds.filter((_, i) => i !== removeIndex);
      this._emitChange(newIds);
      if (this._selectedChipIndex >= 0) {
        this._selectedChipIndex = Math.min(
          this._selectedChipIndex,
          newIds.length - 1,
        );
        if (newIds.length === 0) this._selectedChipIndex = -1;
      }
    } else {
      this._selectedChipIndex = -1;
    }
  }

  private _emitChange(newIds: string[]) {
    this.dispatchEvent(
      new CustomEvent("change", { detail: { selectedIds: newIds } }),
    );
  }

  override render() {
    const availableItems = this._availableItems;

    return html`
      <div
        class="chip-input"
        @click="${() =>
          this.renderRoot
            .querySelector<HTMLInputElement>(".chip-input input")
            ?.focus()}"
      >
        ${this.selectedIds.map((id, idx) => {
          const item = this.items.find((i) => i.id === id);
          const color = item?.color || this.defaultColor;
          return item
            ? html`
              <span
                class="chip ${idx === this._selectedChipIndex
                  ? "selected"
                  : ""}"
                style="background: ${color}"
              >
                ${item.name}
                <button
                  type="button"
                  tabindex="-1"
                  @click="${() => this._removeItem(id)}"
                >
                  ×
                </button>
              </span>
            `
            : nothing;
        })} ${availableItems.length > 0
          ? html`
            <input
              type="text"
              autocomplete="off"
              placeholder="${this.placeholder}"
              @input="${this._handleInput}"
              @focus="${this._handleFocus}"
              @keydown="${this._handleKeydown}"
              @blur="${this._handleBlur}"
            />
          `
          : html`
            <input
              type="text"
              autocomplete="off"
              readonly
              @focus="${this._handleFocus}"
              @keydown="${this._handleKeydown}"
              @blur="${this._handleBlur}"
            />
          `} ${this._showSuggestions && this._filteredItems.length > 0
          ? html`
            <div class="suggestions">
              ${this._filteredItems.map(
                (item, i) =>
                  html`
                    <button
                      type="button"
                      class="${i === this._highlightedIndex
                        ? "highlighted"
                        : ""}"
                      @mouseenter="${() => {
                        this._highlightedIndex = i;
                      }}"
                      @mouseleave="${() => {
                        this._highlightedIndex = -1;
                      }}"
                      @mousedown="${(e: MouseEvent) => {
                        e.preventDefault();
                        this._selectItem(item.id);
                      }}"
                    >
                      ${item.name}
                    </button>
                  `,
              )}
            </div>
          `
          : nothing}
      </div>
    `;
  }
}
