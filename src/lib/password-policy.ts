export const PASSWORD_POLICY_MESSAGE =
  "Salasanan on oltava vähintään 8 merkkiä ja sisällettävä vähintään yksi numero tai erikoismerkki.";

/** Returns an error message string if invalid, or null if valid. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return PASSWORD_POLICY_MESSAGE;
  if (!/[\d\W]/.test(password)) return PASSWORD_POLICY_MESSAGE;
  return null;
}
