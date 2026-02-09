import { getFormatDimensions } from "../core/document.js";
import { hydrateIcons } from "./icons.js";

function valueOrFallback(value, fallback = "") {
  return value ?? fallback;
}

function buildBookSettingsForm(draftState, autoApply) {
  const draft = draftState.current;
  const size = getFormatDimensions(draft.format, draft.customSize, draft.orientation);
  const dirtyCount = draftState.dirtyFields.length;
  const customFormatActive = Boolean(draftState.meta?.customFormatActive);
  const lastPreset = draftState.meta?.lastPreset || "A4";

  const userPresets = draft.marginPresets || [];

  return `
    <form id="bookSettingsForm" novalidate>
      <article class="style-item">
        <div class="book-settings-draft-bar">
          <span class="pending-badge ${dirtyCount ? "pending" : "clean"}">
            ${dirtyCount ? `Modifications en attente (${dirtyCount})` : "Aucune modification en attente"}
          </span>
          <label class="field"><span><input type="checkbox" name="autoApply" ${autoApply ? "checked" : ""}/> Appliquer automatiquement</span></label>
          <div class="inline-actions">
            <button class="tool-btn" data-action="applyDraft" data-tool="save" title="Appliquer les modifications" ${dirtyCount ? "" : "disabled"}></button>
            <button class="tool-btn" data-action="cancelDraft" data-tool="close" title="Annuler les modifications" ${dirtyCount ? "" : "disabled"}></button>
          </div>
        </div>
      </article>

      <article class="style-item">
        <div class="row-between">
          <strong>Format & pagination</strong>
          <small>${size.width}×${size.height} mm</small>
        </div>
        <div class="row-between">
          <span class="status-pill ${customFormatActive ? "warning" : "ok"}">
            ${customFormatActive ? "format personnalisé" : `preset: ${draft.format}`}
          </span>
          <small>preset mémorisé: ${lastPreset}</small>
        </div>
        <div class="grid-2">
          <label class="field">Format
            <select name="format" data-path="format">
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
              <option value="Square">Square</option>
              <option value="Digest">Digest</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label class="field">Orientation
            <select name="orientation" data-path="orientation">
              <option value="portrait">Portrait</option>
              <option value="landscape">Paysage</option>
            </select>
          </label>
        </div>
        <div class="grid-2">
          <label class="field">Largeur (mm)
            <input type="number" step="0.1" name="customWidth" data-path="customSize.width" value="${valueOrFallback(draft.customSize.width, 210)}" />
          </label>
          <label class="field">Hauteur (mm)
            <input type="number" step="0.1" name="customHeight" data-path="customSize.height" value="${valueOrFallback(draft.customSize.height, 297)}" />
          </label>
        </div>
        <div class="grid-2">
          <label class="field">Unités
            <select name="unit" data-path="unit">
              <option value="mm">mm</option>
              <option value="pt">pt</option>
              <option value="in">in</option>
              <option value="px">px</option>
            </select>
          </label>
          <label class="field">DPI
            <input type="number" min="72" max="600" name="dpi" data-path="dpi" value="${valueOrFallback(draft.dpi, 96)}" />
          </label>
        </div>
        <div class="grid-2">
          <label class="field"><span><input type="checkbox" name="startOnRight" data-path="startOnRight" ${draft.startOnRight ? "checked" : ""}/> Commencer sur page droite (recto)</span></label>
          <label class="field"><span><input type="checkbox" name="safeVisible" data-path="safeVisible" ${draft.safeVisible ? "checked" : ""}/> Zone safe visible</span></label>
          <label class="field"><span><input type="checkbox" name="bleedVisible" data-path="bleedVisible" ${draft.bleedVisible ? "checked" : ""}/> Bleed visible</span></label>
        </div>
      </article>

      <article class="style-item">
        <div class="row-between"><strong>Marges & tranche</strong><small>Overlays non imprimés</small></div>
        <div class="grid-2">
          <label class="field">Haut<input type="number" step="0.1" name="marginTop" data-path="margins.top" value="${valueOrFallback(draft.margins.top, 15)}" /></label>
          <label class="field">Bas<input type="number" step="0.1" name="marginBottom" data-path="margins.bottom" value="${valueOrFallback(draft.margins.bottom, 20)}" /></label>
          <label class="field">Intérieur<input type="number" step="0.1" name="marginInside" data-path="margins.inside" value="${valueOrFallback(draft.margins.inside, 18)}" /></label>
          <label class="field">Extérieur<input type="number" step="0.1" name="marginOutside" data-path="margins.outside" value="${valueOrFallback(draft.margins.outside, 15)}" /></label>
          <label class="field">Tranche<input type="number" step="0.1" name="marginSpine" data-path="margins.spine" value="${valueOrFallback(draft.margins.spine, 4)}" /></label>
          <label class="field">Comp. pair/impair<input type="number" step="0.1" name="oddEvenComp" data-path="margins.oddEvenCompensation" value="${valueOrFallback(draft.margins.oddEvenCompensation, 0)}" /></label>
          <label class="field">Bleed<input type="number" step="0.1" name="bleed" data-path="bleed" value="${valueOrFallback(draft.bleed, 3)}" /></label>
          <label class="field">Safe area<input type="number" step="0.1" name="safeArea" data-path="safeArea" value="${valueOrFallback(draft.safeArea, 5)}" /></label>
        </div>
      </article>

      <article class="style-item">
        <div class="row-between"><strong>Système visuel des marges</strong><small>Lisibilité pro</small></div>
        <div class="grid-3">
          <label class="field">Preset visuel
            <select name="marginVisualPreset" data-path="margins.visual.preset">
              <option value="edition">édition</option>
              <option value="printPreview">print preview</option>
              <option value="debug">debug</option>
            </select>
          </label>
          <label class="field">Mode
            <select name="marginVisualMode" data-path="margins.visual.mode">
              <option value="simple">Simple</option>
              <option value="advanced">Avancé</option>
            </select>
          </label>
          <label class="field">Afficher overlays
            <select name="marginsVisible" data-path="margins.visible">
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label class="field">Opacité ${Math.round(Number(draft.margins.visual.opacity || 0.2) * 100)}%
            <input type="range" min="0.05" max="0.45" step="0.01" name="marginOpacity" data-path="margins.visual.opacity" value="${valueOrFallback(draft.margins.visual.opacity, 0.2)}" />
          </label>
          <label class="field">Trait (px)<input type="number" min="1" max="5" step="1" name="marginStroke" data-path="margins.visual.stroke" value="${valueOrFallback(draft.margins.visual.stroke, 1)}" /></label>
          <label class="field">Style ligne
            <select name="marginLineStyle" data-path="margins.visual.lineStyle">
              <option value="solid">Plein</option>
              <option value="dashed">Pointillé</option>
            </select>
          </label>
        </div>

        <div class="grid-3">
          <label class="field"><span><input type="checkbox" data-path="margins.visual.show.inside" ${draft.margins.visual.show.inside ? "checked" : ""}/> inside</span></label>
          <label class="field"><span><input type="checkbox" data-path="margins.visual.show.outside" ${draft.margins.visual.show.outside ? "checked" : ""}/> outside</span></label>
          <label class="field"><span><input type="checkbox" data-path="margins.visual.show.top" ${draft.margins.visual.show.top ? "checked" : ""}/> top</span></label>
          <label class="field"><span><input type="checkbox" data-path="margins.visual.show.bottom" ${draft.margins.visual.show.bottom ? "checked" : ""}/> bottom</span></label>
          <label class="field"><span><input type="checkbox" data-path="margins.visual.show.bleed" ${draft.margins.visual.show.bleed ? "checked" : ""}/> bleed</span></label>
          <label class="field"><span><input type="checkbox" data-path="margins.visual.show.safe" ${draft.margins.visual.show.safe ? "checked" : ""}/> safe</span></label>
        </div>

        <div class="grid-3">
          <label class="field">Couleur unique<input type="color" data-path="margins.visual.colors.all" value="${valueOrFallback(draft.margins.visual.colors.all, "#c9793b")}" /></label>
          <label class="field">Top<input type="color" data-path="margins.visual.colors.top" value="${valueOrFallback(draft.margins.visual.colors.top, "#c9793b")}" /></label>
          <label class="field">Bottom<input type="color" data-path="margins.visual.colors.bottom" value="${valueOrFallback(draft.margins.visual.colors.bottom, "#b86f37")}" /></label>
          <label class="field">Inside<input type="color" data-path="margins.visual.colors.inside" value="${valueOrFallback(draft.margins.visual.colors.inside, "#9d5c2f")}" /></label>
          <label class="field">Outside<input type="color" data-path="margins.visual.colors.outside" value="${valueOrFallback(draft.margins.visual.colors.outside, "#d4975f")}" /></label>
          <label class="field">Bleed<input type="color" data-path="margins.visual.colors.bleed" value="${valueOrFallback(draft.margins.visual.colors.bleed, "#b96767")}" /></label>
          <label class="field">Safe<input type="color" data-path="margins.visual.colors.safe" value="${valueOrFallback(draft.margins.visual.colors.safe, "#4f8d6f")}" /></label>
        </div>

        <div class="inline-actions">
          <button class="tool-btn" data-action="applyVisualPreset" data-tool="settings" title="Appliquer preset visuel"></button>
          <button class="tool-btn" data-action="saveMarginPreset" data-tool="save" title="Sauvegarder preset utilisateur"></button>
          <label class="field" style="min-width:180px;">Preset utilisateur
            <select name="userMarginPreset">
              ${userPresets.length ? userPresets.map((preset, index) => `<option value="${index}">${preset.name}</option>`).join("") : "<option value=\"\">Aucun</option>"}
            </select>
          </label>
          <button class="tool-btn" data-action="loadMarginPreset" data-tool="bookSettings" title="Charger preset utilisateur" ${userPresets.length ? "" : "disabled"}></button>
        </div>
      </article>
    </form>
  `;
}

function markDirtyFields(form, dirtyFields) {
  const dirtySet = new Set(dirtyFields);
  form.querySelectorAll("[data-path]").forEach((field) => {
    const path = field.dataset.path;
    const isDirty = dirtySet.has(path);
    field.classList.toggle("dirty-field", isDirty);
    const wrapper = field.closest(".field");
    if (wrapper) {
      wrapper.classList.toggle("field-dirty", isDirty);
    }
  });
}

function bindDraftInteractions(store, draftController, container, draftState) {
  const form = container.querySelector("#bookSettingsForm");
  if (!form) {
    return;
  }

  const draft = draftState.current;
  form.format.value = draft.format;
  form.orientation.value = draft.orientation;
  form.unit.value = draft.unit;
  form.marginVisualPreset.value = draft.margins.visual.preset || "edition";
  form.marginVisualMode.value = draft.margins.visual.mode || "simple";
  form.marginsVisible.value = String(draft.margins.visible);
  form.marginLineStyle.value = draft.margins.visual.lineStyle || "solid";

  const applyInputChange = (field) => {
    const path = field.dataset.path;
    if (!path) {
      return;
    }

    let nextValue;
    if (field.type === "checkbox") {
      nextValue = field.checked;
    } else if (field.type === "number" || field.type === "range") {
      nextValue = Number(field.value);
    } else if (field.tagName === "SELECT" && field.name === "marginsVisible") {
      nextValue = field.value === "true";
    } else {
      nextValue = field.value;
    }

    draftController.updateField(path, nextValue);
  };

  form.querySelectorAll("[data-path]").forEach((field) => {
    const liveNumber =
      field.dataset.path === "customSize.width" || field.dataset.path === "customSize.height";
    const evt = field.type === "range" || liveNumber ? "input" : "change";
    field.addEventListener(evt, () => applyInputChange(field));
  });

  form.autoApply.addEventListener("change", () => {
    draftController.setAutoApply(form.autoApply.checked);
  });

  form.querySelector('[data-action="applyDraft"]').addEventListener("click", (event) => {
    event.preventDefault();
    draftController.apply();
  });

  form.querySelector('[data-action="cancelDraft"]').addEventListener("click", (event) => {
    event.preventDefault();
    draftController.cancel();
  });

  form.querySelector('[data-action="applyVisualPreset"]').addEventListener("click", (event) => {
    event.preventDefault();
    draftController.updateField("margins.visual.preset", form.marginVisualPreset.value);
  });

  form.querySelector('[data-action="saveMarginPreset"]').addEventListener("click", (event) => {
    event.preventDefault();
    const current = draftController.getDraftState().current;
    const presets = current.marginPresets || [];
    const nextPreset = {
      name: `Preset ${presets.length + 1}`,
      margins: structuredClone(current.margins),
      bleed: current.bleed,
      safeArea: current.safeArea,
      bleedVisible: current.bleedVisible,
      safeVisible: current.safeVisible
    };
    draftController.updateField("marginPresets", [...presets, nextPreset]);
  });

  form.querySelector('[data-action="loadMarginPreset"]').addEventListener("click", (event) => {
    event.preventDefault();
    const current = draftController.getDraftState().current;
    const presetIndex = Number(form.userMarginPreset.value || -1);
    const preset = current.marginPresets?.[presetIndex];
    if (!preset) {
      return;
    }
    draftController.updateField("margins", structuredClone(preset.margins));
    draftController.updateField("bleed", Number(preset.bleed));
    draftController.updateField("safeArea", Number(preset.safeArea));
    draftController.updateField("bleedVisible", Boolean(preset.bleedVisible));
    draftController.updateField("safeVisible", Boolean(preset.safeVisible));
  });

  markDirtyFields(form, draftState.dirtyFields);
}

export function initBookSettingsModule(store, refs, draftController) {
  const container = refs.bookSettingsPanel;

  const render = () => {
    const draftState = draftController.getDraftState();
    const autoApply = Boolean(store.getState().ui.bookSettingsAutoApply);

    container.innerHTML = buildBookSettingsForm(draftState, autoApply);
    bindDraftInteractions(store, draftController, container, draftState);
    hydrateIcons(container);
  };

  store.subscribe("BOOK_SETTINGS_DIRTY", render);
  store.subscribe("BOOK_SETTINGS_APPLY", render);
  store.subscribe("BOOK_SETTINGS_CANCEL", render);
  store.subscribe("state:changed", ({ reason }) => {
    if (String(reason).startsWith("undo:") || String(reason).startsWith("redo:")) {
      draftController.syncFromDocument(true);
    }
    render();
  });
  store.subscribe("ui:changed", render);

  draftController.syncFromDocument(true);
  render();
}

function buildGridForm(doc) {
  return `
    <div class="style-item">
      <div class="row-between"><strong>Colonnes & baseline</strong><small>Snapping et guides</small></div>
      <div class="grid-2">
        <label class="field">Colonnes<input name="columns" type="number" min="1" max="12" value="${doc.grids.columns}" /></label>
        <label class="field">Gouttière (mm)<input name="gutter" type="number" step="0.1" value="${doc.grids.gutter}" /></label>
        <label class="field">Baseline (mm)<input name="baseline" type="number" step="0.1" value="${doc.grids.baseline}" /></label>
        <label class="field">Preset
          <select name="gridPreset">
            ${doc.grids.presets.map((preset, index) => `<option value="${index}">${preset.name}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="grid-3">
        <label class="field"><span><input type="checkbox" name="snap" ${doc.grids.snap ? "checked" : ""}/> Snap</span></label>
        <label class="field"><span><input type="checkbox" name="rulers" ${doc.grids.rulers ? "checked" : ""}/> Règles</span></label>
        <label class="field"><span><input type="checkbox" name="guides" ${doc.grids.guides ? "checked" : ""}/> Guides</span></label>
      </div>
      <div class="inline-actions">
        <button class="tool-btn" data-action="saveGridPreset" data-tool="save" title="Sauvegarder preset grille"></button>
        <button class="tool-btn" data-action="applyGridPreset" data-tool="grid" title="Appliquer preset grille"></button>
      </div>
    </div>
  `;
}

export function initGridPanelModule(store, refs) {
  const container = refs.gridPanel;

  function render() {
    const { document: doc } = store.getState();
    container.innerHTML = `<form id="gridSettingsForm">${buildGridForm(doc)}</form>`;
    const form = container.querySelector("#gridSettingsForm");

    const sync = () => {
      store.commit("grid-settings", (draft) => {
        draft.document.grids.columns = Number(form.columns.value || draft.document.grids.columns);
        draft.document.grids.gutter = Number(form.gutter.value || draft.document.grids.gutter);
        draft.document.grids.baseline = Number(form.baseline.value || draft.document.grids.baseline);
        draft.document.grids.snap = form.snap.checked;
        draft.document.grids.rulers = form.rulers.checked;
        draft.document.grids.guides = form.guides.checked;
      }, { trackHistory: false });
    };

    form.querySelectorAll("input").forEach((field) => {
      field.addEventListener("change", sync);
    });

    const applyPreset = form.querySelector('[data-action="applyGridPreset"]');
    applyPreset.addEventListener("click", (event) => {
      event.preventDefault();
      store.commit("apply-grid-preset", (draft) => {
        const presetIndex = Number(form.gridPreset.value || 0);
        const preset = draft.document.grids.presets[presetIndex];
        if (!preset) {
          return;
        }
        draft.document.grids.columns = preset.columns;
        draft.document.grids.gutter = preset.gutter;
        draft.document.grids.baseline = preset.baseline;
      }, { trackHistory: false });
    });

    const savePreset = form.querySelector('[data-action="saveGridPreset"]');
    savePreset.addEventListener("click", (event) => {
      event.preventDefault();
      store.commit("save-grid-preset", (draft) => {
        draft.document.grids.presets.push({
          name: `Custom ${draft.document.grids.presets.length + 1}`,
          columns: draft.document.grids.columns,
          gutter: draft.document.grids.gutter,
          baseline: draft.document.grids.baseline
        });
      }, { trackHistory: false });
    });

    hydrateIcons(container);
  }

  store.subscribe("state:changed", render);
  render();
}
