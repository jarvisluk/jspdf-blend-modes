/**
 * Test helpers for inspecting raw PDF byte streams.
 *
 * jsPDF emits PDFs as ASCII (with binary streams sandwiched in between when
 * compression is on). For the assertions we care about — does the PDF
 * contain a particular ExtGState dictionary? Does the page Resources
 * reference our `/Gs<Mode>` name? — converting to a Latin-1 string and
 * regex-matching is correct, fast, and order-independent.
 *
 * Compression is disabled in these tests so the page content stream stays
 * in plaintext and we can assert on operator sequences too.
 */
export function pdfBytesToLatin1(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  // String.fromCharCode in chunks — same encoding as TextDecoder('latin1')
  // but works in jsdom/happy-dom without an explicit decoder.
  const chunkSize = 0x8000;
  let result = "";
  for (let i = 0; i < u8.length; i += chunkSize) {
    result += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  return result;
}

/** Counts non-overlapping regex matches in a string. */
export function countMatches(haystack: string, re: RegExp): number {
  if (!re.global) re = new RegExp(re.source, re.flags + "g");
  return (haystack.match(re) ?? []).length;
}
