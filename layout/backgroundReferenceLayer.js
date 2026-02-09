function fallbackLabel(reference) {
  if (!reference) {
    return "Reference";
  }
  const source = reference.sourceName || "PDF";
  const pageNo = reference.pageNumber ? ` · page ${reference.pageNumber}` : "";
  return `${source}${pageNo}`;
}

export function normalizeBackgroundReference(reference) {
  if (!reference) {
    return null;
  }

  return {
    id: reference.id || `bg-${Math.random().toString(36).slice(2, 8)}`,
    mode: reference.mode || "reference",
    sourceName: reference.sourceName || "Imported document",
    sourceType: reference.sourceType || "application/octet-stream",
    pageNumber: Number(reference.pageNumber || 1),
    locked: reference.locked ?? true,
    visible: reference.visible ?? true,
    nonPrintable: reference.nonPrintable ?? true,
    opacity: Math.max(0.05, Math.min(1, Number(reference.opacity ?? 0.35))),
    rotation: Number(reference.rotation || 0),
    dataUrl: reference.dataUrl || "",
    isRasterized: reference.isRasterized ?? true
  };
}

export function renderBackgroundReferenceLayer(page) {
  const reference = normalizeBackgroundReference(page.backgroundReference);
  if (!reference || !reference.visible) {
    return null;
  }

  const layer = document.createElement("div");
  layer.className = "page-background-reference-layer";
  layer.style.opacity = String(reference.opacity);

  if (reference.dataUrl) {
    const img = document.createElement("img");
    img.src = reference.dataUrl;
    img.alt = fallbackLabel(reference);
    img.className = "page-background-reference-image";
    img.style.transform = `rotate(${reference.rotation}deg)`;
    layer.appendChild(img);
  } else {
    const card = document.createElement("div");
    card.className = "page-background-reference-placeholder";
    card.style.transform = `rotate(${reference.rotation}deg)`;
    card.innerHTML = `
      <strong>${reference.mode === "reference" ? "Fond de référence" : "Fond importé"}</strong>
      <small>${fallbackLabel(reference)}</small>
      <small>${reference.locked ? "Verrouillé" : "Editable"} · ${reference.nonPrintable ? "Non imprimé" : "Imprimable"}</small>
    `;
    layer.appendChild(card);
  }

  if (reference.locked) {
    layer.dataset.locked = "true";
  }

  if (reference.nonPrintable) {
    layer.dataset.nonPrintable = "true";
  }

  return layer;
}
