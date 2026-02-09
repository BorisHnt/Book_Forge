import { hydrateIcons } from "../ui/icons.js";

function makeStyleEditor(sectionName, styles) {
  const wrapper = document.createElement("div");
  wrapper.className = "style-item";

  const heading = document.createElement("div");
  heading.className = "row-between";
  heading.innerHTML = `<strong>${sectionName}</strong><small>${styles.length} styles</small>`;

  const list = document.createElement("div");
  list.className = "field";
  list.innerHTML = `<label>Style</label><select>${styles
    .map((style) => `<option value="${style.id}">${style.name}</option>`)
    .join("")}</select>`;

  const preview = document.createElement("div");
  preview.className = "field";
  preview.innerHTML = "<label>Propriétés</label><div class='style-props'></div>";

  wrapper.append(heading, list, preview);
  return { wrapper, select: list.querySelector("select"), props: preview.querySelector(".style-props") };
}

function renderStyleProps(target, style) {
  const entries = Object.entries(style).filter(([key]) => !["id", "name"].includes(key));
  target.innerHTML = entries
    .map(([key, value]) => `<div class="row-between"><small>${key}</small><small>${String(value)}</small></div>`)
    .join("");
}

export function initStylesModule(store, refs) {
  const container = refs.stylesPanel;

  function render() {
    const { document: doc } = store.getState();
    container.innerHTML = "";

    const paragraphEditor = makeStyleEditor("Styles de paragraphe", doc.styles.paragraph);
    const characterEditor = makeStyleEditor("Styles de caractère", doc.styles.character);
    const objectEditor = makeStyleEditor("Styles d'objet", doc.styles.object);

    const editors = [
      ["paragraph", paragraphEditor],
      ["character", characterEditor],
      ["object", objectEditor]
    ];

    editors.forEach(([key, editor]) => {
      const initialStyle = doc.styles[key][0];
      renderStyleProps(editor.props, initialStyle);

      editor.select.addEventListener("change", (event) => {
        const style = doc.styles[key].find((candidate) => candidate.id === event.target.value);
        if (style) {
          renderStyleProps(editor.props, style);
        }
      });

      const mutate = document.createElement("button");
      mutate.className = "tool-btn compact";
      mutate.dataset.tool = "settings";
      mutate.title = "Modifier style sélectionné";
      mutate.addEventListener("click", () => {
        const selected = editor.select.value;
        store.commit(`mutate-style:${key}`, (draft) => {
          const style = draft.document.styles[key].find((candidate) => candidate.id === selected);
          if (!style) {
            return;
          }

          if (key === "paragraph") {
            style.size = Number(style.size) + 1;
            style.leading = Number(style.leading) + 1;
          }
          if (key === "character") {
            style.tracking = Number(style.tracking || 0) + 5;
          }
          if (key === "object") {
            style.padding = Number(style.padding || 0) + 1;
            style.radius = Math.min(6, Number(style.radius || 0) + 1);
          }
        });
      });

      const overrideHint = document.createElement("small");
      overrideHint.textContent = "Héritage visible: les overrides locaux sont marqués dans les objets de page.";
      editor.wrapper.append(mutate, overrideHint);
      container.appendChild(editor.wrapper);
    });

    hydrateIcons(container);
  }

  store.subscribe("state:changed", render);
  render();
}
