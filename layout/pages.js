import { createPage, findPage, getPageSizePx, mmToPx } from "../core/document.js";
import {
  applyBookLayoutRecalculation,
  buildSpreadGroups,
  getPageSlotInfo,
  spreadModeEnabled
} from "./spreadEngine.js";
import { renderMarginOverlay } from "./marginOverlay.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function renderPageCanvas(doc, slot) {
  const size = getPageSizePx(doc);
  const pageEl = document.createElement("article");
  pageEl.className = "page-canvas";
  pageEl.style.width = `${size.width}px`;
  pageEl.style.height = `${size.height}px`;

  if (slot.isVirtualBlank) {
    pageEl.classList.add("virtual-blank");
    pageEl.dataset.pageId = "virtual-front-blank";

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = "Page blanche fictive";

    const note = document.createElement("small");
    note.className = "blank-note";
    note.textContent = "Insérée automatiquement pour démarrer en recto (page 1 à droite).";
    pageEl.append(label, note);
    return pageEl;
  }

  const page = slot.page;
  const pageIndex = doc.pages.findIndex((candidate) => candidate.id === page.id);
  pageEl.dataset.pageId = page.id;

  const label = document.createElement("span");
  label.className = "page-label";
  label.textContent = `#${page.autoNumber}`;

  const masterTag = document.createElement("span");
  masterTag.className = "page-master-tag";
  const master = doc.masters.find((item) => item.id === page.masterId);
  masterTag.textContent = master ? master.name : "No master";

  const pageNumber = document.createElement("span");
  pageNumber.className = "page-number";
  pageNumber.textContent = page.displayNumber || String(page.autoNumber);

  const content = document.createElement("div");
  content.className = "page-content";

  const frames = page.frames.length
    ? page.frames
    : [
        {
          id: `${page.id}-fallback`,
          type: "text",
          x: 8,
          y: 14,
          w: 84,
          h: 70,
          content: "Double-cliquez pour éditer ce cadre texte."
        }
      ];

  for (const frame of frames) {
    const frameEl = document.createElement("div");
    frameEl.className = `frame ${frame.type === "image" ? "image" : "text"}`;
    frameEl.style.left = `${(frame.x / 100) * size.width}px`;
    frameEl.style.top = `${(frame.y / 100) * size.height}px`;
    frameEl.style.width = `${(frame.w / 100) * size.width}px`;
    frameEl.style.height = `${(frame.h / 100) * size.height}px`;
    frameEl.textContent = frame.type === "image" ? frame.content || "Image frame" : frame.content || "Text frame";
    content.appendChild(frameEl);
  }

  const masterOverlay = document.createElement("div");
  masterOverlay.className = "master-overlay";
  if (master?.header) {
    const header = document.createElement("div");
    header.style.position = "absolute";
    header.style.top = "6px";
    header.style.left = "16px";
    header.style.fontSize = "11px";
    header.style.fontFamily = "Avenir Next, Futura, Trebuchet MS, sans-serif";
    header.style.color = "#786a5c";
    header.textContent = master.header;
    masterOverlay.appendChild(header);
  }
  if (master?.footer) {
    const footer = document.createElement("div");
    footer.style.position = "absolute";
    footer.style.bottom = "6px";
    footer.style.left = "16px";
    footer.style.fontSize = "10px";
    footer.style.fontFamily = "Avenir Next, Futura, Trebuchet MS, sans-serif";
    footer.style.color = "#786a5c";
    footer.textContent = master.footer;
    masterOverlay.appendChild(footer);
  }

  const marginOverlay = renderMarginOverlay({
    doc,
    page,
    pageSizePx: size,
    slotInfo: slot
  });
  pageEl.appendChild(marginOverlay);

  if (doc.grids.guides) {
    const grid = document.createElement("div");
    grid.className = "grid-overlay";
    const colSize = size.width / Math.max(1, doc.grids.columns);
    grid.style.setProperty("--grid-col-size", `${colSize}px`);
    grid.style.setProperty("--grid-gutter-size", `${mmToPx(doc.grids.gutter, doc.settings.dpi)}px`);
    grid.style.setProperty("--grid-baseline-size", `${mmToPx(doc.grids.baseline, doc.settings.dpi)}px`);
    pageEl.appendChild(grid);
  }

  pageEl.append(label, masterTag, content, masterOverlay, pageNumber);
  return pageEl;
}

function renderSpread(store, refs) {
  const state = store.getState();
  const { document: doc, view } = state;
  const spreadViewport = refs.spreadViewport;
  spreadViewport.innerHTML = "";

  const spreads = buildSpreadGroups(doc, { includeVirtualFrontBlank: doc.settings.startOnRight });
  const index = clamp(view.spreadIndex, 0, Math.max(0, spreads.length - 1));
  const current = spreads[index] || { slots: [] };

  const spread = document.createElement("div");
  spread.className = "spread";
  spread.style.transform = `scale(${view.zoom})`;

  current.slots.forEach((slot) => {
    spread.appendChild(renderPageCanvas(doc, slot));
  });

  if (!current.slots.length) {
    const empty = document.createElement("p");
    empty.textContent = "Aucune page";
    spread.appendChild(empty);
  }

  spreadViewport.appendChild(spread);

  const spreadMode = spreadModeEnabled(doc);
  refs.spreadLabel.textContent = spreadMode
    ? `Spread ${index + 1}/${spreads.length}`
    : `Page ${index + 1}/${spreads.length}`;
  refs.zoomLabel.textContent = `${Math.round(view.zoom * 100)}%`;
}

function renderThumbnails(store, refs) {
  const state = store.getState();
  const { document: doc, view } = state;
  const target = refs.pagesList;
  target.innerHTML = "";

  doc.pages.forEach((page, pageIndex) => {
    const item = document.createElement("article");
    item.className = "thumb-item";
    item.draggable = true;
    item.dataset.pageId = page.id;
    item.classList.toggle("active", page.id === view.selectedPageId);

    const head = document.createElement("div");
    head.className = "thumb-head";

    const title = document.createElement("strong");
    title.textContent = `${page.name} (${page.displayNumber || page.autoNumber})`;

    const actions = document.createElement("div");
    actions.className = "inline-actions";

    const moveLeft = document.createElement("button");
    moveLeft.className = "tool-btn compact";
    moveLeft.dataset.tool = "chevronLeft";
    moveLeft.title = "Déplacer avant";
    moveLeft.addEventListener("click", () => movePage(store, page.id, pageIndex - 1));

    const moveRight = document.createElement("button");
    moveRight.className = "tool-btn compact";
    moveRight.dataset.tool = "chevronRight";
    moveRight.title = "Déplacer après";
    moveRight.addEventListener("click", () => movePage(store, page.id, pageIndex + 1));

    actions.append(moveLeft, moveRight);
    head.append(title, actions);

    const mini = document.createElement("div");
    mini.className = "thumb-mini";

    const meta = document.createElement("small");
    const section = doc.sections.find((entry) => entry.id === page.sectionId);
    const slot = getPageSlotInfo(doc, page.id, { includeVirtualFrontBlank: doc.settings.startOnRight });
    meta.textContent = `${section?.name || "Sans section"} · ${page.masterId} · ${slot?.side || "single"}`;

    item.append(head, mini, meta);

    item.addEventListener("click", () => {
      store.commit("select-page", (draft) => {
        draft.view.selectedPageId = page.id;
        const slotInfo = getPageSlotInfo(draft.document, page.id, { includeVirtualFrontBlank: draft.document.settings.startOnRight });
        draft.view.spreadIndex = Math.max(0, slotInfo?.spreadIndex || 0);
      }, { trackHistory: false });
    });

    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", page.id);
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      item.classList.add("active");
    });

    item.addEventListener("dragleave", () => item.classList.remove("active"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("active");
      const draggedPageId = event.dataTransfer.getData("text/plain");
      if (!draggedPageId || draggedPageId === page.id) {
        return;
      }
      movePage(store, draggedPageId, pageIndex);
    });

    target.appendChild(item);
  });
}

function movePage(store, pageId, targetIndex) {
  store.commit("reorder-page", (draft) => {
    const pages = draft.document.pages;
    const sourceIndex = pages.findIndex((page) => page.id === pageId);
    if (sourceIndex < 0) {
      return;
    }
    const [page] = pages.splice(sourceIndex, 1);
    const nextIndex = clamp(targetIndex, 0, pages.length);
    pages.splice(nextIndex, 0, page);
    applyBookLayoutRecalculation(draft.document);
  });
  store.emit("SPREADS_UPDATED", "reorder-page");
}

export function initPagesModule(store, refs) {
  function render() {
    renderThumbnails(store, refs);
    renderSpread(store, refs);
  }

  store.subscribe("state:changed", render);
  store.subscribe("ui:changed", render);
  store.subscribe("SPREADS_UPDATED", render);
  store.subscribe("MARGINS_UPDATED", render);

  render();

  return {
    addPage() {
      store.commit("add-page", (draft) => {
        const pages = draft.document.pages;
        const selectedId = draft.view.selectedPageId;
        const selectedIndex = selectedId ? pages.findIndex((page) => page.id === selectedId) : pages.length - 1;
        const insertIndex = selectedIndex < 0 ? pages.length : selectedIndex + 1;
        const selected = findPage(draft.document, selectedId);

        const page = createPage({
          sectionId: selected?.sectionId || draft.document.sections[0]?.id,
          number: pages.length + 1,
          masterId: selected?.masterId || "master-default",
          frames: [
            {
              id: `frame-${Math.random().toString(36).slice(2, 8)}`,
              type: "text",
              x: 8,
              y: 15,
              w: 84,
              h: 68,
              content: "Nouveau contenu importé dans BOOK FORGE."
            }
          ]
        });

        pages.splice(insertIndex, 0, page);
        draft.view.selectedPageId = page.id;
        applyBookLayoutRecalculation(draft.document);
        const slot = getPageSlotInfo(draft.document, page.id, { includeVirtualFrontBlank: draft.document.settings.startOnRight });
        draft.view.spreadIndex = slot?.spreadIndex || 0;
      });
      store.emit("SPREADS_UPDATED", "add-page");
    },

    toggleSpread() {
      store.commit("toggle-spread-mode", (draft) => {
        if (draft.document.settings.startOnRight) {
          draft.document.settings.startOnRight = false;
          draft.document.settings.spreads = false;
        } else {
          draft.document.settings.spreads = !draft.document.settings.spreads;
        }
        applyBookLayoutRecalculation(draft.document);
      }, { trackHistory: false });
      store.emit("SPREADS_UPDATED", "toggle-spread-mode");
    },

    prevSpread() {
      store.commit("prev-spread", (draft) => {
        draft.view.spreadIndex = Math.max(0, draft.view.spreadIndex - 1);
      }, { trackHistory: false });
    },

    nextSpread() {
      store.commit("next-spread", (draft) => {
        const spreads = buildSpreadGroups(draft.document, { includeVirtualFrontBlank: draft.document.settings.startOnRight });
        draft.view.spreadIndex = Math.min(spreads.length - 1, draft.view.spreadIndex + 1);
      }, { trackHistory: false });
    },

    fitView() {
      store.commit("fit-view", (draft) => {
        draft.view.zoom = 0.56;
      }, { trackHistory: false });
    },

    zoomIn() {
      store.commit("zoom-in", (draft) => {
        draft.view.zoom = clamp(draft.view.zoom + 0.1, 0.2, 1.8);
      }, { trackHistory: false });
    },

    zoomOut() {
      store.commit("zoom-out", (draft) => {
        draft.view.zoom = clamp(draft.view.zoom - 0.1, 0.2, 1.8);
      }, { trackHistory: false });
    },

    toggleRulers() {
      store.commit("toggle-guides", (draft) => {
        draft.document.grids.guides = !draft.document.grids.guides;
        draft.document.grids.rulers = draft.document.grids.guides;
      }, { trackHistory: false });
    },

    jumpToPage(pageId) {
      store.commit("jump-page", (draft) => {
        draft.view.selectedPageId = pageId;
        const slot = getPageSlotInfo(draft.document, pageId, { includeVirtualFrontBlank: draft.document.settings.startOnRight });
        if (slot) {
          draft.view.spreadIndex = slot.spreadIndex;
        }
      }, { trackHistory: false });
    }
  };
}
