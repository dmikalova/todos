// Base component with store subscription for reactivity

import { LitElement } from "lit";
import { store } from "./store.ts";

export class StoreElement extends LitElement {
  private unsubscribe?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = store.subscribe(() => this.requestUpdate());
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }
}
