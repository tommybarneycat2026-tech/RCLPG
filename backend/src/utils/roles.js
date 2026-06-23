export const ADMINISTRATOR_ROLES = new Set(['Administrator', 'Admin']);

export function isAdministratorRole(role) {
  return ADMINISTRATOR_ROLES.has(role);
}
