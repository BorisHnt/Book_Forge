import { normalizeFrame } from "../layout/frameEngine.js";
import { hydrateIcons } from "./icons.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uid(prefix = "frame") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function isPdfType(value) {
  return typeof value === "string" && value.toLowerCase().includes("pdf");
}

function isPdfImportedFrame(frame) {
  return Boolean(frame?.importedFrom && isPdfType(frame.importedFrom));
}

export function getPdfImportedFrames(page) {
  return (page?.frames || []).filter((frame) => isPdfImportedFrame(frame) || frame.importedFrom === "pdf");
}

export function isPdfImportedPage(page) {
  if (!page) {
    return false;
  }
  if (page.imported?.source === "pdf") {
    return true;
  }
  if (isPdfType(page.backgroundReference?.sourceType)) {
    return true;
  }
  return getPdfImportedFrames(page).length > 0;
}

export function centerImportedFramesOnPage(page) {
  const frames = getPdfImportedFrames(page);
  let moved = 0;

  frames.forEach((frame) => {
    const width = clamp(Number(frame.w || 0), 1, 100);
    const height = clamp(Number(frame.h || 0), 1, 100);
    const centeredX = clamp((100 - width) / 2, 0, 100 - width);
    const centeredY = clamp((100 - height) / 2, 0, 100 - height);

    frame.x = centeredX;
    frame.y = centeredY;
    moved += 1;
  });

  return moved;
}

export function createImportedClipboardSnapshot(page) {
  const frames = getPdfImportedFrames(page).map((frame) => structuredClone(frame));
  const reference = isPdfType(page?.backgroundReference?.sourceType)
    ? structuredClone(page.backgroundReference)
    : null;

  return {
    sourcePageId: page?.id || null,
    fileName: page?.imported?.fileName || reference?.sourceName || "",
    frames,
    backgroundReference: reference
  };
}

export function pasteImportedSnapshot(targetPage, snapshot, options = {}) {
  if (!targetPage || !snapshot) {
    return { insertedFrames: 0, lastFrameId: null };
  }

  const offset = Number.isFinite(options.offset) ? Number(options.offset) : 2;
  targetPage.frames = targetPage.frames || [];

  const pastedFrames = (snapshot.frames || []).map((frame, index) =>
    normalizeFrame({
      ...structuredClone(frame),
      id: uid("frame"),
      x: clamp(Number(frame.x || 0) + offset + index * 0.4, 0, 99),
      y: clamp(Number(frame.y || 0) + offset + index * 0.4, 0, 99),
      locked: false,
      hidden: false
    }, frame.type)
  );

  if (pastedFrames.length) {
    targetPage.frames.push(...pastedFrames);
  }

  if (!targetPage.backgroundReference && snapshot.backgroundReference) {
    targetPage.backgroundReference = structuredClone(snapshot.backgroundReference);
  }

  return {
    insertedFrames: pastedFrames.length,
    lastFrameId: pastedFrames.at(-1)?.id || null
  };
}

export function removeImportedPdfContentFromPage(page) {
  if (!page) {
    return { removedFrames: 0, removedReference: false };
  }

  const before = (page.frames || []).length;
  page.frames = (page.frames || []).filter((frame) => !isPdfImportedFrame(frame) && frame.importedFrom !== "pdf");
  const removedFrames = before - page.frames.length;

  let removedReference = false;
  if (isPdfType(page.backgroundReference?.sourceType)) {
    page.backgroundReference = null;
    removedReference = true;
  }

  if (page.imported?.source === "pdf" && !page.frames.length && !page.backgroundReference) {
    page.imported = null;
  }

  return { removedFrames, removedReference };
}

function getPageById(store, pageId) {
  return store.getState().document.pages.find((page) => page.id === pageId) || null;
}

function positionMenu(menu, x, y) {
  const gap = 8;
  const width = menu.offsetWidth || 220;
  const height = menu.offsetHeight || 180;
  const maxX = window.innerWidth - width - gap;
  const maxY = window.innerHeight - height - gap;
  const nextX = clamp(x, gap, Math.max(gap, maxX));
  const nextY = clamp(y, gap, Math.max(gap, maxY));
  menu.style.left = `${nextX}px`;
  menu.style.top = `${nextY}px`;
}

function createMenuMarkup({ canCenter, canPaste, canDeletePage }) {
  return `
    <header class="context-menu-title">Page PDF importée</header>
    <button class="context-menu-item" data-action="removeContent" data-tool="delete" title="Supprimer le contenu importé">
      <span>Supprimer contenu importé</span>
    </button>
    <button class="context-menu-item" data-action="centerContent" data-tool="grid" title="Centrer le contenu importé" ${canCenter ? "" : "disabled"}>
      <span>Centrer le contenu</span>
    </button>
    <button class="context-menu-item" data-action="copyContent" data-tool="link" title="Copier le contenu importé">
      <span>Copier</span>
    </button>
    <button class="context-menu-item" data-action="pasteContent" data-tool="add" title="Coller le contenu importé" ${canPaste ? "" : "disabled"}>
      <span>Coller</span>
    </button>
    <div class="context-menu-separator"></div>
    <button class="context-menu-item danger" data-action="deletePage" data-tool="delete" title="Supprimer la page importée" ${canDeletePage ? "" : "disabled"}>
      <span>Supprimer la page</span>
    </button>
  `;
}

export function initPageContextMenu({ store, pageManager, viewport }) {
  if (!viewport) {
    return { destroy: () => {} };
  }

  const menu = document.createElement("section");
  menu.className = "context-menu-popover";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  document.body.appendChild(menu);

  let clipboard = null;
  let currentPageId = null;
  let suppressOpenUntil = 0;
  let lastOpenPointerStamp = -1;

  const closeMenu = () => {
    if (menu.hidden) {
      return;
    }
    menu.hidden = true;
    currentPageId = null;
    menu.innerHTML = "";
    menu.style.left = "-9999px";
    menu.style.top = "-9999px";
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("blur", closeMenu);
    window.removeEventListener("resize", closeMenu);
  };

  const onPointerDown = (event) => {
    if (!menu.hidden && !menu.contains(event.target)) {
      closeMenu();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  };

  const bindCloseHandlers = () => {
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
  };

  const openMenu = (page, x, y) => {
    const canCenter = getPdfImportedFrames(page).length > 0;
    const canDeletePage = pageManager.canDelete([page.id]);
    const canPaste = Boolean(clipboard && (clipboard.frames?.length || clipboard.backgroundReference));

    menu.innerHTML = createMenuMarkup({
      canCenter,
      canPaste,
      canDeletePage
    });
    hydrateIcons(menu);

    menu.querySelector('[data-action="removeContent"]').addEventListener("click", () => {
      suppressOpenUntil = performance.now() + 260;
      closeMenu();
      store.commit("context-remove-imported-content", (draft) => {
        const draftPage = draft.document.pages.find((candidate) => candidate.id === page.id);
        if (!draftPage) {
          return;
        }
        removeImportedPdfContentFromPage(draftPage);
        draft.view.selectedPageId = draftPage.id;
        draft.view.selectedFrameId = null;
        draft.view.selectedFramePageId = null;
      });
      store.emit("PAGE_REBUILT", { reason: "context-remove-imported-content", pageId: page.id });
    });

    menu.querySelector('[data-action="centerContent"]').addEventListener("click", () => {
      suppressOpenUntil = performance.now() + 260;
      closeMenu();
      const target = getPageById(store, page.id);
      if (!target || !getPdfImportedFrames(target).length) {
        return;
      }
      let moved = 0;
      store.commit("context-center-imported-content", (draft) => {
        const draftPage = draft.document.pages.find((candidate) => candidate.id === page.id);
        if (!draftPage) {
          return;
        }
        moved = centerImportedFramesOnPage(draftPage);
        draft.view.selectedPageId = draftPage.id;
        draft.view.selectedFrameId = null;
        draft.view.selectedFramePageId = null;
      });
      if (moved > 0) {
        store.emit("FRAME_MOVED", { reason: "context-center-imported-content", pageId: page.id, count: moved });
      }
    });

    menu.querySelector('[data-action="copyContent"]').addEventListener("click", () => {
      const sourcePage = getPageById(store, page.id);
      clipboard = createImportedClipboardSnapshot(sourcePage);
      suppressOpenUntil = performance.now() + 260;
      closeMenu();
    });

    menu.querySelector('[data-action="pasteContent"]').addEventListener("click", () => {
      suppressOpenUntil = performance.now() + 260;
      closeMenu();
      if (!clipboard) {
        return;
      }
      let pasteResult = { insertedFrames: 0, lastFrameId: null };
      store.commit("context-paste-imported-content", (draft) => {
        const draftPage = draft.document.pages.find((candidate) => candidate.id === page.id);
        if (!draftPage) {
          return;
        }
        pasteResult = pasteImportedSnapshot(draftPage, clipboard, { offset: 2 });
        draft.view.selectedPageId = draftPage.id;
        draft.view.selectedFrameId = pasteResult.lastFrameId;
        draft.view.selectedFramePageId = pasteResult.lastFrameId ? draftPage.id : null;
      });

      if (pasteResult.insertedFrames > 0) {
        store.emit("IMPORT_FRAMES_CREATED", { reason: "context-paste-imported-content", count: pasteResult.insertedFrames });
        store.emit("PAGE_REBUILT", { reason: "context-paste-imported-content", pageId: page.id });
      }
    });

    menu.querySelector('[data-action="deletePage"]').addEventListener("click", () => {
      suppressOpenUntil = performance.now() + 260;
      closeMenu();
      if (pageManager.canDelete([page.id])) {
        pageManager.requestDelete([page.id]);
      }
    });

    menu.hidden = false;
    menu.style.left = "-9999px";
    menu.style.top = "-9999px";
    positionMenu(menu, x, y);
    currentPageId = page.id;
    bindCloseHandlers();
  };

  const resolvePdfPageFromEvent = (event) => {
    const pageEl = event.target.closest(".page-canvas");
    if (!pageEl || pageEl.classList.contains("virtual-blank")) {
      closeMenu();
      return null;
    }

    const pageId = pageEl.dataset.pageId;
    const page = getPageById(store, pageId);
    if (!isPdfImportedPage(page)) {
      closeMenu();
      return null;
    }
    return page;
  };

  const onContextMenu = (event) => {
    const page = resolvePdfPageFromEvent(event);
    if (!page) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (performance.now() < suppressOpenUntil) {
      return;
    }

    if (event.pointerId && event.pointerId === lastOpenPointerStamp) {
      return;
    }

    if (!menu.hidden && currentPageId === page.id) {
      closeMenu();
      return;
    }
    closeMenu();
    openMenu(page, event.clientX, event.clientY);
  };

  const onRightPointerDown = (event) => {
    if (event.button !== 2) {
      return;
    }

    const page = resolvePdfPageFromEvent(event);
    if (!page) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (performance.now() < suppressOpenUntil) {
      return;
    }

    lastOpenPointerStamp = event.pointerId || -1;

    if (!menu.hidden && currentPageId === page.id) {
      closeMenu();
      return;
    }

    closeMenu();
    openMenu(page, event.clientX, event.clientY);
  };

  viewport.addEventListener("pointerdown", onRightPointerDown, true);
  viewport.addEventListener("contextmenu", onContextMenu);
  viewport.addEventListener("scroll", closeMenu, { passive: true });
  store.subscribe("state:changed", closeMenu);

  return {
    destroy() {
      closeMenu();
      viewport.removeEventListener("pointerdown", onRightPointerDown, true);
      viewport.removeEventListener("contextmenu", onContextMenu);
      viewport.removeEventListener("scroll", closeMenu);
      menu.remove();
    }
  };
}
