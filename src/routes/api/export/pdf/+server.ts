// PDF export route.
//
// This is one of only two server routes in the app. It receives a resume (or cover letter)
// document in the request body, lays it out with the SAME engine the browser preview uses,
// and streams back a PDF. Nothing is stored or logged server-side - the request is
// stateless and the body is discarded when the response is sent.

import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { contentDisposition } from '#lib/server/content-disposition';
import { layoutResume } from '#lib/logic/layout';
import { renderLayoutToPdf } from '#lib/server/pdf';
import { exportFileName, coverLetterFileName } from '#lib/logic/filenames';
import type { Resume } from '#lib/types';

interface ResumePdfRequest {
	kind: 'resume';
	resume: Resume;
}

interface LetterPdfRequest {
	kind: 'cover-letter';
	/** A cover letter is rendered through a synthesised single-section resume. */
	resume: Resume;
	company: string;
}

type PdfRequest = ResumePdfRequest | LetterPdfRequest;

export const POST: RequestHandler = async ({ request }) => {
	let payload: PdfRequest;
	try {
		payload = (await request.json()) as PdfRequest;
	} catch {
		throw error(400, 'Invalid request body.');
	}

	if (!payload?.resume?.sections) {
		throw error(400, 'No resume supplied.');
	}

	const resume = payload.resume;

	try {
		const layout = layoutResume(resume);

		const personal = resume.sections.find((s) => s.items.type === 'personal');
		const fullName =
			personal && personal.items.type === 'personal' ? personal.items.data.fullName : resume.name;

		const { bytes, unsupportedCharacters } = await renderLayoutToPdf(layout, resume.style.font, {
			title: payload.kind === 'cover-letter' ? `Cover letter - ${fullName}` : `${fullName} - resume`,
			author: fullName || 'ResumeForge',
			subject: resume.targetRole || undefined
		});

		const filename =
			payload.kind === 'cover-letter'
				? coverLetterFileName(fullName, payload.company ?? '', 'pdf')
				: exportFileName(fullName, resume.targetRole, 'pdf');

		return new Response(bytes as BodyInit, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': contentDisposition(filename),
				'Cache-Control': 'no-store',
				'X-Page-Count': String(layout.pageCount),
				// The client surfaces this so the user is told rather than finding blank
				// boxes in the file. The bundled fonts cover Latin-1 + Latin Extended-A.
				...(unsupportedCharacters.length
					? { 'X-Unsupported-Characters': encodeURIComponent(unsupportedCharacters.join('')) }
					: {})
			}
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		// Surface a readable reason so the UI can tell the user to use Print instead.
		return json({ error: `Could not build the PDF: ${message}` }, { status: 500 });
	}
};
