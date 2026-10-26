// Factories for new documents. Centralised so every creation path produces a complete,
// valid object (no undefined fields leaking into the renderer).

import type {
	Bullet,
	CoverLetter,
	PageSetup,
	Resume,
	ResumeSection,
	SectionKind,
	StyleSettings
} from '#lib/types';
import { emptyMonthYear } from './dates';

let counter = 0;

/** Stable unique id. crypto.randomUUID when available, with a safe fallback. */
export function uid(prefix = 'id'): string {
	counter += 1;
	const rand =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10);
	return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${rand}`;
}

export function newBullet(text = ''): Bullet {
	return { id: uid('b'), text };
}

export function defaultPage(): PageSetup {
	return {
		size: 'a4',
		marginTop: 18,
		marginBottom: 18,
		marginSide: 16,
		fontSize: 10.5,
		lineSpacing: 1.15,
		sectionSpacing: 6
	};
}

export function defaultStyle(): StyleSettings {
	return {
		template: 'classic',
		font: 'inter',
		accent: '#E8590C',
		headingStyle: 'rule'
	};
}

export const SECTION_LABELS: Record<SectionKind, string> = {
	personal: 'Personal details',
	summary: 'Summary',
	experience: 'Experience',
	education: 'Education',
	skills: 'Skills',
	projects: 'Projects',
	certifications: 'Certifications',
	languages: 'Languages',
	awards: 'Awards',
	custom: 'Custom section'
};

export function newSection(kind: SectionKind, name?: string): ResumeSection {
	const label = name ?? SECTION_LABELS[kind];
	const base = { id: uid('s'), kind, name: label, hidden: false };
	switch (kind) {
		case 'personal':
			return {
				...base,
				items: {
					type: 'personal',
					data: {
						fullName: '',
						headline: '',
						email: '',
						phone: '',
						location: '',
						links: [],
						photo: null,
						showPhoto: false
					}
				}
			};
		case 'summary':
			return { ...base, items: { type: 'summary', text: '' } };
		case 'experience':
			return { ...base, items: { type: 'experience', entries: [newExperience()] } };
		case 'education':
			return { ...base, items: { type: 'education', entries: [newEducation()] } };
		case 'skills':
			return { ...base, items: { type: 'skills', groups: [newSkillGroup('Languages')] } };
		case 'projects':
			return { ...base, items: { type: 'projects', entries: [newProject()] } };
		case 'certifications':
			return { ...base, items: { type: 'certifications', entries: [newCertification()] } };
		case 'languages':
			return { ...base, items: { type: 'languages', entries: [newLanguage()] } };
		case 'awards':
			return { ...base, items: { type: 'awards', entries: [newAward()] } };
		case 'custom':
			return { ...base, items: { type: 'custom', entries: [newCustomItem()] } };
	}
}

export function newExperience() {
	return {
		id: uid('exp'),
		company: '',
		role: '',
		location: '',
		start: emptyMonthYear(),
		end: emptyMonthYear(),
		bullets: [newBullet()],
		hidden: false
	};
}

export function newEducation() {
	return {
		id: uid('edu'),
		institution: '',
		degree: '',
		location: '',
		start: emptyMonthYear(),
		end: emptyMonthYear(),
		notes: '',
		hidden: false
	};
}

export function newSkillGroup(name = 'Skills') {
	return { id: uid('sg'), name, skills: [], hidden: false };
}

export function newProject() {
	return {
		id: uid('prj'),
		name: '',
		link: '',
		description: '',
		bullets: [newBullet()],
		hidden: false
	};
}

export function newCertification() {
	return { id: uid('cert'), name: '', issuer: '', date: emptyMonthYear(), hidden: false };
}

export function newLanguage() {
	return { id: uid('lang'), name: '', level: '', hidden: false };
}

export function newAward() {
	return {
		id: uid('awd'),
		name: '',
		issuer: '',
		date: emptyMonthYear(),
		description: '',
		hidden: false
	};
}

export function newCustomItem() {
	return {
		id: uid('cst'),
		title: '',
		subtitle: '',
		date: emptyMonthYear(),
		bullets: [newBullet()],
		hidden: false
	};
}

/** A blank resume with the usual starting sections in a sensible order. */
export function newResume(name = 'Untitled resume'): Resume {
	const now = new Date().toISOString();
	return {
		id: uid('resume'),
		name,
		tag: '',
		targetRole: '',
		createdAt: now,
		updatedAt: now,
		sections: [
			newSection('personal'),
			newSection('summary'),
			newSection('experience'),
			newSection('education'),
			newSection('skills')
		],
		page: defaultPage(),
		style: defaultStyle(),
		linkedJob: null,
		scoreHistory: []
	};
}

export function newCoverLetter(name = 'Untitled cover letter', resumeId: string | null = null): CoverLetter {
	const now = new Date().toISOString();
	return {
		id: uid('letter'),
		name,
		resumeId,
		recipient: '',
		company: '',
		role: '',
		source: '',
		points: ['', '', ''],
		tone: 'formal',
		body: '',
		createdAt: now,
		updatedAt: now
	};
}

/** Deep clone that also re-keys every id, used by duplicate and "Tailor a copy". */
export function cloneResume(resume: Resume, name: string): Resume {
	const copy = structuredCloneSafe(resume);
	const now = new Date().toISOString();
	copy.id = uid('resume');
	copy.name = name;
	copy.createdAt = now;
	copy.updatedAt = now;
	copy.scoreHistory = [];
	for (const section of copy.sections) {
		section.id = uid('s');
		const items = section.items;
		if (items.type === 'experience') {
			for (const e of items.entries) {
				e.id = uid('exp');
				e.bullets = e.bullets.map((b) => ({ ...b, id: uid('b') }));
			}
		} else if (items.type === 'education') {
			for (const e of items.entries) e.id = uid('edu');
		} else if (items.type === 'skills') {
			for (const g of items.groups) g.id = uid('sg');
		} else if (items.type === 'projects') {
			for (const e of items.entries) {
				e.id = uid('prj');
				e.bullets = e.bullets.map((b) => ({ ...b, id: uid('b') }));
			}
		} else if (items.type === 'certifications') {
			for (const e of items.entries) e.id = uid('cert');
		} else if (items.type === 'languages') {
			for (const e of items.entries) e.id = uid('lang');
		} else if (items.type === 'awards') {
			for (const e of items.entries) e.id = uid('awd');
		} else if (items.type === 'custom') {
			for (const e of items.entries) {
				e.id = uid('cst');
				e.bullets = e.bullets.map((b) => ({ ...b, id: uid('b') }));
			}
		} else if (items.type === 'personal') {
			items.data.links = items.data.links.map((l) => ({ ...l, id: uid('lnk') }));
		}
	}
	return copy;
}

export function structuredCloneSafe<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		try {
			return structuredClone(value);
		} catch {
			// fall through to JSON
		}
	}
	return JSON.parse(JSON.stringify(value)) as T;
}
