// ---------------------------------------------------------
// Player-level shared inventory.
//
// Items listed here are available to every incarnation on the
// same player page, in addition to that character's own `inv`.
// Loadout entries use the same string / `{ id, count?, titleOverride? }`
// format as character inventories.
// ---------------------------------------------------------

export const PLAYER_INVENTORY = {
  p1: ["golden_talisman", "sensory_stone", "potion_of_poison_resistance", "warming_waterskin", { id: "book", titleOverride: "Dustman Manifesto" }, { id: "embalming_fluid", count: 2 }, "trinket_beads"],
  p2: ["scalpel", "hat_of_disguise", "portal_compass", "blood_charm", { id: "clot_charm", count: 3 }, { id: "portal_key", titleOverride: "Portal Key (Eye-Shaped Piece of Lapis Lazuli)" }],
  p3: ["necklace_of_prayer_beads"],
};
