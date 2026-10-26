// "Fit to one page" helper.
//
// Reduces spacing first (least damaging), then font size, within sensible limits. If the
// content still does not fit we say so plainly rather than shrinking text to 6pt.

import type { Resume } from '#lib/types';
import { layoutResume } from './layout';

export const FIT_LIMITS = {
	minFontSize: 9,
	minLineSpacing: 1.0,
	minSectionSpacing: 0
} as const;

export interface FitAttempt {
	fontSize: number;
	lineSpacing: number;
	sectionSpacing: number;
}

export interface FitResult {
	/** True when a combination was found that fits on one page. */
	fits: boolean;
	/** The settings to apply. Present whether or not it fully fits (best effort). */
	settings: FitAttempt;
	/** Page count achieved with `settings`. */
	pageCount: number;
	/** Human-readable outcome for the toast / inline message. */
	message: string;
	/** True when we hit the limits without fitting. */
	hitLimits: boolean;
}

/**
 * Search for the least aggressive settings that fit on one page.
 * Strategy: step spacing down before font size, so text stays readable.
 */
export function fitToOnePage(resume: Resume, targetPages = 1): FitResult {
	const start: FitAttempt = {
		fontSize: resume.page.fontSize,
		lineSpacing: resume.page.lineSpacing,
		sectionSpacing: resume.page.sectionSpacing
	};

	const measure = (a: FitAttempt) =>
		layoutResume(resume, {
			fontSize: a.fontSize,
			lineSpacing: a.lineSpacing,
			sectionSpacing: a.sectionSpacing
		}).pageCount;

	const startPages = measure(start);
	if (startPages <= targetPages) {
		return {
			fits: true,
			settings: start,
			pageCount: startPages,
			message: `Already fits on ${targetPages} page${targetPages === 1 ? '' : 's'}.`,
			hitLimits: false
		};
	}

	// Build the candidate ladder: spacing first, then font size, never below the limits.
	const candidates: FitAttempt[] = [];
	for (let fs = start.fontSize; fs >= FIT_LIMITS.minFontSize; fs -= 0.5) {
		for (const ls of stepsDown(start.lineSpacing, FIT_LIMITS.minLineSpacing, 0.05)) {
			for (const ss of stepsDown(start.sectionSpacing, FIT_LIMITS.minSectionSpacing, 1)) {
				candidates.push({ fontSize: fs, lineSpacing: ls, sectionSpacing: ss });
			}
		}
	}
	// Prefer the gentlest change: sort by "damage" (font size reduction weighs most).
	candidates.sort((a, b) => damage(start, a) - damage(start, b));

	let best: { attempt: FitAttempt; pages: number } = { attempt: start, pages: startPages };
	for (const candidate of candidates) {
		const pages = measure(candidate);
		if (pages < best.pages) best = { attempt: candidate, pages };
		if (pages <= targetPages) {
			return {
				fits: true,
				settings: candidate,
				pageCount: pages,
				message: `Fitted to ${targetPages} page${targetPages === 1 ? '' : 's'} by adjusting spacing and font size.`,
				hitLimits: false
			};
		}
	}

	return {
		fits: false,
		settings: best.attempt,
		pageCount: best.pages,
		message: `Still ${best.pages} pages at the smallest sensible settings (${FIT_LIMITS.minFontSize}pt text). Remove or shorten some content to fit on ${targetPages}.`,
		hitLimits: true
	};
}

function stepsDown(from: number, to: number, step: number): number[] {
	const out: number[] = [];
	for (let v = from; v >= to - 1e-9; v -= step) {
		out.push(Math.round(v * 100) / 100);
	}
	if (!out.length) out.push(to);
	return out;
}

/** Lower is gentler. Font size reductions are weighted heaviest. */
function damage(start: FitAttempt, a: FitAttempt): number {
	return (
		(start.fontSize - a.fontSize) * 10 +
		(start.lineSpacing - a.lineSpacing) * 8 +
		(start.sectionSpacing - a.sectionSpacing) * 0.5
	);
}
