import {
  createPage,
  findPage,
  getPageSizePx,
  mmToPx,
  recomputePagination
} from "../core/document.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPageGroups(doc) {
  const pages = doc.pages;
  if (!doc.settings.spreads) {
    return pages.map((page) => [page]);
  }

  const groups = [];
  for (let index = 0; index < pages.length; index += 2) {
    groups.push(pages.slice(index, index + 2));
  }
  return groups;
}

function getMarginsPx(doc, pageIndex) {
  const settings = doc.settings;
  const base = settings.margins;
  const odd = (pageIndex + 1) % 2 === 1;
  const compensation = base.oddEvenCompensation || 0;

  const insideExtra = odd ? compensation : -compensation;
  const outsideExtra = odd ? -compensation : compensation;

  const insidePx = mmToPx(Math.max(0, base.inside + insideExtra), settings.dpi);
  const outsidePx = mmToPx(Math.max(0, base.outside + outsideExtra), settings.dpi);

  return {
    top: mmToPx(base.top, settings.dpi),
    bottom: mmToPx(base.bottom, settings.dpi),
    left: odd ? insidePx : outsidePx,
    right: odd ? outsidePx : insidePx
  };
}

function renderPageCanvas(doc, page, pageIndex) {
  const size = getPageSizePx(doc);
  const pageEl = document.createElement("article");
  pageEl.className = "page-canvas";
  pageEl.dataset.pageId = page.id;
  pageEl.style.width = `${size.width}px`;
  pageEl.style.height = `${size.height}px`;

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
          id: `${page.id}-fallback` ,
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

  if (doc.settings.margins.visible) {
    const marginOverlay = document.createElement("div");
    marginOverlay.className = "margin-overlay";
    const margins = getMarginsPx(doc, pageIndex);
    const colors = doc.settings.margins.colors;
    const stroke = doc.settings.margins.stroke || 1;
    marginOverlay.style.borderWidth = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;
    if (colors.mode === "single") {
      marginOverlay.style.borderColor = colors.all;
    } else {
      marginOverlay.style.borderTopColor = colors.top;
      marginOverlay.style.borderRightColor = colors.outside;
      marginOverlay.style.borderBottomColor = colors.bottom;
      marginOverlay.style.borderLeftColor = colors.inside;
    }
    marginOverlay.style.borderStyle = "solid";
    marginOverlay.style.outline = `${stroke}px solid transparent`;
    pageEl.appendChild(marginOverlay);
  }

  if (doc.settings.bleedVisible) {
    const bleedOverlay = document.createElement("div");
    bleedOverlay.className = "bleed-overlay";
    const bleedPx = mmToPx(doc.settings.bleed, doc.settings.dpi);
    bleedOverlay.style.inset = `${-bleedPx}px`;
    pageEl.appendChild(bleedOverlay);
  }

  if (doc.settings.safeVisible) {
    const safe = document.createElement("div");
    safe.className = "safe-overlay";
    const safePx = mmToPx(doc.settings.safeArea, doc.settings.dpi);
    safe.style.inset = `${safePx}px`;
    pageEl.appendChild(safe);
  }

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

  const groups = getPageGroups(doc);
  const index = clamp(view.spreadIndex, 0, Math.max(0, groups.length - 1));
  const currentGroup = groups[index] || [];

  const spread = document.createElement("div");
  spread.className = "spread";
  spread.style.transform = `scale(${view.zoom})`;

  currentGroup.forEach((page) => {
    const pageIndex = doc.pages.findIndex((candidate) => candidate.id === page.id);
    spread.appendChild(renderPageCanvas(doc, page, pageIndex));
  });

  if (!currentGroup.length) {
    const empty = document.createElement("p");
    empty.textContent = "Aucune page";
    spread.appendChild(empty);
  }

  spreadViewport.appendChild(spread);

  refs.spreadLabel.textContent = doc.settings.spreads ? `Spread ${index + 1}/${groups.length}` : `Page ${index + 1}/${groups.length}`;
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
    meta.textContent = `${section?.name || "Sans section"} · ${page.masterId}`;

    item.append(head, mini, meta);

    item.addEventListener("click", () => {
      store.commit("select-page", (draft) => {
        draft.view.selectedPageId = page.id;
        const groupIndex = getPageGroups(draft.document).findIndex((group) => group.some((p) => p.id === page.id));
        draft.view.spreadIndex = Math.max(0, groupIndex);
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
    recomputePagination(draft.document);
  });
}

export function initPagesModule(store, refs) {
  function render() {
    renderThumbnails(store, refs);
    renderSpread(store, refs);
  }

  store.subscribe("state:changed", render);
  store.subscribe("ui:changed", render);

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
        draft.view.spreadIndex = getPageGroups(draft.document).findIndex((group) => group.some((entry) => entry.id === page.id));
      });
    },

    toggleSpread() {
      store.commit("toggle-spread-mode", (draft) => {
        draft.document.settings.spreads = !draft.document.settings.spreads;
      }, { trackHistory: false });
    },

    prevSpread() {
      store.commit("prev-spread", (draft) => {
        draft.view.spreadIndex = Math.max(0, draft.view.spreadIndex - 1);
      }, { trackHistory: false });
    },

    nextSpread() {
      store.commit("next-spread", (draft) => {
        const groups = getPageGroups(draft.document);
        draft.view.spreadIndex = Math.min(groups.length - 1, draft.view.spreadIndex + 1);
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
        const index = getPageGroups(draft.document).findIndex((group) => group.some((page) => page.id === pageId));
        if (index >= 0) {
          draft.view.spreadIndex = index;
        }
      }, { trackHistory: false });
    }
  };
}
