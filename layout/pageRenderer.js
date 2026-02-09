import { getPageSizePx, mmToPx } from "../core/document.js";
import { renderMarginOverlay } from "./marginOverlay.js";
import { renderBackgroundReferenceLayer } from "./backgroundReferenceLayer.js";
import {
  bindFrameInteractions,
  ensurePageFrames,
  frameOverflowsMargins,
  frameToInlineStyle
} from "./frameEngine.js";

function renderMasterOverlay(master) {
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

  return masterOverlay;
}

function renderFrameContent(frame) {
  if (frame.type === "image") {
    const box = document.createElement("div");
    box.className = "frame-image-content";
    if (frame.src) {
      const img = document.createElement("img");
      img.src = frame.src;
      img.alt = frame.content || "Imported image";
      const zoom = frame.crop?.zoom || 1;
      img.style.transform = `scale(${zoom})`;
      box.appendChild(img);
    } else {
      box.textContent = frame.content || "Image frame";
    }
    return box;
  }

  if (frame.type === "table") {
    const pre = document.createElement("pre");
    pre.className = "frame-table-content";
    pre.textContent = frame.content || "Table";
    return pre;
  }

  const text = document.createElement("div");
  text.className = "frame-text-content";
  text.textContent = frame.content || "Text frame";
  return text;
}

function addFrameControls(frameEl, frame) {
  const controls = document.createElement("div");
  controls.className = "frame-controls";
  controls.innerHTML = `
    <button class="tool-btn compact frame-action frame-action-lock" data-tool="settings" title="Verrouiller/Déverrouiller"></button>
    <button class="tool-btn compact frame-action frame-action-hide" data-tool="theme" title="Masquer/Afficher"></button>
    <button class="tool-btn compact frame-action frame-action-replace" data-tool="import" title="Remplacer contenu"></button>
    <button class="tool-btn compact frame-action frame-action-delete" data-tool="delete" title="Supprimer cadre"></button>
  `;
  frameEl.appendChild(controls);

  const resize = document.createElement("div");
  resize.className = "frame-handle frame-handle-resize";
  resize.title = "Redimensionner";
  frameEl.appendChild(resize);

  const rotate = document.createElement("div");
  rotate.className = "frame-handle frame-handle-rotate";
  rotate.title = "Pivoter";
  frameEl.appendChild(rotate);

  if (frame.locked) {
    frameEl.classList.add("locked");
  }
}

function renderVirtualBlankPage(slot, pageSizePx) {
  const pageEl = document.createElement("article");
  pageEl.className = "page-canvas virtual-blank";
  pageEl.dataset.pageId = slot.pageId;
  pageEl.style.width = `${pageSizePx.width}px`;
  pageEl.style.height = `${pageSizePx.height}px`;

  const label = document.createElement("span");
  label.className = "page-label";
  label.textContent = "Page blanche fictive";

  const note = document.createElement("small");
  note.className = "blank-note";
  note.textContent = "Insérée automatiquement pour démarrer en recto (page 1 à droite).";

  pageEl.append(label, note);
  return pageEl;
}

export function renderPageSlot({ store, doc, slot }) {
  const pageSizePx = getPageSizePx(doc);

  if (slot.isVirtualBlank) {
    return renderVirtualBlankPage(slot, pageSizePx);
  }

  const page = slot.page;
  ensurePageFrames(page);

  const pageEl = document.createElement("article");
  pageEl.className = "page-canvas";
  pageEl.dataset.pageId = page.id;
  pageEl.style.width = `${pageSizePx.width}px`;
  pageEl.style.height = `${pageSizePx.height}px`;

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

  const referenceLayer = renderBackgroundReferenceLayer(page);
  if (referenceLayer) {
    content.appendChild(referenceLayer);
  }

  const state = store.getState();
  const selectedFrameId = state.view.selectedFrameId;
  const selectedFramePageId = state.view.selectedFramePageId;

  const frames = [...page.frames].sort((a, b) => String(a.layer).localeCompare(String(b.layer)));
  frames.forEach((frame) => {
    if (frame.hidden) {
      return;
    }

    const frameEl = document.createElement("div");
    frameEl.className = `frame frame-object frame-${frame.type}`;
    frameEl.dataset.frameId = frame.id;
    frameEl.dataset.pageId = page.id;
    frameEl.dataset.layer = frame.layer;

    const style = frameToInlineStyle(frame, pageSizePx);
    frameEl.style.left = style.left;
    frameEl.style.top = style.top;
    frameEl.style.width = style.width;
    frameEl.style.height = style.height;
    frameEl.style.transform = style.transform;

    if (frame.imported) {
      frameEl.classList.add("imported-frame");
    }

    const overflow = frameOverflowsMargins(frame, {
      doc,
      page,
      side: slot.side,
      pageSizePx
    });
    if (overflow) {
      frameEl.classList.add("frame-warning");
    }

    frameEl.appendChild(renderFrameContent(frame));

    const isSelected = selectedFrameId === frame.id && selectedFramePageId === page.id;
    if (isSelected) {
      addFrameControls(frameEl, frame);
    }

    bindFrameInteractions({
      store,
      doc,
      page,
      slotInfo: slot,
      pageSizePx,
      pageEl,
      frameEl,
      frame,
      selected: isSelected,
      onSelect: (frameId) => {
        store.commit("select-frame", (draft) => {
          draft.view.selectedPageId = page.id;
          draft.view.selectedFrameId = frameId;
          draft.view.selectedFramePageId = page.id;
        }, { trackHistory: false });
      }
    });

    content.appendChild(frameEl);
  });

  const marginOverlay = renderMarginOverlay({
    doc,
    page,
    pageSizePx,
    slotInfo: slot
  });
  pageEl.appendChild(marginOverlay);

  if (doc.grids.guides) {
    const grid = document.createElement("div");
    grid.className = "grid-overlay";
    const colSize = pageSizePx.width / Math.max(1, doc.grids.columns);
    grid.style.setProperty("--grid-col-size", `${colSize}px`);
    grid.style.setProperty("--grid-gutter-size", `${mmToPx(doc.grids.gutter, doc.settings.dpi)}px`);
    grid.style.setProperty("--grid-baseline-size", `${mmToPx(doc.grids.baseline, doc.settings.dpi)}px`);
    pageEl.appendChild(grid);
  }

  pageEl.append(label, masterTag, content, renderMasterOverlay(master), pageNumber);

  pageEl.addEventListener("click", (event) => {
    if (event.target.closest(".frame-object")) {
      return;
    }
    store.commit("select-page-canvas", (draft) => {
      draft.view.selectedPageId = page.id;
      draft.view.selectedFrameId = null;
      draft.view.selectedFramePageId = null;
    }, { trackHistory: false });
  });

  return pageEl;
}
