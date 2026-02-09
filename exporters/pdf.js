import { getPageSizeMm } from "../core/document.js";
import { getPrintablePageSequence } from "../layout/spreadEngine.js";
import { hydrateIcons } from "../ui/icons.js";

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPageInner(page) {
  if (page?.isVirtualBlank) {
    return `<div class="blank-note">Page blanche fictive (recto)</div>`;
  }

  const frames = (page.frames || [])
    .map((frame) => {
      const left = `${frame.x || 0}%`;
      const top = `${frame.y || 0}%`;
      const width = `${frame.w || 100}%`;
      const height = `${frame.h || 100}%`;
      return `<div class="f" style="left:${left};top:${top};width:${width};height:${height};">${escapeHtml(
        frame.content || ""
      )}</div>`;
    })
    .join("");

  return frames;
}

function buildPrintableDocument(doc, options) {
  const size = getPageSizeMm(doc);
  const sequence = getPrintablePageSequence(doc, {
    spreads: options.spreads
  });

  const sectionBookmarks = doc.sections
    .filter((section) => section.bookmark)
    .map((section) => `<li>${escapeHtml(section.name)}</li>`)
    .join("");

  const spreadSheets = [];
  if (options.spreads) {
    for (let index = 0; index < sequence.length; index += 2) {
      const left = sequence[index] || null;
      const right = sequence[index + 1] || null;
      const sheet = `
        <article class="sheet spread">
          ${[left, right]
            .map((slot) => {
              if (!slot) {
                return `<section class="slot empty"></section>`;
              }
              const page = slot.page;
              const label = slot.isVirtualBlank
                ? "Blanche"
                : `${escapeHtml(page.displayNumber || page.autoNumber)} (${slot.side})`;
              return `
                <section class="slot page" style="width:${size.width}mm;height:${size.height}mm;">
                  <div class="head">${label}</div>
                  <div class="inner">${renderPageInner(page)}</div>
                </section>
              `;
            })
            .join("")}
        </article>
      `;
      spreadSheets.push(sheet);
    }
  } else {
    sequence.forEach((slot) => {
      const page = slot.page;
      const label = slot.isVirtualBlank
        ? "Blanche"
        : `${escapeHtml(page.displayNumber || page.autoNumber)} (${slot.side})`;
      spreadSheets.push(`
        <article class="sheet single">
          <section class="slot page" style="width:${size.width}mm;height:${size.height}mm;">
            <div class="head">${label}</div>
            <div class="inner">${renderPageInner(page)}</div>
          </section>
        </article>
      `);
    });
  }

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(doc.title)}</title>
        <style>
          @page { size: ${size.width}mm ${size.height}mm; margin: ${options.bleed ? "0" : "8mm"}; }
          body { font-family: 'Palatino Linotype', serif; color:#222; margin:0; padding:0; }
          .meta { margin: 0 0 8mm 0; font: 12px/1.4 'Avenir Next', 'Trebuchet MS', sans-serif; }
          .bookmarks { margin: 0 0 8mm 0; padding-left: 16px; font-size: 11px; }
          .sheet { break-after: page; }
          .sheet.spread { display:flex; gap:2mm; }
          .slot.page { position: relative; border: ${options.cropMarks ? "1px dashed #555" : "none"}; background:#fff; overflow:hidden; }
          .slot.empty { flex: 1 1 auto; }
          .head { position:absolute; top:2mm; left:3mm; font: 10px 'Avenir Next', sans-serif; color:#666; z-index:3; }
          .inner { position:absolute; inset: 8mm; }
          .blank-note { position:absolute; inset:0; display:grid; place-items:center; color:#888; font:12px 'Avenir Next', sans-serif; }
          .f { position:absolute; border:1px solid #888; padding:4px; overflow:hidden; font-size:11px; }
        </style>
      </head>
      <body>
        <div class="meta">
          <strong>${escapeHtml(doc.title)}</strong><br/>
          Profil: ${options.profile} · Couleur: ${options.colorMode} · Compression: ${options.compression}
          <br/>Bleed: ${options.bleed ? "Oui" : "Non"} · Traits de coupe: ${options.cropMarks ? "Oui" : "Non"} · Fonts intégrées: ${options.embedFonts ? "Oui" : "Non"}
          <br/>Recto à droite: ${doc.settings.startOnRight ? "Oui" : "Non"}
        </div>
        <ul class="bookmarks">${sectionBookmarks || "<li>Aucun signet section</li>"}</ul>
        ${spreadSheets.join("")}
      </body>
    </html>
  `;
}

function downloadText(name, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function initPdfExporter(store, refs, checklistApi) {
  const exportPanel = refs.exportPanel;
  let options = {
    profile: "print",
    colorMode: "CMYK",
    bleed: true,
    cropMarks: true,
    embedFonts: true,
    bookmarks: true,
    spreads: true,
    compression: "high"
  };

  function render() {
    const mount = exportPanel.querySelector("#exportMount");
    if (!mount) {
      return;
    }

    mount.innerHTML = `
      <article class="style-item">
        <div class="row-between"><strong>Export</strong><small>PDF Print / Digital</small></div>
        <div class="grid-2">
          <label class="field">Profil
            <select name="profile">
              <option value="print">PDF Print</option>
              <option value="digital">PDF Digital</option>
            </select>
          </label>
          <label class="field">Couleur
            <select name="colorMode">
              <option value="CMYK">CMYK</option>
              <option value="RGB">RGB</option>
            </select>
          </label>
          <label class="field">Compression
            <select name="compression">
              <option value="none">Aucune</option>
              <option value="medium">Moyenne</option>
              <option value="high">Forte</option>
            </select>
          </label>
          <label class="field">Spreads
            <select name="spreads">
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          </label>
        </div>
        <div class="grid-2">
          <label class="field"><span><input type="checkbox" name="bleed" ${options.bleed ? "checked" : ""}/> Bleed</span></label>
          <label class="field"><span><input type="checkbox" name="cropMarks" ${options.cropMarks ? "checked" : ""}/> Traits de coupe</span></label>
          <label class="field"><span><input type="checkbox" name="embedFonts" ${options.embedFonts ? "checked" : ""}/> Polices embarquées</span></label>
          <label class="field"><span><input type="checkbox" name="bookmarks" ${options.bookmarks ? "checked" : ""}/> Bookmarks</span></label>
        </div>
        <div class="inline-actions">
          <button class="tool-btn" data-action="exportPrint" data-tool="exportPdf" title="Exporter PDF Print"></button>
          <button class="tool-btn" data-action="exportDigital" data-tool="file-export" title="Exporter PDF Digital"></button>
          <button class="tool-btn" data-action="exportHtml" data-tool="pages" title="Exporter HTML paginé"></button>
          <button class="tool-btn" data-action="exportEpub" data-tool="book" title="Exporter EPUB simple"></button>
          <button class="tool-btn" data-action="exportImages" data-tool="photo" title="Exporter images"></button>
        </div>
      </article>
    `;

    const profile = mount.querySelector("[name='profile']");
    const colorMode = mount.querySelector("[name='colorMode']");
    const compression = mount.querySelector("[name='compression']");
    const spreads = mount.querySelector("[name='spreads']");

    profile.value = options.profile;
    colorMode.value = options.colorMode;
    compression.value = options.compression;
    spreads.value = String(options.spreads);

    const sync = () => {
      options = {
        ...options,
        profile: profile.value,
        colorMode: colorMode.value,
        compression: compression.value,
        spreads: spreads.value === "true",
        bleed: mount.querySelector("[name='bleed']").checked,
        cropMarks: mount.querySelector("[name='cropMarks']").checked,
        embedFonts: mount.querySelector("[name='embedFonts']").checked,
        bookmarks: mount.querySelector("[name='bookmarks']").checked
      };
    };

    mount.querySelectorAll("input,select").forEach((field) => field.addEventListener("change", sync));

    mount.querySelector('[data-action="exportPrint"]').addEventListener("click", () => {
      sync();
      if (!checklistApi.canExport()) {
        alert("Export bloqué: corrigez les erreurs critiques de la checklist ou désactivez le blocage.");
        return;
      }
      exportPrintPdf();
    });

    mount.querySelector('[data-action="exportDigital"]').addEventListener("click", () => {
      sync();
      exportDigitalPdf();
    });

    mount.querySelector('[data-action="exportHtml"]').addEventListener("click", () => {
      const doc = store.getState().document;
      downloadText(`${doc.title.replace(/\s+/g, "-").toLowerCase()}.html`, buildPrintableDocument(doc, options), "text/html");
    });

    mount.querySelector('[data-action="exportEpub"]').addEventListener("click", () => {
      const doc = store.getState().document;
      const toc = doc.sections.map((section) => `- ${section.name}`).join("\n");
      const content = `EPUB simple (V1 placeholder)\n\n${doc.title}\n\nTOC\n${toc}`;
      downloadText(`${doc.title.replace(/\s+/g, "-").toLowerCase()}.epub.txt`, content, "text/plain");
    });

    mount.querySelector('[data-action="exportImages"]').addEventListener("click", () => {
      const doc = store.getState().document;
      const summary = doc.pages
        .flatMap((page) => (page.frames || []).filter((frame) => frame.type === "image").map((frame) => `${page.name}: ${frame.content || "image"}`))
        .join("\n");
      downloadText(`${doc.title.replace(/\s+/g, "-").toLowerCase()}-images.txt`, summary || "Aucune image", "text/plain");
    });

    hydrateIcons(mount);
  }

  function exportPrintPdf() {
    const doc = store.getState().document;
    const popup = window.open("", "bookforge-print", "width=1100,height=800");
    if (!popup) {
      alert("Popup bloquée: autorisez les fenêtres pour lancer l'export PDF Print.");
      return;
    }

    popup.document.open();
    popup.document.write(buildPrintableDocument(doc, options));
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  }

  function exportDigitalPdf() {
    const doc = store.getState().document;
    const popup = window.open("", "bookforge-digital", "width=1100,height=800");
    if (!popup) {
      alert("Popup bloquée: autorisez les fenêtres pour lancer l'export PDF Digital.");
      return;
    }

    const digitalOptions = {
      ...options,
      profile: "digital",
      bleed: false,
      cropMarks: false,
      colorMode: "RGB"
    };

    popup.document.open();
    popup.document.write(buildPrintableDocument(doc, digitalOptions));
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  }

  store.subscribe("state:changed", render);

  return {
    render,
    exportPdf: exportPrintPdf
  };
}
