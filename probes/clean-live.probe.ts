// Pre/post-deploy gate: a first-time visitor to the LIVE site must see sample data only.
// Enumerates every stored record so nothing can hide.
import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';

const BASE = process.env.RF_BASE ?? 'https://resumeforge-teal.vercel.app';

describe('live site opens with sample data only', () => {
	it('contains no development or test records', async () => {
		const browser = await chromium.launch();
		const page = await browser.newPage(); // fresh profile = empty localStorage
		page.setDefaultTimeout(15_000);
		await page.goto(`${BASE}/resumes`, { waitUntil: 'networkidle' });
		await page.locator('li h2').first().waitFor();

		const d = await page.evaluate(() => JSON.parse(localStorage.getItem('resumeforge:data:v1')!));

		console.log('RESUMES:');
		for (const r of d.resumes) console.log(`  - "${r.name}" | tag=${r.tag} | linkedJob=${r.linkedJob ? 'YES' : 'none'} | scoreHistory=${r.scoreHistory.length}`);
		console.log('APPLICATIONS:');
		for (const a of d.applications) console.log(`  - "${a.jobTitle}" @ ${a.company} [${a.status}] ${a.dateApplied}`);
		console.log('COVER LETTERS:');
		for (const c of d.coverLetters) console.log(`  - "${c.name}"`);
		console.log('JOB DESCRIPTIONS:');
		for (const j of d.jobDescriptions) console.log(`  - "${j.title}" @ ${j.company}`);

		// Exact expected shape.
		expect(d.resumes).toHaveLength(2);
		expect(d.applications).toHaveLength(6);
		expect(d.coverLetters).toHaveLength(1);
		expect(d.jobDescriptions).toHaveLength(1);

		// Every name I typed during manual and automated testing.
		const blob = JSON.stringify(d);
		for (const junk of [
			'Platform Engineer', 'Test Co', '(edited)', 'Untitled resume',
			'Untitled cover letter', 'test note', 'Tailored for', 'Full Stack Developer (edited)',
			'\u0141ukasz', '\u00d8stergaard', 'copy)'
		]) {
			expect(blob, `leaked test record: ${junk}`).not.toContain(junk);
		}

		// No tailored copies, and no fabricated contact details.
		expect(d.resumes.filter((r: { linkedJob: unknown }) => r.linkedJob)).toHaveLength(0);
		for (const email of blob.match(/[\w.+-]+@[\w.-]+/g) ?? []) {
			expect(email.endsWith('@example.com')).toBe(true);
		}
		for (const phone of blob.match(/\+\d[\d ]{6,}/g) ?? []) {
			expect(phone).toContain('555');
		}
		// Sample flag set, backup never claimed.
		expect(d.settings.sampleDataLoaded).toBe(true);
		expect(d.settings.lastBackupAt).toBeNull();

		await browser.close();
	}, 90_000);
});
