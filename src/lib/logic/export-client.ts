// Client-side export helpers: trigger downloads and call the two server routes.
// Plain text and JSON are produced entirely in the browser; only PDF and DOCX need a
// server route (that is the only server-side work in the whole app).

import type { CoverLetter, Resume } from '#lib/types';
import { resumeToBlocks } from './resume-text';
import { exportFileName, coverLetterFileName } from './filenames';

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	// Revoke on the next tick so Safari has time to start the download.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
	downloadBlob(new Blob([text], { type }), filename);
}

/** Plain-text resume: headings in caps, bullets with a dash. */
export function resumeToPlainTextExport(resume: Resume): string {
	const lines: string[] = [];
	for (const block of resumeToBlocks(resume)) {
		switch (block.kind) {
			case 'heading':
				lines.push('', block.text.toUpperCase(), '='.repeat(Math.min(60, block.text.length)));
				break;
			case 'subheading':
				lines.push('', block.text);
				break;
			case 'bullet':
				lines.push(`  - ${block.text}`);
				break;
			default:
				lines.push(block.text);
		}
	}
	return lines.join('\n').replace(/^\n+/, '').concat('\n');
}

function personalOf(resume: Resume) {
	const section = resume.sections.find((s) => s.items.type === 'personal');
	return section && section.items.type === 'personal' ? section.items.data : null;
}

/**
 * Export a resume as PDF.
 * Returns a warning when the chosen font had no glyph for some characters, so the caller
 * can tell the user rather than letting them discover "?" in the file.
 */
export async function exportResumePdf(resume: Resume): Promise<{ warning?: string }> {
	const response = await fetch('/api/export/pdf', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind: 'resume', resume })
	});
	if (!response.ok) {
		let message = `Export failed (${response.status}).`;
		try {
			const body = await response.json();
			if (body?.error) message = body.error;
		} catch {
			// keep the status message
		}
		throw new Error(message);
	}
	const blob = await response.blob();
	const personal = personalOf(resume);
	downloadBlob(blob, exportFileName(personal?.fullName ?? resume.name, resume.targetRole, 'pdf'));

	const raw = response.headers.get('X-Unsupported-Characters');
	if (raw) {
		const chars = decodeURIComponent(raw);
		return {
			warning: `The PDF font has no glyph for ${[...chars]
				.map((c) => `"${c}"`)
				.join(', ')}, so those characters show as "?". The bundled fonts cover European accents; for other scripts use "Print or save as PDF", which uses your system fonts.`
		};
	}
	return {};
}

export async function exportResumeDocx(resume: Resume): Promise<void> {
	const response = await fetch('/api/export/docx', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind: 'resume', resume })
	});
	if (!response.ok) {
		let message = `Export failed (${response.status}).`;
		try {
			const body = await response.json();
			if (body?.error) message = body.error;
		} catch {
			// keep the status message
		}
		throw new Error(message);
	}
	const blob = await response.blob();
	const personal = personalOf(resume);
	downloadBlob(blob, exportFileName(personal?.fullName ?? resume.name, resume.targetRole, 'docx'));
}

export function exportResumeText(resume: Resume) {
	const personal = personalOf(resume);
	downloadText(
		resumeToPlainTextExport(resume),
		exportFileName(personal?.fullName ?? resume.name, resume.targetRole, 'txt')
	);
}

export function exportResumeJson(resume: Resume) {
	const personal = personalOf(resume);
	downloadText(
		JSON.stringify(resume, null, 2),
		exportFileName(personal?.fullName ?? resume.name, resume.targetRole, 'json'),
		'application/json'
	);
}

// --- cover letters ----------------------------------------------------------

/**
 * A cover letter is rendered through the resume layout engine by synthesising a tiny
 * resume: the author's details as the personal section and the letter body as paragraphs.
 * That guarantees the letter's style matches the resume exactly.
 */
export function letterAsResume(letter: CoverLetter, source: Resume | null): Resume {
	const base: Resume = source
		? JSON.parse(JSON.stringify(source))
		: {
				id: letter.id,
				name: letter.name,
				tag: '',
				targetRole: letter.role,
				createdAt: letter.createdAt,
				updatedAt: letter.updatedAt,
				sections: [],
				page: {
					size: 'a4',
					marginTop: 20,
					marginBottom: 20,
					marginSide: 18,
					fontSize: 10.5,
					lineSpacing: 1.25,
					sectionSpacing: 6
				},
				style: { template: 'classic', font: 'inter', accent: '#E8590C', headingStyle: 'plain' },
				linkedJob: null,
				scoreHistory: []
			};

	const personalSection = base.sections.find((s) => s.items.type === 'personal');
	const personal =
		personalSection && personalSection.items.type === 'personal'
			? personalSection.items.data
			: {
					fullName: '',
					headline: '',
					email: '',
					phone: '',
					location: '',
					links: [],
					photo: null,
					showPhoto: false
				};

	// Letters read better with a little more leading than a resume.
	const paragraphs = letter.body
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

	return {
		...base,
		id: `${letter.id}-render`,
		name: letter.name,
		targetRole: letter.role,
		page: { ...base.page, lineSpacing: Math.max(base.page.lineSpacing, 1.25) },
		style: { ...base.style, headingStyle: 'plain' },
		sections: [
			{
				id: 'letter-personal',
				kind: 'personal',
				name: 'Personal details',
				hidden: false,
				items: { type: 'personal', data: { ...personal, headline: letter.role || personal.headline } }
			},
			{
				id: 'letter-body',
				kind: 'custom',
				name: '',
				hidden: false,
				items: {
					type: 'custom',
					entries: paragraphs.map((text, i) => ({
						id: `lp-${i}`,
						title: '',
						subtitle: text,
						date: { month: null, year: null },
						bullets: [],
						hidden: false
					}))
				}
			}
		]
	};
}

export async function exportLetterPdf(letter: CoverLetter, source: Resume | null): Promise<void> {
	const resume = letterAsResume(letter, source);
	const response = await fetch('/api/export/pdf', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind: 'cover-letter', resume, company: letter.company })
	});
	if (!response.ok) {
		let message = `Export failed (${response.status}).`;
		try {
			const body = await response.json();
			if (body?.error) message = body.error;
		} catch {
			// keep the status message
		}
		throw new Error(message);
	}
	const personal = personalOf(resume);
	downloadBlob(
		await response.blob(),
		coverLetterFileName(personal?.fullName ?? '', letter.company, 'pdf')
	);
}

export async function exportLetterDocx(letter: CoverLetter, source: Resume | null): Promise<void> {
	const personal = source ? personalOf(source) : null;
	const contact = [personal?.email, personal?.phone, personal?.location].filter(Boolean).join('  |  ');
	const response = await fetch('/api/export/docx', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			kind: 'cover-letter',
			letter: {
				name: letter.name,
				body: letter.body,
				contact,
				company: letter.company,
				accent: source?.style.accent ?? '#E8590C',
				authorName: personal?.fullName ?? ''
			}
		})
	});
	if (!response.ok) {
		let message = `Export failed (${response.status}).`;
		try {
			const body = await response.json();
			if (body?.error) message = body.error;
		} catch {
			// keep the status message
		}
		throw new Error(message);
	}
	downloadBlob(
		await response.blob(),
		coverLetterFileName(personal?.fullName ?? '', letter.company, 'docx')
	);
}

export function exportLetterText(letter: CoverLetter, source: Resume | null) {
	const personal = source ? personalOf(source) : null;
	downloadText(
		`${letter.body.trim()}\n`,
		coverLetterFileName(personal?.fullName ?? '', letter.company, 'txt')
	);
}
