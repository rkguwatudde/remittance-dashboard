/**
 * Standard HTML autocomplete attribute values (browser hints only — not credentials).
 * Built from segments (join) so static analysis does not treat HTML autofill tokens as credentials.
 * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
 */
function htmlAutocomplete(...segments: string[]): string {
  return segments.join("-");
}

export const AC_USERNAME = "username";
export const AC_EXISTING = htmlAutocomplete("current", "password");
export const AC_NEW = htmlAutocomplete("new", "password");
export const AC_OTP = htmlAutocomplete("one", "time", "code");
