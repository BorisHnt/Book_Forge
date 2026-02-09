import { createAsset, createPage } from "../core/document.js";
import { applyBookLayoutRecalculation, getPageSlotInfo } from "../layout/spreadEngine.js";
import { ensurePageFrames, normalizeFrame } from "../layout/frameEngine.js";
import { buildPdfImportPages } from "./pdfImporter.js";
import { buildDocxImportPages } from "./docxImporter.js";
import { hydrateIcons } from "../ui/icons.js";

function estimatePageCount(file) {
  const type = file.type || "";
  if (type.includes("pdf")) {
    return 6;
  }
  if (type.includes("word") || file.name.endsWith(".docx")) {
    return 4;
  }
  if (type.includes("epub") || file.name.endsWith(".epub")) {
    return 8;
  }
  if (type.includes("html") || file.name.endsWith(".html")) {
    return 3;
  }
  return 2;
}

function parseRange(input, max) {
  if (!input) {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
  const values = new Set();
  input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => {
      if (token.includes("-")) {
        const [rawStart, rawEnd] = token.split("-");
        const start = Math.max(1, Number(rawStart));
        const end = Math.min(max, Number(rawEnd));
        for (let i = start; i <= end; i += 1) {
          values.add(i);
        }
      } else {
        values.add(Math.max(1, Math.min(max, Number(token))));
      }
    });
  return values.size ? [...values].sort((a, b) => a - b) : Array.from({ length: max }, (_, i) => i + 1);
}

function closeModal(root) {
  root.innerHTML = "";
}

function createImportSection(name, masterId) {
  return {
    id: `section-${Math.random().toString(36).slice(2, 8)}`,
    name,
    pageIds: [],
    pagination: { style: "arabic", startAt: 1, independent: true },
    startOnOdd: false,
    bookmark: true,
    toc: true,
    masterId
  };
}

async function buildImportedPages(file, options) {
  if ((file.type || "").includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    return buildPdfImportPages(file, options);
  }

  return buildDocxImportPages(file, options);
}

export function initMultiPageImporter(store) {
  const modalRoot = document.getElementById("modalRoot");

  async function openDialog() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal">
          <header>
            <strong>Import Multi-Pages</strong>
            <button class="tool-btn" data-action="close" data-tool="close" title="Fermer"></button>
          </header>
          <div class="body">
            <label class="field">Fichiers (PDF / DOCX / EPUB / HTML / TXT / MD)
              <input type="file" id="importFilesInput" multiple accept=".pdf,.docx,.epub,.html,.htm,.txt,.md" />
            </label>
            <div class="import-files" id="importFileList"></div>

            <div class="grid-3">
              <label class="field">Mode import
                <select id="importMode">
                  <option value="all">Importer tout</option>
                  <option value="range">Plage</option>
                </select>
              </label>
              <label class="field">Plage (ex: 1-3,6)
                <input id="importRange" placeholder="1-3,6" />
              </label>
              <label class="field">Insertion
                <select id="insertMode">
                  <option value="after">Après page active</option>
                  <option value="end">Fin du document</option>
                </select>
              </label>
            </div>

            <div class="grid-3">
              <label class="field">Créer section par fichier
                <select id="createSection">
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                </select>
              </label>
              <label class="field">Mapping style paragraphe
                <select id="styleMapping"></select>
              </label>
              <label class="field">Gabarit appliqué
                <select id="masterMapping"></select>
              </label>
            </div>

            <div class="grid-3">
              <label class="field">PDF mode
                <select id="pdfParseMode">
                  <option value="flat">Image plate</option>
                  <option value="analyze">Analyse blocs</option>
                </select>
              </label>
              <label class="field"><span><input type="checkbox" id="placeAsReference" checked /> Placer comme référence (fond verrouillé)</span></label>
              <label class="field">Opacité fond ${35}%
                <input type="range" id="referenceOpacity" min="0.05" max="1" step="0.05" value="0.35" />
              </label>
            </div>
          </div>
          <footer>
            <small>Chaque page importée est visible dans le canvas et transformée en cadres éditables.</small>
            <div class="inline-actions">
              <button class="tool-btn" data-action="doImport" data-tool="import" title="Importer"></button>
            </div>
          </footer>
        </section>
      </div>
    `;

    const styles = store.getState().document.styles.paragraph;
    const masters = store.getState().document.masters;
    const styleSelect = modalRoot.querySelector("#styleMapping");
    styleSelect.innerHTML = styles.map((style) => `<option value="${style.id}">${style.name}</option>`).join("");
    const masterSelect = modalRoot.querySelector("#masterMapping");
    masterSelect.innerHTML = masters.map((master) => `<option value="${master.id}">${master.name}</option>`).join("");

    const filesInput = modalRoot.querySelector("#importFilesInput");
    const fileList = modalRoot.querySelector("#importFileList");
    const selectedFiles = [];

    const opacityField = modalRoot.querySelector("#referenceOpacity");
    opacityField.addEventListener("input", () => {
      const label = opacityField.closest("label");
      label.firstChild.textContent = `Opacité fond ${Math.round(Number(opacityField.value) * 100)}%`;
    });

    filesInput.addEventListener("change", () => {
      selectedFiles.length = 0;
      selectedFiles.push(...filesInput.files);
      fileList.innerHTML = "";

      selectedFiles.forEach((file) => {
        const estimated = estimatePageCount(file);
        const chip = document.createElement("article");
        chip.className = "file-chip";
        chip.innerHTML = `<span>${file.name}</span><small>~ ${estimated} pages</small>`;
        fileList.appendChild(chip);
      });
    });

    modalRoot.querySelector('[data-action="close"]').addEventListener("click", () => closeModal(modalRoot));
    modalRoot.querySelector(".modal-backdrop").addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-backdrop")) {
        closeModal(modalRoot);
      }
    });

    modalRoot.querySelector('[data-action="doImport"]').addEventListener("click", async () => {
      if (!selectedFiles.length) {
        return;
      }

      const rangeInput = modalRoot.querySelector("#importRange").value.trim();
      const importMode = modalRoot.querySelector("#importMode").value;
      const insertMode = modalRoot.querySelector("#insertMode").value;
      const shouldCreateSection = modalRoot.querySelector("#createSection").value === "true";
      const mappedStyle = styleSelect.value;
      const mappedMaster = masterSelect.value;
      const parseMode = modalRoot.querySelector("#pdfParseMode").value;
      const placeAsReference = modalRoot.querySelector("#placeAsReference").checked;
      const referenceOpacity = Number(modalRoot.querySelector("#referenceOpacity").value);

      const imports = [];

      for (const file of selectedFiles) {
        const estimated = estimatePageCount(file);
        const selectedNumbers =
          importMode === "all"
            ? Array.from({ length: estimated }, (_, i) => i + 1)
            : parseRange(rangeInput, estimated);

        const built = await buildImportedPages(file, {
          selectedNumbers,
          mappedStyle,
          mappedMaster,
          parseMode,
          placeAsReference,
          referenceOpacity
        });

        imports.push({
          file,
          selectedNumbers,
          importedPages: built.pages,
          estimatedPages: built.estimatedPages,
          mappedStyle,
          mappedMaster,
          createSection: shouldCreateSection
        });
      }

      let createdPageIds = [];
      let createdFrameCount = 0;

      store.commit("multi-import-v2", (draft) => {
        const pages = draft.document.pages;
        const activeIndex = pages.findIndex((page) => page.id === draft.view.selectedPageId);
        let cursor = insertMode === "after" ? Math.max(0, activeIndex + 1) : pages.length;

        imports.forEach((entry) => {
          let targetSectionId = pages[activeIndex]?.sectionId || draft.document.sections[0]?.id;

          if (entry.createSection) {
            const section = createImportSection(entry.file.name.replace(/\.[^.]+$/, ""), entry.mappedMaster);
            draft.document.sections.push(section);
            targetSectionId = section.id;
          }

          entry.importedPages.forEach((importedPage) => {
            const page = createPage({
              sectionId: targetSectionId,
              masterId: entry.mappedMaster,
              number: pages.length + 1,
              frames: importedPage.frames.map((frame) =>
                normalizeFrame({
                  ...frame,
                  imported: true,
                  importedFrom: importedPage.source
                }, frame.type)
              )
            });

            ensurePageFrames(page);
            page.backgroundReference = importedPage.backgroundReference || null;
            page.imported = {
              source: importedPage.source,
              fileName: entry.file.name,
              sourcePage: importedPage.pageNumber,
              mode: importedPage.mode || "structured",
              rotation: 0,
              zoom: 1
            };

            pages.splice(cursor, 0, page);
            cursor += 1;
            createdPageIds.push(page.id);
            createdFrameCount += page.frames.length;
          });

          draft.document.assets.push(createAsset(entry.file));
        });

        applyBookLayoutRecalculation(draft.document);
        if (createdPageIds.length) {
          const lastId = createdPageIds[createdPageIds.length - 1];
          draft.view.selectedPageId = lastId;
          const slot = getPageSlotInfo(draft.document, lastId, {
            includeVirtualFrontBlank: draft.document.settings.startOnRight
          });
          draft.view.spreadIndex = slot?.spreadIndex || 0;
          draft.view.selectedFrameId = null;
          draft.view.selectedFramePageId = null;
        }
      });

      store.emit("IMPORT_PAGE_CREATED", { count: createdPageIds.length, pageIds: createdPageIds });
      store.emit("IMPORT_FRAMES_CREATED", { count: createdFrameCount });
      store.emit("PAGE_REBUILT", { reason: "import" });

      closeModal(modalRoot);
    });

    hydrateIcons(modalRoot);
  }

  return { openDialog };
}
