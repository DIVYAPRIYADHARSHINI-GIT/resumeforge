// DOCX export route.
//
// The second and last server route. Stateless: the posted document is turned into a .docx
// and streamed straight back. Nothing is persisted or logged.

import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { contentDisposition } from '#lib/server/content-disposition';
import { buildDocxStructure, buildCoverLetterDocxStructure } from '#lib/logic/docx-structure';
import { renderDocx } from '#lib/server/docx';
import { coverLetterFileName, exportFileName } from '#lib/logic/filenames';
import { mmToPt } from '#lib/logic/measure';
import type { Resume } from '#lib/types';

interface DocxRequest {
	kind: 'resume' | 'cover-letter';
	resume?: Resume;
	/** Cover letter payload. */
	letter?: {
		name: string;
		body: string;
		contact: string;
		company: string;
		accent: string;
		authorName: string;
	};
}

export const POST: RequestHandler = async ({ request }) => {
	let payload: DocxRequest;
	try {
		payload = (await request.json()) as DocxRequest;
	} catch {
		throw error(400, 'Invalid request body.');
	}

	try {
		if (payload.kind === 'cover-letter') {
			const letter = payload.letter;
			if (!letter) throw error(400, 'No cover letter supplied.');
			const structure = buildCoverLetterDocxStructure(letter.name, letter.body, letter.contact);
			const bytes = await renderDocx(structure, {
				accent: letter.accent || '#E8590C',
				author: letter.authorName || 'ResumeForge',
				title: letter.name
			});
			const filename = coverLetterFileName(letter.authorName, letter.company, 'docx');
			return new Response(bytes as BodyInit, {
				headers: {
					'Content-Type':
						'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					'Content-Disposition': contentDisposition(filename),
					'Cache-Control': 'no-store'
				}
			});
		}

		const resume = payload.resume;
		if (!resume?.sections) throw error(400, 'No resume supplied.');

		const structure = buildDocxStructure(resume);
		const personal = resume.sections.find((s) => s.items.type === 'personal');
		const fullName =
			personal && personal.items.type === 'personal' ? personal.items.data.fullName : resume.name;

		const bytes = await renderDocx(structure, {
			accent: resume.style.accent,
			author: fullName || 'ResumeForge',
			title: `${fullName} - resume`,
			// Mirror the resume's own margins (twips = points * 20).
			marginTwips: Math.round(mmToPt(resume.page.marginSide) * 20)
		});

		const filename = exportFileName(fullName, resume.targetRole, 'docx');
		return new Response(bytes as BodyInit, {
			headers: {
				'Content-Type':
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': contentDisposition(filename),
				'Cache-Control': 'no-store'
			}
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		const message = e instanceof Error ? e.message : 'Unknown error';
		return json({ error: `Could not build the Word file: ${message}` }, { status: 500 });
	}
};
