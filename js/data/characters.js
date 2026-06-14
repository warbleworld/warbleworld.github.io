// ─────────────────────────────────────────────────────────
// Character (incarnation) definitions.
//
// Each entry describes one playable incarnation: ability scores,
// proficiencies, derived stats, resource counters, and the card IDs
// (resolved against cards.json) that make up its inventory, features,
// and spells.
//
// Loadout entries may be a plain card ID string, or an object
// `{ id, count?, title? }` to override quantity or display title.
// ─────────────────────────────────────────────────────────

import { PORTRAITS } from "../config.js";

export const LEVEL = 6;
const PROF_BONUS = Math.ceil(1 + LEVEL / 4);

export const CHARACTERS = {
  vespera: {
    name: "Vespera", race: "Tiefling", class: "Divine Soul Sorcerer", img: PORTRAITS.vespera,
    ab: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 13, CHA: 18 }, prof: PROF_BONUS, ac: 13, hp: 22, init: "+2",
    spellcastingAbility: "CHA",
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
    name: "Lucia", race: "Fallen Aasimar", class: "Shadow Sorcerer", img: PORTRAITS.lucia,
    ab: { STR: 9, DEX: 12, CON: 15, INT: 10, WIS: 10, CHA: 20 }, prof: PROF_BONUS, ac: 11, hp: 38, init: "+1",
    spellcastingAbility: "CHA",
    saves: ["CON", "CHA"],
    skills: ["Arcana", "Intimidation", "Persuasion", "Religion"],
    senses: ["Darkvision | 120"],
    resistances: ["Necrotic", "Radiant"],
    weapons: ["Dagger", "Dart", "Light Crossbow", "Quarterstaff", "Sling"],
    languages: ["Common", "Abyssal", "Celestial", "Infernal"],
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
    name: "Karmine", race: "High Elf", class: "Bladesinger Wizard", img: PORTRAITS.karmine,
    ab: { STR: 9, DEX: 16, CON: 15, INT: 20, WIS: 12, CHA: 9 }, prof: PROF_BONUS, ac: 15, hp: 38, init: "+3", speed: 35,
    spellcastingAbility: "INT",
    saves: ["INT", "WIS"],
    skills: ["History", "Arcana", "Perception", "Insight", "Performance", "Investigation"],
    senses: ["Darkvision | 60"],
    armor: ["Light"],
    weapons: ["Dagger", "Dart", "Light Crossbow", "Longbow", "Longsword", "Quarterstaff", "Rapier", "Shortbow", "Shortsword", "Sling"],
    languages: ["Common", "Elvish", "Celestial", "Infernal", "Sylvan"],
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
    unprep: ["burning_hands", "comprehend_languages", "detect_magic", "identify", "summon_fey"],
    starred: ["shortsword", "common_clothes", "crystal", "studded_leather_armor", "ink", "pouch", "mysterious_letter", "small_knife", "spellbook", "writing_quill"],
  },
  rubic: {
    name: "Rubic", race: "Harengon", class: "Rune Knight Fighter", img: PORTRAITS.rubic,
    ab: { STR: 16, DEX: 14, CON: 16, INT: 10, WIS: 12, CHA: 8 }, prof: PROF_BONUS, ac: 18, hp: 44, init: "+5",
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
    name: "Lucien", race: "Wood Elf", class: "Light Cleric", img: PORTRAITS.lucien,
    ab: { STR: 10, DEX: 10, CON: 14, INT: 12, WIS: 17, CHA: 16 }, prof: PROF_BONUS, ac: 16, hp: 38, init: "+0",
    spellcastingAbility: "WIS",
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
    name: "Seabastion", race: "Sea Elf", class: "Tempest Cleric", img: PORTRAITS.seabastion,
    ab: { STR: 14, DEX: 10, CON: 14, INT: 10, WIS: 16, CHA: 12 }, prof: PROF_BONUS, ac: 18, hp: 28, init: "+0",
    spellcastingAbility: "WIS",
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
    name: "Christian", race: "Wood Elf", class: "Inquisitive Rogue", img: PORTRAITS.christian,
    ab: { STR: 8, DEX: 20, CON: 12, INT: 12, WIS: 18, CHA: 12 }, prof: PROF_BONUS, ac: 16, hp: 39, speed: 35,
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
    inv: [{ id: "dagger", count: 2 }, "rapier", "shortbow", "fine_clothes", "leather_armor", "necklace_of_prayer_beads", { id: "arrow", count: 20 }, "ball_bearings", { id: "candle", count: 5 }, "hempen_rope", "hooded_lantern", { id: "oil", count: 2 }, { id: "piton", count: 10 }, { id: "rations", count: 5 }, "string", "waterskin", { id: "backpack", title: "Burglar's Pack" }, "purse", "thieves_tools", "bell", "crowbar", "hammer", "signet_ring", "scroll_of_pedigree", "tinderbox"],
    feat: ["expertise", "sneak_attack", "thieves_cant", "cunning_action", "ear_for_deceit", "eye_for_detail", "insightful_fighting", "steady_aim", "uncanny_dodge", "age_elf", "darkvision_elf", "keen_senses", "fey_ancestry", "trance", "elf_weapon_training", "fleet_of_foot", "mask_of_the_wild", "position_of_privilege"],
    spells: [],
    starred: ["dagger", "rapier", "shortbow", "fine_clothes", "leather_armor", "arrow", "ball_bearings", "candle", "hempen_rope", "hooded_lantern", "oil", "piton", "rations", "string", "waterskin", "backpack", "purse", "thieves_tools", "bell", "crowbar", "hammer", "signet_ring", "scroll_of_pedigree", "tinderbox"],
  },
};
