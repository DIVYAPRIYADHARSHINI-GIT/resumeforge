// Text measurement + word wrapping from real font metrics.
//
// This is the foundation of "the PDF looks like the preview": the DOM preview, the
// paginator and the pdf-lib writer all call measureText()/wrapText() with the same font
// metrics extracted from the shipped TTFs, so a line that fits in the preview also fits
// in the PDF and the page breaks land in the same place.

import metricsJson from './font-metrics.json';
import type { FontId } from '#lib/types';

export interface FontMetrics {
	unitsPerEm: number;
	ascender: number; // per 1000 em
	descender: number; // negative, per 1000 em
	lineGap: number;
	defaultWidth: number;
	widths: Record<string, number>; // codepoint -> width per 1000 em
}

export type FontWeight = 'regular' | 'bold' | 'italic';

const METRICS = metricsJson as unknown as Record<string, FontMetrics>;

/** Maps a resume font choice to the shipped file stems. */
export const FONT_FILES: Record<FontId, Record<FontWeight, string>> = {
	inter: { regular: 'inter-regular', bold: 'inter-bold', italic: 'inter-italic' },
	'source-serif': {
		regular: 'source-serif-regular',
		bold: 'source-serif-bold',
		italic: 'source-serif-italic'
	},
	lato: { regular: 'lato-regular', bold: 'lato-bold', italic: 'lato-italic' },
	'ibm-plex-sans': {
		regular: 'ibm-plex-sans-regular',
		bold: 'ibm-plex-sans-bold',
		italic: 'ibm-plex-sans-italic'
	}
};

export const FONT_LABELS: Record<FontId, string> = {
	inter: 'Inter',
	'source-serif': 'Source Serif 4',
	lato: 'Lato',
	'ibm-plex-sans': 'IBM Plex Sans'
};

/** CSS font-family stack for the preview - self-hosted only, no external font service. */
export const FONT_CSS: Record<FontId, string> = {
	inter: "'RF Inter', sans-serif",
	'source-serif': "'RF Source Serif', serif",
	lato: "'RF Lato', sans-serif",
	'ibm-plex-sans': "'RF IBM Plex Sans', sans-serif"
};

export function getMetrics(font: FontId, weight: FontWeight = 'regular'): FontMetrics {
	const key = FONT_FILES[font]?.[weight] ?? FONT_FILES.inter.regular;
	return METRICS[key] ?? METRICS['inter-regular'];
}

/**
 * Width of a string in points at a given size.
 * Unknown glyphs fall back to the font's default advance so exotic characters never
 * silently measure as zero.
 */
export function measureText(
	text: string,
	font: FontId,
	weight: FontWeight,
	sizePt: number
): number {
	if (!text) return 0;
	const m = getMetrics(font, weight);
	let total = 0;
	// Iterate by code point so surrogate pairs count once.
	for (const ch of text) {
		const cp = ch.codePointAt(0);
		if (cp == null) continue;
		const w = m.widths[String(cp)];
		total += w == null ? m.defaultWidth : w;
	}
	return (total * sizePt) / 1000;
}

/** Natural line height in points for a font at a size (before the user's line spacing). */
export function naturalLineHeight(font: FontId, sizePt: number): number {
	const m = getMetrics(font, 'regular');
	const h = m.ascender - m.descender + m.lineGap;
	return (h * sizePt) / 1000;
}

export interface WrapOptions {
	font: FontId;
	weight: FontWeight;
	sizePt: number;
	maxWidthPt: number;
}

/**
 * Greedy word wrap. Returns the lines that fit `maxWidthPt`.
 * A single word longer than the line (a long URL, say) is split by character so it can
 * never overflow the page.
 */
export function wrapText(text: string, opts: WrapOptions): string[] {
	const { font, weight, sizePt, maxWidthPt } = opts;
	if (!text) return [];
	if (maxWidthPt <= 0) return [text];

	const lines: string[] = [];
	// Preserve author-entered line breaks.
	for (const paragraph of text.split('\n')) {
		if (!paragraph.trim()) {
			lines.push('');
			continue;
		}
		const words = paragraph.split(/\s+/).filter(Boolean);
		let current = '';
		for (const word of words) {
			const candidate = current ? `${current} ${word}` : word;
			if (measureText(candidate, font, weight, sizePt) <= maxWidthPt) {
				current = candidate;
				continue;
			}
			if (current) {
				lines.push(current);
				current = '';
			}
			// The word alone may still be too wide.
			if (measureText(word, font, weight, sizePt) <= maxWidthPt) {
				current = word;
			} else {
				let chunk = '';
				for (const ch of word) {
					if (measureText(chunk + ch, font, weight, sizePt) > maxWidthPt && chunk) {
						lines.push(chunk);
						chunk = ch;
					} else {
						chunk += ch;
					}
				}
				current = chunk;
			}
		}
		if (current) lines.push(current);
	}
	return lines.length ? lines : [''];
}

/** How many wrapped lines a string needs - used by the paginator without keeping the text. */
export function countLines(text: string, opts: WrapOptions): number {
	return wrapText(text, opts).length;
}

// --- unit conversion ---------------------------------------------------------
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

export function mmToPt(mm: number): number {
	return (mm / MM_PER_INCH) * PT_PER_INCH;
}

export function ptToMm(pt: number): number {
	return (pt / PT_PER_INCH) * MM_PER_INCH;
}

/** Page sizes in points (pdf-lib's unit). */
export const PAGE_SIZES_PT = {
	a4: { width: 595.28, height: 841.89 },
	letter: { width: 612, height: 792 }
} as const;
