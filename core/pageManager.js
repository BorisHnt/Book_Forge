import { applyBookLayoutRecalculation, getPageSlotInfo } from "../layout/spreadEngine.js";

function uniquePageIds(pageIds = []) {
  return [...new Set((pageIds || []).filter(Boolean))];
}

function chooseNextSelectedPageId(pages, deletedSet, fallbackId = null) {
  if (!pages.length) {
    return null;
  }

  const survivor = pages.find((page) => !deletedSet.has(page.id));
  if (survivor) {
    return survivor.id;
  }

  return fallbackId || pages[0].id;
}

export function createPageManager(store) {
  const getSelection = () => uniquePageIds(store.getState().view.pageSelectionIds || []);

  const canDelete = (pageIds) => {
    const state = store.getState();
    const ids = uniquePageIds(pageIds?.length ? pageIds : getSelection());
    if (!ids.length) {
      return false;
    }

    const existing = ids.filter((id) => state.document.pages.some((page) => page.id === id));
    return state.document.pages.length - existing.length >= 1;
  };

  const setSelection = (pageIds, options = { keepCurrent: false }) => {
    const ids = uniquePageIds(pageIds);
    store.commit("set-page-selection", (draft) => {
      draft.view.pageSelectionIds = ids;
      if (!options.keepCurrent && ids.length === 1) {
        draft.view.selectedPageId = ids[0];
      }
    }, { trackHistory: false });
  };

  const toggleSelection = (pageId, mode = "replace") => {
    const current = getSelection();
    const has = current.includes(pageId);

    let next = [];
    if (mode === "toggle") {
      next = has ? current.filter((id) => id !== pageId) : [...current, pageId];
    } else {
      next = [pageId];
    }

    setSelection(next, { keepCurrent: false });
  };

  const clearSelection = () => {
    setSelection([], { keepCurrent: true });
  };

  const requestDelete = (pageIds = []) => {
    const ids = uniquePageIds(pageIds.length ? pageIds : getSelection());
    store.emit("PAGE_DELETE_REQUEST", {
      pageIds: ids,
      canDelete: canDelete(ids)
    });
  };

  const cancelDelete = (pageIds = []) => {
    store.emit("PAGE_DELETE_CANCEL", {
      pageIds: uniquePageIds(pageIds)
    });
  };

  const deletePages = (pageIds = []) => {
    const ids = uniquePageIds(pageIds.length ? pageIds : getSelection());
    const state = store.getState();
    const existing = ids.filter((id) => state.document.pages.some((page) => page.id === id));

    if (!existing.length || state.document.pages.length - existing.length < 1) {
      return false;
    }

    store.commit("delete-pages", (draft) => {
      const deletedSet = new Set(existing);
      draft.document.pages = draft.document.pages.filter((page) => !deletedSet.has(page.id));

      draft.document.sections.forEach((section) => {
        section.pageIds = (section.pageIds || []).filter((id) => !deletedSet.has(id));
      });

      applyBookLayoutRecalculation(draft.document);

      const nextSelected = chooseNextSelectedPageId(draft.document.pages, deletedSet, draft.document.pages[0]?.id || null);
      draft.view.selectedPageId = nextSelected;
      draft.view.pageSelectionIds = nextSelected ? [nextSelected] : [];

      const slot = nextSelected
        ? getPageSlotInfo(draft.document, nextSelected, { includeVirtualFrontBlank: draft.document.settings.startOnRight })
        : null;
      draft.view.spreadIndex = Math.max(0, slot?.spreadIndex || 0);
      draft.view.selectedFrameId = null;
      draft.view.selectedFramePageId = null;
    });

    store.emit("PAGE_DELETED", {
      pageIds: existing
    });
    store.emit("SPREADS_UPDATED", "delete-pages");
    return true;
  };

  return {
    getSelection,
    setSelection,
    toggleSelection,
    clearSelection,
    canDelete,
    requestDelete,
    cancelDelete,
    deletePages
  };
}
