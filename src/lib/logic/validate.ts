// JSON backup import validation.
//
// A backup file comes from the user's disk, so we treat it as hostile: validate the shape,
// coerce what is safely coercible, and return clear, specific errors otherwise. We never
// throw into the UI - callers get a result object.

import { DATA_VERSION, type AppData } from '#lib/types';

export interface ValidationError {
	path: string;
	message: string;
}

export type ValidationResult =
	| { ok: true; data: AppData; warnings: string[] }
	| { ok: false; errors: ValidationError[] };

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ''): string {
	return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback = false): boolean {
	return typeof v === 'boolean' ? v : fallback;
}

function arr(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

/**
 * Parse and validate a backup file's text.
 * Returns either normalised AppData or a list of errors suitable for showing in the UI.
 */
export function validateBackup(text: string): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: string[] = [];

	if (!text || !text.trim()) {
		return { ok: false, errors: [{ path: 'file', message: 'The file is empty.' }] };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown parse error';
		return {
			ok: false,
			errors: [
				{
					path: 'file',
					message: `This is not a valid JSON file. ${message}`
				}
			]
		};
	}

	if (!isObject(parsed)) {
		return {
			ok: false,
			errors: [
				{
					path: 'file',
					message: 'The file does not contain a ResumeForge backup object.'
				}
			]
		};
	}

	// Version: accept current and older, refuse newer (we cannot know its shape).
	const version = num(parsed.version, 0);
	if (version === 0) {
		warnings.push('No version field found - importing as version 1.');
	} else if (version > DATA_VERSION) {
		errors.push({
			path: 'version',
			message: `This backup was made by a newer version of ResumeForge (v${version}). Update the app and try again.`
		});
	}

	if (!Array.isArray(parsed.resumes)) {
		errors.push({
			path: 'resumes',
			message: 'Missing the "resumes" list. This may not be a ResumeForge backup.'
		});
	}

	if (errors.length) return { ok: false, errors };

	// --- normalise ---------------------------------------------------------
	const resumes = arr(parsed.resumes)
		.map((r, i) => normaliseResume(r, i, errors, warnings))
		.filter((r): r is AppData['resumes'][number] => r !== null);

	if (!resumes.length) {
		errors.push({
			path: 'resumes',
			message: 'The backup contains no readable resumes.'
		});
	}

	if (errors.length) return { ok: false, errors };

	const settingsRaw = isObject(parsed.settings) ? parsed.settings : {};
	const theme = str(settingsRaw.theme, 'system');

	const data: AppData = {
		version: DATA_VERSION,
		resumes,
		coverLetters: arr(parsed.coverLetters).map((c, i) => normaliseCoverLetter(c, i)),
		applications: arr(parsed.applications).map((a, i) => normaliseApplication(a, i)),
		jobDescriptions: arr(parsed.jobDescriptions).map((j, i) => normaliseJob(j, i)),
		settings: {
			theme: theme === 'light' || theme === 'dark' ? theme : 'system',
			defaultStyle: isObject(settingsRaw.defaultStyle)
				? (settingsRaw.defaultStyle as unknown as AppData['settings']['defaultStyle'])
				: null,
			lastBackupAt: typeof settingsRaw.lastBackupAt === 'string' ? settingsRaw.lastBackupAt : null,
			sampleDataLoaded: bool(settingsRaw.sampleDataLoaded, false)
		}
	};

	// Repair dangling references rather than failing the whole import.
	const resumeIds = new Set(data.resumes.map((r) => r.id));
	for (const letter of data.coverLetters) {
		if (letter.resumeId && !resumeIds.has(letter.resumeId)) {
			warnings.push(`Cover letter "${letter.name}" pointed at a missing resume - the link was cleared.`);
			letter.resumeId = null;
		}
	}
	for (const app of data.applications) {
		if (app.resumeId && !resumeIds.has(app.resumeId)) {
			warnings.push(`Application "${app.jobTitle}" pointed at a missing resume - the link was cleared.`);
			app.resumeId = null;
		}
	}

	return { ok: true, data, warnings };
}

function normaliseResume(
	raw: unknown,
	index: number,
	errors: ValidationError[],
	warnings: string[]
): AppData['resumes'][number] | null {
	if (!isObject(raw)) {
		warnings.push(`Resume ${index + 1} was not an object and was skipped.`);
		return null;
	}
	const id = str(raw.id) || `imported-${index + 1}-${Date.now()}`;
	const name = str(raw.name, `Imported resume ${index + 1}`);

	if (!Array.isArray(raw.sections)) {
		errors.push({
			path: `resumes[${index}].sections`,
			message: `Resume "${name}" has no sections list.`
		});
		return null;
	}

	const pageRaw = isObject(raw.page) ? raw.page : {};
	const styleRaw = isObject(raw.style) ? raw.style : {};
	const sizeStr = str(pageRaw.size, 'a4');
	const templateStr = str(styleRaw.template, 'classic');
	const fontStr = str(styleRaw.font, 'inter');
	const headingStr = str(styleRaw.headingStyle, 'rule');

	const validTemplates = ['classic', 'modern', 'compact', 'minimal', 'executive'];
	const validFonts = ['inter', 'source-serif', 'lato', 'ibm-plex-sans'];
	const validHeadings = ['plain', 'underline', 'rule', 'caps'];

	const now = new Date().toISOString();
	return {
		id,
		name,
		tag: str(raw.tag),
		targetRole: str(raw.targetRole),
		createdAt: str(raw.createdAt, now),
		updatedAt: str(raw.updatedAt, now),
		// Sections are kept as-is: the editor tolerates partial items and the renderer
		// skips anything it does not recognise.
		sections: arr(raw.sections).filter(
			isObject
		) as unknown as AppData['resumes'][number]['sections'],
		page: {
			size: sizeStr === 'letter' ? 'letter' : 'a4',
			marginTop: clamp(num(pageRaw.marginTop, 18), 8, 40),
			marginBottom: clamp(num(pageRaw.marginBottom, 18), 8, 40),
			marginSide: clamp(num(pageRaw.marginSide, 16), 8, 40),
			fontSize: clamp(num(pageRaw.fontSize, 10.5), 8, 16),
			lineSpacing: clamp(num(pageRaw.lineSpacing, 1.15), 0.9, 2),
			sectionSpacing: clamp(num(pageRaw.sectionSpacing, 6), 0, 30)
		},
		style: {
			template: (validTemplates.includes(templateStr)
				? templateStr
				: 'classic') as AppData['resumes'][number]['style']['template'],
			font: (validFonts.includes(fontStr)
				? fontStr
				: 'inter') as AppData['resumes'][number]['style']['font'],
			accent: /^#[0-9a-fA-F]{6}$/.test(str(styleRaw.accent)) ? str(styleRaw.accent) : '#E8590C',
			headingStyle: (validHeadings.includes(headingStr)
				? headingStr
				: 'rule') as AppData['resumes'][number]['style']['headingStyle']
		},
		linkedJob: isObject(raw.linkedJob)
			? {
					title: str(raw.linkedJob.title),
					company: str(raw.linkedJob.company),
					date: str(raw.linkedJob.date, now),
					descriptionId: typeof raw.linkedJob.descriptionId === 'string' ? raw.linkedJob.descriptionId : null
				}
			: null,
		scoreHistory: arr(raw.scoreHistory)
			.filter(isObject)
			.map((h) => ({
				date: str(h.date, now),
				score: clamp(num(h.score, 0), 0, 100),
				matched: Math.max(0, num(h.matched, 0)),
				missing: Math.max(0, num(h.missing, 0))
			}))
	};
}

function normaliseCoverLetter(raw: unknown, index: number): AppData['coverLetters'][number] {
	const o = isObject(raw) ? raw : {};
	const now = new Date().toISOString();
	const pointsRaw = arr(o.points).map((p) => str(p));
	const tone = str(o.tone, 'formal');
	return {
		id: str(o.id) || `imported-letter-${index + 1}-${Date.now()}`,
		name: str(o.name, `Imported cover letter ${index + 1}`),
		resumeId: typeof o.resumeId === 'string' ? o.resumeId : null,
		recipient: str(o.recipient),
		company: str(o.company),
		role: str(o.role),
		source: str(o.source),
		points: [pointsRaw[0] ?? '', pointsRaw[1] ?? '', pointsRaw[2] ?? ''],
		tone: (tone === 'friendly' || tone === 'concise' ? tone : 'formal') as 'formal' | 'friendly' | 'concise',
		body: str(o.body),
		createdAt: str(o.createdAt, now),
		updatedAt: str(o.updatedAt, now)
	};
}

function normaliseApplication(raw: unknown, index: number): AppData['applications'][number] {
	const o = isObject(raw) ? raw : {};
	const now = new Date().toISOString();
	const status = str(o.status, 'saved');
	const valid = ['saved', 'applied', 'interview', 'offer', 'rejected'];
	return {
		id: str(o.id) || `imported-app-${index + 1}-${Date.now()}`,
		jobTitle: str(o.jobTitle, 'Untitled role'),
		company: str(o.company),
		link: str(o.link),
		dateApplied: /^\d{4}-\d{2}-\d{2}$/.test(str(o.dateApplied)) ? str(o.dateApplied) : '',
		status: (valid.includes(status) ? status : 'saved') as AppData['applications'][number]['status'],
		resumeId: typeof o.resumeId === 'string' ? o.resumeId : null,
		notes: str(o.notes),
		createdAt: str(o.createdAt, now)
	};
}

function normaliseJob(raw: unknown, index: number): AppData['jobDescriptions'][number] {
	const o = isObject(raw) ? raw : {};
	return {
		id: str(o.id) || `imported-job-${index + 1}-${Date.now()}`,
		title: str(o.title, 'Untitled job'),
		company: str(o.company),
		text: str(o.text),
		createdAt: str(o.createdAt, new Date().toISOString())
	};
}

function clamp(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v));
}
