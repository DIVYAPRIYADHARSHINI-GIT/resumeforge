import { describe, it, expect } from 'vitest';
import {
	formatMonthYear,
	formatDateRange,
	isEndBeforeStart,
	todayLocalISODate,
	parseLocalISODate,
	formatLocalISODate,
	daysBetweenLocal,
	daysSince,
	relativeDayLabel,
	detectDateFormatInconsistency,
	monthYearToOrdinal
} from './dates';
import {
	tokenise,
	singularise,
	contentTokens,
	extractKeywords,
	labelsInText,
	buildDictionaryIndex,
	wordFrequencies,
	splitSegments,
	normaliseToken
} from './keywords';
import { computeMatch, scoreBand, weightFor, SCORE_DISCLAIMER } from './score';
import {
	startsWithActionVerb,
	weakPhrasesIn,
	hasQuantifiedResult,
	firstWord,
	checkResumeHealth
} from './health';
import { measureText, wrapText, countLines, mmToPt, ptToMm, getMetrics } from './measure';
import { layoutResume, TEMPLATES, TEMPLATE_LIST } from './layout';
import { fitToOnePage, FIT_LIMITS } from './fit';
import { validateBackup } from './validate';
import { buildSampleData, SAMPLE_JOB_TEXT } from './sample-data';
import { newResume, cloneResume, uid, newSection } from './factory';
import { buildDocxStructure } from './docx-structure';
import { resumeToPlainText, collectBullets, collectDates } from './resume-text';
import { SKILL_DICTIONARY, ACTION_VERBS } from './dictionary';
import { buildLetterBody, countWords, letterFitsOnePage } from './cover-letter';
import { exportFileName, sanitiseFileNamePart } from './filenames';
import type { Resume } from '#lib/types';

const sample = buildSampleData();
const devResume = sample.resumes[0];
const mktResume = sample.resumes[1];

// ---------------------------------------------------------------------------
describe('dates: formatting', () => {
	it('formats month and year', () => {
		expect(formatMonthYear({ month: 1, year: 2022 })).toBe('Jan 2022');
	});

	it('formats Present regardless of month/year', () => {
		expect(formatMonthYear({ month: 5, year: 2020, present: true })).toBe('Present');
	});

	it('formats a year-only date', () => {
		expect(formatMonthYear({ month: null, year: 2019 })).toBe('2019');
	});

	it('returns empty string for an empty date', () => {
		expect(formatMonthYear({ month: null, year: null })).toBe('');
		expect(formatMonthYear(null)).toBe('');
	});

	it('formats a range as "Jan 2022 - Present"', () => {
		const out = formatDateRange({ month: 1, year: 2022 }, { month: null, year: null, present: true });
		expect(out).toBe('Jan 2022 \u2013 Present');
	});

	it('collapses a range when only one side is set', () => {
		expect(formatDateRange({ month: 3, year: 2021 }, null)).toBe('Mar 2021');
		expect(formatDateRange(null, { month: 3, year: 2021 })).toBe('Mar 2021');
	});
});

describe('dates: validation', () => {
	it('flags an end date before the start date', () => {
		expect(isEndBeforeStart({ month: 6, year: 2023 }, { month: 2, year: 2023 })).toBe(true);
	});

	it('does not flag a valid range', () => {
		expect(isEndBeforeStart({ month: 2, year: 2023 }, { month: 6, year: 2023 })).toBe(false);
	});

	it('does not flag Present as before the start', () => {
		expect(isEndBeforeStart({ month: 6, year: 2023 }, { month: null, year: null, present: true })).toBe(false);
	});

	it('treats a missing month as January when ordering', () => {
		expect(monthYearToOrdinal({ month: null, year: 2020 })).toBe(2020 * 12);
	});

	it('detects mixed month/year and year-only formats', () => {
		expect(
			detectDateFormatInconsistency([
				{ month: 1, year: 2022 },
				{ month: null, year: 2023 }
			])
		).toBe(true);
	});

	it('does not flag consistent formats', () => {
		expect(
			detectDateFormatInconsistency([
				{ month: 1, year: 2022 },
				{ month: 4, year: 2023 }
			])
		).toBe(false);
	});
});

describe('dates: local time zone handling', () => {
	it('builds today from local components, not a UTC string', () => {
		const d = new Date(2026, 0, 1, 23, 30); // 1 Jan local, late evening
		expect(todayLocalISODate(d)).toBe('2026-01-01');
	});

	it('parses a local ISO date without shifting the day', () => {
		expect(parseLocalISODate('2026-03-12')).toEqual({ y: 2026, m: 3, d: 12 });
	});

	it('rejects an impossible day', () => {
		expect(parseLocalISODate('2023-02-30')).toBeNull();
	});

	it('rejects a malformed date string', () => {
		expect(parseLocalISODate('12/03/2026')).toBeNull();
	});

	it('formats a local date without a day shift', () => {
		expect(formatLocalISODate('2026-03-12')).toBe('12 Mar 2026');
	});

	it('counts whole days between local dates', () => {
		expect(daysBetweenLocal('2026-03-01', '2026-03-15')).toBe(14);
	});

	it('counts days across a DST boundary correctly', () => {
		// US DST starts 8 Mar 2026; a naive ms/86400000 would give 29.96 days.
		expect(daysBetweenLocal('2026-03-01', '2026-03-31')).toBe(30);
	});

	it('reports days since a timestamp', () => {
		const now = new Date(2026, 2, 20, 10, 0);
		const then = new Date(2026, 2, 14, 10, 0).toISOString();
		expect(daysSince(then, now)).toBe(6);
	});

	it('labels recent dates in plain language', () => {
		const now = new Date(2026, 2, 20, 10, 0);
		expect(relativeDayLabel(new Date(2026, 2, 20, 8, 0).toISOString(), now)).toBe('Today');
		expect(relativeDayLabel(new Date(2026, 2, 19, 8, 0).toISOString(), now)).toBe('Yesterday');
		expect(relativeDayLabel(null, now)).toBe('Never');
	});
});

// ---------------------------------------------------------------------------
describe('keywords: tokenising', () => {
	it('splits on whitespace and punctuation', () => {
		expect(tokenise('React, Node.js; and SQL!')).toEqual(['react', 'node.js', 'and', 'sql']);
	});

	it('keeps meaningful symbols inside tech terms', () => {
		expect(normaliseToken('C++')).toBe('c++');
		expect(normaliseToken('(C#)')).toBe('c#');
	});

	it('normalises smart quotes', () => {
		expect(normaliseToken('\u2018agile\u2019')).toBe('agile');
	});

	it('removes stop words and bare numbers', () => {
		const out = contentTokens('We are looking for a developer with 3 years of React');
		expect(out).toContain('developer');
		expect(out).toContain('react');
		expect(out).not.toContain('for');
		expect(out).not.toContain('3');
	});

	it('splits sentences and lines into segments', () => {
		const segs = splitSegments('Requirements:\n- React\n- SQL. Also Python.');
		expect(segs.length).toBeGreaterThanOrEqual(4);
	});
});

describe('keywords: plurals, variants and abbreviations', () => {
	it('singularises regular plurals', () => {
		expect(singularise('developers')).toBe('developer');
		expect(singularise('apis')).toBe('api');
	});

	it('singularises -ies plurals', () => {
		expect(singularise('libraries')).toBe('library');
	});

	it('leaves -ss, -us and -is words alone', () => {
		expect(singularise('css')).toBe('css');
		expect(singularise('analysis')).toBe('analysis');
		expect(singularise('process')).toBe('process');
	});

	it('matches JS to JavaScript', () => {
		expect(labelsInText('Strong JS skills').has('JavaScript')).toBe(true);
	});

	it('matches ML to machine learning', () => {
		expect(labelsInText('Exposure to ML pipelines').has('Machine learning')).toBe(true);
		expect(labelsInText('machine learning experience').has('Machine learning')).toBe(true);
	});

	it('matches k8s to Kubernetes and GCP to Google Cloud', () => {
		const labels = labelsInText('We run k8s on GCP');
		expect(labels.has('Kubernetes')).toBe(true);
		expect(labels.has('Google Cloud')).toBe(true);
	});

	it('matches plural tool names', () => {
		expect(labelsInText('built REST APIs').has('REST APIs')).toBe(true);
	});
});

describe('keywords: phrase detection', () => {
	it('detects two and three word phrases', () => {
		const labels = labelsInText('experience with continuous integration and unit testing');
		expect(labels.has('CI/CD')).toBe(true);
		expect(labels.has('Unit testing')).toBe(true);
	});

	it('prefers the longest phrase at a position', () => {
		// "machine learning" must win over a bare "learning"/"machine" token.
		const kws = extractKeywords('Required: machine learning');
		expect(kws.some((k) => k.label === 'Machine learning')).toBe(true);
	});

	it('indexes aliases without shadowing canonical labels', () => {
		const index = buildDictionaryIndex();
		expect(index.byForm.get('javascript')?.label).toBe('JavaScript');
		expect(index.byForm.get('js')?.label).toBe('JavaScript');
	});

	it('limits phrase scanning to three words', () => {
		expect(buildDictionaryIndex().maxPhraseWords).toBeLessThanOrEqual(3);
	});
});

describe('keywords: required vs nice-to-have', () => {
	const kws = extractKeywords(SAMPLE_JOB_TEXT);
	const find = (label: string) => kws.find((k) => k.label === label);

	it('marks requirements-section skills as required', () => {
		expect(find('TypeScript')?.importance).toBe('required');
		expect(find('SQL')?.importance).toBe('required');
	});

	it('marks nice-to-have skills from the heading below them', () => {
		expect(find('Docker')?.importance).toBe('nice-to-have');
		expect(find('AWS')?.importance).toBe('nice-to-have');
	});

	it('counts repeated keywords', () => {
		expect((find('React')?.count ?? 0)).toBeGreaterThan(1);
	});

	it('sorts required keywords first', () => {
		expect(kws[0].importance).toBe('required');
	});

	it('returns nothing for empty text', () => {
		expect(extractKeywords('')).toEqual([]);
		expect(extractKeywords('   ')).toEqual([]);
	});
});

describe('keywords: word frequency', () => {
	it('counts stemmed content words', () => {
		const freq = wordFrequencies('Managed projects. Managed teams. Project delivery.');
		expect(freq.get('managed')).toBe(2);
		expect(freq.get('project')).toBe(2);
	});
});

// ---------------------------------------------------------------------------
describe('score: calculation', () => {
	it('weights required keywords above nice-to-have', () => {
		expect(weightFor('required')).toBeGreaterThan(weightFor('nice-to-have'));
	});

	it('scores 100 when every keyword is present', () => {
		const jd = 'Required: React and TypeScript.';
		const result = computeMatch('I use React and TypeScript daily.', jd);
		expect(result.score).toBe(100);
		expect(result.missing).toHaveLength(0);
	});

	it('scores 0 when no keyword is present', () => {
		const result = computeMatch('I bake bread and ride bicycles.', 'Required: React and Kubernetes.');
		expect(result.score).toBe(0);
		expect(result.matched).toHaveLength(0);
	});

	it('scores 0 for an empty job description without dividing by zero', () => {
		const result = computeMatch('anything', '');
		expect(result.score).toBe(0);
		expect(Number.isNaN(result.score)).toBe(false);
	});

	it('gives a partial score for partial overlap', () => {
		const result = computeMatch('I know React.', 'Required: React. Nice to have: Kubernetes.');
		// required React (weight 2) matched out of 2 + 1 total weight
		expect(result.score).toBe(67);
	});

	it('produces a score between 0 and 100 for the sample pair', () => {
		const result = computeMatch(resumeToPlainText(devResume), SAMPLE_JOB_TEXT);
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThanOrEqual(100);
	});

	it('finds real overlap between the sample resume and job', () => {
		const result = computeMatch(resumeToPlainText(devResume), SAMPLE_JOB_TEXT);
		const labels = result.matched.map((m) => m.label);
		expect(labels).toContain('React');
		expect(labels).toContain('TypeScript');
		expect(labels).toContain('PostgreSQL');
	});

	it('reports a lower score for an unrelated resume', () => {
		const devScore = computeMatch(resumeToPlainText(devResume), SAMPLE_JOB_TEXT).score;
		const mktScore = computeMatch(resumeToPlainText(mktResume), SAMPLE_JOB_TEXT).score;
		expect(mktScore).toBeLessThan(devScore);
	});

	it('suggests a section for each missing keyword', () => {
		const result = computeMatch('Nothing relevant here.', SAMPLE_JOB_TEXT);
		expect(result.missing.length).toBeGreaterThan(0);
		for (const m of result.missing) {
			expect(m.suggestion.length).toBeGreaterThan(0);
			expect(m.suggestSection).toBeTruthy();
		}
	});

	it('always carries the estimate disclaimer', () => {
		const result = computeMatch('x', 'Required: React');
		expect(result.disclaimer).toBe(SCORE_DISCLAIMER);
		expect(result.disclaimer).toContain('estimate based on keyword matching');
	});

	it('bands the score without promising an outcome', () => {
		expect(scoreBand(85).tone).toBe('good');
		expect(scoreBand(50).tone).toBe('warn');
		expect(scoreBand(10).tone).toBe('bad');
		for (const s of [0, 50, 100]) {
			expect(scoreBand(s).label).not.toMatch(/interview|guarantee|will get/i);
		}
	});

	it('handles a 3,000-word job description quickly', () => {
		const long = `${SAMPLE_JOB_TEXT} `.repeat(12); // well over 3,000 words
		const words = long.split(/\s+/).length;
		expect(words).toBeGreaterThan(3000);
		const t0 = Date.now();
		const result = computeMatch(resumeToPlainText(devResume), long);
		const ms = Date.now() - t0;
		expect(result.score).toBeGreaterThan(0);
		expect(ms).toBeLessThan(1500);
	});
});

// ---------------------------------------------------------------------------
describe('health: bullet quality', () => {
	it('accepts a bullet starting with a strong verb', () => {
		expect(startsWithActionVerb('Built 14 reusable React components')).toBe(true);
	});

	it('rejects a bullet starting with "Responsible for"', () => {
		expect(startsWithActionVerb('Responsible for the billing module')).toBe(false);
	});

	it('rejects a bullet starting with "Worked on"', () => {
		expect(startsWithActionVerb('Worked on several features')).toBe(false);
	});

	it('accepts an unlisted regular past-tense verb', () => {
		expect(startsWithActionVerb('Refactored the parser')).toBe(true);
	});

	it('reads the first word ignoring punctuation and accents', () => {
		expect(firstWord('  "Managed" the team')).toBe('managed');
		expect(firstWord('\u00c9valuated options')).toBe('\u00e9valuated');
	});

	it('detects weak phrases', () => {
		expect(weakPhrasesIn('Responsible for reporting')).toContain('responsible for');
		expect(weakPhrasesIn('Helped with the migration')).toContain('helped with');
		expect(weakPhrasesIn('Built the pipeline')).toHaveLength(0);
	});

	it('detects whether a bullet has a number', () => {
		expect(hasQuantifiedResult('Raised coverage from 38% to 81%')).toBe(true);
		expect(hasQuantifiedResult('Improved the build process')).toBe(false);
	});

	it('ships a usable list of action verbs', () => {
		expect(ACTION_VERBS.length).toBeGreaterThan(150);
		expect(ACTION_VERBS).toContain('Led');
	});
});

describe('health: resume checks', () => {
	it('passes most checks on the sample resume', () => {
		const report = checkResumeHealth(devResume, { pageCount: 1 });
		expect(report.problems).toBe(0);
	});

	it('flags missing contact details', () => {
		const r = newResume('Blank');
		const report = checkResumeHealth(r);
		expect(report.issues.some((i) => i.id === 'contact')).toBe(true);
	});

	it('flags a missing summary', () => {
		const r = newResume('Blank');
		const report = checkResumeHealth(r);
		expect(report.issues.some((i) => i.id === 'summary-missing')).toBe(true);
	});

	it('flags a resume longer than two pages', () => {
		const report = checkResumeHealth(devResume, { pageCount: 4 });
		const issue = report.issues.find((i) => i.id === 'page-count');
		expect(issue).toBeTruthy();
		expect(issue?.title).toContain('4 pages');
	});

	it('flags bullets that do not start with an action verb', () => {
		const r: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = r.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			exp.items.entries[0].bullets[0].text = 'Responsible for the customer portal';
		}
		const report = checkResumeHealth(r, { pageCount: 1 });
		expect(report.issues.some((i) => i.id === 'bullet-verbs')).toBe(true);
		expect(report.issues.some((i) => i.id === 'bullet-weak')).toBe(true);
	});

	it('flags an over-long bullet', () => {
		const r: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = r.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			exp.items.entries[0].bullets[0].text = `Delivered ${'a very long description '.repeat(12)}`;
		}
		const report = checkResumeHealth(r, { pageCount: 1 });
		expect(report.issues.some((i) => i.id === 'bullet-length')).toBe(true);
	});

	it('flags a resume with no bullets as a problem', () => {
		const r = newResume('Blank');
		const report = checkResumeHealth(r);
		expect(report.issues.some((i) => i.id === 'no-bullets' && i.severity === 'problem')).toBe(true);
	});

	it('never writes replacement content for the user', () => {
		const report = checkResumeHealth(devResume, { pageCount: 1 });
		for (const issue of report.issues) {
			expect(issue.detail).not.toMatch(/here is a better bullet|try writing:|we wrote/i);
		}
	});
});

// ---------------------------------------------------------------------------
describe('measure: text metrics', () => {
	it('loads metrics for every shipped font', () => {
		for (const font of ['inter', 'source-serif', 'lato', 'ibm-plex-sans'] as const) {
			const m = getMetrics(font, 'regular');
			expect(Object.keys(m.widths).length).toBeGreaterThan(200);
			expect(m.ascender).toBeGreaterThan(0);
		}
	});

	it('measures a wider string as wider', () => {
		const short = measureText('Hi', 'inter', 'regular', 12);
		const long = measureText('Hi there, this is longer', 'inter', 'regular', 12);
		expect(long).toBeGreaterThan(short);
	});

	it('scales linearly with font size', () => {
		const a = measureText('Sample text', 'inter', 'regular', 10);
		const b = measureText('Sample text', 'inter', 'regular', 20);
		expect(b).toBeCloseTo(a * 2, 5);
	});

	it('measures bold wider than regular for the same string', () => {
		const regular = measureText('Experience', 'inter', 'regular', 12);
		const bold = measureText('Experience', 'inter', 'bold', 12);
		expect(bold).toBeGreaterThanOrEqual(regular);
	});

	it('measures accented and non-English characters', () => {
		expect(measureText('Zo\u00eb Mart\u00ednez', 'inter', 'regular', 12)).toBeGreaterThan(0);
		expect(measureText('\u0141ukasz', 'lato', 'regular', 12)).toBeGreaterThan(0);
	});

	it('measures an empty string as zero', () => {
		expect(measureText('', 'inter', 'regular', 12)).toBe(0);
	});
});

describe('measure: wrapping', () => {
	const opts = { font: 'inter' as const, weight: 'regular' as const, sizePt: 10, maxWidthPt: 200 };

	it('wraps long text into multiple lines', () => {
		const lines = wrapText('word '.repeat(60).trim(), opts);
		expect(lines.length).toBeGreaterThan(1);
	});

	it('keeps every wrapped line within the max width', () => {
		const lines = wrapText('Developed REST API endpoints in Node.js and PostgreSQL for the portal', opts);
		for (const line of lines) {
			expect(measureText(line, 'inter', 'regular', 10)).toBeLessThanOrEqual(opts.maxWidthPt + 0.01);
		}
	});

	it('breaks a single over-long word rather than overflowing', () => {
		const lines = wrapText('https://example.com/' + 'x'.repeat(300), opts);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) {
			expect(measureText(line, 'inter', 'regular', 10)).toBeLessThanOrEqual(opts.maxWidthPt + 0.01);
		}
	});

	it('preserves author line breaks', () => {
		expect(wrapText('one\ntwo', { ...opts, maxWidthPt: 500 })).toEqual(['one', 'two']);
	});

	it('counts lines consistently with wrapText', () => {
		const text = 'Coordinated six webinars with an average of 180 registrations each';
		expect(countLines(text, opts)).toBe(wrapText(text, opts).length);
	});

	it('converts mm and pt round-trip', () => {
		expect(ptToMm(mmToPt(25.4))).toBeCloseTo(25.4, 6);
		expect(mmToPt(25.4)).toBeCloseTo(72, 6);
	});
});

// ---------------------------------------------------------------------------
describe('layout: pagination and page-break rules', () => {
	it('lays out the sample resume onto at least one page', () => {
		const result = layoutResume(devResume);
		expect(result.pageCount).toBeGreaterThanOrEqual(1);
		expect(result.pages[0].runs.length).toBeGreaterThan(10);
	});

	it('uses the correct A4 and Letter page sizes in points', () => {
		const a4 = layoutResume(devResume);
		expect(a4.pageWidth).toBeCloseTo(595.28, 1);
		const letter = layoutResume({ ...devResume, page: { ...devResume.page, size: 'letter' } });
		expect(letter.pageWidth).toBeCloseTo(612, 1);
	});

	it('keeps all runs inside the printable area', () => {
		const result = layoutResume(devResume);
		const marginSide = mmToPt(devResume.page.marginSide);
		for (const page of result.pages) {
			for (const run of page.runs) {
				expect(run.x).toBeGreaterThanOrEqual(marginSide - 0.5);
				expect(run.y).toBeGreaterThanOrEqual(mmToPt(devResume.page.marginTop) - 0.5);
				expect(run.y).toBeLessThanOrEqual(result.pageHeight - mmToPt(devResume.page.marginBottom) + 2);
			}
		}
	});

	it('adds pages as content grows', () => {
		const big: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = big.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			const base = exp.items.entries[0];
			for (let i = 0; i < 25; i += 1) {
				exp.items.entries.push({ ...JSON.parse(JSON.stringify(base)), id: `dup-${i}` });
			}
		}
		expect(layoutResume(big).pageCount).toBeGreaterThan(1);
	});

	it('never leaves a section heading alone at the bottom of a page', () => {
		// Grow the resume until it spans pages, then check every page's last run.
		const big: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = big.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			const base = exp.items.entries[0];
			for (let i = 0; i < 12; i += 1) {
				exp.items.entries.push({ ...JSON.parse(JSON.stringify(base)), id: `dup2-${i}` });
			}
		}
		const result = layoutResume(big);
		expect(result.pageCount).toBeGreaterThan(1);
		const headings = new Set(
			big.sections.map((s) => s.name.toUpperCase()).concat(big.sections.map((s) => s.name))
		);
		for (let i = 0; i < result.pages.length - 1; i += 1) {
			const runs = result.pages[i].runs;
			const last = runs[runs.length - 1];
			// The final run on a page must not be a bare section heading.
			expect(headings.has(last.text)).toBe(false);
		}
	});

	it('keeps an entry heading with its first bullet', () => {
		const big: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = big.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			const base = exp.items.entries[0];
			for (let i = 0; i < 14; i += 1) {
				exp.items.entries.push({ ...JSON.parse(JSON.stringify(base)), id: `dup3-${i}` });
			}
		}
		const result = layoutResume(big);
		for (let i = 0; i < result.pages.length - 1; i += 1) {
			const runs = result.pages[i].runs;
			const last = runs[runs.length - 1];
			// A role title must never be the last thing on a page with its bullets overleaf.
			expect(last.text).not.toBe('Junior Software Developer');
		}
	});

	it('emits clickable link runs for email and profile links', () => {
		const result = layoutResume(devResume);
		const links = result.pages[0].runs.filter((r) => r.href);
		expect(links.length).toBeGreaterThanOrEqual(3);
		expect(links.some((l) => l.href?.startsWith('mailto:'))).toBe(true);
		expect(links.some((l) => l.href?.startsWith('https://'))).toBe(true);
	});

	it('renders every template without losing content', () => {
		const textOf = (r: Resume) =>
			layoutResume(r)
				.pages.flatMap((p) => p.runs.map((x) => x.text))
				.join(' ');
		for (const t of TEMPLATE_LIST) {
			const out = textOf({ ...devResume, style: { ...devResume.style, template: t.id } });
			expect(out).toContain('Ravi Anand');
			expect(out).toContain('Northwind Labs');
		}
	});

	it('labels the two-column template as less suited to screening', () => {
		expect(TEMPLATES.executive.columns).toBe(2);
		expect(TEMPLATES.executive.atsNote).toContain('Less suited to automated screening');
		expect(TEMPLATES.classic.columns).toBe(1);
		expect(TEMPLATES.minimal.columns).toBe(1);
	});

	it('produces fewer or equal pages at a smaller font size', () => {
		const big = layoutResume(devResume, { fontSize: 13 }).pageCount;
		const small = layoutResume(devResume, { fontSize: 9 }).pageCount;
		expect(small).toBeLessThanOrEqual(big);
	});

	it('handles an empty resume without crashing', () => {
		const r = newResume('Empty');
		const result = layoutResume(r);
		expect(result.pageCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
describe('fit to one page', () => {
	it('reports when a resume already fits', () => {
		const small = newResume('Tiny');
		const result = fitToOnePage(small);
		expect(result.fits).toBe(true);
		expect(result.pageCount).toBe(1);
	});

	it('reduces spacing and font size to fit', () => {
		const r: Resume = JSON.parse(JSON.stringify(devResume));
		r.page.fontSize = 13;
		r.page.lineSpacing = 1.5;
		const before = layoutResume(r).pageCount;
		const result = fitToOnePage(r);
		if (before > 1) {
			expect(result.settings.fontSize).toBeLessThanOrEqual(13);
		}
		expect(result.pageCount).toBeLessThanOrEqual(before);
	});

	it('never goes below the sensible limits', () => {
		const big: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = big.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			const base = exp.items.entries[0];
			for (let i = 0; i < 30; i += 1) {
				exp.items.entries.push({ ...JSON.parse(JSON.stringify(base)), id: `fit-${i}` });
			}
		}
		const result = fitToOnePage(big);
		expect(result.settings.fontSize).toBeGreaterThanOrEqual(FIT_LIMITS.minFontSize);
		expect(result.settings.lineSpacing).toBeGreaterThanOrEqual(FIT_LIMITS.minLineSpacing);
	});

	it('says so clearly when the content still does not fit', () => {
		const big: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = big.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			const base = exp.items.entries[0];
			for (let i = 0; i < 40; i += 1) {
				exp.items.entries.push({ ...JSON.parse(JSON.stringify(base)), id: `fit2-${i}` });
			}
		}
		const result = fitToOnePage(big);
		expect(result.fits).toBe(false);
		expect(result.hitLimits).toBe(true);
		expect(result.message).toMatch(/still|does not fit|Remove/i);
	});
});

// ---------------------------------------------------------------------------
describe('JSON import validation', () => {
	const goodBackup = JSON.stringify(sample);

	it('accepts a backup this app produced', () => {
		const result = validateBackup(goodBackup);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.resumes).toHaveLength(2);
			expect(result.data.applications).toHaveLength(6);
		}
	});

	it('rejects an empty file with a clear message', () => {
		const result = validateBackup('');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0].message).toMatch(/empty/i);
	});

	it('rejects malformed JSON with a clear message', () => {
		const result = validateBackup('{ "resumes": [ ');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0].message).toMatch(/not a valid JSON/i);
	});

	it('rejects valid JSON that is not a backup object', () => {
		const result = validateBackup('[1,2,3]');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0].message).toMatch(/backup object/i);
	});

	it('rejects a backup with no resumes list', () => {
		const result = validateBackup('{"version":1,"applications":[]}');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0].path).toBe('resumes');
	});

	it('rejects a backup from a newer app version', () => {
		const result = validateBackup('{"version":99,"resumes":[]}');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0].message).toMatch(/newer version/i);
	});

	it('rejects a backup whose resumes are all unreadable', () => {
		const result = validateBackup('{"version":1,"resumes":[1,2,3]}');
		expect(result.ok).toBe(false);
	});

	it('clamps out-of-range page settings instead of failing', () => {
		const payload = {
			version: 1,
			resumes: [{ id: 'x', name: 'X', sections: [], page: { fontSize: 99, lineSpacing: 9 } }]
		};
		const result = validateBackup(JSON.stringify(payload));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.resumes[0].page.fontSize).toBeLessThanOrEqual(16);
			expect(result.data.resumes[0].page.lineSpacing).toBeLessThanOrEqual(2);
		}
	});

	it('falls back to safe defaults for unknown template and font values', () => {
		const payload = {
			version: 1,
			resumes: [{ id: 'x', name: 'X', sections: [], style: { template: 'hacker', font: 'comic' } }]
		};
		const result = validateBackup(JSON.stringify(payload));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.resumes[0].style.template).toBe('classic');
			expect(result.data.resumes[0].style.font).toBe('inter');
		}
	});

	it('clears references to resumes that are not in the file', () => {
		const payload = {
			version: 1,
			resumes: [{ id: 'real', name: 'Real', sections: [] }],
			applications: [{ id: 'a', jobTitle: 'Role', resumeId: 'ghost' }]
		};
		const result = validateBackup(JSON.stringify(payload));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.applications[0].resumeId).toBeNull();
			expect(result.warnings.length).toBeGreaterThan(0);
		}
	});

	it('rejects an invalid application date rather than shifting it', () => {
		const payload = {
			version: 1,
			resumes: [{ id: 'r', name: 'R', sections: [] }],
			applications: [{ id: 'a', jobTitle: 'Role', dateApplied: '12/03/2026' }]
		};
		const result = validateBackup(JSON.stringify(payload));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.applications[0].dateApplied).toBe('');
	});
});

// ---------------------------------------------------------------------------
describe('DOCX structure', () => {
	const doc = buildDocxStructure(devResume);

	it('uses real headings rather than styled paragraphs', () => {
		const headings = doc.blocks.filter((b) => b.type === 'heading');
		expect(headings.length).toBeGreaterThan(3);
		expect(headings.some((h) => h.text.toLowerCase().includes('experience'))).toBe(true);
	});

	it('uses a real bullet list for bullets', () => {
		const bulletBlocks = doc.blocks.filter((b) => b.type === 'bullet');
		expect(bulletBlocks.length).toBeGreaterThan(4);
	});

	it('never uses tables or text boxes for layout', () => {
		for (const block of doc.blocks) {
			expect(['title', 'heading', 'subheading', 'paragraph', 'bullet', 'contact']).toContain(block.type);
		}
	});

	it('puts the name first and keeps contact details near the top', () => {
		expect(doc.blocks[0].type).toBe('title');
		expect(doc.blocks[0].text).toBe('Ravi Anand');
		const contactIndex = doc.blocks.findIndex((b) => b.type === 'contact');
		expect(contactIndex).toBeGreaterThan(0);
		expect(contactIndex).toBeLessThan(4);
	});

	it('keeps links with their display text', () => {
		const withLinks = doc.blocks.filter((b) => b.runs?.some((r) => r.href));
		expect(withLinks.length).toBeGreaterThan(0);
	});

	it('preserves reading order across sections', () => {
		const text = doc.blocks.map((b) => b.text).join('\n');
		expect(text.indexOf('Ravi Anand')).toBeLessThan(text.indexOf('Experience'));
		expect(text.indexOf('Experience')).toBeLessThan(text.indexOf('Education'));
	});
});

// ---------------------------------------------------------------------------
describe('cover letter', () => {
	it('fills {company} and {role} placeholders', () => {
		const body = buildLetterBody(
			{
				recipient: 'Priya Raghavan',
				company: 'Harbourline Software',
				role: 'Junior Developer',
				source: 'your careers page',
				points: ['Point one', 'Point two', 'Point three'],
				tone: 'formal'
			},
			{ fullName: 'Ravi Anand', email: 'ravi.anand@example.com', phone: '+1 555 0148' }
		);
		expect(body).toContain('Harbourline Software');
		expect(body).toContain('Junior Developer');
		expect(body).not.toContain('{company}');
		expect(body).not.toContain('{role}');
	});

	it('changes wording with the tone', () => {
		const base = {
			recipient: 'Alex',
			company: 'Acme',
			role: 'Developer',
			source: 'LinkedIn',
			points: ['a', 'b', 'c']
		};
		const person = { fullName: 'Ravi Anand', email: 'r@example.com', phone: '1' };
		const formal = buildLetterBody({ ...base, tone: 'formal' }, person);
		const friendly = buildLetterBody({ ...base, tone: 'friendly' }, person);
		const concise = buildLetterBody({ ...base, tone: 'concise' }, person);
		expect(formal).not.toBe(friendly);
		expect(concise.length).toBeLessThan(formal.length);
	});

	it('uses the linked resume name and contact details', () => {
		const body = buildLetterBody(
			{ recipient: '', company: 'Acme', role: 'Dev', source: '', points: ['', '', ''], tone: 'formal' },
			{ fullName: 'Zo\u00eb Mart\u00ednez', email: 'zoe@example.com', phone: '+1 555 0172' }
		);
		expect(body).toContain('Zo\u00eb Mart\u00ednez');
		expect(body).toContain('zoe@example.com');
	});

	it('counts words', () => {
		expect(countWords('one two three')).toBe(3);
		expect(countWords('   ')).toBe(0);
	});

	it('flags a letter that is too long for one page', () => {
		expect(letterFitsOnePage('word '.repeat(300))).toBe(true);
		expect(letterFitsOnePage('word '.repeat(700))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
describe('file names', () => {
	it('builds Resume_First_Last_Role.pdf', () => {
		expect(exportFileName('Ravi Anand', 'Junior Software Developer', 'pdf')).toBe(
			'Resume_Ravi_Anand_Junior_Software_Developer.pdf'
		);
	});

	it('omits the role when there is not one', () => {
		expect(exportFileName('Ravi Anand', '', 'docx')).toBe('Resume_Ravi_Anand.docx');
	});

	it('strips characters that break file systems', () => {
		expect(sanitiseFileNamePart('A/B\\C:D*E?F"G<H>I|J')).toBe('ABCDEFGHIJ');
	});

	it('keeps accented characters readable', () => {
		expect(exportFileName('Zo\u00eb Mart\u00ednez', 'Marketing', 'pdf')).toBe(
			'Resume_Zo\u00eb_Mart\u00ednez_Marketing.pdf'
		);
	});

	it('falls back when the name is empty', () => {
		expect(exportFileName('', '', 'txt')).toBe('Resume.txt');
	});
});

// ---------------------------------------------------------------------------
describe('resume text and factories', () => {
	it('flattens a resume in reading order', () => {
		const text = resumeToPlainText(devResume);
		expect(text.indexOf('Ravi Anand')).toBeLessThan(text.indexOf('Northwind Labs'));
		expect(text).toContain('- Built 14 reusable React components');
	});

	it('skips hidden sections and items', () => {
		const r: Resume = JSON.parse(JSON.stringify(devResume));
		r.sections[2].hidden = true;
		expect(resumeToPlainText(r)).not.toContain('Northwind Labs');
	});

	it('collects bullets with their origin', () => {
		const bullets = collectBullets(devResume);
		expect(bullets.length).toBeGreaterThan(5);
		expect(bullets[0].entryLabel).toContain('Northwind Labs');
	});

	it('collects dates for the consistency check', () => {
		expect(collectDates(devResume).length).toBeGreaterThan(2);
	});

	it('generates unique ids', () => {
		const ids = new Set(Array.from({ length: 500 }, () => uid('t')));
		expect(ids.size).toBe(500);
	});

	it('creates a complete blank resume', () => {
		const r = newResume();
		expect(r.sections.length).toBeGreaterThanOrEqual(5);
		expect(r.page.size).toBe('a4');
	});

	it('creates every section kind without undefined items', () => {
		for (const kind of [
			'personal', 'summary', 'experience', 'education', 'skills',
			'projects', 'certifications', 'languages', 'awards', 'custom'
		] as const) {
			const section = newSection(kind);
			expect(section.items).toBeTruthy();
			expect(section.items.type).toBe(kind);
		}
	});

	it('duplicates a resume with fresh ids but identical content', () => {
		const copy = cloneResume(devResume, 'Tailored copy');
		expect(copy.id).not.toBe(devResume.id);
		expect(copy.name).toBe('Tailored copy');
		expect(resumeToPlainText(copy)).toBe(resumeToPlainText(devResume));
		const origIds = devResume.sections.map((s) => s.id);
		for (const s of copy.sections) expect(origIds).not.toContain(s.id);
	});

	it('clears score history on a duplicate', () => {
		expect(cloneResume(devResume, 'Copy').scoreHistory).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
describe('sample data', () => {
	it('ships two resumes, a job, a letter and six applications', () => {
		expect(sample.resumes).toHaveLength(2);
		expect(sample.jobDescriptions).toHaveLength(1);
		expect(sample.coverLetters).toHaveLength(1);
		expect(sample.applications).toHaveLength(6);
	});

	it('covers every application status', () => {
		const statuses = new Set(sample.applications.map((a) => a.status));
		expect(statuses.has('saved')).toBe(true);
		expect(statuses.has('applied')).toBe(true);
		expect(statuses.has('interview')).toBe(true);
		expect(statuses.has('offer')).toBe(true);
		expect(statuses.has('rejected')).toBe(true);
	});

	it('uses only fictional contact details', () => {
		const blob = JSON.stringify(sample);
		const emails = blob.match(/[\w.+-]+@[\w.-]+/g) ?? [];
		expect(emails.length).toBeGreaterThan(0);
		for (const email of emails) expect(email.endsWith('@example.com')).toBe(true);
		// Links point at .example domains that cannot resolve to a real site.
		const urls = blob.match(/https?:\/\/[^"\s]+/g) ?? [];
		for (const url of urls) {
			expect(/(\.example|linkedin\.com|github\.com)/.test(url)).toBe(true);
		}
	});

	it('uses reserved 555 phone numbers', () => {
		const phones = JSON.stringify(sample).match(/\+1 555 \d{4}/g) ?? [];
		expect(phones.length).toBeGreaterThanOrEqual(2);
	});

	it('provides a job description long enough to be realistic', () => {
		expect(SAMPLE_JOB_TEXT.split(/\s+/).length).toBeGreaterThan(150);
	});

	it('produces a meaningful match for the developer sample', () => {
		const result = computeMatch(resumeToPlainText(devResume), SAMPLE_JOB_TEXT);
		expect(result.matched.length).toBeGreaterThan(8);
		expect(result.missing.length).toBeGreaterThan(0);
	});

	it('round-trips through backup validation unchanged', () => {
		const result = validateBackup(JSON.stringify(sample));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(resumeToPlainText(result.data.resumes[0])).toBe(resumeToPlainText(devResume));
		}
	});
});

// ---------------------------------------------------------------------------
describe('robustness', () => {
	it('handles special characters and non-English names end to end', () => {
		const r: Resume = JSON.parse(JSON.stringify(devResume));
		const personal = r.sections[0];
		if (personal.items.type === 'personal') {
			personal.items.data.fullName = '\u0141ukasz \u00d8stergaard-Ni\u00f1o';
			personal.items.data.headline = 'Engineer & "Builder" <tester>';
		}
		const layout = layoutResume(r);
		const text = layout.pages.flatMap((p) => p.runs.map((x) => x.text)).join(' ');
		expect(text).toContain('\u0141ukasz');
		expect(layout.pageCount).toBeGreaterThanOrEqual(1);
	});

	it('handles a very short resume', () => {
		const r = newResume('Short');
		if (r.sections[0].items.type === 'personal') {
			r.sections[0].items.data.fullName = 'A';
		}
		expect(layoutResume(r).pageCount).toBe(1);
		expect(() => checkResumeHealth(r)).not.toThrow();
	});

	it('handles a very long four-page resume without hanging', () => {
		const big: Resume = JSON.parse(JSON.stringify(devResume));
		const exp = big.sections.find((s) => s.items.type === 'experience');
		if (exp && exp.items.type === 'experience') {
			const base = exp.items.entries[0];
			for (let i = 0; i < 45; i += 1) {
				exp.items.entries.push({ ...JSON.parse(JSON.stringify(base)), id: `long-${i}` });
			}
		}
		const t0 = Date.now();
		const result = layoutResume(big);
		const ms = Date.now() - t0;
		expect(result.pageCount).toBeGreaterThanOrEqual(4);
		expect(ms).toBeLessThan(2000);
	});

	it('keeps the dictionary near the stated size', () => {
		expect(SKILL_DICTIONARY.length).toBeGreaterThan(280);
		const forms = SKILL_DICTIONARY.reduce((n, e) => n + 1 + (e.aliases?.length ?? 0), 0);
		expect(forms).toBeGreaterThan(450);
	});

	it('has no duplicate canonical labels in the dictionary', () => {
		const labels = SKILL_DICTIONARY.map((e) => e.label);
		expect(new Set(labels).size).toBe(labels.length);
	});
});
