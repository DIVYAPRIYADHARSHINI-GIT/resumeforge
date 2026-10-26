// Keyword extraction, phrase detection and synonym/abbreviation matching.
// Everything runs in the browser against the bundled dictionary - no AI service, no network.
//
// Performance intent: a 3,000-word job description must never freeze the page. We make one
// linear pass to tokenise, then look phrases up in pre-built Maps (O(1) per n-gram).

import {
	NICE_TO_HAVE_CUES,
	REQUIRED_CUES,
	SKILL_DICTIONARY,
	type SkillEntry,
	type SuggestSection
} from './dictionary';

export const STOP_WORDS = new Set([
	'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'also', 'am', 'an',
	'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
	'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing',
	'done', 'down', 'during', 'each', 'either', 'else', 'etc', 'even', 'ever', 'every',
	'few', 'for', 'from', 'further', 'get', 'got', 'had', 'has', 'have', 'having', 'he',
	'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'however', 'i', 'if',
	'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'like', 'make', 'many', 'may', 'me',
	'might', 'more', 'most', 'much', 'must', 'my', 'myself', 'need', 'no', 'nor', 'not',
	'now', 'of', 'off', 'on', 'once', 'one', 'only', 'or', 'other', 'others', 'ought', 'our',
	'ours', 'ourselves', 'out', 'over', 'own', 'per', 'please', 'same', 'shall', 'she',
	'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
	'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
	'under', 'until', 'up', 'upon', 'us', 'use', 'used', 'using', 'very', 'was', 'we',
	'well', 'were', 'what', 'when', 'where', 'whether', 'which', 'while', 'who', 'whom',
	'why', 'will', 'with', 'within', 'without', 'would', 'you', 'your', 'yours', 'yourself',
	// job-ad filler that is never a useful keyword
	'role', 'job', 'work', 'working', 'team', 'teams', 'company', 'candidate', 'candidates',
	'position', 'opportunity', 'looking', 'join', 'apply', 'applicant', 'applicants',
	'responsibilities', 'responsibility', 'benefits', 'salary', 'office', 'remote', 'hybrid',
	'years', 'year', 'month', 'months', 'day', 'days', 'week', 'weeks', 'time', 'full',
	'part', 'new', 'good', 'great', 'strong', 'help', 'helping', 'ability', 'able', 'plus',
	'etc.', 'us', 'our', 'their', 'who', 'what'
]);

/**
 * Normalise a token for matching: lowercase, strip surrounding punctuation but keep the
 * characters that carry meaning inside tech terms (+ # . /).
 */
export function normaliseToken(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[\u2018\u2019\u201c\u201d]/g, "'")
		.replace(/^[^a-z0-9+#./]+/, '')
		.replace(/[^a-z0-9+#./]+$/, '')
		.replace(/\.$/, '');
}

/**
 * Singularise common plurals. Deliberately conservative: we only strip a trailing "s"/"es"
 * when the result still looks like a word, so "css", "analysis" and "process" survive.
 */
export function singularise(word: string): string {
	if (word.length <= 3) return word;
	// "css", "status", "analysis"/"thesis" are not plurals. Note the check is "sis" rather
	// than "is" so that genuine plurals such as "apis" still singularise to "api".
	if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('sis')) return word;
	if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
	if (word.endsWith('ches') || word.endsWith('shes') || word.endsWith('xes') || word.endsWith('zes')) {
		return word.slice(0, -2);
	}
	if (word.endsWith('s')) return word.slice(0, -1);
	return word;
}

/** Tokenise free text into normalised, non-empty tokens (stop words kept at this stage). */
export function tokenise(text: string): string[] {
	if (!text) return [];
	const rough = text.split(/[\s,;:!?()[\]{}"'<>|\\]+/);
	const out: string[] = [];
	for (const piece of rough) {
		// Split on dashes/slashes too, but keep a copy of the joined form for things like CI/CD.
		const token = normaliseToken(piece);
		if (token) out.push(token);
	}
	return out;
}

/** Tokens with stop words and bare numbers removed. */
export function contentTokens(text: string): string[] {
	return tokenise(text).filter((t) => !STOP_WORDS.has(t) && !/^\d+$/.test(t) && t.length > 1);
}

// ---------------------------------------------------------------------------
// Dictionary index
// ---------------------------------------------------------------------------

export interface DictionaryIndex {
	/** normalised surface form -> dictionary entry */
	byForm: Map<string, SkillEntry>;
	/** Longest surface form in words, so we know how wide to scan n-grams. */
	maxPhraseWords: number;
}

function normalisePhrase(phrase: string): string {
	return tokenise(phrase).map(singularise).join(' ');
}

let cachedIndex: DictionaryIndex | null = null;

export function buildDictionaryIndex(entries: SkillEntry[] = SKILL_DICTIONARY): DictionaryIndex {
	const byForm = new Map<string, SkillEntry>();
	let maxPhraseWords = 1;
	for (const entry of entries) {
		const forms = [entry.label, ...(entry.aliases ?? [])];
		for (const form of forms) {
			const key = normalisePhrase(form);
			if (!key) continue;
			// First writer wins so a canonical label is never shadowed by another entry's alias.
			if (!byForm.has(key)) byForm.set(key, entry);
			const words = key.split(' ').length;
			if (words > maxPhraseWords) maxPhraseWords = words;
		}
	}
	return { byForm, maxPhraseWords: Math.min(maxPhraseWords, 3) };
}

export function getDictionaryIndex(): DictionaryIndex {
	if (!cachedIndex) cachedIndex = buildDictionaryIndex();
	return cachedIndex;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export type Importance = 'required' | 'nice-to-have';

export interface ExtractedKeyword {
	/** Canonical dictionary label. */
	label: string;
	section: SuggestSection;
	importance: Importance;
	/** How many times it appeared in the job description. */
	count: number;
	/** The surface forms actually seen, for display. */
	forms: string[];
}

/** Split text into lines/sentences so we can read the "required vs nice to have" context. */
export function splitSegments(text: string): string[] {
	return text
		.split(/[\n\r]+|(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Words strong enough to pull a line back to "required" even when it sits under a
 * "Nice to have" heading. Softer cues like "experience with" are deliberately excluded:
 * job ads use that phrasing inside nice-to-have lists all the time.
 */
const STRONG_REQUIRED_CUES = [
	'required',
	'requirement',
	'must have',
	'must be',
	'essential',
	'mandatory',
	'minimum'
];

function segmentImportance(segment: string, inheritedNice: boolean): Importance {
	const lower = segment.toLowerCase();

	// Under a nice-to-have heading, only an explicit mandatory word overrides inheritance.
	if (inheritedNice) {
		return STRONG_REQUIRED_CUES.some((cue) => lower.includes(cue)) ? 'required' : 'nice-to-have';
	}

	for (const cue of NICE_TO_HAVE_CUES) {
		if (lower.includes(cue)) return 'nice-to-have';
	}
	for (const cue of REQUIRED_CUES) {
		if (lower.includes(cue)) return 'required';
	}
	return 'required';
}

/**
 * A short line that names a requirement tier acts as a heading for the lines beneath it,
 * with or without a trailing colon ("Nice to have" and "Nice to have:" both count).
 */
function headingTier(segment: string): 'required' | 'nice-to-have' | null {
	const trimmed = segment.trim();
	if (trimmed.length > 80) return null;
	const lower = trimmed.toLowerCase().replace(/[:\u2013-]+$/, '').trim();
	// Headings are short phrases, not sentences.
	if (lower.split(/\s+/).length > 5) return null;
	if (NICE_TO_HAVE_CUES.some((cue) => lower === cue || lower.startsWith(cue))) {
		return 'nice-to-have';
	}
	if (
		['requirements', 'required', 'what you need', 'about you', 'qualifications', 'must have'].some(
			(cue) => lower === cue || lower.startsWith(cue)
		)
	) {
		return 'required';
	}
	return null;
}

/**
 * Extract dictionary keywords from a job description, with 1-3 word phrase detection and
 * required/nice-to-have weighting taken from the surrounding heading or sentence.
 */
export function extractKeywords(
	text: string,
	index: DictionaryIndex = getDictionaryIndex()
): ExtractedKeyword[] {
	const found = new Map<string, ExtractedKeyword>();
	if (!text || !text.trim()) return [];

	const segments = splitSegments(text);
	// A heading like "Nice to have:" applies to the bullets that follow it.
	let inheritedNice = false;

	for (const segment of segments) {
		// A tier heading switches the inherited importance for the lines beneath it.
		const tier = headingTier(segment);
		if (tier) inheritedNice = tier === 'nice-to-have';
		const importance = segmentImportance(segment, inheritedNice);

		const raw = tokenise(segment);
		const stems = raw.map(singularise);

		for (let i = 0; i < stems.length; i += 1) {
			// Prefer the longest phrase match starting here (3 -> 2 -> 1 words).
			for (let n = index.maxPhraseWords; n >= 1; n -= 1) {
				if (i + n > stems.length) continue;
				const key = stems.slice(i, i + n).join(' ');
				const entry = index.byForm.get(key);
				if (!entry) continue;
				// A single stop word on its own is never a keyword (e.g. "c" from a stray letter).
				if (n === 1 && STOP_WORDS.has(stems[i]) ) continue;
				const existing = found.get(entry.label);
				const surface = raw.slice(i, i + n).join(' ');
				if (existing) {
					existing.count += 1;
					// Required always wins over nice-to-have.
					if (importance === 'required') existing.importance = 'required';
					if (!existing.forms.includes(surface)) existing.forms.push(surface);
				} else {
					found.set(entry.label, {
						label: entry.label,
						section: entry.section,
						importance,
						count: 1,
						forms: [surface]
					});
				}
				i += n - 1; // consume the phrase
				break;
			}
		}
	}

	return [...found.values()].sort((a, b) => {
		if (a.importance !== b.importance) return a.importance === 'required' ? -1 : 1;
		if (b.count !== a.count) return b.count - a.count;
		return a.label.localeCompare(b.label);
	});
}

/**
 * Build the set of dictionary labels present in a body of text (used for the resume side).
 * Returns canonical labels so JS in the resume matches JavaScript in the job ad.
 */
export function labelsInText(
	text: string,
	index: DictionaryIndex = getDictionaryIndex()
): Set<string> {
	const labels = new Set<string>();
	if (!text) return labels;
	const raw = tokenise(text);
	const stems = raw.map(singularise);
	for (let i = 0; i < stems.length; i += 1) {
		for (let n = index.maxPhraseWords; n >= 1; n -= 1) {
			if (i + n > stems.length) continue;
			const key = stems.slice(i, i + n).join(' ');
			const entry = index.byForm.get(key);
			if (!entry) continue;
			if (n === 1 && STOP_WORDS.has(stems[i])) continue;
			labels.add(entry.label);
			i += n - 1;
			break;
		}
	}
	return labels;
}

/** Every surface form (lowercased) that maps to a canonical label - used for highlighting. */
export function formsForLabel(
	label: string,
	entries: SkillEntry[] = SKILL_DICTIONARY
): string[] {
	const entry = entries.find((e) => e.label === label);
	if (!entry) return [label.toLowerCase()];
	return [entry.label, ...(entry.aliases ?? [])].map((f) => f.toLowerCase());
}

/** Count how often each content word repeats - feeds the "repeated word" health check. */
export function wordFrequencies(text: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const token of contentTokens(text)) {
		const stem = singularise(token);
		counts.set(stem, (counts.get(stem) ?? 0) + 1);
	}
	return counts;
}
