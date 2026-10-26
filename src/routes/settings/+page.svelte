<script lang="ts">
	import { app } from '#lib/store/app-state.svelte';
	import { relativeDayLabel } from '#lib/logic/dates';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { resumeStore } from '#lib/store/resume-store';

	let confirmSample = $state(false);
	let confirmFresh = $state(false);

	const sizeBytes = $derived(app.loaded ? resumeStore.sizeOf(app.data) : 0);
	const sizeLabel = $derived(
		sizeBytes > 1024 * 1024
			? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
			: `${Math.round(sizeBytes / 1024)} KB`
	);

	const controlStyle =
		'background: var(--surface); border: 1px solid var(--border); color: var(--text)';
</script>

<div class="mx-auto max-w-3xl p-4 md:p-6">
	<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>

	<!-- Appearance -->
	<section class="surface-card mt-5 p-4">
		<h2 class="text-base font-semibold">Appearance</h2>
		<p class="mt-1 text-sm" style="color: var(--text-muted)">
			Dark mode applies to the interface. Resume pages always stay white like paper.
		</p>
		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Match system' }] as option (option.id)}
				<button
					type="button"
					class="tap rounded-lg px-4 py-2 text-sm font-medium"
					style={app.data.settings.theme === option.id
						? 'background: var(--color-ember); color: #fff'
						: controlStyle}
					aria-pressed={app.data.settings.theme === option.id}
					onclick={() => app.setTheme(option.id as 'light' | 'dark' | 'system')}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</section>

	<!-- Storage -->
	<section class="surface-card mt-4 p-4">
		<h2 class="text-base font-semibold">Storage</h2>
		<dl class="mt-3 space-y-1.5 text-sm">
			<div class="flex justify-between gap-4">
				<dt style="color: var(--text-muted)">Where your data lives</dt>
				<dd class="text-right font-medium">This browser only (localStorage)</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt style="color: var(--text-muted)">Current size</dt>
				<dd class="font-medium">{sizeLabel}</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt style="color: var(--text-muted)">Storage available</dt>
				<dd class="font-medium">{app.storageAvailable ? 'Yes' : 'Blocked by this browser'}</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt style="color: var(--text-muted)">Last backup</dt>
				<dd class="font-medium">{relativeDayLabel(app.data.settings.lastBackupAt)}</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt style="color: var(--text-muted)">Resumes / letters / applications</dt>
				<dd class="font-medium">
					{app.data.resumes.length} / {app.data.coverLetters.length} / {app.data.applications.length}
				</dd>
			</div>
		</dl>
		{#if !app.storageAvailable}
			<p
				class="mt-3 rounded-lg p-3 text-sm"
				style="background: #ffe3e3; color: #a51111"
				role="alert"
			>
				This browser is blocking local storage, so changes will not survive a reload. Export a JSON
				backup before you close the tab.
			</p>
		{/if}
		<a
			href="/privacy"
			class="tap mt-3 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
			style={controlStyle}
		>
			Privacy and backup
		</a>
	</section>

	<!-- Sample data -->
	<section class="surface-card mt-4 p-4">
		<h2 class="text-base font-semibold">Sample data</h2>
		<p class="mt-1 text-sm" style="color: var(--text-muted)">
			The sample content uses an invented person and invented companies. No real people, companies,
			email addresses or phone numbers are used.
		</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
				style="background: var(--color-ember)"
				onclick={() => (confirmSample = true)}
			>
				Load sample data
			</button>
			<button
				type="button"
				class="tap rounded-lg px-4 py-2 text-sm font-medium"
				style="border: 1px solid var(--border); color: var(--color-bad)"
				onclick={() => (confirmFresh = true)}
			>
				Start fresh
			</button>
		</div>
	</section>

	<!-- About -->
	<section class="surface-card mt-4 p-4">
		<h2 class="text-base font-semibold">About</h2>
		<p class="mt-1 text-sm" style="color: var(--text-muted)">
			ResumeForge - Build it. Tailor it. Land it. A free resume and cover letter builder with a job
			match checker that runs entirely in your browser. No accounts, no AI service, no tracking.
		</p>
		<p class="mt-2 text-sm" style="color: var(--text-muted)">
			The match score is an estimate based on keyword matching. It is not how any specific
			company&rsquo;s screening software scores resumes.
		</p>
	</section>
</div>

<ConfirmDialog
	open={confirmSample}
	title="Load sample data?"
	message="This replaces everything currently in this browser with the two sample resumes, sample job description, sample cover letter and six sample applications. Export a backup first if you want to keep your work."
	confirmLabel="Load sample data"
	tone="normal"
	onconfirm={() => {
		app.loadSampleData();
		app.pushToast('Sample data loaded.', 'good');
	}}
	oncancel={() => (confirmSample = false)}
/>

<ConfirmDialog
	open={confirmFresh}
	title="Start fresh?"
	message="This permanently deletes every resume, cover letter and application in this browser. This cannot be undone unless you have a backup."
	confirmLabel="Delete everything"
	onconfirm={() => {
		app.startFresh();
		app.pushToast('All data cleared. Starting fresh.', 'good');
	}}
	oncancel={() => (confirmFresh = false)}
/>
