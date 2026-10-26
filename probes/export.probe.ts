// Dev-only probe (not part of the unit suite): posts the sample resume to the running dev
// server's export routes and saves the real PDF/DOCX bytes for inspection.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildSampleData } from '#lib/logic/sample-data';
import { layoutResume } from '#lib/logic/layout';

const base = process.env.RF_BASE ?? 'http://localhost:5179';
const outDir = process.env.RF_OUT ?? '/tmp/rf-verify';

describe('export routes (live dev server)', () => {
	it('produces a PDF and a DOCX for the sample resume', async () => {
		mkdirSync(outDir, { recursive: true });
		const data = buildSampleData();
		const resume = data.resumes[0];
		console.log('expected pages from layout engine:', layoutResume(resume).pageCount);

		const pdfRes = await fetch(`${base}/api/export/pdf`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ kind: 'resume', resume })
		});
		console.log('PDF', pdfRes.status, pdfRes.headers.get('content-type'));
		console.log('PDF pages header:', pdfRes.headers.get('x-page-count'));
		console.log('PDF disposition:', pdfRes.headers.get('content-disposition'));
		if (!pdfRes.ok) console.log(await pdfRes.text());
		expect(pdfRes.status).toBe(200);
		writeFileSync(`${outDir}/resume.pdf`, Buffer.from(await pdfRes.arrayBuffer()));

		const docxRes = await fetch(`${base}/api/export/docx`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ kind: 'resume', resume })
		});
		console.log('DOCX', docxRes.status, docxRes.headers.get('content-type'));
		console.log('DOCX disposition:', docxRes.headers.get('content-disposition'));
		if (!docxRes.ok) console.log(await docxRes.text());
		expect(docxRes.status).toBe(200);
		writeFileSync(`${outDir}/resume.docx`, Buffer.from(await docxRes.arrayBuffer()));
	}, 60000);
});
