import { getMarginGeometryPx } from "./marginOverlay.js";

const SNAP_THRESHOLD_PX = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uid(prefix = "frame") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function normalizeFrame(frame, fallbackType = "text") {
  const base = frame || {};
  return {
    id: base.id || uid("frame"),
    type: base.type || fallbackType,
    x: clamp(Number(base.x ?? 8), 0, 100),
    y: clamp(Number(base.y ?? 8), 0, 100),
    w: clamp(Number(base.w ?? 50), 1, 100),
    h: clamp(Number(base.h ?? 20), 1, 100),
    rotation: Number(base.rotation || 0),
    locked: Boolean(base.locked),
    hidden: Boolean(base.hidden),
    layer: base.layer || (base.type === "image" ? "images" : "text"),
    content: base.content || "",
    styleId: base.styleId || null,
    crop: {
      x: Number(base.crop?.x || 0),
      y: Number(base.crop?.y || 0),
      w: Number(base.crop?.w || 100),
      h: Number(base.crop?.h || 100),
      zoom: Number(base.crop?.zoom || 1)
    },
    src: base.src || "",
    imported: Boolean(base.imported),
    importedFrom: base.importedFrom || "",
    nonPrintable: Boolean(base.nonPrintable)
  };
}

export function ensurePageFrames(page) {
  page.frames = (page.frames || []).map((frame) => normalizeFrame(frame));
  return page.frames;
}

export function findFrame(page, frameId) {
  ensurePageFrames(page);
  return page.frames.find((frame) => frame.id === frameId) || null;
}

function percentToPx(rectPercent, pageSizePx) {
  return {
    x: (rectPercent.x / 100) * pageSizePx.width,
    y: (rectPercent.y / 100) * pageSizePx.height,
    w: (rectPercent.w / 100) * pageSizePx.width,
    h: (rectPercent.h / 100) * pageSizePx.height
  };
}

function pxToPercent(rectPx, pageSizePx) {
  return {
    x: clamp((rectPx.x / pageSizePx.width) * 100, 0, 100),
    y: clamp((rectPx.y / pageSizePx.height) * 100, 0, 100),
    w: clamp((rectPx.w / pageSizePx.width) * 100, 1, 100),
    h: clamp((rectPx.h / pageSizePx.height) * 100, 1, 100)
  };
}

function maybeSnap(value, targets, threshold = SNAP_THRESHOLD_PX) {
  for (const target of targets) {
    if (Math.abs(value - target) <= threshold) {
      return target;
    }
  }
  return value;
}

export function snapFrameRectPx(rectPx, { doc, page, side, pageSizePx }) {
  const geometry = getMarginGeometryPx(doc, page, side);

  const marginLeft = geometry.px.left;
  const marginRight = pageSizePx.width - geometry.px.right;
  const marginTop = geometry.px.top;
  const marginBottom = pageSizePx.height - geometry.px.bottom;

  const snappedLeft = maybeSnap(rectPx.x, [0, marginLeft, marginRight - rectPx.w, pageSizePx.width - rectPx.w]);
  const snappedTop = maybeSnap(rectPx.y, [0, marginTop, marginBottom - rectPx.h, pageSizePx.height - rectPx.h]);

  const snappedRight = maybeSnap(snappedLeft + rectPx.w, [marginLeft, marginRight, pageSizePx.width]);
  const snappedBottom = maybeSnap(snappedTop + rectPx.h, [marginTop, marginBottom, pageSizePx.height]);

  const width = clamp(snappedRight - snappedLeft, 10, pageSizePx.width - snappedLeft);
  const height = clamp(snappedBottom - snappedTop, 10, pageSizePx.height - snappedTop);

  return {
    x: clamp(snappedLeft, 0, pageSizePx.width - width),
    y: clamp(snappedTop, 0, pageSizePx.height - height),
    w: width,
    h: height
  };
}

export function moveFrame(page, frameId, rectPx, context) {
  const frame = findFrame(page, frameId);
  if (!frame || frame.locked) {
    return null;
  }

  const snapped = snapFrameRectPx(rectPx, {
    ...context,
    page
  });

  const percent = pxToPercent(snapped, context.pageSizePx);
  frame.x = percent.x;
  frame.y = percent.y;
  return frame;
}

export function resizeFrame(page, frameId, rectPx, context) {
  const frame = findFrame(page, frameId);
  if (!frame || frame.locked) {
    return null;
  }

  const snapped = snapFrameRectPx(rectPx, {
    ...context,
    page
  });

  const percent = pxToPercent(snapped, context.pageSizePx);
  frame.x = percent.x;
  frame.y = percent.y;
  frame.w = percent.w;
  frame.h = percent.h;
  return frame;
}

export function rotateFrame(page, frameId, angle) {
  const frame = findFrame(page, frameId);
  if (!frame || frame.locked) {
    return null;
  }
  frame.rotation = Number.isFinite(angle) ? angle : frame.rotation;
  return frame;
}

export function replaceFrame(page, frameId, patch) {
  const frame = findFrame(page, frameId);
  if (!frame) {
    return null;
  }

  Object.assign(frame, patch || {});
  return frame;
}

export function removeFrame(page, frameId) {
  ensurePageFrames(page);
  const index = page.frames.findIndex((frame) => frame.id === frameId);
  if (index < 0) {
    return null;
  }
  const [removed] = page.frames.splice(index, 1);
  return removed;
}

export function frameOverflowsMargins(frame, { doc, page, side, pageSizePx }) {
  const geometry = getMarginGeometryPx(doc, page, side);
  const rect = percentToPx(frame, pageSizePx);

  const minX = geometry.px.left;
  const maxX = pageSizePx.width - geometry.px.right;
  const minY = geometry.px.top;
  const maxY = pageSizePx.height - geometry.px.bottom;

  return rect.x < minX || rect.y < minY || rect.x + rect.w > maxX || rect.y + rect.h > maxY;
}

export function frameToInlineStyle(frame, pageSizePx) {
  const rect = percentToPx(frame, pageSizePx);
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    transform: `rotate(${frame.rotation || 0}deg)`
  };
}

function updateFrameStyleFromRect(frameEl, rectPx, rotation = 0) {
  frameEl.style.left = `${rectPx.x}px`;
  frameEl.style.top = `${rectPx.y}px`;
  frameEl.style.width = `${rectPx.w}px`;
  frameEl.style.height = `${rectPx.h}px`;
  frameEl.style.transform = `rotate(${rotation}deg)`;
}

function parseRectFromElement(frameEl) {
  return {
    x: Number.parseFloat(frameEl.style.left || "0"),
    y: Number.parseFloat(frameEl.style.top || "0"),
    w: Number.parseFloat(frameEl.style.width || "0"),
    h: Number.parseFloat(frameEl.style.height || "0")
  };
}

function triggerFilePicker(onFile) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onFile(file, String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  input.click();
}

export function bindFrameInteractions({
  store,
  doc,
  page,
  slotInfo,
  pageSizePx,
  pageEl,
  frameEl,
  frame,
  selected,
  onSelect
}) {
  if (!frame || frame.hidden) {
    return;
  }

  const context = {
    doc,
    side: slotInfo?.side || "right",
    pageSizePx
  };

  const selectFrame = () => {
    onSelect?.(frame.id);
  };

  frameEl.addEventListener("pointerdown", (event) => {
    if (frame.locked) {
      return;
    }
    if (event.target.closest(".frame-handle") || event.target.closest(".frame-action")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectFrame();

    const start = parseRectFromElement(frameEl);
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const rect = {
        x: start.x + dx,
        y: start.y + dy,
        w: start.w,
        h: start.h
      };
      const snapped = snapFrameRectPx(rect, { ...context, page });
      updateFrameStyleFromRect(frameEl, snapped, frame.rotation || 0);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      const finalRect = parseRectFromElement(frameEl);
      store.commit("frame-move", (draft) => {
        const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
        if (!draftPage) {
          return;
        }
        moveFrame(draftPage, frame.id, finalRect, {
          ...context,
          doc: draft.document
        });
        draft.view.selectedFrameId = frame.id;
        draft.view.selectedFramePageId = page.id;
      });
      store.emit("FRAME_MOVED", frame.id);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  const resizeHandle = frameEl.querySelector(".frame-handle-resize");
  if (resizeHandle) {
    resizeHandle.addEventListener("pointerdown", (event) => {
      if (frame.locked) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectFrame();

      const start = parseRectFromElement(frameEl);
      const startX = event.clientX;
      const startY = event.clientY;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const rect = {
          x: start.x,
          y: start.y,
          w: clamp(start.w + dx, 10, pageSizePx.width - start.x),
          h: clamp(start.h + dy, 10, pageSizePx.height - start.y)
        };
        const snapped = snapFrameRectPx(rect, { ...context, page });
        updateFrameStyleFromRect(frameEl, snapped, frame.rotation || 0);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const finalRect = parseRectFromElement(frameEl);
        store.commit("frame-resize", (draft) => {
          const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
          if (!draftPage) {
            return;
          }
          resizeFrame(draftPage, frame.id, finalRect, {
            ...context,
            doc: draft.document
          });
          draft.view.selectedFrameId = frame.id;
          draft.view.selectedFramePageId = page.id;
        });
        store.emit("FRAME_RESIZED", frame.id);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  const rotateHandle = frameEl.querySelector(".frame-handle-rotate");
  if (rotateHandle) {
    rotateHandle.addEventListener("pointerdown", (event) => {
      if (frame.locked) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectFrame();

      const rect = frameEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const onMove = (moveEvent) => {
        const angle = Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx) * (180 / Math.PI);
        frameEl.style.transform = `rotate(${angle}deg)`;
      };

      const onUp = (upEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const angle = Math.atan2(upEvent.clientY - cy, upEvent.clientX - cx) * (180 / Math.PI);
        store.commit("frame-rotate", (draft) => {
          const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
          if (!draftPage) {
            return;
          }
          rotateFrame(draftPage, frame.id, angle);
          draft.view.selectedFrameId = frame.id;
          draft.view.selectedFramePageId = page.id;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  const lockBtn = frameEl.querySelector(".frame-action-lock");
  if (lockBtn) {
    lockBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      store.commit("frame-lock-toggle", (draft) => {
        const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
        const target = findFrame(draftPage, frame.id);
        if (target) {
          target.locked = !target.locked;
        }
      });
    });
  }

  const hideBtn = frameEl.querySelector(".frame-action-hide");
  if (hideBtn) {
    hideBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      store.commit("frame-hide-toggle", (draft) => {
        const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
        const target = findFrame(draftPage, frame.id);
        if (target) {
          target.hidden = !target.hidden;
        }
      });
    });
  }

  const deleteBtn = frameEl.querySelector(".frame-action-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      store.commit("frame-delete", (draft) => {
        const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
        if (!draftPage) {
          return;
        }
        removeFrame(draftPage, frame.id);
        if (draft.view.selectedFrameId === frame.id) {
          draft.view.selectedFrameId = null;
          draft.view.selectedFramePageId = null;
        }
      });
      store.emit("PAGE_REBUILT", page.id);
    });
  }

  const replaceBtn = frameEl.querySelector(".frame-action-replace");
  if (replaceBtn) {
    replaceBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (frame.type === "image") {
        triggerFilePicker((file, dataUrl) => {
          store.commit("frame-replace-image", (draft) => {
            const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
            const target = findFrame(draftPage, frame.id);
            if (target) {
              replaceFrame(draftPage, frame.id, {
                src: dataUrl,
                content: file.name,
                imported: true,
                importedFrom: file.type || "image"
              });
            }
          });
          store.emit("FRAME_REPLACED", frame.id);
        });
        return;
      }

      const nextText = window.prompt("Remplacer le texte du cadre", frame.content || "") ?? frame.content;
      store.commit("frame-replace-text", (draft) => {
        const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
        const target = findFrame(draftPage, frame.id);
        if (target) {
          replaceFrame(draftPage, frame.id, {
            content: nextText
          });
        }
      });
      store.emit("FRAME_REPLACED", frame.id);
    });
  }

  frameEl.addEventListener("dblclick", (event) => {
    if (frame.locked) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (frame.type === "image") {
      triggerFilePicker((file, dataUrl) => {
        store.commit("frame-replace-image", (draft) => {
          const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
          replaceFrame(draftPage, frame.id, {
            src: dataUrl,
            content: file.name,
            imported: true,
            importedFrom: file.type || "image"
          });
        });
        store.emit("FRAME_REPLACED", frame.id);
      });
      return;
    }

    const nextText = window.prompt("Editer le texte", frame.content || "");
    if (nextText === null) {
      return;
    }

    store.commit("frame-edit-text", (draft) => {
      const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
      replaceFrame(draftPage, frame.id, { content: nextText });
    });
  });

  frameEl.addEventListener("wheel", (event) => {
    if (frame.type !== "image" || frame.locked) {
      return;
    }
    if (!event.shiftKey) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;

    store.commit("frame-crop-zoom", (draft) => {
      const draftPage = draft.document.pages.find((entry) => entry.id === page.id);
      const target = findFrame(draftPage, frame.id);
      if (!target) {
        return;
      }
      target.crop = target.crop || { x: 0, y: 0, w: 100, h: 100, zoom: 1 };
      target.crop.zoom = clamp(Number(target.crop.zoom || 1) + delta, 0.3, 3);
    }, { trackHistory: false });
  });

  if (selected) {
    frameEl.classList.add("selected");
  }

  frameEl.addEventListener("click", (event) => {
    event.stopPropagation();
    selectFrame();
  });
}
