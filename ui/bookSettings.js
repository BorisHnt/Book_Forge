import { getFormatDimensions } from "../core/document.js";
import { hydrateIcons } from "./icons.js";

const marginPresetDefaults = {
  mode: "single",
  all: "#c9793b",
  top: "#c9793b",
  bottom: "#b86f37",
  inside: "#9d5c2f",
  outside: "#d4975f"
};

function buildBookSettingsForm(doc) {
  const size = getFormatDimensions(doc.settings.format, doc.settings.customSize, doc.settings.orientation);
  return `
    <div class="style-item">
      <div class="row-between"><strong>Format page</strong><small>${size.width}×${size.height} mm</small></div>
      <div class="grid-2">
        <label class="field">Format
          <select name="format">
            <option value="A4">A4</option>
            <option value="A5">A5</option>
            <option value="Letter">Letter</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="field">Orientation
          <select name="orientation">
            <option value="portrait">Portrait</option>
            <option value="landscape">Paysage</option>
          </select>
        </label>
      </div>
      <div class="grid-2">
        <label class="field">Largeur (mm)<input type="number" step="0.1" name="customWidth" value="${doc.settings.customSize.width}" /></label>
        <label class="field">Hauteur (mm)<input type="number" step="0.1" name="customHeight" value="${doc.settings.customSize.height}" /></label>
      </div>
      <div class="grid-2">
        <label class="field">Unités
          <select name="unit">
            <option value="mm">mm</option>
            <option value="pt">pt</option>
            <option value="in">in</option>
            <option value="px">px</option>
          </select>
        </label>
        <label class="field">DPI<input type="number" name="dpi" min="72" max="600" value="${doc.settings.dpi}" /></label>
      </div>
    </div>

    <div class="style-item">
      <div class="row-between"><strong>Marges</strong><small>Overlay non imprimé</small></div>
      <div class="grid-2">
        <label class="field">Haut<input type="number" step="0.1" name="marginTop" value="${doc.settings.margins.top}" /></label>
        <label class="field">Bas<input type="number" step="0.1" name="marginBottom" value="${doc.settings.margins.bottom}" /></label>
        <label class="field">Intérieur<input type="number" step="0.1" name="marginInside" value="${doc.settings.margins.inside}" /></label>
        <label class="field">Extérieur<input type="number" step="0.1" name="marginOutside" value="${doc.settings.margins.outside}" /></label>
        <label class="field">Tranche<input type="number" step="0.1" name="marginSpine" value="${doc.settings.margins.spine}" /></label>
        <label class="field">Comp. pair/impair<input type="number" step="0.1" name="oddEvenComp" value="${doc.settings.margins.oddEvenCompensation}" /></label>
      </div>
      <div class="grid-2">
        <label class="field">Bleed<input type="number" step="0.1" name="bleed" value="${doc.settings.bleed}" /></label>
        <label class="field">Safe area<input type="number" step="0.1" name="safeArea" value="${doc.settings.safeArea}" /></label>
      </div>
      <div class="grid-3">
        <label class="field">Mode couleur
          <select name="marginColorMode">
            <option value="single">Simple</option>
            <option value="advanced">Avancé</option>
          </select>
        </label>
        <label class="field">Trait (px)<input type="number" step="1" min="1" max="5" name="marginStroke" value="${doc.settings.margins.stroke || 1}" /></label>
        <label class="field">Afficher
          <select name="marginVisible">
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        </label>
      </div>
      <div class="grid-3">
        <label class="field">Couleur unique<input type="color" name="marginColorAll" value="${doc.settings.margins.colors.all}" /></label>
        <label class="field">Top<input type="color" name="marginColorTop" value="${doc.settings.margins.colors.top}" /></label>
        <label class="field">Bottom<input type="color" name="marginColorBottom" value="${doc.settings.margins.colors.bottom}" /></label>
        <label class="field">Inside<input type="color" name="marginColorInside" value="${doc.settings.margins.colors.inside}" /></label>
        <label class="field">Outside<input type="color" name="marginColorOutside" value="${doc.settings.margins.colors.outside}" /></label>
      </div>
      <div class="inline-actions">
        <button class="tool-btn" data-action="saveMarginPreset" data-tool="save" title="Sauvegarder preset marges"></button>
        <button class="tool-btn" data-action="applyMarginPreset" data-tool="settings" title="Appliquer preset marges"></button>
      </div>
    </div>
  `;
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

export function initBookSettingsModule(store, refs) {
  const container = refs.bookSettingsPanel;

  function render() {
    const { document: doc } = store.getState();
    const colors = { ...marginPresetDefaults, ...doc.settings.margins.colors };
    doc.settings.margins.colors = colors;

    container.innerHTML = `<form id="bookSettingsForm">${buildBookSettingsForm(doc)}</form>`;
    const form = container.querySelector("#bookSettingsForm");

    form.format.value = doc.settings.format;
    form.orientation.value = doc.settings.orientation;
    form.unit.value = doc.settings.unit;
    form.marginColorMode.value = doc.settings.margins.colors.mode;
    form.marginVisible.value = String(doc.settings.margins.visible);

    const sync = () => {
      store.commit("book-settings", (draft) => {
        const settings = draft.document.settings;
        settings.format = form.format.value;
        settings.orientation = form.orientation.value;
        settings.customSize.width = Number(form.customWidth.value || settings.customSize.width);
        settings.customSize.height = Number(form.customHeight.value || settings.customSize.height);
        settings.unit = form.unit.value;
        settings.dpi = Number(form.dpi.value || settings.dpi);

        settings.margins.top = Number(form.marginTop.value || settings.margins.top);
        settings.margins.bottom = Number(form.marginBottom.value || settings.margins.bottom);
        settings.margins.inside = Number(form.marginInside.value || settings.margins.inside);
        settings.margins.outside = Number(form.marginOutside.value || settings.margins.outside);
        settings.margins.spine = Number(form.marginSpine.value || settings.margins.spine);
        settings.margins.oddEvenCompensation = Number(form.oddEvenComp.value || 0);
        settings.margins.stroke = Number(form.marginStroke.value || 1);
        settings.margins.visible = form.marginVisible.value === "true";

        settings.margins.colors.mode = form.marginColorMode.value;
        settings.margins.colors.all = form.marginColorAll.value;
        settings.margins.colors.top = form.marginColorTop.value;
        settings.margins.colors.bottom = form.marginColorBottom.value;
        settings.margins.colors.inside = form.marginColorInside.value;
        settings.margins.colors.outside = form.marginColorOutside.value;

        settings.bleed = Number(form.bleed.value || settings.bleed);
        settings.safeArea = Number(form.safeArea.value || settings.safeArea);
      }, { trackHistory: false });
    };

    form.querySelectorAll("input,select").forEach((input) => {
      input.addEventListener("change", sync);
    });

    const savePreset = form.querySelector('[data-action="saveMarginPreset"]');
    savePreset.addEventListener("click", (event) => {
      event.preventDefault();
      store.commit("save-margin-preset", (draft) => {
        if (!draft.document.settings.marginPresets) {
          draft.document.settings.marginPresets = [];
        }
        draft.document.settings.marginPresets.push({
          name: `Preset ${draft.document.settings.marginPresets.length + 1}`,
          margins: structuredClone(draft.document.settings.margins),
          bleed: draft.document.settings.bleed,
          safeArea: draft.document.settings.safeArea
        });
      }, { trackHistory: false });
    });

    const applyPreset = form.querySelector('[data-action="applyMarginPreset"]');
    applyPreset.addEventListener("click", (event) => {
      event.preventDefault();
      store.commit("apply-margin-preset", (draft) => {
        const preset = draft.document.settings.marginPresets?.at(-1);
        if (!preset) {
          return;
        }
        draft.document.settings.margins = structuredClone(preset.margins);
        draft.document.settings.bleed = preset.bleed;
        draft.document.settings.safeArea = preset.safeArea;
      }, { trackHistory: false });
    });

    hydrateIcons(container);
  }

  store.subscribe("state:changed", render);
  render();
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
