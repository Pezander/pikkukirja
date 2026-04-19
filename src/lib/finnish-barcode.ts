import bwipjs from "bwip-js/node";

/**
 * Builds a Finnish bank barcode string (version 5, 54 chars).
 *
 * Format: 5 + IBAN-digits(16) + amount(8) + reserved(3) + reference(20) + due-date(6)
 *
 * Returns null if required fields are missing or invalid.
 */
export function buildFinnishBarcodeString(params: {
  iban: string;
  amountEur: number;
  referenceNumber: string;
  dueDate: string; // ISO date string
}): string | null {
  const { iban, amountEur, referenceNumber, dueDate } = params;

  // Strip spaces and validate Finnish IBAN
  const ibanClean = iban.replace(/\s/g, "").toUpperCase();
  if (!ibanClean.startsWith("FI")) return null;
  const ibanDigits = ibanClean.slice(2); // 16 digits after "FI"
  if (ibanDigits.length !== 16 || !/^\d+$/.test(ibanDigits)) return null;

  // Amount: euros and cents as 8-digit integer string (no decimal point)
  const cents = Math.round(amountEur * 100);
  const amountStr = cents.toString().padStart(8, "0");
  if (amountStr.length > 8) return null;

  // Reference: digits only, padded to 20 chars with leading zeros
  const refDigits = referenceNumber.replace(/\D/g, "");
  if (!refDigits) return null;
  const refStr = refDigits.padStart(20, "0");
  if (refStr.length > 20) return null;

  // Due date: YYMMDD
  let dueDateStr = "000000";
  if (dueDate) {
    const d = new Date(dueDate);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    dueDateStr = `${yy}${mm}${dd}`;
  }

  const result = `5${ibanDigits}${amountStr}000${refStr}${dueDateStr}`;
  if (result.length !== 54) return null;
  return result;
}

/**
 * Generates a Finnish bank barcode image as a base64 PNG data URI.
 * Returns null if generation fails.
 */
export async function generateFinnishBarcodeImage(
  barcodeString: string
): Promise<string | null> {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: barcodeString,
      scale: 2,
      height: 12,
      includetext: false,
    });
    return "data:image/png;base64," + (png as Buffer).toString("base64");
  } catch {
    return null;
  }
}
