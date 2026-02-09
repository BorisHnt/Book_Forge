import { hydrateIcons } from "./icons.js";

const SKIP_KEY = "book-forge.skip-delete-confirm.session";

function isSkipEnabled() {
  try {
    return sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function setSkipEnabled(enabled) {
  try {
    sessionStorage.setItem(SKIP_KEY, enabled ? "1" : "0");
  } catch {
    // no-op
  }
}

function getFocusable(root) {
  return [...root.querySelectorAll("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])")]
    .filter((element) => !element.hasAttribute("disabled"));
}

function trapFocus(modal, event) {
  if (event.key !== "Tab") {
    return;
  }

  const focusable = getFocusable(modal);
  if (!focusable.length) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initDeletePageDialog({ store, pageManager, modalRoot }) {
  const root = modalRoot || document.getElementById("modalRoot");

  const close = () => {
    root.innerHTML = "";
  };

  const cancel = (pageIds = []) => {
    pageManager.cancelDelete(pageIds);
    close();
  };

  const confirm = (pageIds = [], skipCheckbox) => {
    if (skipCheckbox?.checked) {
      setSkipEnabled(true);
    }
    const success = pageManager.deletePages(pageIds);
    if (!success) {
      pageManager.cancelDelete(pageIds);
    }
    close();
  };

  const open = ({ pageIds = [] }) => {
    const ids = [...new Set(pageIds.filter(Boolean))];
    if (!ids.length) {
      return;
    }

    if (isSkipEnabled()) {
      confirm(ids, null);
      return;
    }

    const canDelete = pageManager.canDelete(ids);

    root.innerHTML = `
      <div class="modal-backdrop" data-role="delete-page-backdrop">
        <section class="modal delete-page-modal" role="dialog" aria-modal="true" aria-labelledby="deletePageTitle">
          <header>
            <strong id="deletePageTitle">Supprimer cette page ?</strong>
            <button class="tool-btn" data-action="cancel" data-tool="close" title="Annuler"></button>
          </header>
          <div class="body">
            <p>Cette action supprimera définitivement la page du document.</p>
            <p><small>${ids.length > 1 ? `${ids.length} pages sélectionnées.` : "1 page sélectionnée."}</small></p>
            <label class="field"><span><input type="checkbox" id="skipDeleteAsk" /> Ne plus demander (session)</span></label>
          </div>
          <footer>
            <button class="tool-btn" data-action="confirm" data-tool="delete" title="Supprimer" ${canDelete ? "" : "disabled"}></button>
            <button class="tool-btn" data-action="cancel" data-tool="close" title="Annuler"></button>
          </footer>
        </section>
      </div>
    `;

    hydrateIcons(root);

    const backdrop = root.querySelector("[data-role='delete-page-backdrop']");
    const modal = root.querySelector(".delete-page-modal");
    const confirmBtn = root.querySelector('[data-action="confirm"]');
    const cancelBtns = root.querySelectorAll('[data-action="cancel"]');
    const skipCheckbox = root.querySelector("#skipDeleteAsk");

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel(ids);
        return;
      }
      trapFocus(modal, event);
    };

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        cancel(ids);
      }
    });

    cancelBtns.forEach((button) => button.addEventListener("click", () => cancel(ids)));
    confirmBtn.addEventListener("click", () => confirm(ids, skipCheckbox));

    modal.addEventListener("keydown", onKeydown);
    const focusable = getFocusable(modal);
    (focusable[0] || modal).focus();
  };

  store.subscribe("PAGE_DELETE_REQUEST", ({ reason }) => {
    const payload = typeof reason === "object" ? reason : null;
    open(payload || {});
  });

  return {
    open,
    close
  };
}
