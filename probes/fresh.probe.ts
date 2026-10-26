// Pre-deploy check: a brand-new browser profile must show ONLY the sample data, with no
// leftover test resumes, applications or notes from development.
import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';

const BASE = process.env.RF_BASE ?? 'http://localhost:4179';

describe('fresh install state', () => {
	it('shows only the intended sample data', async () => {
		const browser = await chromium.launch();
		// A new context = empty localStorage, exactly like a first-time visitor.
		const page = await browser.newPage();
		page.setDefaultTimeout(12_000);
		await page.goto(`${BASE}/resumes`, { waitUntil: 'networkidle' });
		await page.locator('li h2').first().waitFor();

		const data = await page.evaluate(() => {
			const raw = localStorage.getItem('resumeforge:data:v1');
			return raw ? JSON.parse(raw) : null;
		});

		console.log('resumes:', data.resumes.map((r: { name: string }) => r.name));
		console.log('applications:', data.applications.map((a: { jobTitle: string }) => a.jobTitle));
		console.log('cover letters:', data.coverLetters.map((c: { name: string }) => c.name));
		console.log('job descriptions:', data.jobDescriptions.map((j: { title: string }) => j.title));

		expect(data.resumes).toHaveLength(2);
		expect(data.applications).toHaveLength(6);
		expect(data.coverLetters).toHaveLength(1);
		expect(data.jobDescriptions).toHaveLength(1);

		// None of the names used during manual/e2e testing may appear.
		const blob = JSON.stringify(data);
		for (const junk of ['Platform Engineer', 'Test Co', '(edited)', 'Untitled resume', 'test note']) {
			expect(blob).not.toContain(junk);
		}
		// No real contact details.
		for (const email of blob.match(/[\w.+-]+@[\w.-]+/g) ?? []) {
			expect(email.endsWith('@example.com')).toBe(true);
		}
		// Tailored copies created during testing must not ship.
		expect(data.resumes.filter((r: { linkedJob: unknown }) => r.linkedJob)).toHaveLength(0);

		await browser.close();
	}, 60_000);
});
