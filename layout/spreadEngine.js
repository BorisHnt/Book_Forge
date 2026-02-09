import { recomputePagination } from "../core/document.js";

function createVirtualFrontBlank() {
  return {
    id: "virtual-front-blank",
    name: "Page blanche",
    autoNumber: 0,
    displayNumber: "",
    sectionId: null,
    frames: [],
    isVirtualBlank: true
  };
}

export function spreadModeEnabled(doc, options = {}) {
  if (typeof options.forceSpreadMode === "boolean") {
    return options.forceSpreadMode;
  }
  return Boolean(doc.settings.startOnRight || doc.settings.spreads);
}

export function buildPageFlow(doc, options = {}) {
  const spreadMode = spreadModeEnabled(doc, options);
  const includeVirtualFrontBlank =
    options.includeVirtualFrontBlank ?? (spreadMode && Boolean(doc.settings.startOnRight));

  const slots = [];

  if (includeVirtualFrontBlank) {
    slots.push({
      slotIndex: 0,
      side: "left",
      pageId: "virtual-front-blank",
      page: createVirtualFrontBlank(),
      isVirtualBlank: true,
      spreadIndex: 0
    });
  }

  doc.pages.forEach((page) => {
    const slotIndex = slots.length;
    const side = spreadMode ? (slotIndex % 2 === 0 ? "left" : "right") : "single";
    slots.push({
      slotIndex,
      side,
      pageId: page.id,
      page,
      isVirtualBlank: false,
      spreadIndex: spreadMode ? Math.floor(slotIndex / 2) : slotIndex
    });
  });

  return slots;
}

export function buildSpreadGroups(doc, options = {}) {
  const spreadMode = spreadModeEnabled(doc, options);
  const flow = buildPageFlow(doc, { ...options, forceSpreadMode: spreadMode });

  if (!spreadMode) {
    return flow.map((slot, index) => ({
      index,
      slots: [slot]
    }));
  }

  const spreads = [];
  for (let i = 0; i < flow.length; i += 2) {
    const slice = flow.slice(i, i + 2);
    spreads.push({
      index: spreads.length,
      slots: slice.map((slot) => ({ ...slot, spreadIndex: spreads.length }))
    });
  }

  return spreads;
}

export function getPageSlotInfo(doc, pageId, options = {}) {
  const flow = buildPageFlow(doc, options);
  return flow.find((slot) => slot.pageId === pageId) || null;
}

export function applyBookLayoutRecalculation(doc) {
  if (doc.settings.startOnRight) {
    doc.settings.spreads = true;
  } else {
    doc.settings.spreads = false;
  }

  recomputePagination(doc);

  for (const page of doc.pages) {
    for (const frame of page.frames || []) {
      frame.x = Math.max(0, Math.min(100, Number(frame.x ?? 0)));
      frame.y = Math.max(0, Math.min(100, Number(frame.y ?? 0)));
      frame.w = Math.max(1, Math.min(100, Number(frame.w ?? 100)));
      frame.h = Math.max(1, Math.min(100, Number(frame.h ?? 100)));
    }
  }

  const flow = buildPageFlow(doc, { includeVirtualFrontBlank: doc.settings.startOnRight });
  doc.pages.forEach((page) => {
    const slot = flow.find((entry) => entry.pageId === page.id);
    page.bindingSide = slot?.side || "single";
    page.bindingEdge = slot?.side === "left" ? "right" : "left";
    page.spreadIndex = slot?.spreadIndex ?? 0;
  });

  doc.runtime = {
    ...(doc.runtime || {}),
    layout: {
      updatedAt: Date.now(),
      startOnRight: Boolean(doc.settings.startOnRight),
      spreads: buildSpreadGroups(doc, { includeVirtualFrontBlank: doc.settings.startOnRight }),
      flow
    }
  };

  return doc.runtime.layout;
}

export function getPrintablePageSequence(doc, options = {}) {
  const spreads = options.spreads ?? true;
  const flow = buildPageFlow(doc, {
    forceSpreadMode: spreads,
    includeVirtualFrontBlank: Boolean(doc.settings.startOnRight)
  });
  return flow;
}
