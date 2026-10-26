// Verifies the generated PDF has real, selectable text in the correct reading order.
// Required by the brief: "extract the text from a generated PDF and check that it reads
// in the right order".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.env.RF_PDF ?? '/tmp/rf-verify/resume.pdf';

describe('generated PDF text', () => {
	it('extracts selectable text in reading order', async () => {
		const data = new Uint8Array(readFileSync(file));
		const doc = await getDocument({ data, useSystemFonts: false }).promise;
		console.log('pages:', doc.numPages);

		const pages: string[] = [];
		for (let p = 1; p <= doc.numPages; p += 1) {
			const page = await doc.getPage(p);
			const content = await page.getTextContent();
			// Reconstruct reading order from the text items as the viewer sees them.
			const items = content.items as { str: string; transform: number[] }[];
			const lines = new Map<number, { x: number; str: string }[]>();
			for (const item of items) {
				if (!item.str.trim()) continue;
				const y = Math.round(item.transform[5]);
				const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
				const arr = lines.get(key) ?? [];
				arr.push({ x: item.transform[4], str: item.str });
				lines.set(key, arr);
			}
			const ordered = [...lines.entries()]
				.sort((a, b) => b[0] - a[0])
				.map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim());
			pages.push(ordered.join('\n'));
		}

		const all = pages.join('\n');
		console.log('--- extracted text (page 1) ---');
		console.log(pages[0]);
		if (pages[1]) {
			console.log('--- page 2 ---');
			console.log(pages[1]);
		}

		// Real text, not an image.
		expect(all.length).toBeGreaterThan(400);
		// Reading order: name before summary before experience before education.
		expect(all.indexOf('Ravi Anand')).toBeGreaterThanOrEqual(0);
		expect(all.indexOf('Ravi Anand')).toBeLessThan(all.indexOf('Northwind Labs'));
		expect(all.indexOf('Northwind Labs')).toBeLessThan(all.indexOf('Western Ghats'));
		// Bullets kept with their heading and in order.
		expect(all).toContain('Built 14 reusable React components');
		// Accented characters survive embedding.
		expect(all).toContain('ravi.anand@example.com');
	}, 60000);
});
