import { iconMap } from "./iconMap.js";

let spriteLoaded = false;

export async function loadTablerSprite(path = "./assets/icons/tabler-sprite.svg") {
  if (spriteLoaded) {
    return;
  }

  const response = await fetch(path);
  const spriteText = await response.text();
  const holder = document.createElement("div");
  holder.id = "tablerSpriteHolder";
  holder.style.position = "absolute";
  holder.style.width = "0";
  holder.style.height = "0";
  holder.style.overflow = "hidden";
  holder.innerHTML = spriteText;
  document.body.prepend(holder);
  spriteLoaded = true;
}

export function createIcon(iconName, label = "") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("icon");
  svg.setAttribute("aria-hidden", "true");
  if (label) {
    svg.setAttribute("aria-label", label);
  }
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", `#ti-${iconName}`);
  svg.appendChild(use);
  return svg;
}

function resolveIcon(toolName, element) {
  if (!toolName) {
    return element.dataset.icon || "settings";
  }

  if (toolName === "theme") {
    return document.body.dataset.theme === "ink" ? iconMap.themeDark : iconMap.themeLight;
  }

  return iconMap[toolName] || "settings";
}

export function hydrateIcons(root = document) {
  const items = root.querySelectorAll("[data-tool], [data-icon]");
  for (const item of items) {
    const existing = item.querySelector("svg.icon");
    if (existing) {
      existing.remove();
    }

    const iconName = resolveIcon(item.dataset.tool, item);
    const label = item.getAttribute("title") || item.dataset.tool || "icon";
    const icon = createIcon(iconName, label);
    item.prepend(icon);

    const shortcut = item.dataset.shortcut;
    if (shortcut && !item.dataset.tooltipBound) {
      item.title = `${label.replace(/\s*\(.*/, "")} (${shortcut})`;
      item.dataset.tooltipBound = "true";
    }
  }
}
