export const OFFICE_USERNAME = "Jesse";

export function isOfficeUsername(name: string) {
  return name.localeCompare(OFFICE_USERNAME, undefined, { sensitivity: "accent" }) === 0;
}
