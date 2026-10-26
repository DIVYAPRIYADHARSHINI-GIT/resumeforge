// PDF generation with pdf-lib (free, MIT).
//
// The key design point: this does NOT re-implement layout. It consumes exactly the same
// LayoutResult the on-screen preview renders, so page breaks, line wrapping and positions
// are identical by construction. Fonts are embedded from the self-hosted TTFs, so the text
// is real selectable text (not an image) and links are real PDF link annotations.

import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FontId } from '#lib/types';
import { FONT_FILES, getMetrics, type FontWeight } from '#lib/logic/measure';
import type { LayoutResult, LayoutRun } from '#lib/logic/layout';

/**
 * Resolve a shipped font file.
 *
 * adapter-vercel copies `static/` into each serverless function bundle, so
 * `<fn root>/static/fonts/*.ttf` is the production path. We also probe a few
 * module-relative locations so local `vite dev`, `vite preview` and any future adapter
 * layout keep working. Results are cached because a cold function may render several
 * pages in one request.
 */
const fontCache = new Map<string, Uint8Array>();

async function readFontFile(stem: string): Promise<Uint8Array> {
	const cached = fontCache.get(stem);
	if (cached) return cached;

	const file = `${stem}.ttf`;
	const here = fileURLToPath(new URL('.', import.meta.url));
	const candidates = [
		join(process.cwd(), 'static', 'fonts', file),
		join(process.cwd(), 'client', 'fonts', file),
		join(here, 'static', 'fonts', file),
		join(here, '..', 'static', 'fonts', file),
		join(here, '..', '..', 'static', 'fonts', file),
		join(here, '..', '..', '..', 'static', 'fonts', file)
	];

	for (const path of candidates) {
		try {
			const bytes = new Uint8Array(await readFile(path));
			fontCache.set(stem, bytes);
			return bytes;
		} catch {
			continue;
		}
	}
	throw new Error(
		`Font file ${file} was not found on the server. Use "Print or save as PDF" instead.`
	);
}

function hexToRgb(hex: string) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return rgb(0.1, 0.1, 0.1);
	const n = parseInt(m[1], 16);
	return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface PdfOptions {
	title: string;
	author: string;
	subject?: string;
}

/**
 * Render a LayoutResult to a PDF.
 * `y` in the layout is the distance from the top of the page to the top of the line box;
 * pdf-lib's origin is the bottom-left, so the baseline is computed from the font ascender.
 */
export interface PdfRenderResult {
	bytes: Uint8Array;
	/** Characters the chosen font has no glyph for; replaced with "?" in the PDF. */
	unsupportedCharacters: string[];
}

export async function renderLayoutToPdf(
	layout: LayoutResult,
	font: FontId,
	options: PdfOptions
): Promise<PdfRenderResult> {
	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);

	pdf.setTitle(options.title);
	pdf.setAuthor(options.author);
	pdf.setProducer('ResumeForge');
	pdf.setCreator('ResumeForge');
	if (options.subject) pdf.setSubject(options.subject);

	// Embed the three faces we may need. `subset: true` keeps the file small while still
	// embedding real glyph outlines.
	const faces: Record<FontWeight, PDFFont> = {
		regular: await pdf.embedFont(await readFontFile(FONT_FILES[font].regular), { subset: true }),
		bold: await pdf.embedFont(await readFontFile(FONT_FILES[font].bold), { subset: true }),
		italic: await pdf.embedFont(await readFontFile(FONT_FILES[font].italic), { subset: true })
	};

	const unsupported = new Set<string>();

	for (const layoutPage of layout.pages) {
		const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);

		for (const rule of layoutPage.rules) {
			page.drawRectangle({
				x: rule.x,
				y: layout.pageHeight - rule.y - rule.thickness,
				width: rule.width,
				height: rule.thickness,
				color: hexToRgb(rule.color)
			});
		}

		for (const run of layoutPage.runs) {
			if (!run.text) continue;
			drawRun(page, run, faces, font, layout.pageHeight, unsupported);
		}
	}

	return { bytes: await pdf.save(), unsupportedCharacters: [...unsupported] };
}

function drawRun(
	page: PDFPage,
	run: LayoutRun,
	faces: Record<FontWeight, PDFFont>,
	fontId: FontId,
	pageHeight: number,
	unsupported: Set<string>
) {
	const face = faces[run.weight] ?? faces.regular;
	const metrics = getMetrics(fontId, run.weight);
	// Baseline sits one ascender below the top of the line box.
	const ascent = (metrics.ascender * run.size) / 1000;
	const baseline = pageHeight - run.y - ascent;

	const common = {
		x: run.x,
		y: baseline,
		size: run.size,
		font: face,
		color: hexToRgb(run.color)
	};

	// pdf-lib throws on characters the embedded subset cannot encode; replace them rather
	// than failing the whole export.
	const text = sanitiseForFont(run.text, fontId, run.weight, unsupported);

	if (run.tracking && run.tracking > 0) {
		// Letter-spaced headings: draw per character so spacing matches the preview.
		let x = run.x;
		for (const ch of text) {
			page.drawText(ch, { ...common, x });
			x += face.widthOfTextAtSize(ch, run.size) + run.tracking;
		}
	} else {
		page.drawText(text, common);
	}

	if (run.href) {
		const width = run.tracking
			? text.split('').reduce((w, ch) => w + face.widthOfTextAtSize(ch, run.size) + (run.tracking ?? 0), 0)
			: face.widthOfTextAtSize(text, run.size);
		// A real PDF link annotation, so the link is clickable in a viewer.
		const annotation = page.doc.context.register(
			page.doc.context.obj({
				Type: 'Annot',
				Subtype: 'Link',
				Rect: [run.x, baseline - run.size * 0.25, run.x + width, baseline + run.size * 0.9],
				Border: [0, 0, 0],
				A: { Type: 'Action', S: 'URI', URI: page.doc.context.obj(run.href) }
			})
		);
		const existing = page.node.Annots();
		if (existing) {
			existing.push(annotation);
		} else {
			page.node.set(page.doc.context.obj('Annots'), page.doc.context.obj([annotation]));
		}
	}
}

/**
 * Replace characters the embedded font cannot draw.
 *
 * The shipped fonts cover Latin-1 and Latin Extended-A, so accented European names render
 * correctly. Scripts outside that range (CJK, Devanagari, Arabic, ...) have no glyph, and
 * pdf-lib would silently emit glyph 0 - a blank box - rather than throwing. We detect that
 * from the real cmap-derived metrics, substitute a visible placeholder, and record the
 * characters so the route can tell the user instead of shipping a broken-looking PDF.
 */
function sanitiseForFont(
	text: string,
	fontId: FontId,
	weight: FontWeight,
	unsupported: Set<string>
): string {
	const metrics = getMetrics(fontId, weight);
	let out = '';
	for (const ch of text) {
		const cp = ch.codePointAt(0);
		if (cp == null) continue;
		// Control characters are dropped outright.
		if (cp < 32 && cp !== 9) continue;
		if (metrics.widths[String(cp)] != null) {
			out += ch;
		} else {
			unsupported.add(ch);
			out += '?';
		}
	}
	return out;
}
