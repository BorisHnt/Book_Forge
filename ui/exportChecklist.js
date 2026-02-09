import { hydrateIcons } from "./icons.js";

function collectChecks(doc) {
  const checks = [];

  checks.push({
    category: "Géométrie",
    status: doc.settings.bleed > 0 ? "ok" : "error",
    label: doc.settings.bleed > 0 ? "Bleed configuré" : "Bleed absent",
    fixable: doc.settings.bleed <= 0,
    fix: (draft) => {
      draft.document.settings.bleed = 3;
      draft.document.settings.bleedVisible = true;
    }
  });

  checks.push({
    category: "Géométrie",
    status: doc.settings.margins.visible ? "ok" : "warning",
    label: doc.settings.margins.visible ? "Marges overlays visibles" : "Overlays de marges masqués",
    fixable: !doc.settings.margins.visible,
    fix: (draft) => {
      draft.document.settings.margins.visible = true;
    }
  });

  const emptyPages = doc.pages.filter((page) => !page.frames || page.frames.length === 0);
  if (emptyPages.length) {
    emptyPages.forEach((page) => {
      checks.push({
        category: "Géométrie",
        status: "warning",
        label: `Page vide détectée (${page.name})`,
        pageId: page.id,
        suggestion: "Ajouter un cadre texte ou image"
      });
    });
  } else {
    checks.push({ category: "Géométrie", status: "ok", label: "Pas de pages vides involontaires" });
  }

  const imageFrames = doc.pages.flatMap((page) =>
    (page.frames || []).filter((frame) => frame.type === "image").map((frame) => ({ page, frame }))
  );

  if (imageFrames.length === 0) {
    checks.push({ category: "Images", status: "ok", label: "Aucun cadre image à contrôler" });
  } else {
    imageFrames.forEach(({ page, frame }) => {
      const dpi = Number(frame.dpi || 300);
      if (dpi < 300) {
        checks.push({
          category: "Images",
          status: "warning",
          label: `Résolution ${dpi} DPI (< 300)`,
          pageId: page.id,
          suggestion: "Remplacer l'image par une version HD"
        });
      }
      if (frame.missing) {
        checks.push({
          category: "Images",
          status: "error",
          label: `Image manquante dans ${page.name}`,
          pageId: page.id,
          suggestion: "Relier le fichier source"
        });
      }
    });
  }

  const usesRgb = doc.styles.character.some((style) => /^#/.test(style.color || ""));
  checks.push({
    category: "Couleurs",
    status: usesRgb ? "warning" : "ok",
    label: usesRgb ? "Styles couleur en RGB" : "Palette neutre",
    suggestion: usesRgb ? "Prévoir conversion CMYK à l'export print" : ""
  });

  checks.push({
    category: "Couleurs",
    status: "warning",
    label: "Profil ICC non défini",
    suggestion: "Renseigner un ICC presse avant tirage"
  });

  const missingGlyph = doc.pages.some((page) =>
    (page.frames || []).some((frame) => typeof frame.content === "string" && frame.content.includes("�"))
  );
  checks.push({
    category: "Typo",
    status: missingGlyph ? "error" : "ok",
    label: missingGlyph ? "Glyphes manquants détectés" : "Glyphes valides"
  });

  checks.push({
    category: "Typo",
    status: "warning",
    label: "Vérifier embedding des polices à l'export PDF",
    suggestion: "Activer l'option embedding complète"
  });

  doc.sections.forEach((section) => {
    if (!section.pageIds.length) {
      checks.push({
        category: "Pagination",
        status: "warning",
        label: `Section sans pages: ${section.name}`
      });
      return;
    }

    if (section.startOnOdd) {
      const firstPageId = section.pageIds[0];
      const index = doc.pages.findIndex((page) => page.id === firstPageId);
      if ((index + 1) % 2 === 0) {
        checks.push({
          category: "Pagination",
          status: "warning",
          label: `${section.name} devrait démarrer sur page impaire`,
          pageId: firstPageId,
          suggestion: "Insérer une page blanche avant la section"
        });
      }
    }
  });

  checks.push({
    category: "Export",
    status: doc.settings.spreads ? "ok" : "warning",
    label: doc.settings.spreads ? "Spreads activés" : "Export en pages simples",
    suggestion: doc.settings.spreads ? "" : "Activer spreads pour BAT imprimeur"
  });

  return checks;
}

function toLabel(status) {
  if (status === "error") {
    return "Error";
  }
  if (status === "warning") {
    return "Warning";
  }
  return "OK";
}

export function initExportChecklistModule(store, refs) {
  const exportPanel = refs.exportPanel;
  let latestChecks = [];
  let blockOnErrors = true;

  function run() {
    const { document: doc } = store.getState();
    latestChecks = collectChecks(doc);
    render();
  }

  function render() {
    const mount = exportPanel.querySelector("#checklistMount");
    if (!mount) {
      return;
    }

    const criticalCount = latestChecks.filter((entry) => entry.status === "error").length;

    mount.innerHTML = `
      <article class="style-item">
        <div class="row-between"><strong>Checklist Export</strong><small>${latestChecks.length || 0} contrôles</small></div>
        <div class="row-between">
          <span class="status-pill ${criticalCount ? "error" : "ok"}">${criticalCount ? `${criticalCount} critiques` : "0 critique"}</span>
          <label class="field"><span><input type="checkbox" id="blockExportOnError" ${blockOnErrors ? "checked" : ""}/> Bloquer export si erreurs</span></label>
        </div>
        <div id="checklistItems" style="display:grid;gap:8px;"></div>
      </article>
    `;

    const container = mount.querySelector("#checklistItems");
    if (!latestChecks.length) {
      const placeholder = document.createElement("small");
      placeholder.textContent = "Aucune analyse lancée.";
      container.appendChild(placeholder);
    }

    latestChecks.forEach((check, index) => {
      const row = document.createElement("article");
      row.className = "check-item";
      row.innerHTML = `
        <div class="row-between">
          <strong>${check.category}</strong>
          <span class="status-pill ${check.status}">${toLabel(check.status)}</span>
        </div>
        <small>${check.label}</small>
        ${check.suggestion ? `<small>${check.suggestion}</small>` : ""}
        <div class="inline-actions" id="checkActions-${index}"></div>
      `;

      const actionBar = row.querySelector(`#checkActions-${index}`);
      if (check.pageId) {
        const jumpButton = document.createElement("button");
        jumpButton.className = "tool-btn compact";
        jumpButton.dataset.tool = "pages";
        jumpButton.title = "Aller à la page";
        jumpButton.addEventListener("click", () => {
          refs.onJumpToPage?.(check.pageId);
        });
        actionBar.appendChild(jumpButton);
      }

      if (check.fixable && typeof check.fix === "function") {
        const fixButton = document.createElement("button");
        fixButton.className = "tool-btn compact";
        fixButton.dataset.tool = "settings";
        fixButton.title = "Correction automatique";
        fixButton.addEventListener("click", () => {
          store.commit("checklist-autofix", (draft) => {
            check.fix(draft);
          });
          run();
        });
        actionBar.appendChild(fixButton);
      }

      container.appendChild(row);
    });

    mount.querySelector("#blockExportOnError").addEventListener("change", (event) => {
      blockOnErrors = event.target.checked;
    });

    hydrateIcons(mount);
  }

  store.subscribe("state:changed", () => {
    if (latestChecks.length) {
      run();
    } else {
      render();
    }
  });

  render();

  return {
    runChecklist: run,
    canExport() {
      if (!latestChecks.length) {
        latestChecks = collectChecks(store.getState().document);
      }
      if (!blockOnErrors) {
        return true;
      }
      return latestChecks.every((check) => check.status !== "error");
    }
  };
}
