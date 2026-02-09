import { getPageSlotInfo } from "../layout/spreadEngine.js";
import { hydrateIcons } from "./icons.js";

function renderBulkActions({ store, pageManager, container }) {
  const selection = pageManager.getSelection();
  const canDeleteSelected = pageManager.canDelete(selection);

  const bar = document.createElement("article");
  bar.className = "style-item";
  bar.innerHTML = `
    <div class="row-between">
      <strong>${selection.length ? `${selection.length} sélectionnée(s)` : "Aucune sélection multiple"}</strong>
      <div class="inline-actions">
        <button class="tool-btn compact" data-action="clearSelection" data-tool="close" title="Effacer sélection" ${selection.length ? "" : "disabled"}></button>
        <button class="tool-btn compact" data-action="deleteSelected" data-tool="delete" title="Supprimer la sélection" ${canDeleteSelected ? "" : "disabled"}></button>
      </div>
    </div>
  `;

  bar.querySelector('[data-action="clearSelection"]').addEventListener("click", () => {
    pageManager.clearSelection();
  });

  bar.querySelector('[data-action="deleteSelected"]').addEventListener("click", () => {
    pageManager.requestDelete(selection);
  });

  container.appendChild(bar);
}

export function renderPageList({ store, pageManager, container, onMovePage, onSelectPage }) {
  const state = store.getState();
  const { document: doc, view } = state;
  const selectedSet = new Set(pageManager.getSelection());

  container.innerHTML = "";
  renderBulkActions({ store, pageManager, container });

  doc.pages.forEach((page, pageIndex) => {
    const item = document.createElement("article");
    item.className = "thumb-item";
    item.draggable = true;
    item.dataset.pageId = page.id;

    const selected = selectedSet.has(page.id);
    item.classList.toggle("active", selected || page.id === view.selectedPageId);

    const head = document.createElement("div");
    head.className = "thumb-head";

    const leftGroup = document.createElement("div");
    leftGroup.className = "inline-actions";

    const selector = document.createElement("input");
    selector.type = "checkbox";
    selector.checked = selected;
    selector.title = "Sélectionner cette page";
    selector.addEventListener("click", (event) => event.stopPropagation());
    selector.addEventListener("change", (event) => {
      const mode = event.target.checked ? "toggle" : "toggle";
      pageManager.toggleSelection(page.id, mode);
    });

    const title = document.createElement("strong");
    title.textContent = `${page.name} (${page.displayNumber || page.autoNumber})`;

    leftGroup.append(selector, title);

    const actions = document.createElement("div");
    actions.className = "inline-actions";

    const moveLeft = document.createElement("button");
    moveLeft.className = "tool-btn compact";
    moveLeft.dataset.tool = "chevronLeft";
    moveLeft.title = "Déplacer avant";
    moveLeft.addEventListener("click", (event) => {
      event.stopPropagation();
      onMovePage?.(page.id, pageIndex - 1);
    });

    const moveRight = document.createElement("button");
    moveRight.className = "tool-btn compact";
    moveRight.dataset.tool = "chevronRight";
    moveRight.title = "Déplacer après";
    moveRight.addEventListener("click", (event) => {
      event.stopPropagation();
      onMovePage?.(page.id, pageIndex + 1);
    });

    const canDelete = pageManager.canDelete([page.id]);
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "tool-btn compact";
    deleteBtn.dataset.tool = "delete";
    deleteBtn.title = canDelete
      ? "Supprimer cette page"
      : "Impossible: le document doit conserver au moins une page";
    deleteBtn.disabled = !canDelete;
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      pageManager.requestDelete([page.id]);
    });

    actions.append(moveLeft, moveRight, deleteBtn);
    head.append(leftGroup, actions);

    const mini = document.createElement("div");
    mini.className = "thumb-mini";

    const meta = document.createElement("small");
    const section = doc.sections.find((entry) => entry.id === page.sectionId);
    const slot = getPageSlotInfo(doc, page.id, { includeVirtualFrontBlank: doc.settings.startOnRight });
    meta.textContent = `${section?.name || "Sans section"} · ${page.masterId} · ${slot?.side || "single"}`;

    item.append(head, mini, meta);

    item.addEventListener("click", (event) => {
      const multi = event.ctrlKey || event.metaKey;
      if (multi) {
        pageManager.toggleSelection(page.id, "toggle");
      } else {
        pageManager.setSelection([page.id]);
      }
      onSelectPage?.(page.id);
    });

    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", page.id);
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      item.classList.add("active");
    });

    item.addEventListener("dragleave", () => item.classList.remove("active"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("active");
      const draggedPageId = event.dataTransfer.getData("text/plain");
      if (!draggedPageId || draggedPageId === page.id) {
        return;
      }
      onMovePage?.(draggedPageId, pageIndex);
    });

    container.appendChild(item);
  });

  hydrateIcons(container);
}
