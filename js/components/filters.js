// ---------------------------------------------------------
// Filter bar behaviour: the per-tab filter visibility toggle and the
// pill-driven card filtering (including tri-state inventory mode).
// ---------------------------------------------------------

/** Toggle the filter bar visibility for a tab button (mobile affordance). */
export function toggleFilters(tabBtn) {
  const tabId = tabBtn.dataset.tab;
  const panel = document.getElementById(tabId);
  if (!panel) return;
  const filterBar = panel.querySelector(".filter-bar");
  if (!filterBar) return;

  const isOpen = filterBar.classList.toggle("filter-visible");
  tabBtn.classList.toggle("caret-open", isOpen);
}

/** Handle a click on a filter pill, updating which cards are visible. */
export function handleFilterClick(e) {
  const pill = e.target.closest(".filter-pill");
  if (!pill) return false;

  const bar = pill.closest(".filter-bar");
  const grid = document.getElementById(bar.dataset.grid);
  if (!grid) return true;

  const allPill = bar.querySelector('[data-filter="all"]');
  const clicked = pill.dataset.filter;
  const triAll = bar.dataset.triAll === "starting";

  const setTriAllState = (state) => {
    // state: "all" | "starting" | "shared"
    allPill.dataset.allState = state;
    const label = state === "all" ? "All" : state === "starting" ? "Starting" : "Shared";
    allPill.textContent = `${label} ↻`;
    // When tri-state is active, the "all" pill is the mode toggle, so keep it visually active.
    allPill.classList.add("active");
  };

  const cycleTriAllState = () => {
    const current = allPill.dataset.allState || "all";
    const next = current === "all" ? "starting" : current === "starting" ? "shared" : "all";
    setTriAllState(next);
  };

  if (clicked === "all") {
    if (triAll) {
      cycleTriAllState();
    } else {
      bar.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      allPill.classList.add("active");
    }
  } else {
    // In tri-state mode, clicking tag pills should layer on top of the current
    // starting/shared mode, not reset it.
    if (triAll) {
      pill.classList.toggle("active");
    } else {
      allPill.classList.remove("active");
      pill.classList.toggle("active");
      if (!bar.querySelector(".filter-pill.active")) {
        allPill.classList.add("active");
      }
    }
  }

  const activeFilters = [];
  bar.querySelectorAll(".filter-pill.active").forEach((p) => activeFilters.push(p.dataset.filter));

  // In tri-state inventory mode, the "all" pill is a mode toggle, not a tag
  // selector; exclude it from tag decisions.
  const activeTagFilters = triAll ? activeFilters.filter((f) => f !== "all") : activeFilters;
  const showAll = triAll ? activeTagFilters.length === 0 : activeFilters.includes("all");
  const unpreparedActive = activeTagFilters.includes("Unprepared");
  const anyLevelActive = triAll ? activeTagFilters.some((f) => f !== "Unprepared") : activeFilters.some((f) => f !== "all" && f !== "Unprepared");
  const triState = triAll ? (allPill.dataset.allState || "all") : "all";

  grid.querySelectorAll(".item-card").forEach((card) => {
    const levelActive = activeFilters.includes(card.dataset.cat);
    const isUnprepared = card.dataset.unprepared === "true";
    const starting = card.dataset.starting === "true";
    const startingOk = !triAll
      ? true
      : triState === "all"
        ? true
        : triState === "starting"
          ? starting
          : !starting;

    const showByTag = showAll
      ? true
      : isUnprepared
        ? unpreparedActive && (anyLevelActive ? levelActive : true)
        : levelActive;

    const show = showByTag && startingOk;
    card.classList.toggle("filter-hidden", !show);
  });
  return true;
}
