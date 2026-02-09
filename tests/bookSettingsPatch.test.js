import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultDocument } from "../core/document.js";
import {
  applyBookLayoutRecalculation,
  buildSpreadGroups,
  getPageSlotInfo
} from "../layout/spreadEngine.js";
import {
  ensureMarginVisualConfig,
  getMarginGeometryPx,
  getMarginOverlayModel
} from "../layout/marginOverlay.js";
import { createBookSettingsDraftController } from "../core/bookSettingsDraft.js";

function createMockStore(document = createDefaultDocument()) {
  const events = [];
  const history = [];

  const store = {
    state: {
      document,
      ui: {
        bookSettingsAutoApply: false
      },
      view: {
        spreadIndex: 0,
        bookSettingsDraft: null
      }
    },
    events,
    history,
    getState() {
      return this.state;
    },
    emit(event, reason) {
      events.push({ event, reason });
    },
    updateUi(_label, mutator) {
      mutator(this.state.ui);
    },
    commit(label, mutator) {
      const before = structuredClone(this.state);
      mutator(this.state);
      const after = structuredClone(this.state);
      history.push({ label, before, after });
    },
    undo() {
      const entry = history.pop();
      if (!entry) {
        return;
      }
      this.state = structuredClone(entry.before);
      events.push({ event: "history", reason: `undo:${entry.label}` });
    }
  };

  return store;
}

test("page 1 à droite insère une page blanche fictive", () => {
  const doc = createDefaultDocument();
  doc.settings.startOnRight = true;
  applyBookLayoutRecalculation(doc);

  const spreads = buildSpreadGroups(doc, { includeVirtualFrontBlank: true });
  assert.equal(spreads[0].slots[0].isVirtualBlank, true);
  assert.equal(spreads[0].slots[0].side, "left");
  assert.equal(spreads[0].slots[1].page.autoNumber, 1);
  assert.equal(spreads[0].slots[1].side, "right");
});

test("spreads recalculés quand recto activé", () => {
  const doc = createDefaultDocument();
  doc.settings.startOnRight = true;
  applyBookLayoutRecalculation(doc);

  const spreads = buildSpreadGroups(doc, { includeVirtualFrontBlank: true });
  assert.equal(spreads.length, 3);
  assert.equal(spreads.at(-1).slots.length, 1);
});

test("inversion inside/outside selon gauche/droite", () => {
  const doc = createDefaultDocument();
  doc.settings.startOnRight = true;
  applyBookLayoutRecalculation(doc);
  ensureMarginVisualConfig(doc.settings);

  const page1 = doc.pages[0];
  const page2 = doc.pages[1];
  const slot1 = getPageSlotInfo(doc, page1.id, { includeVirtualFrontBlank: true });
  const slot2 = getPageSlotInfo(doc, page2.id, { includeVirtualFrontBlank: true });

  const geom1 = getMarginGeometryPx(doc, page1, slot1.side);
  const geom2 = getMarginGeometryPx(doc, page2, slot2.side);

  assert.equal(slot1.side, "right");
  assert.equal(slot2.side, "left");
  assert.ok(geom1.px.left > geom1.px.right);
  assert.ok(geom2.px.left < geom2.px.right);
});

test("tranche appliquée côté reliure", () => {
  const doc = createDefaultDocument();
  doc.settings.startOnRight = true;
  doc.settings.margins.spine = 6;
  applyBookLayoutRecalculation(doc);

  const slot = getPageSlotInfo(doc, doc.pages[0].id, { includeVirtualFrontBlank: true });
  const geometry = getMarginGeometryPx(doc, doc.pages[0], slot.side);

  assert.equal(geometry.mm.inside, doc.settings.margins.inside + doc.settings.margins.spine);
});

test("overlay recalculé après changement visuel", () => {
  const doc = createDefaultDocument();
  doc.settings.startOnRight = true;
  applyBookLayoutRecalculation(doc);
  ensureMarginVisualConfig(doc.settings);

  const slot = getPageSlotInfo(doc, doc.pages[0].id, { includeVirtualFrontBlank: true });
  const pageSize = { width: 800, height: 1100 };

  const modelBefore = getMarginOverlayModel({
    doc,
    page: doc.pages[0],
    pageSizePx: pageSize,
    side: slot.side
  });

  doc.settings.margins.visual.opacity = 0.4;
  doc.settings.margins.visual.stroke = 3;

  const modelAfter = getMarginOverlayModel({
    doc,
    page: doc.pages[0],
    pageSizePx: pageSize,
    side: slot.side
  });

  assert.notEqual(modelBefore.zones[0].opacity, modelAfter.zones[0].opacity);
  assert.notEqual(modelBefore.stroke, modelAfter.stroke);
});

test("les champs restent inactifs sans apply", () => {
  const store = createMockStore();
  const controller = createBookSettingsDraftController(store);
  const previousDpi = store.state.document.settings.dpi;

  controller.updateField("dpi", 300);

  assert.equal(store.state.document.settings.dpi, previousDpi);
  assert.equal(controller.getDraftState().dirty, true);
});

test("Annuler restaure le draft", () => {
  const store = createMockStore();
  const controller = createBookSettingsDraftController(store);
  const originalFormat = controller.getDraftState().base.format;

  controller.updateField("format", "A5");
  assert.equal(controller.getDraftState().current.format, "A5");

  controller.cancel();

  assert.equal(controller.getDraftState().dirty, false);
  assert.equal(controller.getDraftState().current.format, originalFormat);
  assert.equal(store.state.document.settings.format, originalFormat);
});

test("undo fonctionne après apply", () => {
  const store = createMockStore();
  const controller = createBookSettingsDraftController(store);
  const originalDpi = store.state.document.settings.dpi;

  controller.updateField("dpi", 300);
  controller.apply();
  assert.equal(store.state.document.settings.dpi, 300);

  store.undo();
  assert.equal(store.state.document.settings.dpi, originalDpi);
});

test("preview print reflète la logique recto", () => {
  const doc = createDefaultDocument();
  doc.settings.startOnRight = true;
  applyBookLayoutRecalculation(doc);

  const spreads = buildSpreadGroups(doc, { includeVirtualFrontBlank: true });
  const previewSpread = spreads[0];

  assert.equal(previewSpread.slots[0].isVirtualBlank, true);
  assert.equal(previewSpread.slots[1].page.autoNumber, 1);
  assert.equal(previewSpread.slots[1].side, "right");
});
