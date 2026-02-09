import { mmToPx } from "../core/document.js";

const DEFAULT_COLORS = {
  all: "#c9793b",
  top: "#c9793b",
  bottom: "#b86f37",
  inside: "#9d5c2f",
  outside: "#d4975f",
  bleed: "#b96767",
  safe: "#4f8d6f"
};

const DEFAULT_SHOW = {
  inside: true,
  outside: true,
  top: true,
  bottom: true,
  bleed: true,
  safe: true
};

const VISUAL_PRESETS = {
  edition: {
    mode: "simple",
    opacity: 0.2,
    stroke: 1,
    lineStyle: "solid",
    legend: true,
    colors: {
      all: "#c9793b"
    },
    show: {
      inside: true,
      outside: true,
      top: true,
      bottom: true,
      bleed: false,
      safe: true
    }
  },
  printPreview: {
    mode: "advanced",
    opacity: 0.15,
    stroke: 1,
    lineStyle: "dashed",
    legend: true,
    colors: {
      top: "#c9793b",
      bottom: "#c9793b",
      inside: "#9d5c2f",
      outside: "#d4975f",
      bleed: "#b96767",
      safe: "#4f8d6f"
    },
    show: {
      inside: true,
      outside: true,
      top: true,
      bottom: true,
      bleed: true,
      safe: true
    }
  },
  debug: {
    mode: "advanced",
    opacity: 0.24,
    stroke: 2,
    lineStyle: "solid",
    legend: true,
    colors: {
      top: "#ff7a7a",
      bottom: "#f9a052",
      inside: "#6a8aff",
      outside: "#23b08f",
      bleed: "#ff4e4e",
      safe: "#25a35f"
    },
    show: {
      inside: true,
      outside: true,
      top: true,
      bottom: true,
      bleed: true,
      safe: true
    }
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha) {
  const normalized = (hex || "#c9793b").replace("#", "");
  const source =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  const int = Number.parseInt(source, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

export function ensureMarginVisualConfig(settings) {
  const margins = settings.margins || {};
  const legacyColors = margins.colors || {};
  const visual = margins.visual || {};

  const presetName = visual.preset || "edition";
  const preset = VISUAL_PRESETS[presetName] || VISUAL_PRESETS.edition;

  const merged = {
    preset: presetName,
    mode: visual.mode || legacyColors.mode || preset.mode || "simple",
    opacity: clamp(Number(visual.opacity ?? preset.opacity ?? 0.2), 0.05, 0.45),
    stroke: clamp(Number(visual.stroke ?? margins.stroke ?? preset.stroke ?? 1), 1, 5),
    lineStyle: visual.lineStyle || preset.lineStyle || "solid",
    legend: typeof visual.legend === "boolean" ? visual.legend : true,
    colors: {
      ...DEFAULT_COLORS,
      ...preset.colors,
      ...legacyColors,
      ...(visual.colors || {})
    },
    show: {
      ...DEFAULT_SHOW,
      ...preset.show,
      ...(visual.show || {})
    }
  };

  settings.margins = {
    ...margins,
    visible: margins.visible ?? true,
    visual: merged,
    colors: {
      ...DEFAULT_COLORS,
      ...legacyColors,
      ...(visual.colors || {})
    },
    stroke: Number(margins.stroke ?? merged.stroke ?? 1)
  };

  return settings.margins.visual;
}

export function applyMarginVisualPreset(visual, presetName) {
  const preset = VISUAL_PRESETS[presetName] || VISUAL_PRESETS.edition;
  return {
    ...visual,
    preset: presetName,
    mode: preset.mode,
    opacity: preset.opacity,
    stroke: preset.stroke,
    lineStyle: preset.lineStyle,
    legend: preset.legend,
    colors: {
      ...visual.colors,
      ...DEFAULT_COLORS,
      ...preset.colors
    },
    show: {
      ...visual.show,
      ...DEFAULT_SHOW,
      ...preset.show
    }
  };
}

function getColorForType(visual, type) {
  if (visual.mode === "simple") {
    return visual.colors.all || DEFAULT_COLORS.all;
  }
  return visual.colors[type] || visual.colors.all || DEFAULT_COLORS[type] || DEFAULT_COLORS.all;
}

function formatLabel(type, valueMm) {
  const text = Number(valueMm).toFixed(1).replace(/\.0$/, "");
  return `${type} ${text} mm`;
}

export function getMarginGeometryPx(doc, page, side) {
  const settings = doc.settings;
  const base = settings.margins;
  const odd = (page.autoNumber || 1) % 2 === 1;
  const compensation = Number(base.oddEvenCompensation || 0);

  const insideMm = Math.max(0, Number(base.inside || 0) + Number(base.spine || 0) + (odd ? compensation : -compensation));
  const outsideMm = Math.max(0, Number(base.outside || 0) + (odd ? -compensation : compensation));

  const topMm = Math.max(0, Number(base.top || 0));
  const bottomMm = Math.max(0, Number(base.bottom || 0));

  const insidePx = mmToPx(insideMm, settings.dpi);
  const outsidePx = mmToPx(outsideMm, settings.dpi);

  const left = side === "left" ? outsidePx : insidePx;
  const right = side === "left" ? insidePx : outsidePx;

  return {
    mm: {
      top: topMm,
      bottom: bottomMm,
      inside: insideMm,
      outside: outsideMm
    },
    px: {
      top: mmToPx(topMm, settings.dpi),
      bottom: mmToPx(bottomMm, settings.dpi),
      left,
      right,
      inside: insidePx,
      outside: outsidePx,
      bleed: mmToPx(Number(settings.bleed || 0), settings.dpi),
      safe: mmToPx(Number(settings.safeArea || 0), settings.dpi)
    }
  };
}

export function getMarginOverlayModel({ doc, page, pageSizePx, side }) {
  ensureMarginVisualConfig(doc.settings);
  const margins = doc.settings.margins;
  const visual = margins.visual;

  if (!margins.visible) {
    return {
      enabled: false,
      zones: [],
      lines: [],
      labels: [],
      boxes: [],
      legend: []
    };
  }

  const geometry = getMarginGeometryPx(doc, page, side);
  const width = pageSizePx.width;
  const height = pageSizePx.height;

  const zones = [];
  const lines = [];
  const labels = [];

  const pushHorizontal = (type, y, zoneHeight) => {
    const color = getColorForType(visual, type);
    zones.push({ type, x: 0, y, w: width, h: zoneHeight, color, opacity: visual.opacity });
    lines.push({ type, axis: "h", x: 0, y: y + zoneHeight, length: width, color });
    labels.push({ type, x: width - 108, y: clamp(y + zoneHeight + 3, 4, height - 16), text: formatLabel(type, geometry.mm[type]), color });
  };

  const pushVertical = (type, x, zoneWidth, labelY) => {
    const color = getColorForType(visual, type);
    zones.push({ type, x, y: 0, w: zoneWidth, h: height, color, opacity: visual.opacity });
    lines.push({ type, axis: "v", x: x + zoneWidth, y: 0, length: height, color });
    labels.push({ type, x: clamp(x + zoneWidth + 4, 4, width - 108), y: labelY, text: formatLabel(type, geometry.mm[type]), color });
  };

  if (visual.show.top) {
    pushHorizontal("top", 0, geometry.px.top);
  }
  if (visual.show.bottom) {
    const zoneHeight = geometry.px.bottom;
    pushHorizontal("bottom", height - zoneHeight, zoneHeight);
  }
  if (visual.show.outside) {
    pushVertical("outside", 0, geometry.px.left, 14);
  }
  if (visual.show.inside) {
    const zoneWidth = geometry.px.right;
    pushVertical("inside", width - zoneWidth, zoneWidth, 30);
  }

  const boxes = [];
  if (visual.show.bleed && doc.settings.bleedVisible) {
    boxes.push({
      type: "bleed",
      inset: -geometry.px.bleed,
      color: getColorForType(visual, "bleed"),
      lineStyle: visual.lineStyle
    });
  }

  if (visual.show.safe && doc.settings.safeVisible) {
    boxes.push({
      type: "safe",
      inset: geometry.px.safe,
      color: getColorForType(visual, "safe"),
      lineStyle: visual.lineStyle
    });
  }

  const legend = visual.legend
    ? ["inside", "outside", "top", "bottom", "bleed", "safe"]
        .filter((type) => visual.show[type])
        .map((type) => ({ type, color: getColorForType(visual, type) }))
    : [];

  return {
    enabled: true,
    zones,
    lines,
    labels,
    boxes,
    legend,
    stroke: visual.stroke,
    lineStyle: visual.lineStyle
  };
}

export function renderMarginOverlay({ doc, page, pageSizePx, slotInfo }) {
  const model = getMarginOverlayModel({
    doc,
    page,
    pageSizePx,
    side: slotInfo?.side || "right"
  });

  const overlay = document.createElement("div");
  overlay.className = "margin-system-overlay";

  if (!model.enabled) {
    return overlay;
  }

  model.zones.forEach((zone) => {
    const el = document.createElement("div");
    el.className = `margin-zone margin-zone-${zone.type}`;
    el.style.left = `${zone.x}px`;
    el.style.top = `${zone.y}px`;
    el.style.width = `${zone.w}px`;
    el.style.height = `${zone.h}px`;
    el.style.background = hexToRgba(zone.color, zone.opacity);
    overlay.appendChild(el);
  });

  model.lines.forEach((line) => {
    const el = document.createElement("div");
    el.className = `margin-line margin-line-${line.type}`;
    el.style.borderStyle = model.lineStyle;
    el.style.borderColor = line.color;
    if (line.axis === "h") {
      el.style.left = `${line.x}px`;
      el.style.top = `${line.y}px`;
      el.style.width = `${line.length}px`;
      el.style.borderTopWidth = `${model.stroke}px`;
      el.style.borderTopStyle = model.lineStyle;
    } else {
      el.style.left = `${line.x}px`;
      el.style.top = `${line.y}px`;
      el.style.height = `${line.length}px`;
      el.style.borderLeftWidth = `${model.stroke}px`;
      el.style.borderLeftStyle = model.lineStyle;
    }
    overlay.appendChild(el);
  });

  model.boxes.forEach((box) => {
    const el = document.createElement("div");
    el.className = `margin-box margin-box-${box.type}`;
    el.style.inset = `${box.inset}px`;
    el.style.borderColor = box.color;
    el.style.borderStyle = box.lineStyle;
    el.style.borderWidth = `${model.stroke}px`;
    overlay.appendChild(el);
  });

  model.labels.forEach((label) => {
    const el = document.createElement("small");
    el.className = "margin-label";
    el.style.left = `${label.x}px`;
    el.style.top = `${label.y}px`;
    el.style.color = label.color;
    el.textContent = label.text;
    overlay.appendChild(el);
  });

  if (model.legend.length) {
    const legend = document.createElement("aside");
    legend.className = "margin-legend";
    legend.innerHTML = model.legend
      .map(
        (entry) =>
          `<span><i style="background:${entry.color}"></i>${entry.type}</span>`
      )
      .join("");
    overlay.appendChild(legend);
  }

  return overlay;
}
