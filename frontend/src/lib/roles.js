/**
 * Chama roles as stored by the backend (`member_profiles.role`).
 *
 * The Flask API compares role strings exactly ("Treasurer", "Chairperson",
 * "Secretary"), so we keep the canonical casing here and compare
 * case-insensitively in the UI.
 */
export const ROLES = {
  CHAIRPERSON: "Chairperson",
  TREASURER: "Treasurer",
  SECRETARY: "Secretary",
  MEMBER: "Member",
};

/** Roles the backend accepts when a user requests to create a chama. */
export const CREATOR_ROLES = [ROLES.CHAIRPERSON, ROLES.TREASURER, ROLES.SECRETARY];

export const ALL_ROLES = [ROLES.CHAIRPERSON, ROLES.TREASURER, ROLES.SECRETARY, ROLES.MEMBER];

export const ROLE_LABELS = {
  [ROLES.CHAIRPERSON]: "Chairperson",
  [ROLES.TREASURER]: "Treasurer",
  [ROLES.SECRETARY]: "Secretary",
  [ROLES.MEMBER]: "Member",
};

/** Case-insensitive role equality (backend casing is not guaranteed). */
export const isRole = (role, expected) =>
  String(role || "").toLowerCase() === String(expected).toLowerCase();

/** True when `role` matches any of `expected`. */
export const roleIn = (role, expected = []) => expected.some((r) => isRole(role, r));

/** Officials that may review join requests / edit the chama (backend rule). */
export const isOfficial = (role) => roleIn(role, [ROLES.CHAIRPERSON, ROLES.TREASURER]);

export const isTreasurer = (role) => isRole(role, ROLES.TREASURER);

export const roleLabel = (role) =>
  ALL_ROLES.find((r) => isRole(role, r)) || role || "Member";
