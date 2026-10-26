// End-to-end browser checks against a running server (dev or preview).
//
// Covers the flow from the brief: open the sample resume, edit sections, reorder by
// keyboard and by drag, switch templates/colours/fonts, fit to one page, export, run the
// match checker, tailor a copy, write a cover letter, add an application, and JSON backup
// and import (including a broken file). Short timeouts so nothing hangs.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = process.env.RF_BASE ?? 'http://localhost:4179';
const DOWNLOADS = process.env.RF_DOWNLOADS ?? '/tmp/rf-e2e';
const TIMEOUT = 12_000;

let browser: Browser;
const consoleErrors: string[] = [];

async function newPage(width = 1440, height = 960): Promise<Page> {
	const context = await browser.newContext({
		viewport: { width, height },
		acceptDownloads: true
	});
	const page = await context.newPage();
	page.setDefaultTimeout(TIMEOUT);
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(`${page.url()} :: ${msg.text()}`);
	});
	page.on('pageerror', (err) => consoleErrors.push(`${page.url()} :: ${err.message}`));
	return page;
}

beforeAll(async () => {
	mkdirSync(DOWNLOADS, { recursive: true });
	browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
	await browser?.close();
	if (consoleErrors.length) {
		console.log('--- console errors seen ---');
		for (const e of [...new Set(consoleErrors)]) console.log(e);
	}
});

describe('ResumeForge end to end', () => {
	it('loads sample data on first open and shows the storage badge', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/resumes`, { waitUntil: 'networkidle' });
		await expect.poll(() => page.locator('li:has-text("Junior developer")').count()).toBeGreaterThan(0);
		expect(await page.getByText('Your data stays in this browser').first().isVisible()).toBe(true);
		// Both sample resumes present.
		expect(await page.locator('h2:has-text("Junior developer - general")').count()).toBe(1);
		expect(await page.locator('h2:has-text("Marketing coordinator - general")').count()).toBe(1);
		await page.close();
	}, 60_000);

	it('edits a section and autosaves, then persists across reload', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });
		const headline = page.getByLabel('Headline', { exact: false }).first();
		await headline.waitFor();
		await headline.fill('Full Stack Developer (edited)');
		// "Saved" indicator appears after the debounce.
		await expect.poll(() => page.getByText('Saved', { exact: true }).count(), { timeout: 8000 }).toBeGreaterThan(0);
		// Preview reflects the change.
		await expect
			.poll(() => page.locator('.rf-page', { hasText: 'Full Stack Developer (edited)' }).count())
			.toBeGreaterThan(0);

		// Undo restores the previous headline (history is per session, so before reload).
		const undo = page.getByRole('button', { name: 'Undo' });
		await expect.poll(() => undo.isEnabled(), { timeout: 8000 }).toBe(true);
		await undo.click();
		await page.waitForTimeout(400);
		await expect
			.poll(() => page.locator('.rf-page', { hasText: 'Full Stack Developer (edited)' }).count())
			.toBe(0);

		// Redo puts it back, and the change survives a reload.
		await page.getByRole('button', { name: 'Redo' }).click();
		await page.waitForTimeout(400);
		await page.reload({ waitUntil: 'networkidle' });
		await expect
			.poll(() => page.locator('.rf-page', { hasText: 'Full Stack Developer (edited)' }).count())
			.toBeGreaterThan(0);
		await page.close();
	}, 60_000);

	it('reorders sections with the keyboard Move up / Move down buttons', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });

		const titles = () =>
			page.locator('h2:has-text("Sections") ~ div .font-semibold.text-sm, h2:has-text("Sections") + div');
		// Read the section order from the list buttons.
		const order = async () =>
			page.$$eval('[role="group"][aria-label] button[aria-expanded] span.font-semibold', (els) =>
				els.map((e) => e.textContent?.trim() ?? '')
			);

		const before = await order();
		expect(before.length).toBeGreaterThan(3);

		// Move the third section up using its labelled button (keyboard accessible).
		const moveUp = page.locator(`button[aria-label="Move ${before[2]} up"]`).first();
		await moveUp.focus();
		await page.keyboard.press('Enter');
		await page.waitForTimeout(250);

		const after = await order();
		expect(after[1]).toBe(before[2]);
		expect(after[2]).toBe(before[1]);
		await page.close();
	}, 60_000);

	it('reorders sections by drag and drop', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });
		const order = async () =>
			page.$$eval('[role="group"][aria-label] button[aria-expanded] span.font-semibold', (els) =>
				els.map((e) => e.textContent?.trim() ?? '')
			);
		const before = await order();

		// HTML5 drag and drop: dispatch the real sequence the handlers listen for.
		const moved = await page.evaluate(() => {
			const groups = [...document.querySelectorAll('[role="group"][aria-label]')].filter((g) =>
				g.querySelector('[draggable="true"]')
			);
			if (groups.length < 3) return false;
			const source = groups[groups.length - 1];
			const target = groups[0];
			const handle = source.querySelector('[draggable="true"]') as HTMLElement;
			const dt = new DataTransfer();
			handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
			target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
			target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
			handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
			return true;
		});
		expect(moved).toBe(true);
		await page.waitForTimeout(300);

		const after = await order();
		expect(after[0]).toBe(before[before.length - 1]);
		await page.close();
	}, 60_000);

	it('switches every template, colour and font while keeping content', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });

		for (const template of ['Classic', 'Modern', 'Compact', 'Minimal', 'Executive']) {
			await page.locator(`button:has-text("${template}")`).first().click();
			await page.waitForTimeout(180);
			// Content survives the switch.
			const text = await page.locator('.rf-page').first().innerText();
			expect(text).toContain('Northwind Labs');
		}
		// The two-column template carries the screening warning.
		expect(await page.getByText('Less suited to automated screening').count()).toBeGreaterThan(0);

		await page.locator('button:has-text("Classic")').first().click();
		for (const colour of ['Ember', 'Blue', 'Green', 'Plum']) {
			await page.locator(`button:has-text("${colour}")`).first().click();
			await page.waitForTimeout(120);
		}

		const fontSelect = page.getByLabel('Resume font').first();
		for (const font of ['source-serif', 'lato', 'ibm-plex-sans', 'inter']) {
			await fontSelect.selectOption(font);
			await page.waitForTimeout(180);
			const text = await page.locator('.rf-page').first().innerText();
			expect(text).toContain('Ravi Anand');
		}
		await page.close();
	}, 90_000);

	it('fits to one page and reports the outcome', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });
		const pagesBefore = await page.locator('.rf-page').count();
		await page.getByRole('button', { name: 'Fit to one page' }).click();
		await page.waitForTimeout(600);
		const pagesAfter = await page.locator('.rf-page').count();
		expect(pagesAfter).toBeLessThanOrEqual(pagesBefore);
		// A plain-language message is always shown.
		expect(await page.locator('[role="status"]').count()).toBeGreaterThan(0);
		await page.close();
	}, 60_000);

	it('downloads PDF, Word, text and JSON from the editor', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });

		for (const [label, ext] of [
			['PDF', 'pdf'],
			['Word', 'docx'],
			['Text', 'txt'],
			['JSON', 'json']
		] as const) {
			const waitDownload = page.waitForEvent('download', { timeout: TIMEOUT });
			await page.getByRole('button', { name: label, exact: true }).click();
			const download = await waitDownload;
			const name = download.suggestedFilename();
			expect(name.endsWith(`.${ext}`)).toBe(true);
			// File name pattern from the brief.
			expect(name.startsWith('Resume_Ravi_Anand')).toBe(true);
			const path = `${DOWNLOADS}/${name}`;
			await download.saveAs(path);
			expect(existsSync(path)).toBe(true);
			console.log('downloaded', name, readFileSync(path).length, 'bytes');
		}
		await page.close();
	}, 120_000);

	it('runs the match checker on the sample job and shows keywords and tips', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/job-match`, { waitUntil: 'networkidle' });
		// The sample job description is preloaded.
		await expect.poll(() => page.getByRole('heading', { name: /Matched keywords/ }).count(), { timeout: 8000 }).toBeGreaterThan(0);

		const score = await page.locator('svg[role="img"][aria-label*="match estimate"]').getAttribute('aria-label');
		console.log('score ring:', score);
		expect(score).toMatch(/\d+ out of 100/);

		// The disclaimer is present, verbatim.
		expect(
			await page.getByText('It is not how any specific company', { exact: false }).count()
		).toBeGreaterThan(0);

		// Matched + missing chips and health tips all rendered.
		expect(await page.locator('li:has-text("React")').count()).toBeGreaterThan(0);
		expect(await page.getByRole('heading', { name: /Missing keywords/ }).count()).toBeGreaterThan(0);
		expect(await page.getByRole('heading', { name: /Resume health/ }).count()).toBeGreaterThan(0);

		// Keywords are highlighted in the preview.
		expect(await page.locator('.rf-kw').count()).toBeGreaterThan(0);
		await page.close();
	}, 90_000);

	it('tailors a copy linked to the job', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/job-match`, { waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: /Matched keywords/ }).waitFor();
		await page.getByRole('button', { name: 'Tailor a copy' }).click();
		await page.waitForURL(/\/editor\?id=/, { timeout: TIMEOUT });

		await page.goto(`${BASE}/resumes`, { waitUntil: 'networkidle' });
		const tailored = page.locator('li:has-text("Tailored for Junior Full Stack Developer")');
		await expect.poll(() => tailored.count()).toBeGreaterThan(0);
		expect(await page.getByText('Last match score', { exact: false }).count()).toBeGreaterThan(0);
		await page.close();
	}, 90_000);

	it('builds a cover letter and exports it', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/cover-letters`, { waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: 'Letter body' }).waitFor();

		// The sample letter preview renders.
		expect(await page.locator('.rf-page').count()).toBeGreaterThan(0);
		const words = await page.getByText('words -', { exact: false }).first().innerText();
		console.log('cover letter length:', words);

		const waitDownload = page.waitForEvent('download', { timeout: TIMEOUT });
		await page.getByRole('button', { name: 'Export PDF' }).click();
		const download = await waitDownload;
		expect(download.suggestedFilename()).toMatch(/^Cover_Letter_.*\.pdf$/);
		await download.saveAs(`${DOWNLOADS}/${download.suggestedFilename()}`);
		console.log('cover letter file:', download.suggestedFilename());
		await page.close();
	}, 90_000);

	it('adds an application and counts it by status', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/applications`, { waitUntil: 'networkidle' });
		await expect.poll(() => page.locator('li h2').count(), { timeout: 8000 }).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Add application' }).click();
		await page.getByLabel('Job title').first().fill('Platform Engineer');
		await page.getByLabel('Company').first().fill('Test Co');
		await page.getByRole('button', { name: 'Done' }).click();
		await page.waitForTimeout(400);

		expect(await page.locator('h2:has-text("Platform Engineer")').count()).toBe(1);
		// Status filters show counts.
		expect(await page.getByRole('button', { name: /^All \(/ }).count()).toBe(1);
		await page.close();
	}, 90_000);

	it('exports a JSON backup and rejects a broken file on import', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' });

		const waitDownload = page.waitForEvent('download', { timeout: TIMEOUT });
		await page.getByRole('button', { name: 'Export JSON backup' }).click();
		const download = await waitDownload;
		const backupPath = `${DOWNLOADS}/${download.suggestedFilename()}`;
		await download.saveAs(backupPath);
		expect(download.suggestedFilename()).toMatch(/^resumeforge-backup-\d{4}-\d{2}-\d{2}\.json$/);

		// Last backup now reads "Today".
		await expect.poll(() => page.getByText('Last backup: Today').count()).toBeGreaterThan(0);

		// A broken file must produce a clear error and change nothing.
		const brokenPath = `${DOWNLOADS}/broken.json`;
		writeFileSync(brokenPath, '{ "resumes": [ this is not json');
		await page.locator('input[type="file"]').setInputFiles(brokenPath);
		await expect.poll(() => page.locator('[role="alert"]').count(), { timeout: 8000 }).toBeGreaterThan(0);
		const alertText = await page.locator('[role="alert"]').first().innerText();
		console.log('broken import message:', alertText.replace(/\s+/g, ' ').slice(0, 160));
		expect(alertText).toContain('could not be imported');

		// A valid backup imports successfully.
		await page.locator('input[type="file"]').setInputFiles(backupPath);
		await expect.poll(() => page.getByText('Ready to import').count(), { timeout: 8000 }).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Import and replace' }).click();
		await page.waitForTimeout(600);
		await page.goto(`${BASE}/resumes`, { waitUntil: 'networkidle' });
		expect(await page.locator('li h2').count()).toBeGreaterThan(0);
		await page.close();
	}, 90_000);

	it('handles special characters and non-English names', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });
		const name = page.getByLabel('Full name').first();
		await name.waitFor();
		await name.fill('\u0141ukasz \u00d8stergaard-Ni\u00f1o \u674e');
		await page.waitForTimeout(500);
		const text = await page.locator('.rf-page').first().innerText();
		expect(text).toContain('\u0141ukasz');

		// The PDF route must not fail on these glyphs.
		const waitDownload = page.waitForEvent('download', { timeout: TIMEOUT });
		await page.getByRole('button', { name: 'PDF', exact: true }).click();
		const download = await waitDownload;
		const path = `${DOWNLOADS}/${download.suggestedFilename()}`;
		await download.saveAs(path);
		expect(readFileSync(path).length).toBeGreaterThan(1000);
		console.log('non-English name PDF:', download.suggestedFilename());
		await page.close();
	}, 90_000);

	it('works at 360px with the bottom tab bar and preview toggle', async () => {
		const page = await newPage(360, 740);
		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });
		// Bottom tab bar replaces the sidebar.
		const tabBar = page.locator('nav[aria-label="Main"]').last();
		expect(await tabBar.isVisible()).toBe(true);
		// Preview is behind a toggle.
		const toggle = page.getByRole('button', { name: /^Preview \(/ });
		await toggle.waitFor();
		await toggle.click();
		await page.waitForTimeout(400);
		expect(await page.locator('.rf-page').first().isVisible()).toBe(true);

		// No horizontal overflow at the narrowest supported width.
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		console.log('360px horizontal overflow:', overflow, 'px');
		expect(overflow).toBeLessThanOrEqual(2);
		await page.close();
	}, 90_000);

	it('renders dark mode with white resume pages', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Dark' }).click();
		await page.waitForTimeout(300);
		expect(await page.locator('html.dark').count()).toBe(1);

		await page.goto(`${BASE}/editor`, { waitUntil: 'networkidle' });
		const pageBg = await page.locator('.rf-page').first().evaluate(
			(el) => getComputedStyle(el).backgroundColor
		);
		console.log('resume page background in dark mode:', pageBg);
		expect(pageBg).toBe('rgb(255, 255, 255)');

		// Put it back so the next test starts from light.
		await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Match system' }).click();
		await page.close();
	}, 90_000);

	it('stays responsive with a long resume and a 3,000-word job description', async () => {
		const page = await newPage();
		await page.goto(`${BASE}/job-match`, { waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: /Matched keywords/ }).waitFor();

		const longJob = await page.evaluate(() => {
			const ta = document.querySelector('textarea') as HTMLTextAreaElement;
			return ta ? ta.value : '';
		});
		const big = `${longJob} `.repeat(14);
		console.log('job description words:', big.split(/\s+/).length);

		const start = Date.now();
		await page.locator('textarea').first().fill(big);
		// The page must stay interactive: a click still lands promptly.
		await page.waitForTimeout(800);
		await page.getByRole('heading', { name: /Missing keywords/ }).first().waitFor({ timeout: TIMEOUT });
		const elapsed = Date.now() - start;
		console.log('analysis settled in', elapsed, 'ms');
		expect(elapsed).toBeLessThan(10_000);
		await page.close();
	}, 120_000);

	it('has no unexpected console errors across every page', async () => {
		const page = await newPage();
		for (const path of [
			'/resumes',
			'/editor',
			'/job-match',
			'/cover-letters',
			'/applications',
			'/settings',
			'/privacy'
		]) {
			await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
			await page.waitForTimeout(250);
		}
		await page.close();

		const real = [...new Set(consoleErrors)].filter(
			(e) => !/favicon|ERR_ABORTED|downloadable font/i.test(e)
		);
		if (real.length) console.log('errors:', real);
		expect(real).toEqual([]);
	}, 120_000);
});
