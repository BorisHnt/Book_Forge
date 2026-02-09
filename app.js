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

async function bootstrap() {
  initTheme();
  bindOfflineStatus();
  registerServiceWorker();

  await loadTablerSprite();

  const store = new Store();
  const panels = initPanels(store);

  const pagesApi = initPagesModule(store, {
    pagesList: document.getElementById("pagesList"),
    spreadViewport: document.getElementById("spreadViewport"),
    spreadLabel: document.getElementById("spreadLabel"),
    zoomLabel: document.getElementById("zoomLabel")
  });

  const sectionsApi = initSectionsModule(store, {
    sectionsList: document.getElementById("sectionsList")
  });

  const mastersApi = initMastersModule(store, {
    mastersList: document.getElementById("mastersList")
  });

  initStylesModule(store, {
    stylesPanel: document.getElementById("stylesPanel")
  });

  initBookSettingsModule(store, {
    bookSettingsPanel: document.getElementById("bookSettingsPanel")
  });

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

  const actions = {
    undo: () => store.undo(),
    redo: () => store.redo(),
    addPage: () => pagesApi.addPage(),
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
    }
  });

  setStatus("BOOK FORGE initialisé");
}

bootstrap().catch((error) => {
  console.error("Bootstrap failure", error);
  setStatus("Erreur au démarrage");
});
