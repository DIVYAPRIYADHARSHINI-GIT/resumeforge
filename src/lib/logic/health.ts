// Resume health checks with plain-language tips.
// We only point at problems and offer verbs - we never invent achievements or write
// content for the user.

import type { Resume } from '#lib/types';
import { ACTION_VERBS, WEAK_PHRASES } from './dictionary';
import { collectBullets, collectDates, resumeToPlainText } from './resume-text';
import { detectDateFormatInconsistency } from './dates';
import { wordFrequencies } from './keywords';

export type HealthSeverity = 'problem' | 'warning' | 'ok';

export interface HealthIssue {
	id: string;
	severity: HealthSeverity;
	title: string;
	detail: string;
	/** Specific offending items, shown as a short list. */
	examples?: string[];
	sectionId?: string;
}

/** Bullet length guidance, in characters. Roughly two printed lines at body size. */
export const BULLET_LONG_CHARS = 170;
export const BULLET_VERY_LONG_CHARS = 240;
export const BULLET_SHORT_CHARS = 40;

const VERB_SET = new Set(ACTION_VERBS.map((v) => v.toLowerCase()));

/** Verbs that are grammatically fine but weak as bullet openers. */
const PASSIVE_OPENERS = new Set([
	'responsible',
	'worked',
	'helped',
	'assisted',
	'participated',
	'involved',
	'tasked',
	'duties',
	'was',
	'were',
	'been',
	'is',
	'are',
	'had',
	'has'
]);

/** First word of a bullet, lowercased and stripped of punctuation. */
export function firstWord(text: string): string {
	const match = /[A-Za-z\u00C0-\u024F']+/.exec(text.trim());
	return match ? match[0].toLowerCase() : '';
}

/** True when a bullet starts with a recognised strong action verb. */
export function startsWithActionVerb(text: string): boolean {
	const word = firstWord(text);
	if (!word) return false;
	if (PASSIVE_OPENERS.has(word)) return false;
	if (VERB_SET.has(word)) return true;
	// Accept regular past-tense verbs we do not list, but not the passive openers above.
	return /ed$/.test(word) && word.length > 4;
}

/** Weak phrases present in a bullet. */
export function weakPhrasesIn(text: string): string[] {
	const lower = text.toLowerCase();
	return WEAK_PHRASES.filter((p) => lower.includes(p));
}

/** True when the bullet contains a number, percentage or currency figure. */
export function hasQuantifiedResult(text: string): boolean {
	return /\d/.test(text);
}

export interface HealthReport {
	issues: HealthIssue[];
	problems: number;
	warnings: number;
	/** 0-100, purely a count of passed checks - shown as "checks passed". */
	passedChecks: number;
	totalChecks: number;
}

export interface HealthContext {
	/** Page count from the paginator, so the "longer than two pages" check is real. */
	pageCount?: number;
}

export function checkResumeHealth(resume: Resume, ctx: HealthContext = {}): HealthReport {
	const issues: HealthIssue[] = [];
	const bullets = collectBullets(resume);
	const plain = resumeToPlainText(resume);

	// --- contact details ---
	const personalSection = resume.sections.find((s) => s.items.type === 'personal');
	const personal =
		personalSection && personalSection.items.type === 'personal' ? personalSection.items.data : null;
	const missingContact: string[] = [];
	if (!personal?.fullName?.trim()) missingContact.push('full name');
	if (!personal?.email?.trim()) missingContact.push('email');
	if (!personal?.phone?.trim()) missingContact.push('phone');
	if (!personal?.location?.trim()) missingContact.push('location');
	if (missingContact.length) {
		issues.push({
			id: 'contact',
			severity: missingContact.includes('email') || missingContact.includes('full name') ? 'problem' : 'warning',
			title: 'Contact details are incomplete',
			detail: `Add your ${missingContact.join(', ')} so an employer can reach you.`,
			sectionId: personalSection?.id
		});
	}

	// --- summary ---
	const summarySection = resume.sections.find((s) => s.items.type === 'summary');
	const summaryText =
		summarySection && summarySection.items.type === 'summary' ? summarySection.items.text : '';
	if (!summaryText.trim()) {
		issues.push({
			id: 'summary-missing',
			severity: 'warning',
			title: 'No summary',
			detail: 'A short summary of two to three lines helps a reader place you quickly.',
			sectionId: summarySection?.id
		});
	} else if (summaryText.trim().length < 80) {
		issues.push({
			id: 'summary-short',
			severity: 'warning',
			title: 'Summary is very short',
			detail: 'Two to three lines gives a reader enough to go on.',
			sectionId: summarySection?.id
		});
	}

	// --- bullets: action verbs ---
	const noVerb = bullets.filter((b) => !startsWithActionVerb(b.text));
	if (noVerb.length) {
		issues.push({
			id: 'bullet-verbs',
			severity: 'warning',
			title: `${noVerb.length} bullet${noVerb.length === 1 ? '' : 's'} do not start with an action verb`,
			detail:
				'Starting with a strong verb makes the result clearer. Pick one from the action verb list below.',
			examples: noVerb.slice(0, 4).map((b) => b.text)
		});
	}

	// --- bullets: weak phrases ---
	const weak = bullets
		.map((b) => ({ b, phrases: weakPhrasesIn(b.text) }))
		.filter((x) => x.phrases.length);
	if (weak.length) {
		issues.push({
			id: 'bullet-weak',
			severity: 'warning',
			title: `${weak.length} bullet${weak.length === 1 ? '' : 's'} use a weak phrase`,
			detail: 'Phrases like "responsible for" or "worked on" describe duties, not results.',
			examples: weak.slice(0, 4).map((x) => `"${x.phrases[0]}" in: ${x.b.text.slice(0, 90)}`)
		});
	}

	// --- bullets: no numbers ---
	const noNumbers = bullets.filter((b) => !hasQuantifiedResult(b.text));
	if (bullets.length > 0 && noNumbers.length / bullets.length > 0.6) {
		issues.push({
			id: 'bullet-numbers',
			severity: 'warning',
			title: `${noNumbers.length} of ${bullets.length} bullets have no numbers or results`,
			detail:
				'Where you genuinely have a figure, add it. Only use numbers you can stand behind - do not estimate.',
			examples: noNumbers.slice(0, 3).map((b) => b.text.slice(0, 90))
		});
	}

	// --- bullets: too long ---
	const tooLong = bullets.filter((b) => b.text.length > BULLET_LONG_CHARS);
	if (tooLong.length) {
		issues.push({
			id: 'bullet-length',
			severity: 'warning',
			title: `${tooLong.length} bullet${tooLong.length === 1 ? '' : 's'} run longer than two lines`,
			detail: `Keep bullets under about ${BULLET_LONG_CHARS} characters so they stay scannable.`,
			examples: tooLong.slice(0, 3).map((b) => `${b.text.length} characters: ${b.text.slice(0, 80)}...`)
		});
	}

	// --- page count ---
	if (ctx.pageCount != null && ctx.pageCount > 2) {
		issues.push({
			id: 'page-count',
			severity: 'warning',
			title: `Resume is ${ctx.pageCount} pages`,
			detail:
				'Two pages is the usual maximum. Try "Fit to one page", trim older roles, or tighten bullets.'
		});
	}

	// --- very short sections ---
	const shortSections: string[] = [];
	for (const section of resume.sections) {
		if (section.hidden) continue;
		const items = section.items;
		if (items.type === 'experience' || items.type === 'projects') {
			const visible = items.entries.filter((e) => !e.hidden);
			const bulletCount = visible.reduce((n, e) => n + e.bullets.filter((b) => b.text.trim()).length, 0);
			if (visible.length > 0 && bulletCount === 0) shortSections.push(section.name);
		} else if (items.type === 'skills') {
			const total = items.groups
				.filter((g) => !g.hidden)
				.reduce((n, g) => n + g.skills.filter(Boolean).length, 0);
			if (total > 0 && total < 4) shortSections.push(section.name);
		}
	}
	if (shortSections.length) {
		issues.push({
			id: 'short-sections',
			severity: 'warning',
			title: 'Some sections are very thin',
			detail: `${shortSections.join(', ')} has very little content. Either build it out or hide it.`,
			examples: shortSections
		});
	}

	// --- date consistency ---
	if (detectDateFormatInconsistency(collectDates(resume))) {
		issues.push({
			id: 'date-format',
			severity: 'warning',
			title: 'Date formats are inconsistent',
			detail: 'Some dates show a month and year while others show only a year. Pick one and use it throughout.'
		});
	}

	// --- repeated words ---
	const freq = wordFrequencies(plain);
	const repeated = [...freq.entries()]
		.filter(([word, n]) => n >= 5 && word.length > 3)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);
	if (repeated.length) {
		issues.push({
			id: 'repeated-words',
			severity: 'warning',
			title: 'Some words repeat often',
			detail: 'Varying your wording keeps bullets from reading the same.',
			examples: repeated.map(([word, n]) => `"${word}" x${n}`)
		});
	}

	// --- no bullets at all ---
	if (bullets.length === 0) {
		issues.push({
			id: 'no-bullets',
			severity: 'problem',
			title: 'No bullet points yet',
			detail: 'Add bullets under your roles or projects to show what you actually did.'
		});
	}

	const problems = issues.filter((i) => i.severity === 'problem').length;
	const warnings = issues.filter((i) => i.severity === 'warning').length;
	const totalChecks = 11;
	return {
		issues,
		problems,
		warnings,
		passedChecks: Math.max(0, totalChecks - issues.length),
		totalChecks
	};
}
