import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

/** Form body for adding a pasted kubeconfig document. */
function renderAddKubeconfigForm(): string {
  return `<form id="add-config-form">
    <label class="field-label" for="new-config-name">Configuration name</label>
    <input class="dialog-input" id="new-config-name" placeholder="My cluster" value="New cluster">
    <label class="field-label" for="new-config-yaml">Kubeconfig YAML</label>
    <textarea id="new-config-yaml" placeholder="apiVersion: v1&#10;kind: Config&#10;contexts:&#10;  - name: my-context" required></textarea>
    <p class="dialog-error" id="config-error" role="alert"></p>
    <footer>
      <button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
      <button type="button" class="button primary" data-action="validate-add-config">Validate &amp; add</button>
    </footer>
  </form>`;
}

/** Modal dialog wrapper. */
export function renderDialog(s: RenderState): string {
  if (!s.dialog) return "";
  return `<div class="dialog-backdrop">
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <header>
        <div>
          <div class="eyebrow">CLUSTER CONFIGURATION</div>
          <h2 id="dialog-title">Add kubeconfig</h2>
          <p>Paste a kubeconfig YAML document to add its contexts to Orbita.</p>
        </div>
        <button class="icon-button" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button>
      </header>
      ${renderAddKubeconfigForm()}
    </section>
  </div>`;
}

defineComponent("orbita-dialog", renderDialog);
