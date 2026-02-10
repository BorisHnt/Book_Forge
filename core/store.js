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
const DATA_URL_MAX_CHARS = 120_000;
const DATA_URL_TOTAL_BUDGET_CHARS = 2_500_000;

function isInlineDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:");
}

function isQuotaExceededError(error) {
  if (!error) {
    return false;
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
  }
  return String(error?.name || "").includes("QuotaExceeded");
}

export function sanitizeDocumentForStorage(document, options = {}) {
  const {
    maxDataUrlChars = DATA_URL_MAX_CHARS,
    maxTotalDataUrlChars = DATA_URL_TOTAL_BUDGET_CHARS,
    dropAllDataUrls = false
  } = options;

  const sanitized = structuredClone(document);
  let keptChars = 0;
  let droppedDataUrls = 0;
  let droppedBytesApprox = 0;

  const sanitizeDataUrl = (target, key, forceDrop = false) => {
    if (!target || !isInlineDataUrl(target[key])) {
      return;
    }

    const value = target[key];
    const wouldExceedBudget = keptChars + value.length > maxTotalDataUrlChars;
    const mustDrop = dropAllDataUrls || forceDrop || value.length > maxDataUrlChars || wouldExceedBudget;
    if (mustDrop) {
      droppedDataUrls += 1;
      droppedBytesApprox += value.length;
      target[key] = "";
      return;
    }

    keptChars += value.length;
  };

  for (const page of sanitized.pages || []) {
    const forceReferenceDrop = Boolean(
      page.imported?.source === "pdf" || page.backgroundReference?.mode === "reference"
    );
    sanitizeDataUrl(page.backgroundReference, "dataUrl", forceReferenceDrop);

    for (const frame of page.frames || []) {
      const forceFrameDrop = frame.importedFrom === "pdf";
      sanitizeDataUrl(frame, "src", forceFrameDrop);
    }
  }

  return {
    document: sanitized,
    stats: {
      keptChars,
      droppedDataUrls,
      droppedBytesApprox
    }
  };
}

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
    const uiJson = JSON.stringify(this.state.ui);
    const baseSnapshot = sanitizeDocumentForStorage(this.state.document);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(baseSnapshot.document));
      localStorage.setItem(UI_KEY, uiJson);
      this.bus.emit("saved", {
        at: new Date().toISOString(),
        degraded: baseSnapshot.stats.droppedDataUrls > 0,
        droppedDataUrls: baseSnapshot.stats.droppedDataUrls
      });
      if (baseSnapshot.stats.droppedDataUrls > 0) {
        this.bus.emit("save:degraded", {
          at: new Date().toISOString(),
          droppedDataUrls: baseSnapshot.stats.droppedDataUrls,
          droppedBytesApprox: baseSnapshot.stats.droppedBytesApprox,
          reason: "sanitized"
        });
      }
      return;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.warn("Unable to save local document", error);
        this.bus.emit("save:error", {
          at: new Date().toISOString(),
          message: error?.message || "Unknown storage error",
          reason: "write-failed"
        });
        return;
      }
    }

    const fallbackSnapshot = sanitizeDocumentForStorage(this.state.document, {
      dropAllDataUrls: true,
      maxDataUrlChars: 0,
      maxTotalDataUrlChars: 0
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackSnapshot.document));
      localStorage.setItem(UI_KEY, uiJson);
      this.bus.emit("saved", {
        at: new Date().toISOString(),
        degraded: true,
        droppedDataUrls: fallbackSnapshot.stats.droppedDataUrls
      });
      this.bus.emit("save:degraded", {
        at: new Date().toISOString(),
        droppedDataUrls: fallbackSnapshot.stats.droppedDataUrls,
        droppedBytesApprox: fallbackSnapshot.stats.droppedBytesApprox,
        reason: "quota-fallback"
      });
    } catch (error) {
      console.warn("Unable to save local document after fallback", error);
      this.bus.emit("save:error", {
        at: new Date().toISOString(),
        message: error?.message || "Unknown storage error",
        reason: "quota-exceeded"
      });
    }
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
