import { EventBus } from "./eventBus.js";
import { CommandHistory } from "./history.js";
import {
  createDefaultDocument,
  normalizeDocument,
  recomputePagination,
  touchDocument,
  ensureSelectedPageId
} from "./document.js";

const STORAGE_KEY = "book-forge.document.v1";
const UI_KEY = "book-forge.ui.v1";

export class Store {
  constructor() {
    this.bus = new EventBus();
    this.history = new CommandHistory();
    this.state = {
      document: createDefaultDocument(),
      ui: {
        leftDockWidth: 320,
        rightDockWidth: 360,
        leftDockCollapsed: false,
        rightDockCollapsed: false,
        leftTab: "panel-pages",
        rightTab: "panel-book",
        bookSettingsAutoApply: false
      },
      view: {
        selectedPageId: null,
        pageSelectionIds: [],
        selectedFrameId: null,
        selectedFramePageId: null,
        spreadIndex: 0,
        tool: "selection",
        zoom: 1,
        printPreview: false,
        bookSettingsDraft: null
      }
    };
    this.load();
  }

  load() {
    try {
      const rawDoc = localStorage.getItem(STORAGE_KEY);
      const rawUi = localStorage.getItem(UI_KEY);
      if (rawDoc) {
        this.state.document = normalizeDocument(JSON.parse(rawDoc));
      }
      if (rawUi) {
        this.state.ui = { ...this.state.ui, ...JSON.parse(rawUi) };
      }
      ensureSelectedPageId(this.state);
      recomputePagination(this.state.document);
      this.emit("init", "initial-load");
    } catch (error) {
      console.warn("Unable to load local document", error);
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.document));
    localStorage.setItem(UI_KEY, JSON.stringify(this.state.ui));
    this.bus.emit("saved", {
      at: new Date().toISOString()
    });
  }

  getState() {
    return this.state;
  }

  subscribe(event, listener) {
    return this.bus.on(event, listener);
  }

  emit(event, reason) {
    this.bus.emit(event, {
      reason,
      state: this.state
    });
  }

  commit(label, mutator, options = { trackHistory: true }) {
    const before = structuredClone(this.state);
    mutator(this.state);
    recomputePagination(this.state.document);
    touchDocument(this.state.document);
    ensureSelectedPageId(this.state);
    this.save();

    const after = structuredClone(this.state);
    if (options.trackHistory) {
      this.history.push({
        label,
        undo: () => {
          this.state = structuredClone(before);
          this.save();
          this.emit("state:changed", `undo:${label}`);
        },
        redo: () => {
          this.state = structuredClone(after);
          this.save();
          this.emit("state:changed", `redo:${label}`);
        }
      });
    }

    this.emit("state:changed", label);
  }

  updateUi(label, mutator) {
    mutator(this.state.ui);
    this.save();
    this.emit("ui:changed", label);
  }

  undo() {
    const command = this.history.undo();
    if (command) {
      this.emit("history", `undo:${command.label}`);
    }
  }

  redo() {
    const command = this.history.redo();
    if (command) {
      this.emit("history", `redo:${command.label}`);
    }
  }
}
