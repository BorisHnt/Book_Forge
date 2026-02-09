import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultDocument } from "../core/document.js";
import { createBookSettingsDraftController } from "../core/bookSettingsDraft.js";
import { createPageManager } from "../core/pageManager.js";

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
        selectedPageId: document.pages[0]?.id || null,
        pageSelectionIds: document.pages[0] ? [document.pages[0].id] : [],
        selectedFrameId: null,
        selectedFramePageId: null,
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
      this.events.push({ event, reason });
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

test("changer dimensions -> preset devient Custom", () => {
  const store = createMockStore();
  const controller = createBookSettingsDraftController(store);

  controller.updateField("customSize.width", 207.3);
  controller.updateField("customSize.height", 289.9);

  const draft = controller.getDraftState();
  assert.equal(draft.current.format, "custom");
  assert.equal(draft.meta.customFormatActive, true);
});

test("revenir à un preset restaure son nom", () => {
  const store = createMockStore();
  const controller = createBookSettingsDraftController(store);

  controller.updateField("customSize.width", 207.3);
  controller.updateField("customSize.height", 289.9);
  controller.updateField("customSize.width", 148.0);
  controller.updateField("customSize.height", 210.0);

  const draft = controller.getDraftState();
  assert.equal(draft.current.format, "A5");
  assert.equal(draft.meta.customFormatActive, false);
});

test("delete ouvre la modale (événement request)", () => {
  const store = createMockStore();
  const pageManager = createPageManager(store);
  const pageId = store.state.document.pages[0].id;

  pageManager.requestDelete([pageId]);

  const evt = store.events.find((entry) => entry.event === "PAGE_DELETE_REQUEST");
  assert.ok(evt);
  assert.deepEqual(evt.reason.pageIds, [pageId]);
});

test("annuler ne supprime pas", () => {
  const store = createMockStore();
  const pageManager = createPageManager(store);
  const before = store.state.document.pages.length;

  pageManager.cancelDelete([store.state.document.pages[0].id]);

  assert.equal(store.state.document.pages.length, before);
  assert.ok(store.events.some((entry) => entry.event === "PAGE_DELETE_CANCEL"));
});

test("supprimer recalcul spreads", () => {
  const store = createMockStore();
  const pageManager = createPageManager(store);
  const toDelete = store.state.document.pages[1].id;

  const ok = pageManager.deletePages([toDelete]);
  assert.equal(ok, true);

  const layout = store.state.document.runtime?.layout;
  assert.ok(layout);
  assert.ok(Array.isArray(layout.spreads));
  assert.ok(store.events.some((entry) => entry.event === "SPREADS_UPDATED"));
});

test("undo restaure page supprimée", () => {
  const store = createMockStore();
  const pageManager = createPageManager(store);
  const before = store.state.document.pages.length;
  const target = store.state.document.pages[1].id;

  pageManager.deletePages([target]);
  assert.equal(store.state.document.pages.length, before - 1);

  store.undo();
  assert.equal(store.state.document.pages.length, before);
  assert.ok(store.state.document.pages.some((page) => page.id === target));
});

test("pagination mise à jour après suppression", () => {
  const store = createMockStore();
  const pageManager = createPageManager(store);

  const toDelete = store.state.document.pages[0].id;
  pageManager.deletePages([toDelete]);

  const pageNumbers = store.state.document.pages.map((page) => page.autoNumber);
  assert.deepEqual(pageNumbers, [1, 2, 3]);
});
