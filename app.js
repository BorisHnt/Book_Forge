import { Store } from "./core/store.js";
import { loadTablerSprite, hydrateIcons } from "./ui/icons.js";
import { initPanels } from "./ui/panels.js";
import { initPagesModule } from "./layout/pages.js";
import { initSectionsModule } from "./layout/sections.js";
import { initMastersModule } from "./layout/masters.js";
import { initStylesModule } from "./typography/styles.js";
import { initBookSettingsModule, initGridPanelModule } from "./ui/bookSettings.js";
import { initPrintPreviewModule } from "./ui/printPreview.js";
import { initExportChecklistModule } from "./ui/exportChecklist.js";
import { initPdfExporter } from "./exporters/pdf.js";
import { initMultiPageImporter } from "./importers/multiPageImporter.js";
import { createBookSettingsDraftController } from "./core/bookSettingsDraft.js";
import { createPageManager } from "./core/pageManager.js";
import { initDeletePageDialog } from "./ui/deletePageDialog.js";
import { createPage } from "./core/document.js";
import { applyBookLayoutRecalculation } from "./layout/spreadEngine.js";

const THEME_KEY = "book-forge.theme.v1";

function setStatus(message) {
  const status = document.getElementById("docStatus");
  const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  status.textContent = `${message} · ${time}`;
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "ink" || saved === "paper") {
    applyTheme(saved);
  }
}

function bindOfflineStatus() {
  const target = document.getElementById("offlineStatus");
  const sync = () => {
    target.textContent = navigator.onLine ? "Online" : "Offline";
  };
  sync();
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker unavailable", error);
  });
}

function renderAssets(store) {
  const list = document.getElementById("assetsList");
  const assets = store.getState().document.assets;
  list.innerHTML = "";

  if (!assets.length) {
    const empty = document.createElement("small");
    empty.textContent = "Aucun asset importé.";
    list.appendChild(empty);
    return;
  }

  assets.forEach((asset) => {
    const item = document.createElement("article");
    item.className = "asset-item";
    const kb = Math.max(1, Math.round(asset.size / 1024));
    item.innerHTML = `<strong>${asset.name}</strong><small>${asset.type} · ${kb} KB</small>`;
    list.appendChild(item);
  });
}

function clearImportedContent(store) {
  const state = store.getState();
  const importedPages = state.document.pages.filter((page) => Boolean(page.imported));
  const importedFrames = state.document.pages.reduce((count, page) => {
    return count + (page.frames || []).filter((frame) => frame.imported || frame.importedFrom).length;
  }, 0);
  const referencedPages = state.document.pages.filter((page) => Boolean(page.backgroundReference));
  const importedAssets = state.document.assets.length;

  const totalTargets = importedPages.length + importedFrames + referencedPages.length + importedAssets;
  if (!totalTargets) {
    return { changed: false, removedPages: 0, removedFrames: 0, removedAssets: 0, removedReferences: 0 };
  }

  store.commit("clear-imported-content", (draft) => {
    const initialPages = draft.document.pages;
    draft.document.pages = initialPages.filter((page) => !page.imported);

    draft.document.pages.forEach((page) => {
      page.frames = (page.frames || []).filter((frame) => !(frame.imported || frame.importedFrom));
      page.backgroundReference = null;
    });

    draft.document.assets = [];

    if (!draft.document.pages.length) {
      const sectionId = draft.document.sections[0]?.id;
      if (!sectionId) {
        const newSectionId = `section-${Math.random().toString(36).slice(2, 8)}`;
        draft.document.sections.push({
          id: newSectionId,
          name: "Section 1",
          pageIds: [],
          pagination: { style: "arabic", startAt: 1, independent: false },
          startOnOdd: false,
          bookmark: true,
          toc: true,
          masterId: "master-default"
        });
      }

      draft.document.pages.push(
        createPage({
          sectionId: draft.document.sections[0].id,
          number: 1,
          masterId: draft.document.sections[0].masterId || "master-default",
          frames: []
        })
      );
    }

    applyBookLayoutRecalculation(draft.document);
    draft.view.selectedPageId = draft.document.pages[0]?.id || null;
    draft.view.pageSelectionIds = draft.view.selectedPageId ? [draft.view.selectedPageId] : [];
    draft.view.selectedFrameId = null;
    draft.view.selectedFramePageId = null;
    draft.view.spreadIndex = 0;
  });

  store.emit("PAGE_REBUILT", "clear-imported");
  store.emit("SPREADS_UPDATED", "clear-imported");
  return {
    changed: true,
    removedPages: importedPages.length,
    removedFrames: importedFrames,
    removedAssets: importedAssets,
    removedReferences: referencedPages.length
  };
}

async function bootstrap() {
  initTheme();
  bindOfflineStatus();
  registerServiceWorker();

  await loadTablerSprite();

  const store = new Store();
  const panels = initPanels(store);
  const draftController = createBookSettingsDraftController(store);
  const pageManager = createPageManager(store);
  initDeletePageDialog({
    store,
    pageManager,
    modalRoot: document.getElementById("modalRoot")
  });

  const pagesApi = initPagesModule(
    store,
    {
      pagesList: document.getElementById("pagesList"),
      spreadViewport: document.getElementById("spreadViewport"),
      spreadLabel: document.getElementById("spreadLabel"),
      zoomLabel: document.getElementById("zoomLabel")
    },
    pageManager
  );

  const sectionsApi = initSectionsModule(store, {
    sectionsList: document.getElementById("sectionsList")
  });

  const mastersApi = initMastersModule(store, {
    mastersList: document.getElementById("mastersList")
  });

  initStylesModule(store, {
    stylesPanel: document.getElementById("stylesPanel")
  });

  initBookSettingsModule(
    store,
    {
      bookSettingsPanel: document.getElementById("bookSettingsPanel")
    },
    draftController
  );

  initGridPanelModule(store, {
    gridPanel: document.getElementById("gridPanel")
  });

  const previewApi = initPrintPreviewModule(store, {
    exportPanel: document.getElementById("exportPanel")
  });

  const checklistApi = initExportChecklistModule(store, {
    exportPanel: document.getElementById("exportPanel"),
    onJumpToPage: pagesApi.jumpToPage
  });

  const exporterApi = initPdfExporter(
    store,
    {
      exportPanel: document.getElementById("exportPanel")
    },
    checklistApi
  );

  const importerApi = initMultiPageImporter(store);

  exporterApi.render();
  renderAssets(store);
  hydrateIcons(document);

  store.subscribe("state:changed", ({ reason }) => {
    renderAssets(store);
    hydrateIcons(document);
    setStatus(`Mise à jour: ${reason}`);
  });

  store.subscribe("saved", () => {
    setStatus("Document sauvegardé localement");
  });

  store.subscribe("save:degraded", ({ droppedDataUrls, reason }) => {
    const dropped = Number(droppedDataUrls || 0);
    const mode = reason === "quota-fallback" ? "fallback quota" : "optimisation";
    setStatus(`Sauvegarde locale (${mode}) · ${dropped} aperçu(x) raster non persisté(s)`);
  });

  store.subscribe("save:error", () => {
    setStatus("Erreur sauvegarde locale (quota/localStorage)");
  });

  store.subscribe("BOOK_SETTINGS_DIRTY", () => {
    const draft = draftController.getDraftState();
    if (draft.dirty) {
      setStatus("Paramètres du livre: modifications en attente");
    }
  });

  store.subscribe("BOOK_SETTINGS_APPLY", () => {
    setStatus("Paramètres du livre appliqués");
  });

  store.subscribe("BOOK_SETTINGS_CANCEL", () => {
    setStatus("Brouillon paramètres annulé");
  });

  store.subscribe("PAGE_DELETED", ({ reason }) => {
    const count = Array.isArray(reason?.pageIds) ? reason.pageIds.length : 1;
    setStatus(`${count} page(s) supprimée(s)`);
  });

  store.subscribe("PAGE_DELETE_CANCEL", () => {
    setStatus("Suppression de page annulée");
  });

  const actions = {
    undo: () => store.undo(),
    redo: () => store.redo(),
    addPage: () => pagesApi.addPage(),
    deleteSelectedPages: () => pagesApi.deleteSelectedPages(),
    toggleSpread: () => pagesApi.toggleSpread(),
    prevSpread: () => pagesApi.prevSpread(),
    nextSpread: () => pagesApi.nextSpread(),
    fitView: () => pagesApi.fitView(),
    zoomIn: () => pagesApi.zoomIn(),
    zoomOut: () => pagesApi.zoomOut(),
    toggleRulers: () => pagesApi.toggleRulers(),
    addSection: () => sectionsApi.addSection(),
    addMaster: () => mastersApi.addMaster(),
    toggleLeftDock: () => panels.toggleDock("left"),
    toggleRightDock: () => panels.toggleDock("right"),
    import: () => importerApi.openDialog(),
    togglePreview: () => previewApi.togglePreview(),
    runChecklist: () => checklistApi.runChecklist(),
    exportPdf: () => exporterApi.exportPdf(),
    saveDoc: () => {
      store.save();
      setStatus("Sauvegarde manuelle effectuée");
    },
    clearImported: () => {
      const confirmed = window.confirm(
        "Clear va supprimer tout le contenu importé (pages, cadres importés, fonds de référence et assets). Continuer ?"
      );
      if (!confirmed) {
        return;
      }
      const result = clearImportedContent(store);
      if (!result.changed) {
        setStatus("Aucun contenu importé à supprimer");
        return;
      }
      setStatus(
        `Clear import: ${result.removedPages} pages, ${result.removedFrames} cadres, ${result.removedAssets} assets supprimés`
      );
    },
    toggleTheme: () => {
      const nextTheme = document.body.dataset.theme === "ink" ? "paper" : "ink";
      applyTheme(nextTheme);
      hydrateIcons(document);
      setStatus(`Thème ${nextTheme === "ink" ? "Ink" : "Paper"}`);
    }
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    if (action && actions[action]) {
      actions[action]();
      return;
    }

    if (button.classList.contains("tool-btn") && button.dataset.tool && !action) {
      store.commit("select-tool", (draft) => {
        draft.view.tool = button.dataset.tool;
      }, { trackHistory: false });
      document.querySelectorAll("#mainToolbar .tool-btn").forEach((entry) => {
        if (!entry.dataset.action && entry.dataset.tool) {
          entry.classList.toggle("active", entry.dataset.tool === button.dataset.tool);
        }
      });
    }
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (event.ctrlKey && key === "s") {
      event.preventDefault();
      actions.saveDoc();
      return;
    }

    if (event.ctrlKey && !event.shiftKey && key === "z") {
      event.preventDefault();
      actions.undo();
      return;
    }

    if (event.ctrlKey && event.shiftKey && key === "z") {
      event.preventDefault();
      actions.redo();
      return;
    }

    if (event.ctrlKey && key === "e") {
      event.preventDefault();
      actions.exportPdf();
      return;
    }

    if (event.ctrlKey && key === "k") {
      event.preventDefault();
      actions.runChecklist();
      return;
    }

    if (event.ctrlKey && event.shiftKey && key === "i") {
      event.preventDefault();
      actions.import();
      return;
    }

    if (event.ctrlKey && (key === "+" || key === "=")) {
      event.preventDefault();
      actions.zoomIn();
      return;
    }

    if (event.ctrlKey && key === "-") {
      event.preventDefault();
      actions.zoomOut();
      return;
    }

    if (!event.ctrlKey && !event.metaKey) {
      if (key === "p") {
        event.preventDefault();
        actions.togglePreview();
      }
      if (key === "d") {
        actions.toggleTheme();
      }
      if (key === "v") {
        document.querySelector('[data-tool="selection"]').click();
      }
      if (key === "t") {
        document.querySelector('[data-tool="textFrame"]').click();
      }
      if (key === "i") {
        document.querySelector('[data-tool="imageFrame"]').click();
      }
      if (key === "n") {
        actions.addPage();
      }
      if (key === "delete" || key === "backspace") {
        const inInput = /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || "");
        if (!inInput) {
          event.preventDefault();
          actions.deleteSelectedPages();
        }
      }
    }
  });

  setStatus("BOOK FORGE initialisé");
}

bootstrap().catch((error) => {
  console.error("Bootstrap failure", error);
  setStatus("Erreur au démarrage");
});
