import { createNewSection, recomputePagination } from "../core/document.js";

function renumberSections(doc) {
  doc.sections.forEach((section, index) => {
    if (!section.name || section.name.startsWith("Section ")) {
      section.name = `Section ${index + 1}`;
    }
  });
}

export function initSectionsModule(store, refs) {
  const list = refs.sectionsList;

  function render() {
    const state = store.getState();
    const { document: doc, view } = state;
    list.innerHTML = "";

    doc.sections.forEach((section) => {
      const item = document.createElement("article");
      item.className = "section-item";
      item.dataset.sectionId = section.id;

      const header = document.createElement("div");
      header.className = "row-between";
      const title = document.createElement("strong");
      title.textContent = section.name;
      const count = document.createElement("small");
      count.textContent = `${section.pageIds.length} pages`;
      header.append(title, count);

      const nameField = document.createElement("label");
      nameField.className = "field";
      nameField.innerHTML = `<span>Nom</span><input value="${section.name}" />`;
      nameField.querySelector("input").addEventListener("change", (event) => {
        store.commit("rename-section", (draft) => {
          const target = draft.document.sections.find((entry) => entry.id === section.id);
          if (target) {
            target.name = event.target.value.trim() || target.name;
          }
        });
      });

      const pagination = document.createElement("div");
      pagination.className = "grid-2";

      const styleField = document.createElement("label");
      styleField.className = "field";
      styleField.innerHTML = `
        <span>Pagination</span>
        <select>
          <option value="arabic">Arabes</option>
          <option value="roman">Romains</option>
        </select>
      `;
      styleField.querySelector("select").value = section.pagination.style;
      styleField.querySelector("select").addEventListener("change", (event) => {
        store.commit("section-pagination-style", (draft) => {
          const target = draft.document.sections.find((entry) => entry.id === section.id);
          if (target) {
            target.pagination.style = event.target.value;
            recomputePagination(draft.document);
          }
        });
      });

      const startField = document.createElement("label");
      startField.className = "field";
      startField.innerHTML = `<span>Démarre à</span><input type="number" min="1" value="${section.pagination.startAt}" />`;
      startField.querySelector("input").addEventListener("change", (event) => {
        const value = Math.max(1, Number(event.target.value || 1));
        store.commit("section-pagination-start", (draft) => {
          const target = draft.document.sections.find((entry) => entry.id === section.id);
          if (target) {
            target.pagination.startAt = value;
            recomputePagination(draft.document);
          }
        });
      });

      pagination.append(styleField, startField);

      const flags = document.createElement("div");
      flags.className = "grid-2";
      flags.innerHTML = `
        <label class="field"><span><input type="checkbox" data-flag="independent" ${section.pagination.independent ? "checked" : ""} /> Pagination indépendante</span></label>
        <label class="field"><span><input type="checkbox" data-flag="startOnOdd" ${section.startOnOdd ? "checked" : ""} /> Démarrer sur page impaire</span></label>
        <label class="field"><span><input type="checkbox" data-flag="bookmark" ${section.bookmark ? "checked" : ""} /> Signet PDF</span></label>
        <label class="field"><span><input type="checkbox" data-flag="toc" ${section.toc ? "checked" : ""} /> Table des matières</span></label>
      `;

      flags.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.addEventListener("change", (event) => {
          const flag = event.target.dataset.flag;
          const checked = event.target.checked;
          store.commit(`section-flag:${flag}`, (draft) => {
            const target = draft.document.sections.find((entry) => entry.id === section.id);
            if (!target) {
              return;
            }
            if (flag === "independent") {
              target.pagination.independent = checked;
            } else {
              target[flag] = checked;
            }
          });
        });
      });

      const controls = document.createElement("div");
      controls.className = "inline-actions";

      const assignButton = document.createElement("button");
      assignButton.className = "tool-btn compact";
      assignButton.dataset.tool = "link";
      assignButton.title = "Affecter la page sélectionnée";
      assignButton.addEventListener("click", () => {
        store.commit("assign-page-to-section", (draft) => {
          const page = draft.document.pages.find((entry) => entry.id === view.selectedPageId);
          if (page) {
            page.sectionId = section.id;
          }
          recomputePagination(draft.document);
        });
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "tool-btn compact";
      deleteButton.dataset.tool = "delete";
      deleteButton.title = "Supprimer section";
      deleteButton.disabled = doc.sections.length <= 1;
      deleteButton.addEventListener("click", () => {
        store.commit("delete-section", (draft) => {
          const next = draft.document.sections.filter((entry) => entry.id !== section.id);
          if (!next.length) {
            return;
          }
          const fallbackId = next[0].id;
          draft.document.pages.forEach((page) => {
            if (page.sectionId === section.id) {
              page.sectionId = fallbackId;
            }
          });
          draft.document.sections = next;
          renumberSections(draft.document);
          recomputePagination(draft.document);
        });
      });

      controls.append(assignButton, deleteButton);

      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        item.classList.add("active");
      });
      item.addEventListener("dragleave", () => item.classList.remove("active"));
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        item.classList.remove("active");
        const pageId = event.dataTransfer.getData("text/plain");
        if (!pageId) {
          return;
        }
        store.commit("section-drop-page", (draft) => {
          const page = draft.document.pages.find((candidate) => candidate.id === pageId);
          if (page) {
            page.sectionId = section.id;
            recomputePagination(draft.document);
          }
        });
      });

      item.append(header, nameField, pagination, flags, controls);
      list.appendChild(item);
    });
  }

  store.subscribe("state:changed", render);
  render();

  return {
    addSection() {
      store.commit("add-section", (draft) => {
        const newSection = createNewSection(`Section ${draft.document.sections.length + 1}`);
        draft.document.sections.push(newSection);
        if (draft.view.selectedPageId) {
          const page = draft.document.pages.find((entry) => entry.id === draft.view.selectedPageId);
          if (page) {
            page.sectionId = newSection.id;
          }
        }
        recomputePagination(draft.document);
      });
    }
  };
}
