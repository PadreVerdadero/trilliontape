import { safeReturnPath } from "@/lib/game/places";

export function nextFromForm(form: FormData) {
  return safeReturnPath(form.get("next"));
}
