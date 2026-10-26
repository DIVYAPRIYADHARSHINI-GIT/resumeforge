// The layout engine: turns a Resume into positioned, paginated draw instructions.
//
// One engine feeds three consumers:
//   1. the on-screen preview (renders these boxes as absolutely positioned divs),
//   2. the page counter / "fit to one page" helper,
//   3. the server-side pdf-lib writer (draws the same boxes at the same coordinates).
// That is how the PDF ends up matching the preview.
//
// Page-break rules required by the brief:
//   - never split an entry heading from its first bullet,
//   - never leave a section heading alone at the bottom of a page.
// Implemented by laying out "atoms" (a heading + its first line are one unbreakable atom)
// and moving a whole atom to the next page when it does not fit.

import type { FontId, Resume, ResumeSection, TemplateId } from '#lib/types';
import { formatDateRange, formatMonthYear } from './dates';
import {
	measureText,
	mmToPt,
	PAGE_SIZES_PT,
	wrapText,
	type FontWeight
} from './measure';

export type RunStyle = 'normal' | 'bold' | 'italic';

/** One positioned piece of text on a page. Coordinates are points from the page's top-left. */
export interface LayoutRun {
	text: string;
	x: number;
	y: number; // baseline-independent: top of the line box
	size: number;
	weight: FontWeight;
	color: string;
	/** Present when the run should be a clickable link in the PDF. */
	href?: string;
	/** Letter spacing in points, used by small-caps style headings. */
	tracking?: number;
}

/** A horizontal rule (used by heading styles and template dividers). */
export interface LayoutRule {
	x: number;
	y: number;
	width: number;
	thickness: number;
	color: string;
}

export interface LayoutPage {
	runs: LayoutRun[];
	rules: LayoutRule[];
}

export interface LayoutResult {
	pages: LayoutPage[];
	pageWidth: number;
	pageHeight: number;
	/** True when content overflowed beyond the requested single page (for the fit helper). */
	pageCount: number;
}

export interface TemplateSpec {
	id: TemplateId;
	label: string;
	columns: 1 | 2;
	/** Multiplier applied to the user's base font size for the name. */
	nameScale: number;
	sectionHeadingScale: number;
	entryHeadingScale: number;
	uppercaseHeadings: boolean;
	/** Extra leading above a section heading, as a multiple of the body size. */
	headingSpaceBefore: number;
	headingSpaceAfter: number;
	/** Show the accent colour on section headings. */
	accentHeadings: boolean;
	nameAlign: 'left' | 'center';
	atsNote?: string;
}

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
	classic: {
		id: 'classic',
		label: 'Classic',
		columns: 1,
		nameScale: 1.9,
		sectionHeadingScale: 1.12,
		entryHeadingScale: 1.0,
		uppercaseHeadings: true,
		headingSpaceBefore: 0.9,
		headingSpaceAfter: 0.45,
		accentHeadings: false,
		nameAlign: 'center'
	},
	modern: {
		id: 'modern',
		label: 'Modern',
		columns: 1,
		nameScale: 2.1,
		sectionHeadingScale: 1.15,
		entryHeadingScale: 1.02,
		uppercaseHeadings: true,
		headingSpaceBefore: 1.0,
		headingSpaceAfter: 0.5,
		accentHeadings: true,
		nameAlign: 'left'
	},
	compact: {
		id: 'compact',
		label: 'Compact',
		columns: 1,
		nameScale: 1.6,
		sectionHeadingScale: 1.05,
		entryHeadingScale: 1.0,
		uppercaseHeadings: true,
		headingSpaceBefore: 0.6,
		headingSpaceAfter: 0.3,
		accentHeadings: false,
		nameAlign: 'left'
	},
	minimal: {
		id: 'minimal',
		label: 'Minimal',
		columns: 1,
		nameScale: 1.7,
		sectionHeadingScale: 1.0,
		entryHeadingScale: 1.0,
		uppercaseHeadings: false,
		headingSpaceBefore: 0.9,
		headingSpaceAfter: 0.35,
		accentHeadings: false,
		nameAlign: 'left'
	},
	executive: {
		id: 'executive',
		label: 'Executive',
		columns: 2,
		nameScale: 2.0,
		sectionHeadingScale: 1.1,
		entryHeadingScale: 1.02,
		uppercaseHeadings: true,
		headingSpaceBefore: 0.9,
		headingSpaceAfter: 0.45,
		accentHeadings: true,
		nameAlign: 'left',
		atsNote: 'Less suited to automated screening'
	}
};

export const TEMPLATE_LIST: TemplateSpec[] = [
	TEMPLATES.classic,
	TEMPLATES.modern,
	TEMPLATES.compact,
	TEMPLATES.minimal,
	TEMPLATES.executive
];

const INK = '#1a1a1a';
const MUTED = '#4a4a4a';

/**
 * An "atom" is a run of lines that must stay together. Lines inside an atom are never
 * split across a page boundary.
 */
interface Atom {
	lines: AtomLine[];
	/** Space reserved above this atom (collapses at the top of a page). */
	spaceBefore: number;
	/** Identifies section headings so we can enforce the widow rule. */
	isSectionHeading?: boolean;
	/** Rules drawn relative to the atom's start. */
	rules?: { dy: number; thickness: number; color: string; indent?: number; width?: number }[];
}

interface AtomLine {
	runs: Omit<LayoutRun, 'y'>[];
	height: number;
}

export interface LayoutOverrides {
	fontSize?: number;
	lineSpacing?: number;
	sectionSpacing?: number;
}

/** Build the full layout for a resume. */
export function layoutResume(resume: Resume, overrides: LayoutOverrides = {}): LayoutResult {
	const page = resume.page;
	const template = TEMPLATES[resume.style.template] ?? TEMPLATES.classic;
	const font = resume.style.font;
	const accent = resume.style.accent || '#E8590C';

	const fontSize = overrides.fontSize ?? page.fontSize;
	const lineSpacing = overrides.lineSpacing ?? page.lineSpacing;
	const sectionSpacing = overrides.sectionSpacing ?? page.sectionSpacing;

	const size = PAGE_SIZES_PT[page.size];
	const marginTop = mmToPt(page.marginTop);
	const marginBottom = mmToPt(page.marginBottom);
	const marginSide = mmToPt(page.marginSide);
	const contentWidth = size.width - marginSide * 2;
	const contentHeight = size.height - marginTop - marginBottom;

	const lh = (s: number) => s * lineSpacing * 1.2;

	const ctx: BuildContext = {
		font,
		accent,
		template,
		fontSize,
		lineSpacing,
		sectionSpacing,
		contentWidth,
		lh,
		headingStyle: resume.style.headingStyle
	};

	const atoms: Atom[] = [];
	for (const section of resume.sections) {
		if (section.hidden) continue;
		atoms.push(...buildSectionAtoms(section, ctx));
	}

	// --- paginate -----------------------------------------------------------
	const pages: LayoutPage[] = [];
	let current: LayoutPage = { runs: [], rules: [] };
	let y = 0;
	let atomsOnPage = 0;

	const pushPage = () => {
		pages.push(current);
		current = { runs: [], rules: [] };
		y = 0;
		atomsOnPage = 0;
	};

	for (let i = 0; i < atoms.length; i += 1) {
		const atom = atoms[i];
		const atomHeight = atom.lines.reduce((n, l) => n + l.height, 0);
		const spaceBefore = atomsOnPage === 0 ? 0 : atom.spaceBefore;

		// Widow rule: a section heading must not be the last atom on a page. If the heading
		// fits but the atom after it does not, push the heading to the next page too.
		let needsBreak = y + spaceBefore + atomHeight > contentHeight;
		if (!needsBreak && atom.isSectionHeading) {
			const next = atoms[i + 1];
			if (next) {
				const nextHeight = next.lines.reduce((n, l) => n + l.height, 0);
				if (y + spaceBefore + atomHeight + next.spaceBefore + nextHeight > contentHeight) {
					needsBreak = true;
				}
			}
		}
		if (needsBreak && atomsOnPage > 0) pushPage();

		y += atomsOnPage === 0 ? 0 : atom.spaceBefore;

		for (const rule of atom.rules ?? []) {
			current.rules.push({
				x: marginSide + (rule.indent ?? 0),
				y: marginTop + y + rule.dy,
				width: rule.width ?? contentWidth - (rule.indent ?? 0),
				thickness: rule.thickness,
				color: rule.color
			});
		}

		for (const line of atom.lines) {
			for (const run of line.runs) {
				current.runs.push({ ...run, x: marginSide + run.x, y: marginTop + y });
			}
			y += line.height;
		}
		atomsOnPage += 1;
	}
	pages.push(current);

	return {
		pages,
		pageWidth: size.width,
		pageHeight: size.height,
		pageCount: pages.length
	};
}

interface BuildContext {
	font: FontId;
	accent: string;
	template: TemplateSpec;
	fontSize: number;
	lineSpacing: number;
	sectionSpacing: number;
	contentWidth: number;
	lh: (size: number) => number;
	headingStyle: Resume['style']['headingStyle'];
}

function textAtom(
	text: string,
	ctx: BuildContext,
	opts: {
		size?: number;
		weight?: FontWeight;
		color?: string;
		spaceBefore?: number;
		indent?: number;
		href?: string;
	} = {}
): Atom {
	const size = opts.size ?? ctx.fontSize;
	const weight = opts.weight ?? 'regular';
	const indent = opts.indent ?? 0;
	const lines = wrapText(text, {
		font: ctx.font,
		weight,
		sizePt: size,
		maxWidthPt: ctx.contentWidth - indent
	});
	return {
		spaceBefore: opts.spaceBefore ?? 0,
		lines: lines.map((line) => ({
			height: ctx.lh(size),
			runs: [
				{
					text: line,
					x: indent,
					size,
					weight,
					color: opts.color ?? INK,
					href: opts.href
				}
			]
		}))
	};
}

/** A heading plus the first line of its body, kept together. */
function mergeAtoms(head: Atom, tail: Atom | null): Atom {
	if (!tail) return head;
	return {
		...head,
		lines: [...head.lines, ...tail.lines]
	};
}

function sectionHeadingAtom(section: ResumeSection, ctx: BuildContext): Atom {
	const size = ctx.fontSize * ctx.template.sectionHeadingScale;
	const label =
		ctx.template.uppercaseHeadings || ctx.headingStyle === 'caps'
			? section.name.toUpperCase()
			: section.name;
	const color = ctx.template.accentHeadings ? ctx.accent : INK;
	const tracking = ctx.template.uppercaseHeadings ? size * 0.06 : 0;

	const atom: Atom = {
		spaceBefore: ctx.template.headingSpaceBefore * ctx.fontSize + ctx.sectionSpacing,
		isSectionHeading: true,
		lines: [
			{
				height: ctx.lh(size) + ctx.template.headingSpaceAfter * ctx.fontSize,
				runs: [{ text: label, x: 0, size, weight: 'bold', color, tracking }]
			}
		]
	};

	if (ctx.headingStyle === 'underline' || ctx.headingStyle === 'rule') {
		atom.rules = [
			{
				dy: ctx.lh(size) + 1,
				thickness: ctx.headingStyle === 'rule' ? 1 : 0.6,
				color: ctx.template.accentHeadings ? ctx.accent : '#999999',
				width:
					ctx.headingStyle === 'underline'
						? measureText(label, ctx.font, 'bold', size) + tracking * label.length
						: undefined
			}
		];
	}
	return atom;
}

function buildSectionAtoms(section: ResumeSection, ctx: BuildContext): Atom[] {
	const items = section.items;
	const atoms: Atom[] = [];

	if (items.type === 'personal') {
		const p = items.data;
		const nameSize = ctx.fontSize * ctx.template.nameScale;
		if (p.fullName) {
			const centered = ctx.template.nameAlign === 'center';
			const width = measureText(p.fullName, ctx.font, 'bold', nameSize);
			atoms.push({
				spaceBefore: 0,
				lines: [
					{
						height: ctx.lh(nameSize) * 0.95,
						runs: [
							{
								text: p.fullName,
								x: centered ? Math.max(0, (ctx.contentWidth - width) / 2) : 0,
								size: nameSize,
								weight: 'bold',
								color: INK
							}
						]
					}
				]
			});
		}
		if (p.headline) {
			const hs = ctx.fontSize * 1.08;
			const width = measureText(p.headline, ctx.font, 'regular', hs);
			atoms.push({
				spaceBefore: ctx.fontSize * 0.15,
				lines: [
					{
						height: ctx.lh(hs),
						runs: [
							{
								text: p.headline,
								x:
									ctx.template.nameAlign === 'center'
										? Math.max(0, (ctx.contentWidth - width) / 2)
										: 0,
								size: hs,
								weight: 'regular',
								color: ctx.template.accentHeadings ? ctx.accent : MUTED
							}
						]
					}
				]
			});
		}

		// Contact line: parts joined with a separator; links become clickable runs.
		const parts: { text: string; href?: string }[] = [];
		if (p.email) parts.push({ text: p.email, href: `mailto:${p.email}` });
		if (p.phone) parts.push({ text: p.phone });
		if (p.location) parts.push({ text: p.location });
		for (const link of p.links) {
			if (!link.url) continue;
			parts.push({ text: link.label || link.url, href: normaliseHref(link.url) });
		}
		if (parts.length) {
			atoms.push(
				contactAtom(parts, ctx, ctx.template.nameAlign === 'center')
			);
		}
		return atoms;
	}

	if (items.type === 'summary') {
		if (!items.text.trim()) return atoms;
		const head = sectionHeadingAtom(section, ctx);
		const body = textAtom(items.text.trim(), ctx);
		// Keep the heading with the first line of the summary.
		const first: Atom = { ...body, lines: body.lines.slice(0, 1) };
		atoms.push(mergeAtoms(head, first));
		if (body.lines.length > 1) {
			atoms.push({ spaceBefore: 0, lines: body.lines.slice(1) });
		}
		return atoms;
	}

	if (items.type === 'experience') {
		const entries = items.entries.filter((e) => !e.hidden);
		if (!entries.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const entry of entries) {
			const entryAtoms = entryBlockAtoms(
				{
					title: entry.role,
					subtitle: entry.company,
					meta: formatDateRange(entry.start, entry.end),
					location: entry.location,
					bullets: entry.bullets.map((b) => b.text).filter((t) => t.trim())
				},
				ctx
			);
			if (heading) {
				entryAtoms[0] = mergeAtoms(heading, entryAtoms[0]);
				heading = null;
			}
			atoms.push(...entryAtoms);
		}
		return atoms;
	}

	if (items.type === 'education') {
		const entries = items.entries.filter((e) => !e.hidden);
		if (!entries.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const entry of entries) {
			const entryAtoms = entryBlockAtoms(
				{
					title: entry.degree,
					subtitle: entry.institution,
					meta: formatDateRange(entry.start, entry.end),
					location: entry.location,
					bullets: entry.notes.trim() ? [entry.notes.trim()] : [],
					bulletsAsText: true
				},
				ctx
			);
			if (heading) {
				entryAtoms[0] = mergeAtoms(heading, entryAtoms[0]);
				heading = null;
			}
			atoms.push(...entryAtoms);
		}
		return atoms;
	}

	if (items.type === 'skills') {
		const groups = items.groups.filter((g) => !g.hidden && g.skills.filter(Boolean).length);
		if (!groups.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const group of groups) {
			const label = group.name ? `${group.name}: ` : '';
			const value = group.skills.filter(Boolean).join(', ');
			const atom = labelledParagraphAtom(label, value, ctx);
			if (heading) {
				atoms.push(mergeAtoms(heading, { ...atom, lines: atom.lines.slice(0, 1) }));
				if (atom.lines.length > 1) {
					atoms.push({ spaceBefore: 0, lines: atom.lines.slice(1) });
				}
				heading = null;
			} else {
				atoms.push(atom);
			}
		}
		return atoms;
	}

	if (items.type === 'projects') {
		const entries = items.entries.filter((e) => !e.hidden);
		if (!entries.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const entry of entries) {
			const entryAtoms = entryBlockAtoms(
				{
					title: entry.name,
					subtitle: '',
					meta: '',
					location: '',
					link: entry.link,
					lead: entry.description.trim(),
					bullets: entry.bullets.map((b) => b.text).filter((t) => t.trim())
				},
				ctx
			);
			if (heading) {
				entryAtoms[0] = mergeAtoms(heading, entryAtoms[0]);
				heading = null;
			}
			atoms.push(...entryAtoms);
		}
		return atoms;
	}

	if (items.type === 'certifications') {
		const entries = items.entries.filter((e) => !e.hidden);
		if (!entries.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const entry of entries) {
			const text = [entry.name, entry.issuer].filter(Boolean).join(' - ');
			const atom = metaLineAtom(text, formatMonthYear(entry.date), ctx);
			if (heading) {
				atoms.push(mergeAtoms(heading, atom));
				heading = null;
			} else {
				atoms.push(atom);
			}
		}
		return atoms;
	}

	if (items.type === 'languages') {
		const entries = items.entries.filter((e) => !e.hidden && e.name);
		if (!entries.length) return atoms;
		const heading = sectionHeadingAtom(section, ctx);
		const text = entries.map((e) => (e.level ? `${e.name} (${e.level})` : e.name)).join(', ');
		const atom = textAtom(text, ctx);
		atoms.push(mergeAtoms(heading, { ...atom, lines: atom.lines.slice(0, 1) }));
		if (atom.lines.length > 1) atoms.push({ spaceBefore: 0, lines: atom.lines.slice(1) });
		return atoms;
	}

	if (items.type === 'awards') {
		const entries = items.entries.filter((e) => !e.hidden);
		if (!entries.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const entry of entries) {
			const entryAtoms = entryBlockAtoms(
				{
					title: entry.name,
					subtitle: entry.issuer,
					meta: formatMonthYear(entry.date),
					location: '',
					bullets: entry.description.trim() ? [entry.description.trim()] : [],
					bulletsAsText: true
				},
				ctx
			);
			if (heading) {
				entryAtoms[0] = mergeAtoms(heading, entryAtoms[0]);
				heading = null;
			}
			atoms.push(...entryAtoms);
		}
		return atoms;
	}

	if (items.type === 'custom') {
		const entries = items.entries.filter((e) => !e.hidden);
		if (!entries.length) return atoms;
		let heading: Atom | null = sectionHeadingAtom(section, ctx);
		for (const entry of entries) {
			const entryAtoms = entryBlockAtoms(
				{
					title: entry.title,
					subtitle: entry.subtitle,
					meta: formatMonthYear(entry.date),
					location: '',
					bullets: entry.bullets.map((b) => b.text).filter((t) => t.trim())
				},
				ctx
			);
			if (heading) {
				entryAtoms[0] = mergeAtoms(heading, entryAtoms[0]);
				heading = null;
			}
			atoms.push(...entryAtoms);
		}
		return atoms;
	}

	return atoms;
}

function normaliseHref(url: string): string {
	const trimmed = url.trim();
	if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

/** Contact details on one or more lines, each piece individually linkable. */
function contactAtom(
	parts: { text: string; href?: string }[],
	ctx: BuildContext,
	centered: boolean
): Atom {
	const size = ctx.fontSize * 0.95;
	const sep = '  |  ';
	const sepWidth = measureText(sep, ctx.font, 'regular', size);
	const lines: AtomLine[] = [];
	let runs: Omit<LayoutRun, 'y'>[] = [];
	let x = 0;

	const flush = () => {
		if (!runs.length) return;
		if (centered) {
			const used = x;
			const shift = Math.max(0, (ctx.contentWidth - used) / 2);
			runs = runs.map((r) => ({ ...r, x: r.x + shift }));
		}
		lines.push({ height: ctx.lh(size), runs });
		runs = [];
		x = 0;
	};

	for (const part of parts) {
		const w = measureText(part.text, ctx.font, 'regular', size);
		const needSep = runs.length > 0;
		if (needSep && x + sepWidth + w > ctx.contentWidth) flush();
		if (runs.length > 0) {
			runs.push({ text: sep, x, size, weight: 'regular', color: '#8a8a8a' });
			x += sepWidth;
		}
		runs.push({
			text: part.text,
			x,
			size,
			weight: 'regular',
			color: part.href ? ctx.accent : MUTED,
			href: part.href
		});
		x += w;
	}
	flush();

	return { spaceBefore: ctx.fontSize * 0.35, lines };
}

/** "Languages: English, Tamil" with a bold label on the same line as the values. */
function labelledParagraphAtom(label: string, value: string, ctx: BuildContext): Atom {
	const size = ctx.fontSize;
	const labelWidth = measureText(label, ctx.font, 'bold', size);
	const lines: AtomLine[] = [];

	// Wrap the value into the space left on the first line, then full width after.
	const firstWidth = ctx.contentWidth - labelWidth;
	const words = value.split(/\s+/).filter(Boolean);
	let current = '';
	let isFirst = true;
	const flush = () => {
		const runs: Omit<LayoutRun, 'y'>[] = [];
		if (isFirst && label) {
			runs.push({ text: label, x: 0, size, weight: 'bold', color: INK });
		}
		runs.push({
			text: current,
			x: isFirst ? labelWidth : 0,
			size,
			weight: 'regular',
			color: INK
		});
		lines.push({ height: ctx.lh(size), runs });
		current = '';
		isFirst = false;
	};

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		const avail = isFirst ? firstWidth : ctx.contentWidth;
		if (measureText(candidate, ctx.font, 'regular', size) <= avail) {
			current = candidate;
		} else {
			if (current) flush();
			current = word;
		}
	}
	if (current || isFirst) flush();

	return { spaceBefore: ctx.fontSize * 0.18, lines };
}

/** A line with left text and right-aligned meta (dates). */
function metaLineAtom(left: string, right: string, ctx: BuildContext): Atom {
	const size = ctx.fontSize;
	const rightWidth = right ? measureText(right, ctx.font, 'regular', size) : 0;
	const avail = ctx.contentWidth - (rightWidth ? rightWidth + 10 : 0);
	const leftLines = wrapText(left, {
		font: ctx.font,
		weight: 'regular',
		sizePt: size,
		maxWidthPt: avail
	});
	const lines: AtomLine[] = leftLines.map((text, i) => {
		const runs: Omit<LayoutRun, 'y'>[] = [
			{ text, x: 0, size, weight: 'regular', color: INK }
		];
		if (i === 0 && right) {
			runs.push({
				text: right,
				x: ctx.contentWidth - rightWidth,
				size,
				weight: 'regular',
				color: MUTED
			});
		}
		return { height: ctx.lh(size), runs };
	});
	return { spaceBefore: ctx.fontSize * 0.18, lines };
}

interface EntryInput {
	title: string;
	subtitle: string;
	meta: string;
	location: string;
	link?: string;
	lead?: string;
	bullets: string[];
	/** Render "bullets" as plain paragraphs (education notes, award descriptions). */
	bulletsAsText?: boolean;
}

/**
 * An entry = heading line(s) + optional lead + bullets.
 * The heading and the FIRST bullet are emitted as one atom, which is the rule that stops a
 * page break landing between a job title and its first bullet.
 */
function entryBlockAtoms(entry: EntryInput, ctx: BuildContext): Atom[] {
	const size = ctx.fontSize * ctx.template.entryHeadingScale;
	const atoms: Atom[] = [];
	const headLines: AtomLine[] = [];

	// Line 1: Role (bold) + right-aligned dates.
	const titleText = entry.title || entry.subtitle;
	const metaWidth = entry.meta ? measureText(entry.meta, ctx.font, 'regular', ctx.fontSize) : 0;
	if (titleText) {
		const avail = ctx.contentWidth - (metaWidth ? metaWidth + 10 : 0);
		const wrapped = wrapText(titleText, {
			font: ctx.font,
			weight: 'bold',
			sizePt: size,
			maxWidthPt: avail
		});
		wrapped.forEach((text, i) => {
			const runs: Omit<LayoutRun, 'y'>[] = [
				{ text, x: 0, size, weight: 'bold', color: INK }
			];
			if (i === 0 && entry.meta) {
				runs.push({
					text: entry.meta,
					x: ctx.contentWidth - metaWidth,
					size: ctx.fontSize,
					weight: 'regular',
					color: MUTED
				});
			}
			headLines.push({ height: ctx.lh(size), runs });
		});
	}

	// Line 2: Company + location (italic/muted), or the project link.
	const secondParts = [entry.title ? entry.subtitle : '', entry.location].filter(Boolean);
	if (secondParts.length) {
		const text = secondParts.join('  |  ');
		const wrapped = wrapText(text, {
			font: ctx.font,
			weight: 'italic',
			sizePt: ctx.fontSize,
			maxWidthPt: ctx.contentWidth
		});
		for (const line of wrapped) {
			headLines.push({
				height: ctx.lh(ctx.fontSize),
				runs: [{ text: line, x: 0, size: ctx.fontSize, weight: 'italic', color: MUTED }]
			});
		}
	}
	if (entry.link) {
		const text = entry.link.replace(/^https?:\/\//, '');
		headLines.push({
			height: ctx.lh(ctx.fontSize),
			runs: [
				{
					text,
					x: 0,
					size: ctx.fontSize * 0.95,
					weight: 'regular',
					color: ctx.accent,
					href: normaliseHref(entry.link)
				}
			]
		});
	}
	if (entry.lead) {
		const wrapped = wrapText(entry.lead, {
			font: ctx.font,
			weight: 'regular',
			sizePt: ctx.fontSize,
			maxWidthPt: ctx.contentWidth
		});
		for (const line of wrapped) {
			headLines.push({
				height: ctx.lh(ctx.fontSize),
				runs: [{ text: line, x: 0, size: ctx.fontSize, weight: 'regular', color: INK }]
			});
		}
	}

	const bulletAtoms = entry.bullets.map((text) =>
		entry.bulletsAsText ? paragraphLines(text, ctx) : bulletLines(text, ctx)
	);

	const head: Atom = {
		spaceBefore: ctx.fontSize * 0.55,
		lines: headLines
	};

	if (bulletAtoms.length === 0) {
		if (headLines.length) atoms.push(head);
		return atoms;
	}

	// Heading + first bullet stay together.
	atoms.push({ ...head, lines: [...headLines, ...bulletAtoms[0]] });
	for (let i = 1; i < bulletAtoms.length; i += 1) {
		atoms.push({ spaceBefore: 0, lines: bulletAtoms[i] });
	}
	return atoms;
}

function bulletLines(text: string, ctx: BuildContext): AtomLine[] {
	const size = ctx.fontSize;
	const marker = '\u2022';
	const indent = size * 0.9;
	const wrapped = wrapText(text, {
		font: ctx.font,
		weight: 'regular',
		sizePt: size,
		maxWidthPt: ctx.contentWidth - indent
	});
	return wrapped.map((line, i) => {
		const runs: Omit<LayoutRun, 'y'>[] = [];
		if (i === 0) {
			runs.push({ text: marker, x: size * 0.15, size, weight: 'regular', color: MUTED });
		}
		runs.push({ text: line, x: indent, size, weight: 'regular', color: INK });
		return { height: ctx.lh(size), runs };
	});
}

function paragraphLines(text: string, ctx: BuildContext): AtomLine[] {
	const size = ctx.fontSize;
	return wrapText(text, {
		font: ctx.font,
		weight: 'regular',
		sizePt: size,
		maxWidthPt: ctx.contentWidth
	}).map((line) => ({
		height: ctx.lh(size),
		runs: [{ text: line, x: 0, size, weight: 'regular', color: INK }]
	}));
}
