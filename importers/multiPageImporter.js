import { createAsset, createPage } from "../core/document.js";
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

function splitTextInPages(text, chunk = 1200) {
  const sanitized = text.replace(/\s+/g, " ").trim();
  if (!sanitized) {
    return ["Page vide"];
  }
  const pages = [];
  for (let index = 0; index < sanitized.length; index += chunk) {
    pages.push(sanitized.slice(index, index + chunk));
  }
  return pages;
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
                  <option value="selected">Pages sélectionnées</option>
                </select>
              </label>
              <label class="field">Plage/sélection (ex: 1-3,6)
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
          </div>
          <footer>
            <small>Import frontend V1: pour PDF/DOCX/EPUB, placeholders paginés générés.</small>
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

      const imports = [];
      for (const file of selectedFiles) {
        const estimated = estimatePageCount(file);
        const selectedNumbers =
          importMode === "all"
            ? Array.from({ length: estimated }, (_, i) => i + 1)
            : parseRange(rangeInput, estimated);

        let textPages = [];
        if (/\.txt$|\.md$|\.html?$/.test(file.name.toLowerCase())) {
          try {
            const text = await file.text();
            textPages = splitTextInPages(text);
          } catch {
            textPages = ["Impossible de lire ce fichier."];
          }
        }

        imports.push({
          file,
          selectedNumbers,
          textPages,
          mappedStyle,
          mappedMaster,
          createSection: shouldCreateSection
        });
      }

      store.commit("multi-import", (draft) => {
        const pages = draft.document.pages;
        const activeIndex = pages.findIndex((page) => page.id === draft.view.selectedPageId);
        let cursor = insertMode === "after" ? Math.max(0, activeIndex + 1) : pages.length;

        imports.forEach((entry) => {
          let targetSectionId = pages[activeIndex]?.sectionId || draft.document.sections[0]?.id;

          if (entry.createSection) {
            const newSection = {
              id: `section-${Math.random().toString(36).slice(2, 8)}`,
              name: entry.file.name.replace(/\.[^.]+$/, ""),
              pageIds: [],
              pagination: { style: "arabic", startAt: 1, independent: true },
              startOnOdd: false,
              bookmark: true,
              toc: true,
              masterId: entry.mappedMaster
            };
            draft.document.sections.push(newSection);
            targetSectionId = newSection.id;
          }

          entry.selectedNumbers.forEach((number, index) => {
            const page = createPage({
              sectionId: targetSectionId,
              masterId: entry.mappedMaster,
              number,
              frames: [
                {
                  id: `frame-${Math.random().toString(36).slice(2, 8)}`,
                  type: "text",
                  x: 8,
                  y: 10,
                  w: 84,
                  h: 78,
                  styleId: entry.mappedStyle,
                  content:
                    entry.textPages[index] ||
                    `Import ${entry.file.name} — page ${number}.\n(Placeholder V1 pour ${entry.file.type || "fichier"})`
                }
              ]
            });

            pages.splice(cursor, 0, page);
            cursor += 1;
          });

          draft.document.assets.push(createAsset(entry.file));
        });

        if (draft.document.pages.length) {
          draft.view.selectedPageId = draft.document.pages[Math.min(cursor - 1, draft.document.pages.length - 1)].id;
        }
      });

      closeModal(modalRoot);
    });

    hydrateIcons(modalRoot);
  }

  return { openDialog };
}
