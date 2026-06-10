// ═══════════════════════════════════════════════════
// TURN OF FORTUNE'S WHEEL — APP SCRIPT
// ═══════════════════════════════════════════════════

// ── CONFIGURATION ──

// Character portrait URLs.
// Change to Discord CDN / Imgur / any host to remove local images.
const IMAGES = {
  vespera: "images/vespera.png",
  lucia: "images/lucia.png",
  karmine: "images/karmine.png",
  rubic: "images/rubic.png",
  lucien: "images/lucien.png",
  seabastion: "images/seabastion.png",
  christian: "images/christian.png",
};

// Incarnations that are temporarily unavailable.
// Their buttons will be disabled and their content will not be built.
const DISABLED = ["vespera", "rubic", "lucien", "seabastion"];

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════

/**
 * Compute ability modifier from a score.
 * @param {number} score - Ability score (e.g. 16)
 * @returns {string} Signed modifier (e.g. "+3")
 */
function abilityMod(score) {
  const m = Math.floor((score - 10) / 2);
  return (m >= 0 ? "+" : "") + m;
}

/**
 * Format a card description string into HTML.
 * Supports: **bold**, *italic*, \n as line breaks, and `- item` as list items.
 * @param {string} raw - Raw description text
 * @returns {string} HTML string
 */
function formatDesc(raw) {
  if (!raw) return "";
  // Escape HTML entities
  let html = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Underline: __text__ (process before bold to handle nesting like **__x__**)
  html = html.replace(/__(.+?)__/g, "<u>$1</u>");
  // Links: [text](url) with nested parentheses support in the URL.
  {
    let parsed = "";
    let idx = 0;
    while (idx < html.length) {
      const start = html.indexOf("[", idx);
      if (start === -1) {
        parsed += html.slice(idx);
        break;
      }
      const endLabel = html.indexOf("]", start + 1);
      if (endLabel === -1 || html[endLabel + 1] !== "(") {
        parsed += html.slice(idx, start + 1);
        idx = start + 1;
        continue;
      }
      const label = html.slice(start + 1, endLabel);
      let cursor = endLabel + 2;
      let depth = 0;
      while (cursor < html.length) {
        const ch = html[cursor];
        if (ch === "(") depth++;
        else if (ch === ")") {
          if (depth === 0) break;
          depth--;
        }
        cursor++;
      }
      if (cursor >= html.length) {
        parsed += html.slice(idx);
        break;
      }
      const url = html.slice(endLabel + 2, cursor);
      parsed += html.slice(idx, start) + `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>`;
      idx = cursor + 1;
    }
    html = parsed;
  }
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // List items: lines starting with "- "
  html = html.replace(/^- (.+)$/gm, '<span class="desc-li">• $1</span>');
  // Line breaks: \n\n -> paragraph break, \n -> line break
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, "<br>");
  return "<p>" + html + "</p>";
}

/**
 * Build a tab bar with ARIA attributes.
 * @param {Array<{id: string, label: string}>} tabs
 * @param {string} ariaLabel
 * @returns {string} HTML string
 */
function buildTabBar(tabs, ariaLabel) {
  return `<div class="tab-bar" role="tablist" aria-label="${ariaLabel}">` +
    tabs.map((tab, i) =>
      `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${tab.id}" ` +
      `role="tab" aria-selected="${i === 0}">${tab.label}</button>`
    ).join("") +
    `</div>`;
}

/**
 * Build a tab content panel.
 * @param {string} id - Panel ID (matches data-tab on button)
 * @param {string} content - Inner HTML
 * @param {boolean} active - Whether this is the default visible panel
 * @returns {string} HTML string
 */
function buildTabPanel(id, content, active) {
  return `<div class="tab-content${active ? ' active' : ''}" id="${id}" role="tabpanel">${content}</div>`;
}

/**
 * Normalize a loadout array that may contain plain IDs or {id, count} objects.
 * Returns an array of {id, count} entries.
 * @param {Array<string|{id:string, count:number}>} items
 * @returns {Array<{id:string, count:number}>}
 */
function normalizeItems(items) {
  return items.map(item =>
    typeof item === "string"
      ? { id: item, count: 1, title: null }
      : { id: item.id, count: item.count || 1, title: item.title || null }
  );
}

/**
 * Resolve the effective tag for a card, considering unprepared overrides.
 * @param {string} id - Card ID
 * @param {Set} [unprepared] - Set of card IDs that are unprepared
 * @returns {string} Effective tag
 */
function effectiveTag(id, unprepared) {
  if (unprepared && unprepared.has(id)) return "Unprepared";
  const c = CARDS[id];
  return c ? c.tag : "Other";
}

/**
 * Build a filter pill bar for a card grid.
 * Only renders if there are 2+ unique categories.
 * @param {Array<{id:string, count:number}>} items - Normalized item entries
 * @param {string} gridId - ID of the card-grid element to filter
 * @param {string[]} [defaultExclude] - Categories to exclude by default (not active on load)
 * @param {Set} [unprepared] - Set of card IDs to treat as "Unprepared"
 * @returns {string} HTML string (empty if ≤1 category)
 */
function buildFilterBar(items, gridId, defaultExclude, unprepared) {
  if (!items.length) return "";
  const categories = [];
  items.forEach(item => {
    const tag = effectiveTag(item.id, unprepared);
    if (!categories.includes(tag)) categories.push(tag);
  });
  if (categories.length <= 1) return "";

  const excluded = defaultExclude || [];
  const hasExclusions = excluded.length > 0;

  // If we have exclusions, default to individual pills active (not "All")
  const allActive = !hasExclusions;
  const pills = categories.map(c => {
    const active = hasExclusions ? !excluded.includes(c) : false;
    return `<button class="filter-pill${active ? ' active' : ''}" data-filter="${c}">${c}</button>`;
  }).join("");

  return `<div class="filter-bar" data-grid="${gridId}">` +
    `<button class="filter-pill${allActive ? ' active' : ''}" data-filter="all">All</button>${pills}</div>`;
}

/**
 * Build a card grid with optional filter bar.
 * @param {Array<string|{id:string, count:number}>} rawItems - Card IDs or {id, count} objects
 * @param {string} gridId - Unique ID for the grid element
 * @param {Set} [starred] - Set of card IDs that should show a star
 * @param {string[]} [defaultExclude] - Categories to exclude by default
 * @param {Set} [unprepared] - Set of card IDs to treat as "Unprepared"
 * @returns {string} HTML string
 */
function buildCardSection(rawItems, gridId, starred, defaultExclude, unprepared) {
  const items = normalizeItems(rawItems);
  if (!items.length) return '<div class="empty-msg">None :(</div>';

  const excluded = defaultExclude || [];
  const hasExclusions = excluded.length > 0;

  const cards = items.map(item => {
    const tag = effectiveTag(item.id, unprepared);
    const hidden = hasExclusions && excluded.includes(tag);
    return renderCard(item.id, starred, item.count, item.title, hidden, unprepared);
  }).join("");

  return buildFilterBar(items, gridId, defaultExclude, unprepared) +
    `<div class="card-grid" id="${gridId}">${cards}</div>`;
}

// ═══════════════════════════════════════════════════
// CARD RENDERING
// ═══════════════════════════════════════════════════

// Card data loaded from cards.json (populated by loadCards)
let CARDS = {};

/**
 * Render a single card by ID.
 * @param {string} id - Card ID from CARDS
 * @returns {string} HTML string
 */
/**
 * Derive the CSS class for a card's category from its tag.
 * @param {string} tag - Semantic tag (e.g. "Weapon", "2nd Level", "Unprepared")
 * @returns {string} CSS class name (e.g. "cat-weapon", "spell-2")
 */
const TAG_TO_CLASS = {
  "Weapon": "cat-weapon",
  "Equipment": "cat-equipment",
  "Consumables": "cat-consumables",
  "Tools and Containers": "cat-tools-and-containers",
  "Loot": "cat-loot",
  "Class": "cat-class",
  "Species": "cat-species",
  "Background": "cat-background",
  "Other": "cat-other",
  "Cantrip": "spell-0",
  "1st Level": "spell-1",
  "2nd Level": "spell-2",
  "3rd Level": "spell-3",
  "4th Level": "spell-4",
  "5th Level": "spell-5",
  "6th Level": "spell-6",
  "7th Level": "spell-7",
  "8th Level": "spell-8",
  "9th Level": "spell-9",
  "Unprepared": "cat-unprepared",
};

function cardClass(tag) {
  return TAG_TO_CLASS[tag] || "cat-other";
}

/**
 * Build the thumbnail HTML for a card (shared between card and modal).
 * @param {object} card - Card data object
 * @param {string} cls - CSS class for the container
 * @returns {string} HTML string
 */
function buildCardThumb(card, cls) {
  const inner = card.img
    ? `<img src="${card.img}" alt="${card.title}" class="card-thumb-img">`
    : `<span class="card-thumb-fallback">${card.title.charAt(0)}</span>`;
  return `<div class="${cls}">${inner}</div>`;
}

/**
 * Render a card in the grid. Description is clamped; click opens modal.
 * @param {string} id - Card ID from CARDS
 * @param {Set} [starred] - Set of card IDs that should show a star badge
 * @param {number} [count=1] - Number of copies (shows "x3" badge if > 1)
 * @param {string} [titleOverride] - Custom title to display instead of the card's default
 * @param {boolean} [hidden=false] - Whether to render hidden (filtered out by default)
 * @param {Set} [unprepared] - Set of card IDs to treat as "Unprepared"
 * @returns {string} HTML string
 */
function renderCard(id, starred, count, titleOverride, hidden, unprepared) {
  const c = CARDS[id];
  if (!c) return "";
  const tag = effectiveTag(id, unprepared);
  const cls = cardClass(tag);
  const displayTitle = titleOverride || c.title;
  const star = starred && starred.has(id) ? '<span class="card-star" title="Starting item">⭐</span>' : "";
  const qty = count > 1 ? `<span class="card-count">x${count}</span>` : "";
  const hiddenCls = hidden ? " filter-hidden" : "";
  return `<div class="item-card ${cls}${hiddenCls}" data-cat="${c.tag}" data-card-id="${id}">` +
    `<div class="card-stripe"></div>` +
    `<div class="card-body">` +
    buildCardThumb(c, "card-thumb") +
    `<div class="card-text">` +
    `<div class="card-title">${star}${displayTitle}${qty}</div>` +
    `<div class="card-desc rich-desc">${formatDesc(c.desc)}</div>` +
    `</div>` +
    `</div>` +
    `<div class="card-footer"><span>${c.footer || ''}</span><span class="card-tag">${c.tag}</span></div>` +
    `</div>`;
}

/**
 * Render and show a detail modal for a card.
 * @param {string} id - Card ID from CARDS
 */
function showCardModal(id) {
  const c = CARDS[id];
  if (!c) return;

  // Remove any existing modal
  closeCardModal();

  const backdrop = document.createElement("div");
  backdrop.className = "card-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-label", c.title);

  backdrop.innerHTML =
    `<div class="card-modal">` +
    `<div class="card-modal-stripe ${cardClass(c.tag)}"><div class="card-stripe"></div></div>` +
    `<div class="card-modal-header">` +
    buildCardThumb(c, "card-modal-thumb") +
    `<div>` +
    `<div class="card-modal-title">${c.title}</div>` +
    `<div class="card-modal-meta">${c.tag}${c.footer ? ' · ' + c.footer : ''}</div>` +
    `</div>` +
    `<button class="card-modal-close" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="card-modal-body"><div class="rich-desc">${formatDesc(c.desc)}</div></div>` +
    `<div class="card-modal-footer ${cardClass(c.tag)}"><span>${c.footer || ''}</span><span class="card-tag">${c.tag}</span></div>` +
    `</div>`;

  document.body.appendChild(backdrop);

  // Close on backdrop click (but not modal body click)
  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) closeCardModal();
  });

  // Close on Escape
  document.addEventListener("keydown", handleModalEscape);
}

function closeCardModal() {
  const existing = document.querySelector(".card-modal-backdrop");
  if (existing) existing.remove();
  document.removeEventListener("keydown", handleModalEscape);
}

function handleModalEscape(e) {
  if (e.key === "Escape") closeCardModal();
}

// ═══════════════════════════════════════════════════
// RADAR CHART
// ═══════════════════════════════════════════════════

const RADAR_LABELS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const RADAR_CX = 105, RADAR_CY = 105, RADAR_R = 85;

function radarAngles() {
  return RADAR_LABELS.map((_, i) => (Math.PI * 2 * i / 6) - (Math.PI / 2));
}

function radarPoint(angle, radius) {
  return `${RADAR_CX + Math.cos(angle) * radius},${RADAR_CY + Math.sin(angle) * radius}`;
}

function renderRadar(abilities) {
  const angles = radarAngles();

  const rings = [0.25, 0.5, 0.75, 1].map(pct => {
    const pts = angles.map(a => radarPoint(a, RADAR_R * pct)).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
  }).join("");

  const axes = angles.map(a =>
    `<line x1="${RADAR_CX}" y1="${RADAR_CY}" x2="${radarPoint(a, RADAR_R).split(",").join('" y2="')}" stroke="rgba(255,255,255,0.04)"/>`
  ).join("");

  const dataPts = RADAR_LABELS.map((label, i) =>
    radarPoint(angles[i], RADAR_R * Math.min(abilities[label] / 20, 1))
  ).join(" ");
  const dataShape = `<polygon points="${dataPts}" fill="rgba(201,168,76,0.12)" stroke="var(--gold)" stroke-width="2"/>`;

  const dotsAndLabels = RADAR_LABELS.map((label, i) => {
    const frac = Math.min(abilities[label] / 20, 1);
    const [dx, dy] = radarPoint(angles[i], RADAR_R * frac).split(",");
    const [lx, ly] = radarPoint(angles[i], RADAR_R + 14).split(",");
    return `<circle cx="${dx}" cy="${dy}" r="3" fill="var(--gold)"/>` +
      `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" ` +
      `fill="var(--text-dim)" font-family="Inter,sans-serif" font-size="8" font-weight="600" letter-spacing="1">${label}</text>`;
  }).join("");

  return `<svg viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg">${rings}${axes}${dataShape}${dotsAndLabels}</svg>`;
}

// ═══════════════════════════════════════════════════
// CHARACTER SHEET
// ═══════════════════════════════════════════════════

const ALL_SAVES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const ALL_SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
  "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
  "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
];

const SKILL_ABILITY = {
  "Acrobatics": "DEX", "Animal Handling": "WIS", "Arcana": "INT", "Athletics": "STR",
  "Deception": "CHA", "History": "INT", "Insight": "WIS", "Intimidation": "CHA",
  "Investigation": "INT", "Medicine": "WIS", "Nature": "INT", "Perception": "WIS",
  "Performance": "CHA", "Persuasion": "CHA", "Religion": "INT",
  "Sleight of Hand": "DEX", "Stealth": "DEX", "Survival": "WIS",
};

function renderProfList(items, data) {
  return `<ul class="cs-pills">${items.map(item => {
    const proficient = item.proficient;
    return `<li class="${proficient ? 'prof-yes' : 'prof-no'}">${item.label} ${item.bonus}</li>`;
  }).join("")}</ul>`;
}

function renderCounters(counters) {
  return `<div class="cs-counters">${counters.map(counter => {
    let content;
    if (counter.max > 20) {
      content = `<div class="cs-counter-pool" style="color:${counter.color}">${counter.cur} / ${counter.max}</div>`;
    } else {
      const pips = Array.from({ length: counter.max }, (_, i) => {
        const filled = i < counter.cur;
        const sep = (i > 0 && i % 5 === 0) ? '<div class="cs-pip-sep"></div>' : '';
        return sep + `<div class="cs-pip${filled ? ' filled' : ''}" style="--pip-color:${counter.color}" ` +
          `role="checkbox" aria-checked="${filled}" aria-label="${counter.name} ${i + 1} of ${counter.max}"></div>`;
      }).join("");
      content = `<div class="cs-pips">${pips}</div>`;
    }
    return `<div class="cs-counter"><div class="cs-counter-label">${counter.name}</div>${content}</div>`;
  }).join("")}</div>`;
}

function renderSheet(data) {
  const abilityBoxes = RADAR_LABELS.map(label =>
    `<div class="cs-ab-box">` +
    `<div class="cs-ab-label">${label}</div>` +
    `<div class="cs-ab-score">${data.ab[label]}</div>` +
    `<div class="cs-ab-mod">${abilityMod(data.ab[label])}</div>` +
    `</div>`
  ).join("");

  const saves = ALL_SAVES.map(save => {
    const proficient = data.saves.includes(save);
    const base = Math.floor((data.ab[save] - 10) / 2);
    const bonus = base + (proficient ? data.prof : 0);
    return { label: save, bonus: (bonus >= 0 ? '+' : '') + bonus, proficient };
  });

  const skills = ALL_SKILLS.map(skill => {
    const ability = SKILL_ABILITY[skill];
    const expertise = data.expertise ? data.expertise.includes(skill) : false;
    const proficient = data.skills.includes(skill);
    const bonus = Math.floor((data.ab[ability] - 10) / 2) + (expertise ? data.prof * 2 : proficient ? data.prof : 0);
    const sign = bonus >= 0 ? "+" : "";
    return { label: skill, bonus: `${sign}${bonus}`, proficient };
  });

  return `<div class="cs">` +
    `<div class="cs-left">` +
    `<div class="cs-portrait">` +
    `<img src="${data.img}" alt="${data.name}">` +
    `<div class="cs-portrait-overlay">` +
    `<div class="cs-portrait-name">${data.name}</div>` +
    `<div class="cs-portrait-meta">${data.race} · ${data.class}</div>` +
    `</div>` +
    `</div>` +
    `<div class="cs-radar">${renderRadar(data.ab)}</div>` +
    `<div class="cs-ab-grid">${abilityBoxes}</div>` +
    `</div>` +
    `<div class="cs-right">` +
    `<div class="cs-stats">` +
    `<div class="cs-stat"><div class="cs-stat-val">${data.ac}</div><div class="cs-stat-label">Armor Class</div></div>` +
    `<div class="cs-stat"><div class="cs-stat-val">${data.hp}</div><div class="cs-stat-label">Hit Points</div></div>` +
    `<div class="cs-stat"><div class="cs-stat-val">${data.init}</div><div class="cs-stat-label">Initiative</div></div>` +
    `<div class="cs-stat"><div class="cs-stat-val">+${data.prof}</div><div class="cs-stat-label">Proficiency</div></div>` +
    `</div>` +
    `<div class="cs-section"><div class="cs-section-title">Saving Throws</div>${renderProfList(saves)}</div>` +
    `<div class="cs-section"><div class="cs-section-title">Skills</div>${renderProfList(skills)}</div>` +
    `<div class="cs-section"><div class="cs-section-title">Counters &amp; Resources</div>${renderCounters(data.counters)}</div>` +
    `</div>` +
    `</div>`;
}

// ═══════════════════════════════════════════════════
// CHARACTER DATA
// ═══════════════════════════════════════════════════

const DATA = {
  vespera: {
    name: "Vespera", race: "Tiefling", class: "Bard (Divine Soul)", img: IMAGES.vespera,
    ab: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 13, CHA: 18 }, prof: 2, ac: 13, hp: 22, init: "+2",
    saves: ["CHA", "DEX"],
    skills: ["Deception", "Intimidation", "Performance", "Persuasion", "Religion"],
    counters: [
      { name: "Hit Dice", max: 3, cur: 3, color: "#d4d0c8" },
      { name: "Bardic Inspiration", max: 4, cur: 4, color: "#d4d0c8" },
      { name: "1st Level Slots", max: 4, cur: 4, color: "#d4d0c8" },
      { name: "2nd Level Slots", max: 2, cur: 2, color: "#d4d0c8" },
    ],
    inv: ["lyre_divinity", "dagger", "cloth_mortuary", "healers_kit", "potion_heal", "backpack", "formaldehyde"],
    feat: ["bardic_insp", "sc_bard", "darkvision_tiefling", "hellish_res", "infernal", "shelter", "divine_line"],
    spells: ["thaumaturgy", "vicious_mock", "mage_hand", "heal_word", "aid_sp", "diss_whisper", "u_charm", "u_det_magic", "u_faerie"],
  },
  lucia: {
    name: "Lucia", race: "Aasimar", class: "Shadow Sorcerer", img: IMAGES.lucia,
    ab: { STR: 9, DEX: 12, CON: 15, INT: 10, WIS: 10, CHA: 20 }, prof: 3, ac: 11, hp: 38, init: "+1",
    saves: ["CON", "CHA"],
    skills: ["Arcana", "Intimidation", "Persuasion", "Religion"],
    counters: [
      { name: "Hit Dice (d6)", max: 6, cur: 6, color: "#d4d0c8" },
      { name: "Sorcery Points", max: 6, cur: 6, color: "#d4d0c8" },
      { name: "Strength of the Grave", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "Healing Hands", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "Necrotic Shroud", max: 1, cur: 1, color: "#d4d0c8" },
    ],
    inv: ["dagger", "common_clothes", "crystal", "golden_talisman", "locket", "sensory_stone", "ink", "potion_of_poison_resistance", { id: "rations", count: 4 }, "warming_waterskin", "waterskin", { id: "backpack", title: "Scholar's Pack" }, "scroll_case", "bag_of_sand", { id: "book", title: "Dustman Manifesto" }, "embalming_fluid", { id: "parchment", count: 10 }, "small_knife", "trinket_beads", "writing_quill"],
    feat: ["spellcasting_sorcerer", "eyes_of_the_dark", "strength_of_the_grave", "font_of_magic", "sorcery_points", "flexible_casting", "metamagic", "metamagic_quickened_spell", "metamagic_twinned_spell", "sorcerous_versatility", "magical_guidance", "hound_of_ill_omen", "age_aasimar", "darkvision_aasimar", "celestial_resistance", "healing_hands", "light_bearer", "necrotic_shroud", "heart_of_darkness"],
    spells: ["chill_touch", "light", "mage_hand", "mind_sliver", "minor_illusion", "prestidigitation", "false_life", "ray_of_sickness", "shield", "blindness_deafness", "darkness", "hold_person", "spider_climb", "enemies_abound"],
    starred: ["dagger", "common_clothes", "crystal", "locket", "ink", "rations", "waterskin", "backpack", "scroll_case", "bag_of_sand", "parchment", "small_knife", "writing_quill"],
  },
  karmine: {
    name: "Karmine", race: "Elf", class: "Wizard / Arcane Scholar", img: IMAGES.karmine,
    ab: { STR: 9, DEX: 16, CON: 15, INT: 20, WIS: 12, CHA: 9 }, prof: 3, ac: 15, hp: 38, init: "+3",
    saves: ["INT", "WIS"],
    skills: ["History", "Arcana", "Perception", "Insight", "Performance", "Investigation"],
    counters: [
      { name: "Hit Dice (d6)", max: 6, cur: 6, color: "#d4d0c8" },
      { name: "Arcane Recovery", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "Bladesong", max: 3, cur: 3, color: "#d4d0c8" },
      { name: "1st Level Slots", max: 4, cur: 4, color: "#d4d0c8" },
      { name: "2nd Level Slots", max: 3, cur: 3, color: "#d4d0c8" },
      { name: "3rd Level Slots", max: 3, cur: 3, color: "#d4d0c8" },
    ],
    inv: ["scalpel", "shortsword", "common_clothes", "crystal", "hat_of_disguise", "portal_compass", "studded_leather_armor", "blood_charm", { id: "clot_charm", count: 3 }, "ink", "pouch", "mysterious_letter", { id: "portal_key", title: "Portal Key (Eye-Shaped Piece of Lapis Lazuli)" }, "small_knife", "spellbook", "writing_quill"],
    feat: ["arcane_recovery", "spellcasting_wizard", "training_in_war_and_song", "bladesong", "bladesinger_styles", "cantrip_formulas", "extra_attack", "age_elf", "darkvision_elf", "keen_senses", "fey_ancestry", "trance", "elf_weapon_training", "cantrip", "extra_language", "researcher", "elven_accuracy"],
    spells: ["booming_blade", "fire_bolt", "green_flame_blade", "mage_hand", "absorb_elements", "find_familiar", "shield", "sleep", "mirror_image", "misty_step", "shadow_blade", "tashas_mind_whip", "counterspell", "fireball", "haste"],
    unprep: ["chill_touch", "burning_hands", "comprehend_languages", "detect_magic", "identify", "summon_fey"],
    starred: ["shortsword", "common_clothes", "crystal", "studded_leather_armor", "ink", "pouch", "mysterious_letter", "small_knife", "spellbook", "writing_quill"],
  },
  rubic: {
    name: "Rubic", race: "Harengon", class: "Fighter / Rune Knight", img: IMAGES.rubic,
    ab: { STR: 16, DEX: 14, CON: 16, INT: 10, WIS: 12, CHA: 8 }, prof: 3, ac: 18, hp: 44, init: "+5",
    saves: ["STR", "CON"],
    skills: ["Athletics", "Intimidation", "Perception", "Survival"],
    counters: [
      { name: "Hit Dice", max: 5, cur: 5, color: "#d4d0c8" },
      { name: "Second Wind", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "Action Surge", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "Runes Active", max: 2, cur: 2, color: "#d4d0c8" },
      { name: "Giant's Might", max: 3, cur: 3, color: "#d4d0c8" },
    ],
    inv: ["glaive", "light_crossbow", "bolts", "chain_mail_x", "lucky_razor", "lucia_locket", "mystery_map", "explorer_pack"],
    feat: ["fight_def", "second_wind", "action_surge", "rune_carver", "giants_might", "rabbit_hop", "lucky_foot", "hare_trigger", "military"],
    spells: [],
  },
  lucien: {
    name: "Lucien", race: "Elf", class: "Cleric of Sune", img: IMAGES.lucien,
    ab: { STR: 10, DEX: 10, CON: 14, INT: 12, WIS: 17, CHA: 16 }, prof: 3, ac: 16, hp: 38, init: "+0",
    saves: ["WIS", "CHA"],
    skills: ["Insight", "Medicine", "Persuasion", "Religion"],
    counters: [
      { name: "Hit Dice", max: 5, cur: 5, color: "#d4d0c8" },
      { name: "Channel Divinity", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "1st Level Slots", max: 4, cur: 4, color: "#d4d0c8" },
      { name: "2nd Level Slots", max: 3, cur: 3, color: "#d4d0c8" },
      { name: "3rd Level Slots", max: 2, cur: 2, color: "#d4d0c8" },
    ],
    inv: ["holy_sune", "mace", "shield_sune", "scale_mail", "wine", "prayer_book", "perfume"],
    feat: ["sc_cleric", "channel_div", "charm_beauty", "fey_ancestry", "darkvision_elf", "shelter"],
    spells: ["sacred_flame", "light_sp", "thaumaturgy", "heal_word", "guiding_bolt", "hold_person", "scorch_ray", "fireball", "u_bless", "u_cure", "u_lesser_rest"],
  },
  seabastion: {
    name: "Seabastion", race: "Sea Elf", class: "Cleric of Deep Sashelas", img: IMAGES.seabastion,
    ab: { STR: 14, DEX: 10, CON: 14, INT: 10, WIS: 16, CHA: 12 }, prof: 2, ac: 18, hp: 28, init: "+0",
    saves: ["WIS", "CHA"],
    skills: ["Athletics", "Medicine", "Nature", "Perception"],
    counters: [
      { name: "Hit Dice", max: 3, cur: 3, color: "#d4d0c8" },
      { name: "Channel Divinity", max: 1, cur: 1, color: "#d4d0c8" },
      { name: "Wrath of Storm", max: 3, cur: 3, color: "#d4d0c8" },
      { name: "1st Level Slots", max: 4, cur: 4, color: "#d4d0c8" },
      { name: "2nd Level Slots", max: 2, cur: 2, color: "#d4d0c8" },
    ],
    inv: ["warhammer", "holy_coral", "chain_mail", "shield_waves", "sailor_pack", "poison_cake"],
    feat: ["sc_cleric", "channel_div", "wrath_storm", "darkvision_elf", "child_sea", "ships"],
    spells: ["sacred_flame", "spare_dying", "thunderwave", "heal_word", "fog_cloud", "shatter", "u_bless", "u_create_water"],
  },
  christian: {
    name: "Christian", race: "Wood Elf", class: "Inquisitive Rogue", img: IMAGES.christian,
    ab: { STR: 8, DEX: 20, CON: 12, INT: 12, WIS: 18, CHA: 12 }, prof: 3, ac: 16, hp: 39, init: "+5",
    saves: ["DEX", "INT"],
    skills: ["Sleight of Hand", "Perception", "Persuasion", "Stealth", "Insight", "Investigation", "Religion"],
    expertise: ["Investigation", "Perception", "Religion", "Stealth"],
    counters: [
      { name: "Hit Dice (d8)", max: 6, cur: 6, color: "#f0ece0" },
    ],
    inv: [{ id: "dagger", count: 2 }, "rapier", "shortbow", "fine_clothes", "leather_armor", "necklace_of_prayer_beads", { id: "arrow", count: 20 }, "ball_bearings", { id: "candle", count: 5 }, "hempen_rope", "hooded_lantern", { id: "oil", count: 2 }, { id: "piton", count: 10 }, { id: "rations", count: 5 }, "string", "waterskin", { id: "backpack", title: "Burglar's Pack" }, "purse", "thieves_tools", "bell", "crowbar", "hammer", "signet_ring", "scroll_of_pedigree", "tinderbox"],
    feat: ["expertise", "sneak_attack", "thieves_cant", "cunning_action", "ear_for_deceit", "eye_for_detail", "insightful_fighting", "steady_aim", "uncanny_dodge", "age_elf", "darkvision_elf", "keen_senses", "fey_ancestry", "trance", "elf_weapon_training", "fleet_of_foot", "mask_of_the_wild", "position_of_privilege"],
    spells: [],
    starred: ["dagger", "rapier", "shortbow", "fine_clothes", "leather_armor", "arrow", "ball_bearings", "candle", "hempen_rope", "hooded_lantern", "oil", "piton", "rations", "string", "waterskin", "backpack", "purse", "thieves_tools", "bell", "crowbar", "hammer", "signet_ring", "scroll_of_pedigree", "tinderbox"],
  },
};

// ═══════════════════════════════════════════════════
// INCARNATION BUILDER
// ═══════════════════════════════════════════════════

const builtIncarnations = {};

function buildIncarnation(id) {
  if (builtIncarnations[id]) return;
  builtIncarnations[id] = true;

  const el = document.getElementById(id);
  if (!el) return;

  if (DISABLED.includes(id)) return;

  const data = DATA[id];
  if (!data) return;

  const starred = new Set(data.starred || []);
  const unprepSet = new Set(data.unprep || []);
  const allSpells = [...data.spells, ...(data.unprep || [])];
  const hasUnprep = unprepSet.size > 0;

  const tabs = [
    { id: `${id}-sheet`, label: "Sheet" },
    { id: `${id}-inv`, label: "Inventory" },
    { id: `${id}-feat`, label: "Features" },
    { id: `${id}-spells`, label: "Spells" },
  ];

  el.innerHTML =
    buildTabBar(tabs, "Character tabs") +
    buildTabPanel(`${id}-sheet`, renderSheet(data), true) +
    buildTabPanel(`${id}-inv`, buildCardSection(data.inv, `${id}-inv-g`, starred), false) +
    buildTabPanel(`${id}-feat`, buildCardSection(data.feat, `${id}-feat-g`, starred), false) +
    buildTabPanel(`${id}-spells`, buildCardSection(allSpells, `${id}-sp-g`, starred, hasUnprep ? ["Unprepared"] : undefined, unprepSet), false);
}

// ═══════════════════════════════════════════════════
// EVENT DELEGATION
// ═══════════════════════════════════════════════════

function handleIncarnationClick(e) {
  const incBtn = e.target.closest(".inc-btn");
  if (!incBtn) return false;
  if (incBtn.classList.contains("inc-disabled")) return true; // swallow click

  const page = incBtn.closest(".player-page");
  page.querySelectorAll(".inc-btn").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  page.querySelectorAll(".inc-content").forEach(c => c.classList.remove("active"));

  incBtn.classList.add("active");
  incBtn.setAttribute("aria-selected", "true");

  const target = document.getElementById(incBtn.dataset.inc);
  if (target) {
    target.classList.add("active");
    buildIncarnation(incBtn.dataset.inc);
  }
  return true;
}

function handleTabClick(e) {
  const tabBtn = e.target.closest(".tab-btn");
  if (!tabBtn) return false;

  const bar = tabBtn.closest(".tab-bar");
  const parent = bar.parentElement;

  bar.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  parent.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  tabBtn.classList.add("active");
  tabBtn.setAttribute("aria-selected", "true");

  const target = document.getElementById(tabBtn.dataset.tab);
  if (target) target.classList.add("active");
  return true;
}

function handlePipClick(e) {
  const pip = e.target.closest(".cs-pip");
  if (!pip) return false;

  const isFilled = pip.classList.toggle("filled");
  pip.setAttribute("aria-checked", isFilled);
  return true;
}

function handleFilterClick(e) {
  const pill = e.target.closest(".filter-pill");
  if (!pill) return false;

  const bar = pill.closest(".filter-bar");
  const grid = document.getElementById(bar.dataset.grid);
  if (!grid) return true;

  const allPill = bar.querySelector('[data-filter="all"]');
  const clicked = pill.dataset.filter;

  if (clicked === "all") {
    bar.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
    allPill.classList.add("active");
  } else {
    allPill.classList.remove("active");
    pill.classList.toggle("active");
    if (!bar.querySelector(".filter-pill.active")) {
      allPill.classList.add("active");
    }
  }

  const activeFilters = [];
  bar.querySelectorAll(".filter-pill.active").forEach(p => activeFilters.push(p.dataset.filter));
  const showAll = activeFilters.includes("all");

  grid.querySelectorAll(".item-card").forEach(card => {
    card.classList.toggle("filter-hidden", !showAll && !activeFilters.includes(card.dataset.cat));
  });
  return true;
}

function handleCardClick(e) {
  // Close button inside modal
  const closeBtn = e.target.closest(".card-modal-close");
  if (closeBtn) { closeCardModal(); return true; }

  // Card click → open modal
  const card = e.target.closest(".item-card[data-card-id]");
  if (card) { showCardModal(card.dataset.cardId); return true; }

  return false;
}

document.addEventListener("click", function (e) {
  handleIncarnationClick(e) ||
    handleTabClick(e) ||
    handlePipClick(e) ||
    handleCardClick(e) ||
    handleFilterClick(e);
});

// ═══════════════════════════════════════════════════
// SWIPE GESTURE HANDLING
// ═══════════════════════════════════════════════════

let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 50;
const SWIPE_MAX_Y = 80;

document.addEventListener("touchstart", function (e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", function (e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  // Only handle horizontal swipes, not vertical scrolling
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_MAX_Y) return;

  // Find the active tab bar within the current incarnation
  const activePage = document.querySelector(".player-page.active");
  if (!activePage) return;
  const activeInc = activePage.querySelector(".inc-content.active");
  if (!activeInc) return;
  const tabBar = activeInc.querySelector(".tab-bar");
  if (!tabBar) return;

  const tabs = Array.from(tabBar.querySelectorAll(".tab-btn"));
  const activeIdx = tabs.findIndex(t => t.classList.contains("active"));
  if (activeIdx === -1) return;

  const newIdx = dx < 0 ? activeIdx + 1 : activeIdx - 1;
  if (newIdx >= 0 && newIdx < tabs.length) {
    tabs[newIdx].click();
  }
}, { passive: true });

// ═══════════════════════════════════════════════════
// DATA LOADING & INIT
// ═══════════════════════════════════════════════════

/**
 * Load cards from JSON, then initialize the app.
 */
function loadCards() {
  return fetch("cards.json")
    .then(r => {
      if (!r.ok) throw new Error("Failed to load cards.json");
      return r.json();
    })
    .then(data => { CARDS = data; })
    .catch(err => {
      console.warn("cards.json load failed, using empty card set:", err.message);
      CARDS = {};
    });
}

function initApp() {
  // Populate avatar thumbnails from IMAGES config
  document.querySelectorAll(".inc-avatar[data-char]").forEach(img => {
    const key = img.dataset.char;
    if (IMAGES[key]) img.src = IMAGES[key];
  });

  // Mark disabled incarnation buttons
  DISABLED.forEach(id => {
    const btn = document.querySelector(`.inc-btn[data-inc="${id}"]`);
    if (btn) btn.classList.add("inc-disabled");
  });

  // For each player page, ensure the default active incarnation is not disabled.
  // If it is, switch to the first available one.
  document.querySelectorAll(".player-page").forEach(page => {
    const activeInc = page.querySelector(".inc-content.active");
    if (activeInc && DISABLED.includes(activeInc.id)) {
      // Deactivate current
      activeInc.classList.remove("active");
      const activeBtn = page.querySelector(".inc-btn.active");
      if (activeBtn) {
        activeBtn.classList.remove("active");
        activeBtn.setAttribute("aria-selected", "false");
      }
      // Find first non-disabled incarnation
      const availableBtn = page.querySelector(".inc-btn:not(.inc-disabled)");
      if (availableBtn) {
        availableBtn.classList.add("active");
        availableBtn.setAttribute("aria-selected", "true");
        const target = document.getElementById(availableBtn.dataset.inc);
        if (target) target.classList.add("active");
      }
    }
  });

  // Select a random player on load
  const playerBtns = Array.from(document.querySelectorAll(".player-btn"));
  const randomBtn = playerBtns[Math.floor(Math.random() * playerBtns.length)];
  if (randomBtn) {
    randomBtn.classList.add("active");
    randomBtn.setAttribute("aria-selected", "true");
    const page = document.getElementById(randomBtn.dataset.player);
    if (page) {
      page.classList.add("active");
      const activeInc = page.querySelector(".inc-content.active");
      if (activeInc) buildIncarnation(activeInc.id);
    }
  }

  // Player switcher
  document.querySelectorAll(".player-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".player-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".player-page").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      const page = document.getElementById(btn.dataset.player);
      if (page) {
        page.classList.add("active");
        const activeInc = page.querySelector(".inc-content.active");
        if (activeInc) buildIncarnation(activeInc.id);
      }
    });
  });
}

// Boot: load cards, then init
loadCards().then(initApp);
