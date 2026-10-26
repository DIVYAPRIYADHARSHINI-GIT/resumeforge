// Flatten a Resume into plain text. Used by the match checker, the plain-text export and
// the version compare. Keeping this in one place means every feature sees the same content.

import type { Resume, ResumeSection, MonthYear } from '#lib/types';
import { formatDateRange, formatMonthYear } from './dates';

export interface TextBlock {
	kind: 'heading' | 'subheading' | 'line' | 'bullet' | 'blank';
	text: string;
	/** Section id this block came from, for highlighting. */
	sectionId?: string;
}

function visibleEntries<T extends { hidden?: boolean }>(entries: T[]): T[] {
	return entries.filter((e) => !e.hidden);
}

/** Structured plain-text blocks for one resume, in reading order. */
export function resumeToBlocks(resume: Resume): TextBlock[] {
	const blocks: TextBlock[] = [];
	for (const section of resume.sections) {
		if (section.hidden) continue;
		blocks.push(...sectionToBlocks(section));
	}
	return blocks;
}

export function sectionToBlocks(section: ResumeSection): TextBlock[] {
	const out: TextBlock[] = [];
	const id = section.id;
	const push = (kind: TextBlock['kind'], text: string) => {
		out.push({ kind, text, sectionId: id });
	};

	const items = section.items;
	switch (items.type) {
		case 'personal': {
			const p = items.data;
			if (p.fullName) push('heading', p.fullName);
			if (p.headline) push('line', p.headline);
			const contact = [p.email, p.phone, p.location].filter(Boolean).join(' | ');
			if (contact) push('line', contact);
			const links = p.links.filter((l) => l.url).map((l) => `${l.label}: ${l.url}`);
			if (links.length) push('line', links.join(' | '));
			break;
		}
		case 'summary': {
			if (items.text.trim()) {
				push('heading', section.name);
				push('line', items.text.trim());
			}
			break;
		}
		case 'experience': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			for (const e of entries) {
				const head = [e.role, e.company].filter(Boolean).join(' - ');
				const meta = [formatDateRange(e.start, e.end), e.location].filter(Boolean).join(' | ');
				push('subheading', [head, meta].filter(Boolean).join('  '));
				for (const b of e.bullets) {
					if (b.text.trim()) push('bullet', b.text.trim());
				}
			}
			break;
		}
		case 'education': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			for (const e of entries) {
				const head = [e.degree, e.institution].filter(Boolean).join(' - ');
				const meta = [formatDateRange(e.start, e.end), e.location].filter(Boolean).join(' | ');
				push('subheading', [head, meta].filter(Boolean).join('  '));
				if (e.notes.trim()) push('line', e.notes.trim());
			}
			break;
		}
		case 'skills': {
			const groups = visibleEntries(items.groups);
			if (!groups.length) break;
			push('heading', section.name);
			for (const g of groups) {
				const list = g.skills.filter(Boolean).join(', ');
				if (list) push('line', `${g.name}: ${list}`);
			}
			break;
		}
		case 'projects': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			for (const e of entries) {
				push('subheading', [e.name, e.link].filter(Boolean).join('  '));
				if (e.description.trim()) push('line', e.description.trim());
				for (const b of e.bullets) {
					if (b.text.trim()) push('bullet', b.text.trim());
				}
			}
			break;
		}
		case 'certifications': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			for (const e of entries) {
				const meta = formatMonthYear(e.date);
				push('line', [e.name, e.issuer, meta].filter(Boolean).join(' | '));
			}
			break;
		}
		case 'languages': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			const line = entries
				.map((e) => (e.level ? `${e.name} (${e.level})` : e.name))
				.filter(Boolean)
				.join(', ');
			if (line) push('line', line);
			break;
		}
		case 'awards': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			for (const e of entries) {
				push('subheading', [e.name, e.issuer, formatMonthYear(e.date)].filter(Boolean).join(' | '));
				if (e.description.trim()) push('line', e.description.trim());
			}
			break;
		}
		case 'custom': {
			const entries = visibleEntries(items.entries);
			if (!entries.length) break;
			push('heading', section.name);
			for (const e of entries) {
				const meta = formatMonthYear(e.date);
				push('subheading', [e.title, e.subtitle, meta].filter(Boolean).join(' | '));
				for (const b of e.bullets) {
					if (b.text.trim()) push('bullet', b.text.trim());
				}
			}
			break;
		}
	}
	return out;
}

/** One plain string of the whole resume, used for keyword matching and compare. */
export function resumeToPlainText(resume: Resume): string {
	return resumeToBlocks(resume)
		.map((b) => (b.kind === 'bullet' ? `- ${b.text}` : b.text))
		.join('\n');
}

/** Every bullet in the resume with its origin, for the bullet-quality checks. */
export interface BulletRef {
	sectionId: string;
	sectionName: string;
	entryLabel: string;
	bulletId: string;
	text: string;
}

export function collectBullets(resume: Resume): BulletRef[] {
	const out: BulletRef[] = [];
	for (const section of resume.sections) {
		if (section.hidden) continue;
		const items = section.items;
		if (items.type === 'experience') {
			for (const e of visibleEntries(items.entries)) {
				for (const b of e.bullets) {
					if (!b.text.trim()) continue;
					out.push({
						sectionId: section.id,
						sectionName: section.name,
						entryLabel: [e.role, e.company].filter(Boolean).join(' at ') || 'Experience',
						bulletId: b.id,
						text: b.text.trim()
					});
				}
			}
		} else if (items.type === 'projects') {
			for (const e of visibleEntries(items.entries)) {
				for (const b of e.bullets) {
					if (!b.text.trim()) continue;
					out.push({
						sectionId: section.id,
						sectionName: section.name,
						entryLabel: e.name || 'Project',
						bulletId: b.id,
						text: b.text.trim()
					});
				}
			}
		} else if (items.type === 'custom') {
			for (const e of visibleEntries(items.entries)) {
				for (const b of e.bullets) {
					if (!b.text.trim()) continue;
					out.push({
						sectionId: section.id,
						sectionName: section.name,
						entryLabel: e.title || section.name,
						bulletId: b.id,
						text: b.text.trim()
					});
				}
			}
		}
	}
	return out;
}

/** All dates in the resume, for the date-consistency check. */
export function collectDates(resume: Resume): MonthYear[] {
	const out: MonthYear[] = [];
	for (const section of resume.sections) {
		const items = section.items;
		if (items.type === 'experience' || items.type === 'education') {
			for (const e of items.entries) {
				out.push(e.start, e.end);
			}
		} else if (items.type === 'certifications' || items.type === 'awards') {
			for (const e of items.entries) out.push(e.date);
		}
	}
	return out.filter(Boolean);
}
