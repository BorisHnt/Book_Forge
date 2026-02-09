function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function estimatePdfPages(file) {
  try {
    const buffer = await file.arrayBuffer();
    const sample = new TextDecoder("latin1").decode(buffer);
    const matches = sample.match(/\/Type\s*\/Page\b/g);
    if (matches?.length) {
      return clamp(matches.length, 1, 2000);
    }
  } catch {
    // Ignore and fallback.
  }

  const kb = Math.max(1, Math.round(file.size / 1024));
  return clamp(Math.ceil(kb / 180), 1, 300);
}

function createPlaceholderDataUrl(label, sublabel) {
  if (typeof document === "undefined") {
    return "";
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1700;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#f7f3ee");
  gradient.addColorStop(1, "#ece4d8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#c2b39e";
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  ctx.fillStyle = "#7a6a58";
  ctx.font = "bold 56px 'Avenir Next', 'Trebuchet MS', sans-serif";
  ctx.fillText(label, 80, 160);
  ctx.font = "32px 'Avenir Next', 'Trebuchet MS', sans-serif";
  ctx.fillText(sublabel, 80, 228);

  ctx.globalAlpha = 0.15;
  for (let y = 320; y < 1500; y += 48) {
    ctx.fillRect(80, y, canvas.width - 160, 14);
  }

  return canvas.toDataURL("image/png");
}

function createFlatFrame(dataUrl, pageNumber, mappedStyle) {
  return {
    id: `frame-${Math.random().toString(36).slice(2, 8)}`,
    type: "image",
    x: 4,
    y: 4,
    w: 92,
    h: 92,
    rotation: 0,
    layer: "imported-image",
    content: `PDF page ${pageNumber}`,
    styleId: mappedStyle,
    src: dataUrl,
    imported: true,
    importedFrom: "pdf"
  };
}

function createAnalyzedFrames(pageNumber, mappedStyle) {
  return [
    {
      id: `frame-${Math.random().toString(36).slice(2, 8)}`,
      type: "text",
      x: 8,
      y: 8,
      w: 84,
      h: 16,
      layer: "text",
      styleId: mappedStyle,
      content: `Titre détecté (page ${pageNumber})`,
      imported: true,
      importedFrom: "pdf"
    },
    {
      id: `frame-${Math.random().toString(36).slice(2, 8)}`,
      type: "text",
      x: 8,
      y: 26,
      w: 55,
      h: 62,
      layer: "text",
      styleId: mappedStyle,
      content: `Bloc texte reconstruit depuis PDF page ${pageNumber}.\n\nCe cadre est éditable, déplaçable et redimensionnable.`,
      imported: true,
      importedFrom: "pdf"
    },
    {
      id: `frame-${Math.random().toString(36).slice(2, 8)}`,
      type: "image",
      x: 66,
      y: 30,
      w: 26,
      h: 32,
      layer: "images",
      content: `Image détectée p.${pageNumber}`,
      imported: true,
      importedFrom: "pdf"
    },
    {
      id: `frame-${Math.random().toString(36).slice(2, 8)}`,
      type: "table",
      x: 66,
      y: 65,
      w: 26,
      h: 20,
      layer: "tables",
      content: "col A | col B\n----- | -----\nval 1 | val 2",
      imported: true,
      importedFrom: "pdf"
    }
  ];
}

export async function buildPdfImportPages(file, options) {
  const estimatedPages = await estimatePdfPages(file);
  const selected =
    options.selectedNumbers?.length
      ? options.selectedNumbers.filter((number) => number >= 1 && number <= estimatedPages)
      : Array.from({ length: estimatedPages }, (_, index) => index + 1);

  const pages = selected.map((pageNumber) => {
    const dataUrl = createPlaceholderDataUrl(file.name, `Page ${pageNumber}`);
    const analyzeMode = options.parseMode === "analyze";
    const placeAsReference = Boolean(options.placeAsReference);

    const backgroundReference = placeAsReference
      ? {
          mode: "reference",
          sourceName: file.name,
          sourceType: file.type || "application/pdf",
          pageNumber,
          locked: true,
          visible: true,
          nonPrintable: true,
          opacity: Number(options.referenceOpacity ?? 0.35),
          dataUrl,
          isRasterized: true
        }
      : null;

    const frames = analyzeMode
      ? createAnalyzedFrames(pageNumber, options.mappedStyle)
      : [createFlatFrame(dataUrl, pageNumber, options.mappedStyle)];

    return {
      source: "pdf",
      pageNumber,
      backgroundReference,
      frames,
      mode: analyzeMode ? "analyze" : "flat"
    };
  });

  return {
    estimatedPages,
    pages
  };
}
