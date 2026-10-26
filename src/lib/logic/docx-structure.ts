// DOCX document structure.
//
// Deliberately semantic and flat: real Heading styles, real bullet lists, no tables and no
// text boxes. That is what makes the file open cleanly in both Word and Google Docs and
// keeps the reading order correct for screen readers.
//
// This module only describes the structure; src/lib/server/docx.ts turns it into a file.

import type { Resume } from '#lib/types';
import { formatDateRange, formatMonthYear } from './dates';

export type DocxBlockType =
	| 'title'
	| 'contact'
	| 'heading'
	| 'subheading'
	| 'paragraph'
	| 'bullet';

export interface DocxRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
	href?: string;
}

export interface DocxBlock {
	type: DocxBlockType;
	/** Plain text of the whole block, used for tests and the reading-order check. */
	text: string;
	/** Rich runs when the block mixes styles or contains links. */
	runs?: DocxRun[];
}

export interface DocxStructure {
	title: string;
	blocks: DocxBlock[];
}

function visible<T extends { hidden?: boolean }>(items: T[]): T[] {
	return items.filter((i) => !i.hidden);
}

function normaliseHref(url: string): string {
	const t = url.trim();
	if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
	return `https://${t}`;
}

/** Build the semantic block list for a resume, in reading order. */
export function buildDocxStructure(resume: Resume): DocxStructure {
	const blocks: DocxBlock[] = [];
	let title = resume.name;

	for (const section of resume.sections) {
		if (section.hidden) continue;
		const items = section.items;

		if (items.type === 'personal') {
			const p = items.data;
			if (p.fullName) {
				title = p.fullName;
				blocks.push({ type: 'title', text: p.fullName });
			}
			if (p.headline) {
				blocks.push({ type: 'paragraph', text: p.headline, runs: [{ text: p.headline, italic: true }] });
			}
			const runs: DocxRun[] = [];
			const plain: string[] = [];
			const addPart = (text: string, href?: string) => {
				if (!text) return;
				if (runs.length) {
					runs.push({ text: '  |  ' });
					plain.push('|');
				}
				runs.push({ text, href });
				plain.push(text);
			};
			addPart(p.email, p.email ? `mailto:${p.email}` : undefined);
			addPart(p.phone);
			addPart(p.location);
			for (const link of p.links) {
				if (link.url) addPart(link.label || link.url, normaliseHref(link.url));
			}
			if (runs.length) blocks.push({ type: 'contact', text: plain.join(' '), runs });
			continue;
		}

		if (items.type === 'summary') {
			if (!items.text.trim()) continue;
			blocks.push({ type: 'heading', text: section.name });
			blocks.push({ type: 'paragraph', text: items.text.trim() });
			continue;
		}

		if (items.type === 'experience') {
			const entries = visible(items.entries);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const e of entries) {
				const dates = formatDateRange(e.start, e.end);
				const line = [e.role, dates].filter(Boolean).join('  |  ');
				blocks.push({
					type: 'subheading',
					text: line,
					runs: [
						{ text: e.role, bold: true },
						...(dates ? [{ text: `  |  ${dates}` }] : [])
					]
				});
				const second = [e.company, e.location].filter(Boolean).join(', ');
				if (second) {
					blocks.push({ type: 'paragraph', text: second, runs: [{ text: second, italic: true }] });
				}
				for (const b of e.bullets) {
					if (b.text.trim()) blocks.push({ type: 'bullet', text: b.text.trim() });
				}
			}
			continue;
		}

		if (items.type === 'education') {
			const entries = visible(items.entries);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const e of entries) {
				const dates = formatDateRange(e.start, e.end);
				const line = [e.degree, dates].filter(Boolean).join('  |  ');
				blocks.push({
					type: 'subheading',
					text: line,
					runs: [
						{ text: e.degree, bold: true },
						...(dates ? [{ text: `  |  ${dates}` }] : [])
					]
				});
				const second = [e.institution, e.location].filter(Boolean).join(', ');
				if (second) {
					blocks.push({ type: 'paragraph', text: second, runs: [{ text: second, italic: true }] });
				}
				if (e.notes.trim()) blocks.push({ type: 'paragraph', text: e.notes.trim() });
			}
			continue;
		}

		if (items.type === 'skills') {
			const groups = visible(items.groups).filter((g) => g.skills.filter(Boolean).length);
			if (!groups.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const g of groups) {
				const list = g.skills.filter(Boolean).join(', ');
				const label = g.name ? `${g.name}: ` : '';
				blocks.push({
					type: 'paragraph',
					text: `${label}${list}`,
					runs: [{ text: label, bold: true }, { text: list }]
				});
			}
			continue;
		}

		if (items.type === 'projects') {
			const entries = visible(items.entries);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const e of entries) {
				blocks.push({
					type: 'subheading',
					text: e.name,
					runs: [{ text: e.name, bold: true }]
				});
				if (e.link) {
					const shown = e.link.replace(/^https?:\/\//, '');
					blocks.push({
						type: 'paragraph',
						text: shown,
						runs: [{ text: shown, href: normaliseHref(e.link) }]
					});
				}
				if (e.description.trim()) blocks.push({ type: 'paragraph', text: e.description.trim() });
				for (const b of e.bullets) {
					if (b.text.trim()) blocks.push({ type: 'bullet', text: b.text.trim() });
				}
			}
			continue;
		}

		if (items.type === 'certifications') {
			const entries = visible(items.entries);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const e of entries) {
				const text = [e.name, e.issuer, formatMonthYear(e.date)].filter(Boolean).join(' | ');
				blocks.push({ type: 'bullet', text });
			}
			continue;
		}

		if (items.type === 'languages') {
			const entries = visible(items.entries).filter((e) => e.name);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			blocks.push({
				type: 'paragraph',
				text: entries.map((e) => (e.level ? `${e.name} (${e.level})` : e.name)).join(', ')
			});
			continue;
		}

		if (items.type === 'awards') {
			const entries = visible(items.entries);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const e of entries) {
				const line = [e.name, formatMonthYear(e.date)].filter(Boolean).join('  |  ');
				blocks.push({ type: 'subheading', text: line, runs: [{ text: e.name, bold: true }] });
				if (e.issuer) {
					blocks.push({ type: 'paragraph', text: e.issuer, runs: [{ text: e.issuer, italic: true }] });
				}
				if (e.description.trim()) blocks.push({ type: 'paragraph', text: e.description.trim() });
			}
			continue;
		}

		if (items.type === 'custom') {
			const entries = visible(items.entries);
			if (!entries.length) continue;
			blocks.push({ type: 'heading', text: section.name });
			for (const e of entries) {
				const line = [e.title, formatMonthYear(e.date)].filter(Boolean).join('  |  ');
				if (line) {
					blocks.push({ type: 'subheading', text: line, runs: [{ text: e.title, bold: true }] });
				}
				if (e.subtitle) {
					blocks.push({ type: 'paragraph', text: e.subtitle, runs: [{ text: e.subtitle, italic: true }] });
				}
				for (const b of e.bullets) {
					if (b.text.trim()) blocks.push({ type: 'bullet', text: b.text.trim() });
				}
			}
		}
	}

	return { title, blocks };
}

/** Cover letters use the same flat, semantic structure. */
export function buildCoverLetterDocxStructure(
	name: string,
	body: string,
	contact: string
): DocxStructure {
	const blocks: DocxBlock[] = [{ type: 'title', text: name }];
	if (contact) blocks.push({ type: 'contact', text: contact });
	for (const para of body.split(/\n{2,}/)) {
		const text = para.trim();
		if (text) blocks.push({ type: 'paragraph', text });
	}
	return { title: name, blocks };
}
