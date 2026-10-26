<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '#lib/store/app-state.svelte';
	import { cloneResume, newResume } from '#lib/logic/factory';
	import { relativeDayLabel } from '#lib/logic/dates';
	import { layoutResume } from '#lib/logic/layout';
	import { resumeToPlainText } from '#lib/logic/resume-text';
	import { TEMPLATES } from '#lib/logic/layout';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import type { Resume } from '#lib/types';

	let deleteTarget = $state<Resume | null>(null);
	let renameTarget = $state<Resume | null>(null);
	let renameValue = $state('');
	let renameTag = $state('');

	// Simple text compare of two versions.
	let compareA = $state('');
	let compareB = $state('');
	let showCompare = $state(false);

	const resumes = $derived(app.data.resumes);

	function create() {
		const resume = newResume('Untitled resume');
		app.addResume(resume);
		app.pushToast('New resume created.', 'good');
		goto(`/editor?id=${resume.id}`);
	}

	function duplicate(resume: Resume) {
		const copy = cloneResume(resume, `${resume.name} (copy)`);
		copy.tag = resume.tag;
		app.addResume(copy);
		app.pushToast('Resume duplicated.', 'good');
	}

	function openRename(resume: Resume) {
		renameTarget = resume;
		renameValue = resume.name;
		renameTag = resume.tag;
	}

	function commitRename() {
		if (!renameTarget) return;
		const id = renameTarget.id;
		const name = renameValue.trim() || 'Untitled resume';
		const tag = renameTag.trim();
		app.updateResume(id, (r) => {
			r.name = name;
			r.tag = tag;
		});
		renameTarget = null;
		app.pushToast('Resume renamed.', 'good');
	}

	function confirmDelete() {
		if (!deleteTarget) return;
		app.removeResume(deleteTarget.id);
		app.pushToast('Resume deleted.', 'good');
		deleteTarget = null;
	}

	function pageCount(resume: Resume): number {
		try {
			return layoutResume(resume).pageCount;
		} catch {
			return 1;
		}
	}

	function nameOf(resume: Resume): string {
		const section = resume.sections.find((s) => s.items.type === 'personal');
		return section && section.items.type === 'personal' ? section.items.data.fullName : '';
	}

	// Line-level diff for the compare view.
	const comparison = $derived.by(() => {
		const a = app.getResume(compareA);
		const b = app.getResume(compareB);
		if (!a || !b) return null;
		const linesA = resumeToPlainText(a).split('\n').filter(Boolean);
		const linesB = resumeToPlainText(b).split('\n').filter(Boolean);
		const setA = new Set(linesA);
		const setB = new Set(linesB);
		return {
			a,
			b,
			onlyA: linesA.filter((l) => !setB.has(l)),
			onlyB: linesB.filter((l) => !setA.has(l)),
			shared: linesA.filter((l) => setB.has(l)).length
		};
	});
</script>

<div class="mx-auto max-w-5xl p-4 md:p-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Resumes</h1>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">
				Your resume library. Everything here is stored only in this browser.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if resumes.length >= 2}
				<button
					type="button"
					class="tap rounded-lg px-4 py-2 text-sm font-medium"
					style="border: 1px solid var(--border); color: var(--text)"
					onclick={() => {
						showCompare = !showCompare;
						if (showCompare && !compareA) {
							compareA = resumes[0].id;
							compareB = resumes[1].id;
						}
					}}
					aria-expanded={showCompare}
				>
					Compare versions
				</button>
			{/if}
			<button
				type="button"
				class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
				style="background: var(--color-ember)"
				onclick={create}
			>
				New resume
			</button>
		</div>
	</div>

	{#if showCompare && resumes.length >= 2}
		<section class="surface-card mt-4 p-4">
			<h2 class="text-sm font-semibold">Compare two versions</h2>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="mb-1 block font-medium">Version A</span>
					<select
						bind:value={compareA}
						class="tap w-full rounded-lg px-3 py-2 text-sm"
						style="background: var(--surface-raised); border: 1px solid var(--border); color: var(--text)"
					>
						{#each resumes as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
					</select>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium">Version B</span>
					<select
						bind:value={compareB}
						class="tap w-full rounded-lg px-3 py-2 text-sm"
						style="background: var(--surface-raised); border: 1px solid var(--border); color: var(--text)"
					>
						{#each resumes as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
					</select>
				</label>
			</div>

			{#if comparison}
				{#if compareA === compareB}
					<p class="mt-3 text-sm" style="color: var(--text-muted)">
						Pick two different versions to see what changed.
					</p>
				{:else}
					<p class="mt-3 text-sm" style="color: var(--text-muted)">
						{comparison.shared} lines are identical.
					</p>
					<div class="mt-3 grid gap-3 sm:grid-cols-2">
						<div>
							<h3 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--text-muted)">
								Only in {comparison.a.name} ({comparison.onlyA.length})
							</h3>
							<ul class="mt-2 space-y-1 text-sm">
								{#each comparison.onlyA.slice(0, 20) as line, i (i)}
									<li class="rounded px-2 py-1" style="background: var(--surface-sunken)">{line}</li>
								{:else}
									<li style="color: var(--text-muted)">Nothing unique.</li>
								{/each}
							</ul>
						</div>
						<div>
							<h3 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--text-muted)">
								Only in {comparison.b.name} ({comparison.onlyB.length})
							</h3>
							<ul class="mt-2 space-y-1 text-sm">
								{#each comparison.onlyB.slice(0, 20) as line, i (i)}
									<li class="rounded px-2 py-1" style="background: var(--surface-sunken)">{line}</li>
								{:else}
									<li style="color: var(--text-muted)">Nothing unique.</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}
			{/if}
		</section>
	{/if}

	{#if !app.loaded}
		<div class="mt-5 grid gap-3 sm:grid-cols-2">
			{#each [1, 2] as n (n)}
				<div class="surface-card p-4">
					<div class="skeleton h-5 w-2/3"></div>
					<div class="skeleton mt-3 h-3 w-1/3"></div>
					<div class="skeleton mt-5 h-9 w-full"></div>
				</div>
			{/each}
		</div>
	{:else if resumes.length === 0}
		<div class="surface-card mt-5 p-8 text-center">
			<h2 class="text-lg font-semibold">No resumes yet</h2>
			<p class="mx-auto mt-2 max-w-md text-sm" style="color: var(--text-muted)">
				Create your first resume, or load the sample data from Settings to see how everything works
				with realistic content.
			</p>
			<div class="mt-5 flex flex-wrap justify-center gap-2">
				<button
					type="button"
					class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
					style="background: var(--color-ember)"
					onclick={create}
				>
					New resume
				</button>
				<a
					href="/settings"
					class="tap inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
					style="border: 1px solid var(--border); color: var(--text)"
				>
					Load sample data
				</a>
			</div>
		</div>
	{:else}
		<ul class="mt-5 grid gap-3 sm:grid-cols-2">
			{#each resumes as resume (resume.id)}
				{@const pages = pageCount(resume)}
				<li class="surface-card flex flex-col p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<h2 class="truncate text-base font-semibold">{resume.name}</h2>
							<p class="mt-0.5 truncate text-sm" style="color: var(--text-muted)">
								{nameOf(resume) || 'No name set'}{resume.targetRole ? ` - ${resume.targetRole}` : ''}
							</p>
						</div>
						{#if resume.tag}
							<span
								class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
								style="background: var(--color-ember-soft); color: #9a3412"
							>
								{resume.tag}
							</span>
						{/if}
					</div>

					<dl class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style="color: var(--text-muted)">
						<div class="flex gap-1"><dt>Edited</dt><dd class="font-medium">{relativeDayLabel(resume.updatedAt)}</dd></div>
						<div class="flex gap-1"><dt>Pages</dt><dd class="font-medium">{pages}</dd></div>
						<div class="flex gap-1"><dt>Template</dt><dd class="font-medium">{TEMPLATES[resume.style.template]?.label ?? 'Classic'}</dd></div>
					</dl>

					{#if resume.linkedJob}
						<p class="mt-2 text-xs" style="color: var(--text-muted)">
							Tailored for {resume.linkedJob.title}{resume.linkedJob.company
								? ` at ${resume.linkedJob.company}`
								: ''}
						</p>
					{/if}

					{#if resume.scoreHistory.length}
						<p class="mt-1 text-xs" style="color: var(--text-muted)">
							Last match score: <strong>{resume.scoreHistory[resume.scoreHistory.length - 1].score}</strong>
							{#if resume.scoreHistory.length > 1}
								(was {resume.scoreHistory[0].score})
							{/if}
						</p>
					{/if}

					<div class="mt-4 flex flex-wrap gap-2 border-t pt-3" style="border-color: var(--border)">
						<a
							href="/editor?id={resume.id}"
							class="tap inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
							style="background: var(--color-ink)"
						>
							Edit
						</a>
						<a
							href="/job-match?resume={resume.id}"
							class="tap inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium"
							style="border: 1px solid var(--border); color: var(--text)"
						>
							Job match
						</a>
						<button
							type="button"
							class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
							style="border: 1px solid var(--border); color: var(--text)"
							onclick={() => duplicate(resume)}
						>
							Duplicate
						</button>
						<button
							type="button"
							class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
							style="border: 1px solid var(--border); color: var(--text)"
							onclick={() => openRename(resume)}
						>
							Rename
						</button>
						<button
							type="button"
							class="tap ml-auto rounded-lg px-3 py-1.5 text-sm font-medium"
							style="border: 1px solid var(--border); color: var(--color-bad)"
							onclick={() => (deleteTarget = resume)}
						>
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if renameTarget}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-sm rounded-xl p-5" style="background: var(--surface-raised); border: 1px solid var(--border)">
			<h2 class="text-lg font-semibold">Rename resume</h2>
			<label class="mt-3 block text-sm">
				<span class="mb-1 block font-medium">Name</span>
				<input
					bind:value={renameValue}
					class="tap w-full rounded-lg px-3 py-2 text-sm"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text)"
				/>
			</label>
			<label class="mt-3 block text-sm">
				<span class="mb-1 block font-medium">Tag</span>
				<input
					bind:value={renameTag}
					placeholder="e.g. Software"
					class="tap w-full rounded-lg px-3 py-2 text-sm"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text)"
				/>
			</label>
			<div class="mt-5 flex justify-end gap-2">
				<button
					type="button"
					class="tap rounded-lg px-4 py-2 text-sm font-medium"
					style="border: 1px solid var(--border); color: var(--text)"
					onclick={() => (renameTarget = null)}>Cancel</button
				>
				<button
					type="button"
					class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
					style="background: var(--color-ember)"
					onclick={commitRename}>Save</button
				>
			</div>
		</div>
	</div>
{/if}

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete this resume?"
	message={`"${deleteTarget?.name ?? ''}" will be removed from this browser. This cannot be undone unless you have a backup.`}
	confirmLabel="Delete"
	onconfirm={confirmDelete}
	oncancel={() => (deleteTarget = null)}
/>
