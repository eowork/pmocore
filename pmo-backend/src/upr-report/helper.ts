import { join } from 'node:path';
import { existsSync } from 'node:fs';

const TEMPLATE_FILE = 'me-quartely-report_fixed.pdf';
// Arimo is metric-compatible with Arial/Helvetica, which is what the template's own fields are
// laid out for, and unlike the standard PDF fonts it covers the peso sign and the typographic
// punctuation that arrives with text pasted from Word. Licence in the same folder (OFL.txt).
const FONT_FILE = 'Arimo-Regular.ttf';
const  TEMPLATE_FILE_2 = "upr-quarterly-report-format-2.pdf"

function resolveAsset(folder: string, file: string): string {
  const candidates = [
    join(__dirname, '..', 'me-pdf', folder, file),
    join(process.cwd(), 'src', 'me-pdf', folder, file),
  ];

  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(`M&E report asset not found: ${file}`);
  }

  return found;
}

export function getTemplatePath(): string {
  return resolveAsset('template', TEMPLATE_FILE);
}

export function getTemplatePath2(): string {
  return resolveAsset('template', TEMPLATE_FILE_2);
}

export function getFontPath(): string {
  return resolveAsset('fonts', FONT_FILE);
}
