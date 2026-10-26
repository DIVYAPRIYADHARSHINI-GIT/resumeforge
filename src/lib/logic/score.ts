// Match score calculation.
//
// The score is the weighted share of job-description keywords that also appear in the
// resume. Required keywords weigh 2x a nice-to-have one. It is an estimate based on
// keyword overlap only - we say so everywhere it is shown and never promise an interview.

import type { Resume } from '#lib/types';
import { extractKeywords, labelsInText, type ExtractedKeyword, type Importance } from './keywords';
import { resumeToPlainText } from './resume-text';
import type { SuggestSection } from './dictionary';

export const REQUIRED_WEIGHT = 2;
export const NICE_WEIGHT = 1;

/** The disclaimer shown with every score. Single source of truth. */
export const SCORE_DISCLAIMER =
	'This is an estimate based on keyword matching. It is not how any specific company\u2019s screening software scores resumes.';

export interface MatchedKeyword {
	label: string;
	importance: Importance;
	count: number;
}

export interface MissingKeyword {
	label: string;
	importance: Importance;
	count: number;
	/** Where the user should consider adding it. */
	suggestSection: SuggestSection;
	suggestion: string;
}

export interface MatchResult {
	score: number; // 0-100
	matched: MatchedKeyword[];
	missing: MissingKeyword[];
	totalKeywords: number;
	requiredTotal: number;
	requiredMatched: number;
	niceTotal: number;
	niceMatched: number;
	disclaimer: string;
}

const SECTION_ADVICE: Record<SuggestSection, string> = {
	skills: 'Add to your Skills section if you have used it.',
	experience: 'Mention it in an Experience bullet where you used it.',
	summary: 'Work it into your Summary if it describes you.',
	projects: 'Add a Project that shows it.',
	certifications: 'List it under Certifications or Education if you hold it.'
};

export function weightFor(importance: Importance): number {
	return importance === 'required' ? REQUIRED_WEIGHT : NICE_WEIGHT;
}

/**
 * Compare a resume against a job description.
 * Pure function over text so it is cheap to unit test and cheap to re-run while typing.
 */
export function computeMatch(resumeText: string, jobDescription: string): MatchResult {
	const keywords = extractKeywords(jobDescription);
	const resumeLabels = labelsInText(resumeText);

	const matched: MatchedKeyword[] = [];
	const missing: MissingKeyword[] = [];
	let weightTotal = 0;
	let weightMatched = 0;
	let requiredTotal = 0;
	let requiredMatched = 0;
	let niceTotal = 0;
	let niceMatched = 0;

	for (const kw of keywords) {
		const w = weightFor(kw.importance);
		weightTotal += w;
		const isMatch = resumeLabels.has(kw.label);
		if (kw.importance === 'required') requiredTotal += 1;
		else niceTotal += 1;

		if (isMatch) {
			weightMatched += w;
			if (kw.importance === 'required') requiredMatched += 1;
			else niceMatched += 1;
			matched.push({ label: kw.label, importance: kw.importance, count: kw.count });
		} else {
			missing.push({
				label: kw.label,
				importance: kw.importance,
				count: kw.count,
				suggestSection: kw.section,
				suggestion: SECTION_ADVICE[kw.section]
			});
		}
	}

	const score = weightTotal === 0 ? 0 : Math.round((weightMatched / weightTotal) * 100);

	return {
		score,
		matched,
		missing,
		totalKeywords: keywords.length,
		requiredTotal,
		requiredMatched,
		niceTotal,
		niceMatched,
		disclaimer: SCORE_DISCLAIMER
	};
}

export function matchResume(resume: Resume, jobDescription: string): MatchResult {
	return computeMatch(resumeToPlainText(resume), jobDescription);
}

/** Plain-language band for the score ring. Never promises an outcome. */
export function scoreBand(score: number): { label: string; tone: 'good' | 'warn' | 'bad' } {
	if (score >= 70) return { label: 'Strong keyword overlap', tone: 'good' };
	if (score >= 40) return { label: 'Partial keyword overlap', tone: 'warn' };
	return { label: 'Low keyword overlap', tone: 'bad' };
}

/** All job keywords (matched + missing) - used to highlight terms in the preview. */
export function allJobKeywords(jobDescription: string): ExtractedKeyword[] {
	return extractKeywords(jobDescription);
}
