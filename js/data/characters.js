// ---------------------------------------------------------
// Character (incarnation) definitions.
//
// Each entry describes one playable incarnation: ability scores,
// proficiencies, derived stats, resource counters, and the card IDs
// (resolved against cards.json) that make up its per-character inventory,
// features, and spells. Shared player inventory is defined in players.js
// and merged at render time.
//
// Loadout entries may be a plain card ID string, or an object
// `{ id, count?, titleOverride? }` to override quantity or display title.
// ---------------------------------------------------------

import { PORTRAITS } from "../config.js";

const getProfBonus = (level) => Math.ceil(1 + level / 4);

/** Default colour for resource-counter pips. */
const PIP_COLOR = "#d4d0c8";

export const CHARACTERS = {
  vespera: {
    level: 6,
    name: "Vespera", race: "Tiefling", class: "Divine Soul Sorcerer", img: PORTRAITS.vespera,
    ab: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 13, CHA: 18 }, ac: 13, hp: 22,
    spellcastingAbility: "CHA",
    saves: ["CHA", "DEX"],
    skills: ["Deception", "Intimidation", "Performance", "Persuasion", "Religion"],
    counters: [
      { name: "Hit Dice", max: 3, cur: 3, color: PIP_COLOR },
      { name: "Bardic Inspiration", max: 4, cur: 4, color: PIP_COLOR },
      { name: "1st Level Slots", max: 4, cur: 4, color: PIP_COLOR },
      { name: "2nd Level Slots", max: 2, cur: 2, color: PIP_COLOR },
    ],
    inv: [],
    feat: [],
    spells: [],
  },
  lucia: {
    level: 6,
    name: "Lucia", race: "Fallen Aasimar", class: "Shadow Sorcerer", img: PORTRAITS.lucia,
    ab: { STR: 9, DEX: 12, CON: 15, INT: 10, WIS: 10, CHA: 20 }, ac: 11, hp: 38,
    spellcastingAbility: "CHA",
    saves: ["CON", "CHA"],
    skills: ["Arcana", "Intimidation", "Persuasion", "Religion"],
    senses: ["Darkvision | 120"],
    resistances: ["Necrotic", "Radiant"],
    weapons: ["Dagger", "Dart", "Light Crossbow", "Quarterstaff", "Sling"],
    languages: ["Common", "Abyssal", "Celestial", "Infernal"],
    counters: [
      { name: "Hit Dice (d6)", max: 6, cur: 6, color: PIP_COLOR },
      { name: "Sorcery Points", max: 6, cur: 6, color: PIP_COLOR },
      { name: "Strength of the Grave (LR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Healing Hands (LR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Necrotic Shroud (LR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "1st Level Slots", max: 4, cur: 4, color: PIP_COLOR },
      { name: "2nd Level Slots", max: 3, cur: 3, color: PIP_COLOR },
      { name: "3rd Level Slots", max: 3, cur: 3, color: PIP_COLOR },
    ],
    inv: ["dagger", "common_clothes", "crystal", "locket", "ink", { id: "rations", count: 4 }, "waterskin", { id: "backpack", titleOverride: "Scholar's Pack" }, "scroll_case", "bag_of_sand", { id: "parchment", count: 10 }, "small_knife", "writing_quill"],
    feat: ["spellcasting_sorcerer", "eyes_of_the_dark", "strength_of_the_grave", "font_of_magic", "sorcery_points", "flexible_casting", "metamagic", "metamagic_quickened_spell", "metamagic_twinned_spell", "sorcerous_versatility", "magical_guidance", "hound_of_ill_omen", "age_aasimar", "darkvision_aasimar", "celestial_resistance", "healing_hands", "light_bearer", "necrotic_shroud", "heart_of_darkness"],
    spells: ["chill_touch", "light", "mage_hand", "mind_sliver", "minor_illusion", "prestidigitation", "false_life", "ray_of_sickness", "shield", "blindness_deafness", "darkness", "hold_person", "spider_climb", "enemies_abound"],
  },
  speaksWithSpirits: {
    level: 6,
    name: "Speaks-With-Spirits", race: "Fallen Aasimar", class: "Shadow Sorcerer", img: PORTRAITS.speaksWithSpirits,
    ab: { STR: 9, DEX: 12, CON: 15, INT: 10, WIS: 10, CHA: 20 }, ac: 11, hp: 38,
    spellcastingAbility: "CHA",
    saves: ["CON", "CHA"],
    skills: ["Arcana", "Intimidation", "Persuasion", "Religion"],
    senses: ["Darkvision | 120"],
    resistances: ["Necrotic", "Radiant"],
    weapons: ["Dagger", "Dart", "Light Crossbow", "Quarterstaff", "Sling"],
    languages: ["Common", "Abyssal", "Celestial", "Infernal"],
    counters: [
      { name: "Hit Dice (d6)", max: 6, cur: 6, color: PIP_COLOR },
      { name: "Sorcery Points", max: 6, cur: 6, color: PIP_COLOR },
      { name: "Strength of the Grave", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Healing Hands", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Necrotic Shroud", max: 1, cur: 1, color: PIP_COLOR },
    ],
    inv: [],
    feat: [],
    spells: [],
  },
  karmine: {
    level: 6,
    name: "Karmine", race: "High Elf", class: "Bladesinger Wizard", img: PORTRAITS.karmine,
    ab: { STR: 9, DEX: 16, CON: 15, INT: 20, WIS: 12, CHA: 9 }, ac: 15, hp: 38, speed: 30,
    spellcastingAbility: "INT",
    saves: ["INT", "WIS"],
    skills: ["History", "Arcana", "Perception", "Insight", "Performance", "Investigation"],
    senses: ["Darkvision | 60"],
    armor: ["Light"],
    weapons: ["Dagger", "Dart", "Light Crossbow", "Longbow", "Longsword", "Quarterstaff", "Rapier", "Shortbow", "Shortsword", "Sling"],
    languages: ["Common", "Elvish", "Celestial", "Infernal", "Sylvan"],
    counters: [
      { name: "Hit Dice (d6)", max: 6, cur: 6, color: PIP_COLOR },
      { name: "Arcane Recovery (SR 1/Day)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Bladesong (LR)", max: 3, cur: 3, color: PIP_COLOR },
      { name: "1st Level Slots", max: 4, cur: 4, color: PIP_COLOR },
      { name: "2nd Level Slots", max: 3, cur: 3, color: PIP_COLOR },
      { name: "3rd Level Slots", max: 3, cur: 3, color: PIP_COLOR },
    ],
    inv: ["shortsword", "common_clothes", "crystal", "studded_leather_armor", "ink", "pouch", "mysterious_letter", "small_knife", "spellbook", "writing_quill"],
    feat: ["arcane_recovery", "spellcasting_wizard", "training_in_war_and_song", "bladesong", "bladesinger_styles", "cantrip_formulas", "extra_attack", "age_elf", "darkvision_elf", "keen_senses", "fey_ancestry", "trance", "elf_weapon_training", "cantrip", "extra_language", "researcher", "elven_accuracy"],
    spells: ["booming_blade", "fire_bolt", "green_flame_blade", "mage_hand", "absorb_elements", "find_familiar", "shield", "sleep", "mirror_image", "misty_step", "shadow_blade", "tashas_mind_whip", "counterspell", "fireball", "haste"],
    unprep: ["burning_hands", "comprehend_languages", "detect_magic", "identify", "summon_fey"],
  },
  rubic: {
    level: 6,
    name: "Rubic", race: "Harengon", class: "Rune Knight Fighter", img: PORTRAITS.rubic,
    ab: { STR: 16, DEX: 14, CON: 20, INT: 9, WIS: 12, CHA: 9 }, ac: 16, hp: 70,
    initBonus: (ch) => ch.prof,
    saves: ["STR", "CON"],
    skills: ["Athletics", "Insight", "Intimidation", "Perception", "Survival"],
    tools: ["Playing Card Set", "Smith's Tools"],
    armor: ["Heavy", "Light", "Medium", "Shields"],
    weapons: ["Martial", "Simple"],
    languages: ["Common", "Giant", "Sylvan"],
    counters: [
      { name: "Hit Dice (d10)", max: 6, cur: 6, color: PIP_COLOR },
      { name: "Second Wind (SR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Action Surge (SR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Runes Carver (LR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Giant's Might (LR)", max: 3, cur: 3, color: PIP_COLOR },
      { name: "Runes: Cloud Rune (SR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Runes: Fire Rune (SR)", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Rabbit Hop (LR)", max: 3, cur: 3, color: PIP_COLOR },
    ],
    inv: ["glaive", "pike", "light_crossbow", "common_clothes", "chain_mail", { id: "crossbow_bolt", count: 20 }, "playing_card_set", { id: "rank_insignia", titleOverride: "Rank Insignia (Scout)" }, "prized_banner", "pouch", { id: "backpack", titleOverride: "Explorer's Pack" }, { id: "torch", count: 10 }, { id: "rations", count: 10 }, "waterskin", "hempen_rope", "bedroll", "mess_kit", "tinderbox"],
    feat: ["fighting_style", "second_wind", "fighting_style_great_weapon_fighting", "action_surge", "bonus_proficiencies", "rune_carver", "giants_might", "runes_cloud_rune", "runes_fire_rune", "martial_versatility", "extra_attack", "hare_trigger", "leporine_senses", "lucky_footwork", "rabbit_hop", "military_rank", "sentinel", "polearm_master"],
    spells: [{ id: "disguise_self", footerOverride: "Hat of Disguise" }],
  },
  akai: {
    level: 6,
    name: "Akai", race: "Harengon", class: "Rune Knight Fighter", img: PORTRAITS.akai,
    ab: { STR: 16, DEX: 14, CON: 16, INT: 10, WIS: 12, CHA: 8 }, ac: 18, hp: 44,
    saves: ["STR", "CON"],
    skills: ["Athletics", "Intimidation", "Perception", "Survival"],
    counters: [
      { name: "Hit Dice", max: 5, cur: 5, color: PIP_COLOR },
      { name: "Second Wind", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Action Surge", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Runes Active", max: 2, cur: 2, color: PIP_COLOR },
      { name: "Giant's Might", max: 3, cur: 3, color: PIP_COLOR },
    ],
    inv: [],
    feat: [],
  },
  lucien: {
    level: 6,
    name: "Lucien", race: "Wood Elf", class: "Light Cleric", img: PORTRAITS.lucien,
    ab: { STR: 10, DEX: 10, CON: 14, INT: 12, WIS: 17, CHA: 16 }, ac: 16, hp: 38,
    spellcastingAbility: "WIS",
    saves: ["WIS", "CHA"],
    skills: ["Insight", "Medicine", "Persuasion", "Religion"],
    counters: [
      { name: "Hit Dice", max: 5, cur: 5, color: PIP_COLOR },
      { name: "Channel Divinity", max: 1, cur: 1, color: PIP_COLOR },
      { name: "1st Level Slots", max: 4, cur: 4, color: PIP_COLOR },
      { name: "2nd Level Slots", max: 3, cur: 3, color: PIP_COLOR },
      { name: "3rd Level Slots", max: 2, cur: 2, color: PIP_COLOR },
    ],
    inv: [],
    feat: [],
    spells: [],
  },
  seabastion: {
    level: 6,
    name: "Seabastion", race: "Sea Elf", class: "Tempest Cleric", img: PORTRAITS.seabastion,
    ab: { STR: 14, DEX: 10, CON: 14, INT: 10, WIS: 16, CHA: 12 }, ac: 18, hp: 28,
    spellcastingAbility: "WIS",
    saves: ["WIS", "CHA"],
    skills: ["Athletics", "Medicine", "Nature", "Perception"],
    counters: [
      { name: "Hit Dice", max: 3, cur: 3, color: PIP_COLOR },
      { name: "Channel Divinity", max: 1, cur: 1, color: PIP_COLOR },
      { name: "Wrath of Storm", max: 3, cur: 3, color: PIP_COLOR },
      { name: "1st Level Slots", max: 4, cur: 4, color: PIP_COLOR },
      { name: "2nd Level Slots", max: 2, cur: 2, color: PIP_COLOR },
    ],
    inv: [],
    feat: [],
    spells: [],
  },
  christian: {
    level: 6,
    name: "Christian", race: "Wood Elf", class: "Inquisitive Rogue", img: PORTRAITS.christian,
    ab: { STR: 8, DEX: 20, CON: 12, INT: 12, WIS: 18, CHA: 12 }, ac: 16, hp: 39, speed: 35,
    saves: ["DEX", "INT"],
    skills: ["Sleight of Hand", "Perception", "Persuasion", "Stealth", "Insight", "Investigation", "Religion"],
    expertise: ["Investigation", "Perception", "Religion", "Stealth"],
    tools: ["Dragonchess", "Thieves' Tools"],
    senses: ["Darkvision | 60"],
    armor: ["Light"],
    weapons: ["Hand Crossbow", "Longbow", "Longsword", "Rapier", "Shortbow", "Shortsword", "Simple"],
    languages: ["Common", "Dwarvish", "Elvish", "Thieves' Cant"],
    counters: [
      { name: "Hit Dice (d8)", max: 6, cur: 6, color: "#f0ece0" },
    ],
    inv: [{ id: "dagger", count: 2 }, "rapier", "shortbow", "fine_clothes", "leather_armor", { id: "arrow", count: 20 }, "ball_bearings", { id: "candle", count: 5 }, "hempen_rope", "hooded_lantern", { id: "oil", count: 2 }, { id: "piton", count: 10 }, { id: "rations", count: 5 }, "string", "waterskin", { id: "backpack", titleOverride: "Burglar's Pack" }, "purse", "thieves_tools", "bell", "crowbar", "hammer", "signet_ring", "scroll_of_pedigree", "tinderbox"],
    feat: ["expertise", "sneak_attack", "thieves_cant", "cunning_action", "ear_for_deceit", "eye_for_detail", "insightful_fighting", "steady_aim", "uncanny_dodge", "age_elf", "darkvision_elf", "keen_senses", "fey_ancestry", "trance", "elf_weapon_training", "fleet_of_foot", "mask_of_the_wild", "position_of_privilege"],
  },
};

for (const ch of Object.values(CHARACTERS)) {
  ch.prof = getProfBonus(ch.level);
  ch.initBonus = ch.initBonus ? ch.initBonus(ch) : 0;
}
