<script lang="ts">
	import { app } from '#lib/store/app-state.svelte';
	import { newCoverLetter } from '#lib/logic/factory';
	import { buildLetterBody, countWords, ONE_PAGE_WORD_LIMIT } from '#lib/logic/cover-letter';
	import {
		exportLetterDocx,
		exportLetterPdf,
		exportLetterText,
		letterAsResume
	} from '#lib/logic/export-client';
	import ResumePreview from '#lib/components/ResumePreview.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { relativeDayLabel } from '#lib/logic/dates';
	import type { CoverLetterTone } from '#lib/types';

	let selectedId = $state('');
	let deleteId = $state<string | null>(null);
	let exporting = $state<string | null>(null);
	let showPreviewMobile = $state(false);

	const letters = $derived(app.data.coverLetters);
	const letter = $derived(letters.find((l) => l.id === selectedId) ?? letters[0] ?? null);
	const linkedResume = $derived(letter ? app.getResume(letter.resumeId) : null);

	$effect(() => {
		if (!selectedId && letters.length) selectedId = letters[0].id;
	});

	const personal = $derived.by(() => {
		const section = linkedResume?.sections.find((s) => s.items.type === 'personal');
		return section && section.items.type === 'personal'
			? section.items.data
			: { fullName: '', email: '', phone: '' };
	});

	const words = $derived(letter ? countWords(letter.body) : 0);
	const fitsOnePage = $derived(words <= ONE_PAGE_WORD_LIMIT);
	const previewResume = $derived(letter ? letterAsResume(letter, linkedResume) : null);

	function create() {
		const l = newCoverLetter('Untitled cover letter', app.data.resumes[0]?.id ?? null);
		app.addCoverLetter(l);
		selectedId = l.id;
		app.pushToast('Cover letter created.', 'good');
	}

	function regenerate() {
		if (!letter) return;
		const body = buildLetterBody(
			{
				recipient: letter.recipient,
				company: letter.company,
				role: letter.role,
				source: letter.source,
				points: [...letter.points],
				tone: letter.tone
			},
			{
				fullName: personal.fullName,
				email: personal.email,
				phone: personal.phone
			}
		);
		app.updateCoverLetter(letter.id, (l) => {
			l.body = body;
		});
		app.pushToast('Template text rebuilt from your fields. Edit it freely.', 'good');
	}

	async function doExport(kind: 'pdf' | 'docx' | 'txt') {
		if (!letter) return;
		exporting = kind;
		try {
			if (kind === 'pdf') await exportLetterPdf(letter, linkedResume);
			else if (kind === 'docx') await exportLetterDocx(letter, linkedResume);
			else exportLetterText(letter, linkedResume);
			app.pushToast(`${kind.toUpperCase()} downloaded.`, 'good');
		} catch (e) {
			app.pushToast(e instanceof Error ? e.message : 'Export failed.', 'bad');
		} finally {
			exporting = null;
		}
	}

	const controlStyle =
		'background: var(--surface); border: 1px solid var(--border); color: var(--text)';
	const TONES: { id: CoverLetterTone; label: string }[] = [
		{ id: 'formal', label: 'Formal' },
		{ id: 'friendly', label: 'Friendly' },
		{ id: 'concise', label: 'Concise' }
	];
</script>

<div class="mx-auto max-w-6xl p-4 md:p-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Cover letters</h1>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">
				Template text fills in automatically. Every line stays editable.
			</p>
		</div>
		<button
			type="button"
			class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
			style="background: var(--color-ember)"
			onclick={create}
		>
			New cover letter
		</button>
	</div>

	{#if letters.length === 0}
		<div class="surface-card mt-5 p-8 text-center">
			<h2 class="text-lg font-semibold">No cover letters yet</h2>
			<p class="mx-auto mt-2 max-w-md text-sm" style="color: var(--text-muted)">
				Create one and link it to a resume - it will reuse the same name and contact details.
			</p>
		</div>
	{:else if letter}
		{#if letters.length > 1}
			<div class="mt-4 flex flex-wrap gap-1.5">
				{#each letters as l (l.id)}
					<button
						type="button"
						class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
						style={l.id === letter.id
							? 'background: var(--color-ink); color: #fff'
							: controlStyle}
						aria-pressed={l.id === letter.id}
						onclick={() => (selectedId = l.id)}
					>
						{l.name}
					</button>
				{/each}
			</div>
		{/if}

		<button
			type="button"
			class="tap mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium md:hidden"
			style="background: var(--color-ink); color: #fff"
			onclick={() => (showPreviewMobile = !showPreviewMobile)}
		>
			{showPreviewMobile ? 'Back to editor' : 'Preview'}
		</button>

		<div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
			<div class="min-w-0 space-y-4 {showPreviewMobile ? 'hidden lg:block' : ''}">
				<section class="surface-card p-4">
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="block text-sm sm:col-span-2">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Letter name</span>
							<input
								class="tap w-full rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								value={letter.name}
								oninput={(e) =>
									app.updateCoverLetter(letter.id, (l) => {
										l.name = (e.currentTarget as HTMLInputElement).value;
									})}
							/>
						</label>

						<label class="block text-sm sm:col-span-2">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
								Linked resume (for your name and contact details)
							</span>
							<select
								class="tap w-full rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								value={letter.resumeId ?? ''}
								onchange={(e) =>
									app.updateCoverLetter(letter.id, (l) => {
										const v = (e.currentTarget as HTMLSelectElement).value;
										l.resumeId = v || null;
									})}
							>
								<option value="">Not linked</option>
								{#each app.data.resumes as r (r.id)}
									<option value={r.id}>{r.name}</option>
								{/each}
							</select>
						</label>

						{#each [{ key: 'recipient', label: 'Recipient', placeholder: 'Hiring Manager' }, { key: 'company', label: 'Company', placeholder: '' }, { key: 'role', label: 'Role', placeholder: '' }, { key: 'source', label: 'How you heard of the job', placeholder: 'your careers page' }] as field (field.key)}
							<label class="block text-sm">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
									{field.label}
								</span>
								<input
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									placeholder={field.placeholder}
									value={letter[field.key as 'recipient'] as string}
									oninput={(e) =>
										app.updateCoverLetter(letter.id, (l) => {
											(l as unknown as Record<string, string>)[field.key] = (
												e.currentTarget as HTMLInputElement
											).value;
										})}
								/>
							</label>
						{/each}
					</div>

					<div class="mt-3">
						<span class="mb-1.5 block text-xs font-medium" style="color: var(--text-muted)">Tone</span>
						<div class="flex flex-wrap gap-1.5">
							{#each TONES as tone (tone.id)}
								<button
									type="button"
									class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
									style={letter.tone === tone.id
										? 'background: var(--color-ember); color: #fff'
										: controlStyle}
									aria-pressed={letter.tone === tone.id}
									onclick={() =>
										app.updateCoverLetter(letter.id, (l) => {
											l.tone = tone.id;
										})}
								>
									{tone.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="mt-3 space-y-2">
						<span class="block text-xs font-medium" style="color: var(--text-muted)">
							Your three key points (in your own words)
						</span>
						{#each [0, 1, 2] as i (i)}
							<input
								class="tap w-full rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								placeholder="Key point {i + 1}"
								aria-label="Key point {i + 1}"
								value={letter.points[i]}
								oninput={(e) =>
									app.updateCoverLetter(letter.id, (l) => {
										const next = [...l.points] as [string, string, string];
										next[i] = (e.currentTarget as HTMLInputElement).value;
										l.points = next;
									})}
							/>
						{/each}
					</div>

					<button
						type="button"
						class="tap mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium"
						style={controlStyle}
						onclick={regenerate}
					>
						{letter.body.trim() ? 'Rebuild template text from these fields' : 'Generate template text'}
					</button>
					<p class="mt-1.5 text-xs" style="color: var(--text-muted)">
						Rebuilding replaces the letter body below. Placeholders such as
						<code>&#123;company&#125;</code> and <code>&#123;role&#125;</code> fill in automatically.
					</p>
				</section>

				<section class="surface-card p-4">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h2 class="text-sm font-semibold">Letter body</h2>
						<span
							class="text-xs font-medium"
							style="color: {fitsOnePage ? 'var(--color-good)' : 'var(--color-warn)'}"
						>
							{words} words -
							{fitsOnePage ? 'fits on one page' : `over one page (aim for ${ONE_PAGE_WORD_LIMIT})`}
						</span>
					</div>
					<textarea
						rows="18"
						class="mt-2 w-full resize-y rounded-lg px-3 py-2 text-sm leading-relaxed"
						style={controlStyle}
						value={letter.body}
						aria-label="Cover letter body"
						oninput={(e) =>
							app.updateCoverLetter(
								letter.id,
								(l) => {
									l.body = (e.currentTarget as HTMLTextAreaElement).value;
								},
								false
							)}
					></textarea>

					<div class="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
							style="background: var(--color-ember)"
							disabled={exporting !== null}
							onclick={() => doExport('pdf')}
						>
							{exporting === 'pdf' ? 'Building...' : 'Export PDF'}
						</button>
						<button
							type="button"
							class="tap rounded-lg px-4 py-2 text-sm font-medium"
							style={controlStyle}
							disabled={exporting !== null}
							onclick={() => doExport('docx')}
						>
							Word
						</button>
						<button
							type="button"
							class="tap rounded-lg px-4 py-2 text-sm font-medium"
							style={controlStyle}
							onclick={() => doExport('txt')}
						>
							Text
						</button>
						<button
							type="button"
							class="tap rounded-lg px-4 py-2 text-sm font-medium"
							style={controlStyle}
							onclick={() => window.print()}
						>
							Print
						</button>
						<button
							type="button"
							class="tap ml-auto rounded-lg px-4 py-2 text-sm font-medium"
							style="border: 1px solid var(--border); color: var(--color-bad)"
							onclick={() => (deleteId = letter.id)}
						>
							Delete
						</button>
					</div>
					<p class="mt-2 text-xs" style="color: var(--text-muted)">
						Last edited {relativeDayLabel(letter.updatedAt)}
					</p>
				</section>
			</div>

			<div class="{showPreviewMobile ? '' : 'hidden lg:block'}">
				<section class="surface-card overflow-hidden p-3">
					<h2 class="mb-2 text-sm font-semibold">Preview</h2>
					<div class="max-h-[40rem] overflow-auto rounded-lg p-2" style="background: var(--surface-sunken)">
						{#if previewResume}
							<ResumePreview resume={previewResume} zoom={0.52} />
						{/if}
					</div>
				</section>
			</div>
		</div>
	{/if}
</div>

<ConfirmDialog
	open={deleteId !== null}
	title="Delete this cover letter?"
	message="It will be removed from this browser. This cannot be undone unless you have a backup."
	confirmLabel="Delete"
	onconfirm={() => {
		if (deleteId) {
			app.removeCoverLetter(deleteId);
			app.pushToast('Cover letter deleted.', 'good');
			selectedId = '';
		}
		deleteId = null;
	}}
	oncancel={() => (deleteId = null)}
/>
