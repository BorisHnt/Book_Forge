import { hydrateIcons } from "./icons.js";

function bindTabs(tabContainer, store, side) {
  const buttons = tabContainer.querySelectorAll(".tab");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tabTarget;
      const panelContainer = tabContainer.closest(".dock");
      panelContainer.querySelectorAll(".panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === target);
      });
      buttons.forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
      store.updateUi(`tab:${side}`, (ui) => {
        if (side === "left") {
          ui.leftTab = target;
        } else {
          ui.rightTab = target;
        }
      });
    });
  });
}

function restoreTabs(store) {
  const state = store.getState();
  for (const [side, saved] of [
    ["left", state.ui.leftTab],
    ["right", state.ui.rightTab]
  ]) {
    const tabs = document.querySelectorAll(`#${side}Tabs .tab`);
    const panelScope = side === "left" ? document.getElementById("leftDock") : document.getElementById("rightDock");
    tabs.forEach((tab) => {
      const active = tab.dataset.tabTarget === saved;
      tab.classList.toggle("active", active);
      const panel = panelScope.querySelector(`#${tab.dataset.tabTarget}`);
      if (panel) {
        panel.classList.toggle("active", active);
      }
    });
  }
}

function applyDockState(store) {
  const workspace = document.querySelector(".workspace");
  const { leftDockCollapsed, rightDockCollapsed, leftDockWidth, rightDockWidth } = store.getState().ui;
  workspace.dataset.leftCollapsed = leftDockCollapsed ? "true" : "false";
  workspace.dataset.rightCollapsed = rightDockCollapsed ? "true" : "false";
  if (!leftDockCollapsed) {
    workspace.style.gridTemplateColumns = `${leftDockWidth}px 6px 1fr 6px ${rightDockCollapsed ? 0 : rightDockWidth}px`;
  }
  if (!rightDockCollapsed) {
    workspace.style.gridTemplateColumns = `${leftDockCollapsed ? 0 : leftDockWidth}px 6px 1fr 6px ${rightDockWidth}px`;
  }
  if (leftDockCollapsed && rightDockCollapsed) {
    workspace.style.gridTemplateColumns = "0 0 1fr 0 0";
  }
  if (leftDockCollapsed && !rightDockCollapsed) {
    workspace.style.gridTemplateColumns = `0 0 1fr 6px ${rightDockWidth}px`;
  }
  if (!leftDockCollapsed && rightDockCollapsed) {
    workspace.style.gridTemplateColumns = `${leftDockWidth}px 6px 1fr 0 0`;
  }
}

function bindResizers(store) {
  const workspace = document.querySelector(".workspace");
  const leftResizer = document.querySelector('[data-resize="left"]');
  const rightResizer = document.querySelector('[data-resize="right"]');

  const startResize = (side, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const uiState = store.getState().ui;
    const startWidth = side === "left" ? uiState.leftDockWidth : uiState.rightDockWidth;

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      let newWidth = side === "left" ? startWidth + delta : startWidth - delta;
      newWidth = Math.max(220, Math.min(520, newWidth));
      store.updateUi(`resize:${side}`, (ui) => {
        if (side === "left") {
          ui.leftDockWidth = newWidth;
          ui.leftDockCollapsed = false;
        } else {
          ui.rightDockWidth = newWidth;
          ui.rightDockCollapsed = false;
        }
      });
      applyDockState(store);
      hydrateIcons(workspace);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  leftResizer.addEventListener("pointerdown", (event) => startResize("left", event));
  rightResizer.addEventListener("pointerdown", (event) => startResize("right", event));
}

export function initPanels(store) {
  bindTabs(document.getElementById("leftTabs"), store, "left");
  bindTabs(document.getElementById("rightTabs"), store, "right");
  restoreTabs(store);
  applyDockState(store);
  bindResizers(store);

  store.subscribe("ui:changed", () => {
    applyDockState(store);
    restoreTabs(store);
    hydrateIcons(document);
  });

  return {
    toggleDock(side) {
      store.updateUi(`toggle:${side}`, (ui) => {
        if (side === "left") {
          ui.leftDockCollapsed = !ui.leftDockCollapsed;
        } else {
          ui.rightDockCollapsed = !ui.rightDockCollapsed;
        }
      });
      applyDockState(store);
    }
  };
}
