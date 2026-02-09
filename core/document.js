const FORMAT_DIMENSIONS_MM = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 }
};

const DEFAULT_STYLES = {
  paragraph: [
    { id: "p-body", name: "Corps", font: "Palatino Linotype", size: 11, leading: 15, align: "justify", hyphenation: true, widowsOrphans: true },
    { id: "p-title", name: "Titre", font: "Avenir Next", size: 28, leading: 30, align: "left", hyphenation: false, widowsOrphans: true },
    { id: "p-subtitle", name: "Sous-titre", font: "Avenir Next", size: 18, leading: 22, align: "left", hyphenation: false, widowsOrphans: true },
    { id: "p-quote", name: "Citation", font: "Palatino Linotype", size: 12, leading: 16, align: "left", hyphenation: true, widowsOrphans: true },
    { id: "p-caption", name: "Légende", font: "Avenir Next", size: 9, leading: 11, align: "left", hyphenation: false, widowsOrphans: false },
    { id: "p-note", name: "Note", font: "Palatino Linotype", size: 9, leading: 11, align: "left", hyphenation: true, widowsOrphans: false },
    { id: "p-list", name: "Liste", font: "Palatino Linotype", size: 11, leading: 15, align: "left", hyphenation: true, widowsOrphans: true }
  ],
  character: [
    { id: "c-bold", name: "Gras", weight: 700, style: "normal", color: "#343434", tracking: 0 },
    { id: "c-italic", name: "Italique", weight: 400, style: "italic", color: "#343434", tracking: 0 }
  ],
  object: [
    { id: "o-text", name: "Cadre texte", type: "text", fill: "transparent", padding: 8, wrap: "none", radius: 0 },
    { id: "o-image", name: "Cadre image", type: "image", fill: "#e9e9e9", padding: 0, wrap: "around", radius: 0 }
  ]
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export function mmToPx(mm, dpi = 96) {
  return (mm / 25.4) * dpi;
}

export function romanize(input) {
  const lookup = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1
  };
  let n = Math.max(1, Math.floor(input));
  let result = "";
  for (const key of Object.keys(lookup)) {
    while (n >= lookup[key]) {
      result += key;
      n -= lookup[key];
    }
  }
  return result.toLowerCase();
}

export function getFormatDimensions(format, custom, orientation) {
  const base = FORMAT_DIMENSIONS_MM[format] || custom || FORMAT_DIMENSIONS_MM.A4;
  if (orientation === "landscape") {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

export function createPage({ sectionId, number, masterId = "master-default", frames = [] } = {}) {
  return {
    id: uid("page"),
    name: `Page ${number ?? 1}`,
    sectionId,
    masterId,
    frames,
    notes: "",
    explicitDisplayNumber: null,
    overset: false
  };
}

export function createDefaultDocument() {
  const sectionId = uid("section");
  const pages = [
    createPage({ sectionId, number: 1 }),
    createPage({ sectionId, number: 2 }),
    createPage({ sectionId, number: 3 }),
    createPage({ sectionId, number: 4 })
  ];

  return {
    id: uid("doc"),
    title: "Untitled Book",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      format: "A4",
      orientation: "portrait",
      customSize: { width: 210, height: 297 },
      unit: "mm",
      dpi: 96,
      spreads: true,
      margins: {
        top: 15,
        bottom: 20,
        inside: 18,
        outside: 15,
        spine: 4,
        oddEvenCompensation: 0,
        colors: {
          mode: "single",
          all: "#c9793b",
          top: "#c9793b",
          bottom: "#b86f37",
          inside: "#9d5c2f",
          outside: "#d4975f"
        },
        stroke: 1,
        visible: true
      },
      bleed: 3,
      safeArea: 5,
      safeVisible: true,
      bleedVisible: true,
      preview: {
        enabled: false,
        cmyk: false,
        bw: false,
        paperSimulation: true
      }
    },
    grids: {
      columns: 2,
      gutter: 12,
      baseline: 14,
      snap: true,
      rulers: true,
      guides: true,
      presets: [
        { name: "Roman", columns: 2, gutter: 12, baseline: 14 },
        { name: "Magazine", columns: 3, gutter: 10, baseline: 12 }
      ]
    },
    sections: [
      {
        id: sectionId,
        name: "Section 1",
        pageIds: pages.map((page) => page.id),
        pagination: { style: "arabic", startAt: 1, independent: false },
        startOnOdd: false,
        bookmark: true,
        toc: true,
        masterId: "master-default"
      }
    ],
    masters: [
      {
        id: "master-default",
        name: "Master A",
        parentId: null,
        lockedColumns: true,
        fixedGuides: true,
        header: "BOOK FORGE",
        footer: "",
        background: "transparent",
        logo: ""
      }
    ],
    pages,
    styles: structuredClone(DEFAULT_STYLES),
    assets: [],
    bookmarks: []
  };
}

export function normalizeDocument(doc) {
  if (!doc || typeof doc !== "object") {
    return createDefaultDocument();
  }

  const fresh = createDefaultDocument();
  const merged = {
    ...fresh,
    ...doc,
    settings: {
      ...fresh.settings,
      ...(doc.settings || {}),
      margins: {
        ...fresh.settings.margins,
        ...(doc.settings?.margins || {}),
        colors: {
          ...fresh.settings.margins.colors,
          ...(doc.settings?.margins?.colors || {})
        }
      },
      preview: {
        ...fresh.settings.preview,
        ...(doc.settings?.preview || {})
      }
    },
    grids: {
      ...fresh.grids,
      ...(doc.grids || {})
    },
    sections: Array.isArray(doc.sections) && doc.sections.length ? doc.sections : fresh.sections,
    masters: Array.isArray(doc.masters) && doc.masters.length ? doc.masters : fresh.masters,
    pages: Array.isArray(doc.pages) && doc.pages.length ? doc.pages : fresh.pages,
    styles: {
      paragraph: doc.styles?.paragraph?.length ? doc.styles.paragraph : fresh.styles.paragraph,
      character: doc.styles?.character?.length ? doc.styles.character : fresh.styles.character,
      object: doc.styles?.object?.length ? doc.styles.object : fresh.styles.object
    },
    assets: Array.isArray(doc.assets) ? doc.assets : []
  };

  recomputePagination(merged);
  return merged;
}

export function recomputePagination(doc) {
  doc.pages.forEach((page, index) => {
    page.index = index;
    page.autoNumber = index + 1;
    if (!page.sectionId) {
      page.sectionId = doc.sections[0]?.id;
    }
    page.name = `Page ${index + 1}`;
  });

  for (const section of doc.sections) {
    section.pageIds = doc.pages.filter((page) => page.sectionId === section.id).map((page) => page.id);
    let counter = section.pagination.startAt || 1;
    for (const pageId of section.pageIds) {
      const page = doc.pages.find((candidate) => candidate.id === pageId);
      if (!page) {
        continue;
      }
      page.displayNumber =
        section.pagination.style === "roman"
          ? romanize(counter)
          : String(counter);
      counter += 1;
    }
  }
}

export function getPageSizeMm(doc) {
  const { format, orientation, customSize } = doc.settings;
  return getFormatDimensions(format, customSize, orientation);
}

export function getPageSizePx(doc) {
  const size = getPageSizeMm(doc);
  return {
    width: mmToPx(size.width, doc.settings.dpi),
    height: mmToPx(size.height, doc.settings.dpi)
  };
}

export function touchDocument(doc) {
  doc.updatedAt = new Date().toISOString();
}

export function findPage(doc, pageId) {
  return doc.pages.find((page) => page.id === pageId) || null;
}

export function ensureSelectedPageId(state) {
  if (!state.view.selectedPageId) {
    state.view.selectedPageId = state.document.pages[0]?.id || null;
    return;
  }
  const found = state.document.pages.some((page) => page.id === state.view.selectedPageId);
  if (!found) {
    state.view.selectedPageId = state.document.pages[0]?.id || null;
  }
}

export function createNewSection(name) {
  return {
    id: uid("section"),
    name: name || "Nouvelle section",
    pageIds: [],
    pagination: { style: "arabic", startAt: 1, independent: false },
    startOnOdd: false,
    bookmark: true,
    toc: true,
    masterId: "master-default"
  };
}

export function createMaster(name) {
  return {
    id: uid("master"),
    name: name || "Nouveau gabarit",
    parentId: null,
    lockedColumns: true,
    fixedGuides: true,
    header: "",
    footer: "",
    background: "transparent",
    logo: ""
  };
}

export function createAsset(file) {
  return {
    id: uid("asset"),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now()
  };
}
