import { hydrateIcons } from "./icons.js";

function applyPreviewDomState(store) {
  const state = store.getState();
  const viewport = document.getElementById("spreadViewport");
  viewport.classList.toggle("preview-mode", state.document.settings.preview.enabled);
  document.body.dataset.previewCmyk = state.document.settings.preview.cmyk ? "true" : "false";
  document.body.dataset.previewBw = state.document.settings.preview.bw ? "true" : "false";
}

export function initPrintPreviewModule(store, refs) {
  const exportPanel = refs.exportPanel;

  function render() {
    const { document: doc } = store.getState();
    const preview = doc.settings.preview;

    exportPanel.innerHTML = `
      <section class="style-item" id="previewControlCard">
        <div class="row-between"><strong>Preview Print</strong><small>Mode aperçu spécial</small></div>
        <div class="grid-2">
          <label class="field"><span><input type="checkbox" name="previewEnabled" ${preview.enabled ? "checked" : ""}/> Aperçu actif</span></label>
          <label class="field"><span><input type="checkbox" name="bleedVisible" ${doc.settings.bleedVisible ? "checked" : ""}/> Bleed visible</span></label>
          <label class="field"><span><input type="checkbox" name="safeVisible" ${doc.settings.safeVisible ? "checked" : ""}/> Zone safe visible</span></label>
          <label class="field"><span><input type="checkbox" name="previewCmyk" ${preview.cmyk ? "checked" : ""}/> Simulation CMYK</span></label>
          <label class="field"><span><input type="checkbox" name="previewBw" ${preview.bw ? "checked" : ""}/> Noir & blanc</span></label>
          <label class="field"><span><input type="checkbox" name="paperSimulation" ${preview.paperSimulation ? "checked" : ""}/> Simulation papier</span></label>
        </div>
        <div class="inline-actions">
          <button class="tool-btn" data-action="previewToggleBtn" data-tool="printPreview" title="Activer/Désactiver aperçu"></button>
          <button class="tool-btn" data-action="previewZoom100" data-tool="zoomIn" title="Zoom 100%"></button>
        </div>
      </section>
      <section id="checklistMount"></section>
      <section id="exportMount"></section>
    `;

    const card = exportPanel.querySelector("#previewControlCard");
    card.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        store.commit("preview-settings", (draft) => {
          draft.document.settings.preview.enabled = card.querySelector("[name='previewEnabled']").checked;
          draft.document.settings.bleedVisible = card.querySelector("[name='bleedVisible']").checked;
          draft.document.settings.safeVisible = card.querySelector("[name='safeVisible']").checked;
          draft.document.settings.preview.cmyk = card.querySelector("[name='previewCmyk']").checked;
          draft.document.settings.preview.bw = card.querySelector("[name='previewBw']").checked;
          draft.document.settings.preview.paperSimulation = card.querySelector("[name='paperSimulation']").checked;
        }, { trackHistory: false });
      });
    });

    card.querySelector('[data-action="previewToggleBtn"]').addEventListener("click", () => {
      store.commit("preview-toggle", (draft) => {
        draft.document.settings.preview.enabled = !draft.document.settings.preview.enabled;
      }, { trackHistory: false });
    });

    card.querySelector('[data-action="previewZoom100"]').addEventListener("click", () => {
      store.commit("preview-zoom-100", (draft) => {
        draft.view.zoom = 1;
      }, { trackHistory: false });
    });

    hydrateIcons(exportPanel);
    applyPreviewDomState(store);
  }

  store.subscribe("state:changed", () => {
    render();
    applyPreviewDomState(store);
  });

  render();
  applyPreviewDomState(store);

  return {
    togglePreview() {
      store.commit("toggle-preview", (draft) => {
        draft.document.settings.preview.enabled = !draft.document.settings.preview.enabled;
      }, { trackHistory: false });
      applyPreviewDomState(store);
    }
  };
}
