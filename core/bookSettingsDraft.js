import { applyBookLayoutRecalculation } from "../layout/spreadEngine.js";
import { applyMarginVisualPreset, ensureMarginVisualConfig } from "../layout/marginOverlay.js";
import { getFormatDimensions, matchFormatPresetBySize, PAGE_FORMAT_PRESETS_MM } from "./document.js";

function clone(value) {
  return structuredClone(value);
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function collectDiffPaths(base, current, prefix = "") {
  if (typeof base !== "object" || base === null || typeof current !== "object" || current === null) {
    return Object.is(base, current) ? [] : [prefix];
  }

  const keys = new Set([...Object.keys(base), ...Object.keys(current)]);
  const diffs = [];

  for (const key of keys) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    const left = base[key];
    const right = current[key];

    if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
      diffs.push(...collectDiffPaths(left, right, nextPrefix));
      continue;
    }

    if (!Object.is(left, right)) {
      diffs.push(nextPrefix);
    }
  }

  return diffs;
}

export function createBookSettingsSnapshot(doc) {
  ensureMarginVisualConfig(doc.settings);

  return {
    format: doc.settings.format,
    orientation: doc.settings.orientation,
    customSize: clone(doc.settings.customSize),
    unit: doc.settings.unit,
    dpi: doc.settings.dpi,
    startOnRight: Boolean(doc.settings.startOnRight),
    margins: {
      top: Number(doc.settings.margins.top),
      bottom: Number(doc.settings.margins.bottom),
      inside: Number(doc.settings.margins.inside),
      outside: Number(doc.settings.margins.outside),
      spine: Number(doc.settings.margins.spine),
      oddEvenCompensation: Number(doc.settings.margins.oddEvenCompensation || 0),
      visible: Boolean(doc.settings.margins.visible),
      visual: clone(doc.settings.margins.visual)
    },
    bleed: Number(doc.settings.bleed),
    safeArea: Number(doc.settings.safeArea),
    bleedVisible: Boolean(doc.settings.bleedVisible),
    safeVisible: Boolean(doc.settings.safeVisible),
    marginPresets: clone(doc.settings.marginPresets || [])
  };
}

export function createDraftStateFromDocument(doc) {
  const base = createBookSettingsSnapshot(doc);
  const draft = {
    base,
    current: clone(base),
    meta: {
      lastPreset: base.format && base.format !== "custom" ? base.format : "A4",
      customFormatActive: base.format === "custom"
    },
    dirty: false,
    dirtyFields: []
  };
  normalizeFormatDraft(draft, "sync");
  return draft;
}

export function applyBookSettingsSnapshot(doc, snapshot) {
  const settings = doc.settings;

  settings.format = snapshot.format;
  settings.orientation = snapshot.orientation;
  settings.customSize = clone(
    snapshot.format && snapshot.format !== "custom"
      ? getFormatDimensions(snapshot.format, snapshot.customSize, snapshot.orientation)
      : snapshot.customSize
  );
  settings.unit = snapshot.unit;
  settings.dpi = Number(snapshot.dpi);
  settings.startOnRight = Boolean(snapshot.startOnRight);

  settings.margins.top = Number(snapshot.margins.top);
  settings.margins.bottom = Number(snapshot.margins.bottom);
  settings.margins.inside = Number(snapshot.margins.inside);
  settings.margins.outside = Number(snapshot.margins.outside);
  settings.margins.spine = Number(snapshot.margins.spine);
  settings.margins.oddEvenCompensation = Number(snapshot.margins.oddEvenCompensation || 0);
  settings.margins.visible = Boolean(snapshot.margins.visible);
  settings.margins.visual = clone(snapshot.margins.visual);
  ensureMarginVisualConfig(settings);

  settings.bleed = Number(snapshot.bleed);
  settings.safeArea = Number(snapshot.safeArea);
  settings.bleedVisible = Boolean(snapshot.bleedVisible);
  settings.safeVisible = Boolean(snapshot.safeVisible);
  settings.marginPresets = clone(snapshot.marginPresets || []);
}

function refreshDraftFlags(draft) {
  draft.dirtyFields = collectDiffPaths(draft.base, draft.current).filter(Boolean);
  draft.dirty = draft.dirtyFields.length > 0;
}

function ensureFormatMeta(draft) {
  draft.meta = draft.meta || {};
  if (!draft.meta.lastPreset) {
    draft.meta.lastPreset =
      draft.current.format && draft.current.format !== "custom" ? draft.current.format : "A4";
  }
  if (typeof draft.meta.customFormatActive !== "boolean") {
    draft.meta.customFormatActive = draft.current.format === "custom";
  }
}

function normalizeFormatDraft(draft, changedPath) {
  ensureFormatMeta(draft);
  const current = draft.current;
  const knownPresets = Object.keys(PAGE_FORMAT_PRESETS_MM);

  if (changedPath === "format") {
    if (current.format && current.format !== "custom" && knownPresets.includes(current.format)) {
      draft.meta.lastPreset = current.format;
      current.customSize = clone(getFormatDimensions(current.format, current.customSize, current.orientation));
      draft.meta.customFormatActive = false;
      return;
    }
  }

  if (changedPath === "orientation" && current.format && current.format !== "custom" && knownPresets.includes(current.format)) {
    current.customSize = clone(getFormatDimensions(current.format, current.customSize, current.orientation));
  }

  const matchedPreset = matchFormatPresetBySize({
    width: current.customSize?.width,
    height: current.customSize?.height,
    orientation: current.orientation,
    toleranceMm: 0.1
  });

  const sizeEdited = changedPath === "customSize.width" || changedPath === "customSize.height";
  if (sizeEdited) {
    if (matchedPreset) {
      current.format = matchedPreset;
      draft.meta.lastPreset = matchedPreset;
      draft.meta.customFormatActive = false;
      return;
    }
    if (current.format !== "custom") {
      draft.meta.lastPreset = current.format;
    }
    current.format = "custom";
    draft.meta.customFormatActive = true;
    return;
  }

  if ((changedPath === "format" || changedPath === "orientation") && current.format === "custom" && matchedPreset) {
    current.format = matchedPreset;
    draft.meta.lastPreset = matchedPreset;
    draft.meta.customFormatActive = false;
    return;
  }

  draft.meta.customFormatActive = current.format === "custom";
}

function ensureDraftInStore(store) {
  const state = store.getState();
  if (!state.view.bookSettingsDraft) {
    state.view.bookSettingsDraft = createDraftStateFromDocument(state.document);
  }
  return state.view.bookSettingsDraft;
}

export function createBookSettingsDraftController(store) {
  ensureDraftInStore(store);

  const syncFromDocument = (force = false) => {
    const state = store.getState();
    const currentDraft = ensureDraftInStore(store);
    if (!force && currentDraft.dirty) {
      return;
    }
    state.view.bookSettingsDraft = createDraftStateFromDocument(state.document);
    store.emit("BOOK_SETTINGS_DIRTY", "sync-from-document");
  };

  const getDraftState = () => ensureDraftInStore(store);

  const updateField = (path, value) => {
    const draft = ensureDraftInStore(store);
    setByPath(draft.current, path, value);

    if (path === "margins.visual.preset") {
      draft.current.margins.visual = applyMarginVisualPreset(
        draft.current.margins.visual,
        value
      );
    }

    normalizeFormatDraft(draft, path);

    refreshDraftFlags(draft);
    store.emit("BOOK_SETTINGS_DIRTY", `draft:${path}`);

    const autoApply = Boolean(store.getState().ui.bookSettingsAutoApply);
    if (autoApply && draft.dirty) {
      apply("auto-apply");
    }
  };

  const cancel = () => {
    const state = store.getState();
    const draft = ensureDraftInStore(store);
    if (!draft.dirty) {
      return false;
    }
    state.view.bookSettingsDraft = createDraftStateFromDocument(state.document);
    store.emit("BOOK_SETTINGS_CANCEL", "manual-cancel");
    return true;
  };

  const apply = (reason = "manual-apply") => {
    const draft = ensureDraftInStore(store);
    if (!draft.dirty) {
      return false;
    }

    store.commit("book-settings-apply", (state) => {
      applyBookSettingsSnapshot(state.document, state.view.bookSettingsDraft.current);
      applyBookLayoutRecalculation(state.document);
      state.view.bookSettingsDraft = createDraftStateFromDocument(state.document);
      const spreadCount = state.document.runtime?.layout?.spreads?.length || 1;
      state.view.spreadIndex = Math.max(0, Math.min(state.view.spreadIndex, spreadCount - 1));
    });

    store.emit("BOOK_SETTINGS_APPLY", reason);
    store.emit("SPREADS_UPDATED", reason);
    store.emit("MARGINS_UPDATED", reason);
    return true;
  };

  const setAutoApply = (enabled) => {
    store.updateUi("book-settings-auto-apply", (ui) => {
      ui.bookSettingsAutoApply = Boolean(enabled);
    });
    if (enabled) {
      apply("auto-apply-toggle");
    }
  };

  return {
    getDraftState,
    updateField,
    apply,
    cancel,
    setAutoApply,
    syncFromDocument
  };
}
