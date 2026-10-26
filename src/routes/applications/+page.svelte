<script lang="ts">
	import { app } from '#lib/store/app-state.svelte';
	import { uid } from '#lib/logic/factory';
	import { formatLocalISODate, todayLocalISODate } from '#lib/logic/dates';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import type { Application, ApplicationStatus } from '#lib/types';

	const STATUSES: { id: ApplicationStatus; label: string; colour: string }[] = [
		{ id: 'saved', label: 'Saved', colour: '#6b7785' },
		{ id: 'applied', label: 'Applied', colour: '#2F6FE8' },
		{ id: 'interview', label: 'Interview', colour: '#C47F0A' },
		{ id: 'offer', label: 'Offer', colour: '#2F9E44' },
		{ id: 'rejected', label: 'Rejected', colour: '#C92A2A' }
	];

	let deleteId = $state<string | null>(null);
	let filter = $state<'all' | ApplicationStatus>('all');
	let editingId = $state<string | null>(null);

	const applications = $derived(app.data.applications);
	const counts = $derived.by(() => {
		const out: Record<string, number> = { all: applications.length };
		for (const s of STATUSES) out[s.id] = applications.filter((a) => a.status === s.id).length;
		return out;
	});
	const visible = $derived(
		filter === 'all' ? applications : applications.filter((a) => a.status === filter)
	);

	function add() {
		const application: Application = {
			id: uid('app'),
			jobTitle: '',
			company: '',
			link: '',
			// Local date, never a UTC timestamp, so the day never shifts.
			dateApplied: todayLocalISODate(),
			status: 'saved',
			resumeId: app.data.resumes[0]?.id ?? null,
			notes: '',
			createdAt: new Date().toISOString()
		};
		app.addApplication(application);
		editingId = application.id;
	}

	function statusOf(id: ApplicationStatus) {
		return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
	}

	const controlStyle =
		'background: var(--surface); border: 1px solid var(--border); color: var(--text)';
</script>

<div class="mx-auto max-w-5xl p-4 md:p-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Applications</h1>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">
				A light list of where you have applied and what happened.
			</p>
		</div>
		<button
			type="button"
			class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
			style="background: var(--color-ember)"
			onclick={add}
		>
			Add application
		</button>
	</div>

	<!-- Summary by status -->
	<div class="mt-4 flex flex-wrap gap-1.5">
		<button
			type="button"
			class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
			style={filter === 'all' ? 'background: var(--color-ink); color: #fff' : controlStyle}
			aria-pressed={filter === 'all'}
			onclick={() => (filter = 'all')}
		>
			All ({counts.all})
		</button>
		{#each STATUSES as status (status.id)}
			<button
				type="button"
				class="tap flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
				style={filter === status.id ? `background: ${status.colour}; color: #fff` : controlStyle}
				aria-pressed={filter === status.id}
				onclick={() => (filter = status.id)}
			>
				<span
					class="inline-block h-2 w-2 rounded-full"
					style="background: {filter === status.id ? '#fff' : status.colour}"
					aria-hidden="true"
				></span>
				{status.label} ({counts[status.id]})
			</button>
		{/each}
	</div>

	{#if applications.length === 0}
		<div class="surface-card mt-5 p-8 text-center">
			<h2 class="text-lg font-semibold">No applications tracked yet</h2>
			<p class="mx-auto mt-2 max-w-md text-sm" style="color: var(--text-muted)">
				Add a role to keep track of where you applied, which resume you used, and what happened.
			</p>
		</div>
	{:else if visible.length === 0}
		<p class="mt-5 text-sm" style="color: var(--text-muted)">
			No applications with that status.
		</p>
	{:else}
		<ul class="mt-5 space-y-2">
			{#each visible as application (application.id)}
				{@const status = statusOf(application.status)}
				{@const resume = app.getResume(application.resumeId)}
				<li class="surface-card p-4">
					{#if editingId === application.id}
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="block text-sm">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Job title</span>
								<input
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									value={application.jobTitle}
									oninput={(e) =>
										app.updateApplication(application.id, (a) => {
											a.jobTitle = (e.currentTarget as HTMLInputElement).value;
										})}
								/>
							</label>
							<label class="block text-sm">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Company</span>
								<input
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									value={application.company}
									oninput={(e) =>
										app.updateApplication(application.id, (a) => {
											a.company = (e.currentTarget as HTMLInputElement).value;
										})}
								/>
							</label>
							<label class="block text-sm sm:col-span-2">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Link</span>
								<input
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									placeholder="https://..."
									value={application.link}
									oninput={(e) =>
										app.updateApplication(application.id, (a) => {
											a.link = (e.currentTarget as HTMLInputElement).value;
										})}
								/>
							</label>
							<label class="block text-sm">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Date applied</span>
								<input
									type="date"
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									value={application.dateApplied}
									oninput={(e) =>
										app.updateApplication(application.id, (a) => {
											a.dateApplied = (e.currentTarget as HTMLInputElement).value;
										})}
								/>
							</label>
							<label class="block text-sm">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Status</span>
								<select
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									value={application.status}
									onchange={(e) =>
										app.updateApplication(application.id, (a) => {
											a.status = (e.currentTarget as HTMLSelectElement).value as ApplicationStatus;
										})}
								>
									{#each STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
								</select>
							</label>
							<label class="block text-sm sm:col-span-2">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
									Resume version used
								</span>
								<select
									class="tap w-full rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									value={application.resumeId ?? ''}
									onchange={(e) =>
										app.updateApplication(application.id, (a) => {
											const v = (e.currentTarget as HTMLSelectElement).value;
											a.resumeId = v || null;
										})}
								>
									<option value="">Not recorded</option>
									{#each app.data.resumes as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
								</select>
							</label>
							<label class="block text-sm sm:col-span-2">
								<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Notes</span>
								<textarea
									rows="3"
									class="w-full resize-y rounded-lg px-3 py-2 text-sm"
									style={controlStyle}
									value={application.notes}
									oninput={(e) =>
										app.updateApplication(application.id, (a) => {
											a.notes = (e.currentTarget as HTMLTextAreaElement).value;
										})}
								></textarea>
							</label>
						</div>
						<div class="mt-3 flex gap-2">
							<button
								type="button"
								class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
								style="background: var(--color-ink)"
								onclick={() => (editingId = null)}
							>
								Done
							</button>
							<button
								type="button"
								class="tap ml-auto rounded-lg px-4 py-2 text-sm font-medium"
								style="border: 1px solid var(--border); color: var(--color-bad)"
								onclick={() => (deleteId = application.id)}
							>
								Delete
							</button>
						</div>
					{:else}
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div class="min-w-0">
								<h2 class="truncate text-base font-semibold">
									{application.jobTitle || 'Untitled role'}
								</h2>
								<p class="truncate text-sm" style="color: var(--text-muted)">
									{application.company || 'No company'}
								</p>
							</div>
							<span
								class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
								style="background: {status.colour}"
							>
								{status.label}
							</span>
						</div>

						<dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style="color: var(--text-muted)">
							{#if application.dateApplied}
								<div class="flex gap-1">
									<dt>Applied</dt>
									<dd class="font-medium">{formatLocalISODate(application.dateApplied)}</dd>
								</div>
							{/if}
							{#if resume}
								<div class="flex gap-1"><dt>Resume</dt><dd class="font-medium">{resume.name}</dd></div>
							{/if}
							{#if application.link}
								<a
									href={application.link}
									target="_blank"
									rel="noopener noreferrer"
									class="font-medium underline underline-offset-2"
								>
									Open posting
								</a>
							{/if}
						</dl>

						{#if application.notes}
							<p class="mt-2 text-sm" style="color: var(--text)">{application.notes}</p>
						{/if}

						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
								style={controlStyle}
								onclick={() => (editingId = application.id)}
							>
								Edit
							</button>
							<select
								class="tap rounded-lg px-3 py-1.5 text-sm"
								style={controlStyle}
								value={application.status}
								aria-label="Change status for {application.jobTitle}"
								onchange={(e) =>
									app.updateApplication(application.id, (a) => {
										a.status = (e.currentTarget as HTMLSelectElement).value as ApplicationStatus;
									})}
							>
								{#each STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
							</select>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ConfirmDialog
	open={deleteId !== null}
	title="Delete this application?"
	message="It will be removed from this browser."
	confirmLabel="Delete"
	onconfirm={() => {
		if (deleteId) {
			app.removeApplication(deleteId);
			app.pushToast('Application deleted.', 'good');
			editingId = null;
		}
		deleteId = null;
	}}
	oncancel={() => (deleteId = null)}
/>
