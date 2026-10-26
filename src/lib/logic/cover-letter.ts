// Cover letter template text.
//
// The template fills {company}, {role} and the user's own key points, then the user edits
// everything freely. We never invent achievements - the three "key points" are the user's
// own words, inserted verbatim.

import type { CoverLetterTone } from '#lib/types';

export interface LetterInput {
	recipient: string;
	company: string;
	role: string;
	source: string;
	points: string[];
	tone: CoverLetterTone;
}

export interface LetterPerson {
	fullName: string;
	email: string;
	phone: string;
}

/** Roughly one page of body text at a normal size. */
export const ONE_PAGE_WORD_LIMIT = 450;

export function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
}

export function letterFitsOnePage(text: string): boolean {
	return countWords(text) <= ONE_PAGE_WORD_LIMIT;
}

/** Replace {company}, {role}, {recipient}, {source} and {name} placeholders. */
export function fillPlaceholders(
	template: string,
	input: LetterInput,
	person: LetterPerson
): string {
	return template
		.replaceAll('{company}', input.company || 'your company')
		.replaceAll('{role}', input.role || 'the role')
		.replaceAll('{recipient}', input.recipient || 'Hiring Manager')
		.replaceAll('{source}', input.source || 'your careers page')
		.replaceAll('{name}', person.fullName || 'Your name');
}

const GREETING: Record<CoverLetterTone, string> = {
	formal: 'Dear {recipient},',
	friendly: 'Hello {recipient},',
	concise: 'Dear {recipient},'
};

const OPENING: Record<CoverLetterTone, string> = {
	formal:
		'I am writing to apply for the {role} position at {company}, which I saw on {source}.',
	friendly:
		'I would love to be considered for the {role} role at {company} - I came across it on {source} and it looked like a great fit.',
	concise: 'I am applying for the {role} role at {company}, advertised on {source}.'
};

const BRIDGE: Record<CoverLetterTone, string> = {
	formal: 'A few points from my background that seem most relevant:',
	friendly: "Here is what I think I would bring:",
	concise: 'Relevant background:'
};

const CLOSING: Record<CoverLetterTone, string> = {
	formal:
		'I would welcome the chance to discuss how I could contribute to {company}. Thank you for your time and consideration.',
	friendly:
		'I would really enjoy talking this through with you. Thanks for reading, and I hope to hear from you.',
	concise: 'I would welcome the chance to talk about the role.'
};

const SIGN_OFF: Record<CoverLetterTone, string> = {
	formal: 'Yours sincerely,',
	friendly: 'Best wishes,',
	concise: 'Kind regards,'
};

/**
 * Build the starting body text. The user can edit every line afterwards.
 * Their three key points are inserted exactly as typed, as bullet lines.
 */
export function buildLetterBody(input: LetterInput, person: LetterPerson): string {
	const tone = input.tone;
	const parts: string[] = [];

	parts.push(fillPlaceholders(GREETING[tone], input, person));
	parts.push(fillPlaceholders(OPENING[tone], input, person));

	const points = input.points.map((p) => p.trim()).filter(Boolean);
	if (points.length) {
		parts.push(fillPlaceholders(BRIDGE[tone], input, person));
		parts.push(points.map((p) => `- ${p}`).join('\n'));
	}

	parts.push(fillPlaceholders(CLOSING[tone], input, person));

	const contact = [person.email, person.phone].filter(Boolean).join('\n');
	parts.push(
		`${fillPlaceholders(SIGN_OFF[tone], input, person)}\n${person.fullName || 'Your name'}${
			contact ? `\n${contact}` : ''
		}`
	);

	return parts.join('\n\n');
}

/** Plain-text export of a cover letter. */
export function coverLetterToText(body: string): string {
	return body.replace(/\r\n/g, '\n').trim();
}
