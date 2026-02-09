import { createMaster } from "../core/document.js";

function getMasterLabel(doc, id) {
  return doc.masters.find((master) => master.id === id)?.name || "Aucun";
}

export function initMastersModule(store, refs) {
  const list = refs.mastersList;

  function render() {
    const state = store.getState();
    const { document: doc, view } = state;
    list.innerHTML = "";

    doc.masters.forEach((master) => {
      const item = document.createElement("article");
      item.className = "master-item";

      const head = document.createElement("div");
      head.className = "row-between";
      const title = document.createElement("strong");
      title.textContent = master.name;
      const inheritance = document.createElement("small");
      inheritance.textContent = master.parentId ? `Hérite de ${getMasterLabel(doc, master.parentId)}` : "Racine";
      head.append(title, inheritance);

      const fields = document.createElement("div");
      fields.className = "grid-2";
      fields.innerHTML = `
        <label class="field">Nom<input value="${master.name}" /></label>
        <label class="field">Parent
          <select>
            <option value="">Aucun</option>
            ${doc.masters
              .filter((candidate) => candidate.id !== master.id)
              .map((candidate) => `<option value="${candidate.id}">${candidate.name}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">Header<input value="${master.header || ""}" /></label>
        <label class="field">Footer<input value="${master.footer || ""}" /></label>
      `;

      const [nameInput, parentSelect, headerInput, footerInput] = [
        fields.querySelector("label:nth-child(1) input"),
        fields.querySelector("label:nth-child(2) select"),
        fields.querySelector("label:nth-child(3) input"),
        fields.querySelector("label:nth-child(4) input")
      ];

      parentSelect.value = master.parentId || "";

      nameInput.addEventListener("change", (event) => {
        store.commit("rename-master", (draft) => {
          const target = draft.document.masters.find((entry) => entry.id === master.id);
          if (target) {
            target.name = event.target.value.trim() || target.name;
          }
        });
      });

      parentSelect.addEventListener("change", (event) => {
        store.commit("master-parent", (draft) => {
          const target = draft.document.masters.find((entry) => entry.id === master.id);
          if (target) {
            target.parentId = event.target.value || null;
          }
        });
      });

      headerInput.addEventListener("change", (event) => {
        store.commit("master-header", (draft) => {
          const target = draft.document.masters.find((entry) => entry.id === master.id);
          if (target) {
            target.header = event.target.value;
          }
        });
      });

      footerInput.addEventListener("change", (event) => {
        store.commit("master-footer", (draft) => {
          const target = draft.document.masters.find((entry) => entry.id === master.id);
          if (target) {
            target.footer = event.target.value;
          }
        });
      });

      const toggles = document.createElement("div");
      toggles.className = "grid-2";
      toggles.innerHTML = `
        <label class="field"><span><input type="checkbox" data-flag="lockedColumns" ${master.lockedColumns ? "checked" : ""}/> Colonnes verrouillées</span></label>
        <label class="field"><span><input type="checkbox" data-flag="fixedGuides" ${master.fixedGuides ? "checked" : ""}/> Guides fixes</span></label>
      `;

      toggles.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.addEventListener("change", (event) => {
          const key = event.target.dataset.flag;
          store.commit(`master-flag:${key}`, (draft) => {
            const target = draft.document.masters.find((entry) => entry.id === master.id);
            if (target) {
              target[key] = event.target.checked;
            }
          });
        });
      });

      const actions = document.createElement("div");
      actions.className = "inline-actions";

      const applyPage = document.createElement("button");
      applyPage.className = "tool-btn compact";
      applyPage.dataset.tool = "link";
      applyPage.title = "Appliquer à la page active";
      applyPage.addEventListener("click", () => {
        store.commit("apply-master-page", (draft) => {
          const page = draft.document.pages.find((entry) => entry.id === view.selectedPageId);
          if (page) {
            page.masterId = master.id;
          }
        });
      });

      const applySection = document.createElement("button");
      applySection.className = "tool-btn compact";
      applySection.dataset.tool = "sections";
      applySection.title = "Appliquer à la section active";
      applySection.addEventListener("click", () => {
        store.commit("apply-master-section", (draft) => {
          const page = draft.document.pages.find((entry) => entry.id === view.selectedPageId);
          if (!page) {
            return;
          }
          const section = draft.document.sections.find((entry) => entry.id === page.sectionId);
          if (!section) {
            return;
          }
          section.masterId = master.id;
          draft.document.pages
            .filter((entry) => entry.sectionId === section.id)
            .forEach((entry) => {
              entry.masterId = master.id;
            });
        });
      });

      const remove = document.createElement("button");
      remove.className = "tool-btn compact";
      remove.dataset.tool = "delete";
      remove.title = "Supprimer master";
      remove.disabled = doc.masters.length <= 1;
      remove.addEventListener("click", () => {
        store.commit("remove-master", (draft) => {
          const fallback = draft.document.masters.find((entry) => entry.id !== master.id);
          if (!fallback) {
            return;
          }
          draft.document.masters = draft.document.masters.filter((entry) => entry.id !== master.id);
          draft.document.pages.forEach((page) => {
            if (page.masterId === master.id) {
              page.masterId = fallback.id;
            }
          });
          draft.document.sections.forEach((section) => {
            if (section.masterId === master.id) {
              section.masterId = fallback.id;
            }
          });
        });
      });

      actions.append(applyPage, applySection, remove);

      item.append(head, fields, toggles, actions);
      list.appendChild(item);
    });
  }

  store.subscribe("state:changed", render);
  render();

  return {
    addMaster() {
      store.commit("add-master", (draft) => {
        const master = createMaster(`Master ${String.fromCharCode(65 + draft.document.masters.length)}`);
        const parent = draft.document.masters[draft.document.masters.length - 1];
        master.parentId = parent?.id || null;
        draft.document.masters.push(master);
      });
    }
  };
}
