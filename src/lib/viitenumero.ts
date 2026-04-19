/**
 * Generates a valid Finnish bank reference number (viitenumero).
 * Algorithm: modulo 10 with weights 7-3-1 applied right-to-left.
 * The base number is padded to at least 3 digits; the check digit is appended.
 */
export function generateViitenumero(base: number): string {
  const digits = String(base).replace(/\D/g, "");
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const weight = weights[(digits.length - 1 - i) % 3];
    sum += parseInt(digits[i], 10) * weight;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + String(checkDigit);
}

/**
 * Validates a Finnish reference number.
 */
export function validateViitenumero(ref: string): boolean {
  const digits = ref.replace(/\D/g, "");
  if (digits.length < 4) return false;
  const base = digits.slice(0, -1);
  const check = parseInt(digits.slice(-1), 10);
  return generateViitenumero(parseInt(base, 10)) === digits && check === parseInt(generateViitenumero(parseInt(base, 10)).slice(-1), 10);
}

/**
 * Formats a reference number for display: groups of 5 from the right.
 * e.g. "13149" → "13149"  "1234567" → "12 34567"
 */
export function formatViitenumero(ref: string): string {
  const digits = ref.replace(/\D/g, "");
  const reversed = digits.split("").reverse();
  const groups: string[] = [];
  for (let i = 0; i < reversed.length; i += 5) {
    groups.push(reversed.slice(i, i + 5).reverse().join(""));
  }
  return groups.reverse().join(" ");
}
