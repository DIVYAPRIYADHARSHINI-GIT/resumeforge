<script lang="ts">
	// Job match checker. Everything runs in this browser against the bundled dictionary -
	// no AI service and no network request.

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '#lib/store/app-state.svelte';
	import { matchResume, SCORE_DISCLAIMER } from '#lib/logic/score';
	import { checkResumeHealth } from '#lib/logic/health';
	import { layoutResume } from '#lib/logic/layout';
	import { formsForLabel } from '#lib/logic/keywords';
	import { cloneResume, uid } from '#lib/logic/factory';
	import { ACTION_VERBS } from '#lib/logic/dictionary';
	import { relativeDayLabel } from '#lib/logic/dates';
	import ScoreRing from '#lib/components/ScoreRing.svelte';
	import ResumePreview from '#lib/components/ResumePreview.svelte';

	const resumes = $derived(app.data.resumes);

	let selectedId = $state('');
	let jobText = $state('');
	let jobTitle = $state('');
	let jobCompany = $state('');
	let showVerbs = $state(false);
	let highlightOn = $state(true);

	// Seed from the query string and the sample job on first load.
	$effect(() => {
		if (!app.loaded) return;
		if (!selectedId) {
			selectedId = page.url.searchParams.get('resume') ?? resumes[0]?.id ?? '';
		}
		if (!jobText && app.data.jobDescriptions.length) {
			const sample = app.data.jobDescriptions[0];
			jobText = sample.text;
			jobTitle = sample.title;
			jobCompany = sample.company;
		}
	});

	const resume = $derived(app.getResume(selectedId));

	// Debounce the analysis so a long paste never blocks typing.
	let debouncedJob = $state('');
	$effect(() => {
		const text = jobText;
		const timer = setTimeout(() => {
			debouncedJob = text;
		}, 250);
		return () => clearTimeout(timer);
	});

	const result = $derived(
		resume && debouncedJob.trim() ? matchResume(resume, debouncedJob) : null
	);

	const pageCount = $derived(resume ? layoutResume(resume).pageCount : 0);
	const health = $derived(resume ? checkResumeHealth(resume, { pageCount }) : null);

	// Highlight every matched keyword's surface forms inside the preview.
	const highlights = $derived.by(() => {
		if (!highlightOn || !result) return [];
		return result.matched.flatMap((m) => formsForLabel(m.label));
	});

	const jobWordCount = $derived(jobText.trim().split(/\s+/).filter(Boolean).length);

	function tailorCopy() {
		if (!resume || !result) return;
		const label = jobTitle.trim() || 'this job';
		const copy = cloneResume(resume, `${resume.name} - ${label}`);
		copy.tag = resume.tag;
		copy.targetRole = jobTitle.trim() || resume.targetRole;
		copy.linkedJob = {
			title: jobTitle.trim() || 'Untitled role',
			company: jobCompany.trim(),
			date: new Date().toISOString(),
			descriptionId: null
		};
		// Seed the history with the score the original scored against this job, so the user
		// can watch it improve as they edit the copy.
		copy.scoreHistory = [
			{
				date: new Date().toISOString(),
				score: result.score,
				matched: result.matched.length,
				missing: result.missing.length
			}
		];
		app.addResume(copy);

		// Keep the job description so the tailored version can be re-checked later.
		if (jobText.trim()) {
			app.addJobDescription({
				id: uid('job'),
				title: jobTitle.trim() || 'Untitled role',
				company: jobCompany.trim(),
				text: jobText,
				createdAt: new Date().toISOString()
			});
		}

		app.pushToast('Tailored copy created. Edit it, then re-check the score.', 'good');
		goto(`/editor?id=${copy.id}`);
	}

	function recordScore() {
		if (!resume || !result) return;
		app.updateResume(resume.id, (r) => {
			r.scoreHistory = [
				...r.scoreHistory,
				{
					date: new Date().toISOString(),
					score: result.score,
					matched: result.matched.length,
					missing: result.missing.length
				}
			];
		});
		app.pushToast('Score saved to this version\u2019s history.', 'good');
	}

	const controlStyle =
		'background: var(--surface); border: 1px solid var(--border); color: var(--text)';
</script>

<div class="mx-auto max-w-6xl p-4 md:p-6">
	<h1 class="text-2xl font-semibold tracking-tight">Job match</h1>
	<p class="mt-1 text-sm" style="color: var(--text-muted)">
		Paste a job description to see which keywords your resume already covers. All analysis runs in
		this browser.
	</p>

	{#if resumes.length === 0}
		<div class="surface-card mt-5 p-8 text-center">
			<h2 class="text-lg font-semibold">No resume to check</h2>
			<p class="mx-auto mt-2 max-w-md text-sm" style="color: var(--text-muted)">
				Create a resume first, or load the sample data from Settings.
			</p>
			<a
				href="/resumes"
				class="tap mt-4 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
				style="background: var(--color-ember)">Go to Resumes</a
			>
		</div>
	{:else}
		<div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div class="min-w-0 space-y-4">
				<!-- Inputs -->
				<section class="surface-card p-4">
					<div class="grid gap-3 sm:grid-cols-3">
						<label class="block text-sm sm:col-span-3">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
								Resume to check
							</span>
							<select class="tap w-full rounded-lg px-3 py-2 text-sm" style={controlStyle} bind:value={selectedId}>
								{#each resumes as r (r.id)}
									<option value={r.id}>{r.name}</option>
								{/each}
							</select>
						</label>
						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
								Job title (optional)
							</span>
							<input class="tap w-full rounded-lg px-3 py-2 text-sm" style={controlStyle} bind:value={jobTitle} />
						</label>
						<label class="block text-sm sm:col-span-2">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
								Company (optional)
							</span>
							<input class="tap w-full rounded-lg px-3 py-2 text-sm" style={controlStyle} bind:value={jobCompany} />
						</label>
					</div>

					<label class="mt-3 block text-sm">
						<span class="mb-1 flex justify-between text-xs font-medium" style="color: var(--text-muted)">
							<span>Job description</span>
							<span>{jobWordCount} words</span>
						</span>
						<textarea
							rows="10"
							class="w-full resize-y rounded-lg px-3 py-2 text-sm"
							style={controlStyle}
							placeholder="Paste the full job description here..."
							bind:value={jobText}
						></textarea>
					</label>

					<div class="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							class="tap rounded-lg px-4 py-2 text-sm font-medium"
							style={controlStyle}
							onclick={() => {
								jobText = '';
								jobTitle = '';
								jobCompany = '';
							}}
						>
							Clear
						</button>
						{#if result}
							<button
								type="button"
								class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
								style="background: var(--color-ember)"
								onclick={tailorCopy}
							>
								Tailor a copy
							</button>
							<button
								type="button"
								class="tap rounded-lg px-4 py-2 text-sm font-medium"
								style={controlStyle}
								onclick={recordScore}
							>
								Save this score
							</button>
						{/if}
					</div>
				</section>

				{#if result}
					<!-- Keywords -->
					<section class="surface-card p-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<h2 class="text-base font-semibold">
								Matched keywords ({result.matched.length})
							</h2>
							<label class="flex items-center gap-2 text-xs">
								<input type="checkbox" class="h-4 w-4" bind:checked={highlightOn} />
								Highlight in preview
							</label>
						</div>
						<ul class="mt-3 flex flex-wrap gap-1.5">
							{#each result.matched as kw (kw.label)}
								<li
									class="rounded-full px-2.5 py-1 text-xs font-medium"
									style="background: #e8f6ea; color: #1d6b28"
									title="{kw.importance === 'required' ? 'Required' : 'Nice to have'} - appears {kw.count} time{kw.count === 1 ? '' : 's'}"
								>
									{kw.label}{kw.importance === 'required' ? ' *' : ''}
								</li>
							{:else}
								<li class="text-sm" style="color: var(--text-muted)">
									No dictionary keywords from this job appear in the resume yet.
								</li>
							{/each}
						</ul>
						<p class="mt-2 text-xs" style="color: var(--text-muted)">
							* marks a keyword the job lists as required rather than nice to have.
						</p>
					</section>

					<section class="surface-card p-4">
						<h2 class="text-base font-semibold">Missing keywords ({result.missing.length})</h2>
						<p class="mt-1 text-xs" style="color: var(--text-muted)">
							Only add a keyword if it is genuinely true of you. Never add a skill you do not have.
						</p>
						<ul class="mt-3 space-y-2">
							{#each result.missing as kw (kw.label)}
								<li
									class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-sm"
									style="background: var(--surface-sunken)"
								>
									<span class="font-medium">{kw.label}</span>
									{#if kw.importance === 'required'}
										<span
											class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
											style="background: #ffe3e3; color: #a51111">Required</span
										>
									{:else}
										<span
											class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
											style="background: var(--panel); color: var(--text-muted)">Nice to have</span
										>
									{/if}
									<span class="w-full text-xs sm:w-auto sm:flex-1" style="color: var(--text-muted)">
										{kw.suggestion}
									</span>
								</li>
							{:else}
								<li class="text-sm" style="color: var(--text-muted)">
									Every keyword we found is already in your resume.
								</li>
							{/each}
						</ul>
					</section>

					<!-- Health -->
					{#if health}
						<section class="surface-card p-4">
							<h2 class="text-base font-semibold">
								Resume health ({health.passedChecks} of {health.totalChecks} checks passed)
							</h2>
							<ul class="mt-3 space-y-2">
								{#each health.issues as issue (issue.id)}
									<li
										class="rounded-lg p-3"
										style="background: var(--surface-sunken); border-left: 4px solid {issue.severity ===
										'problem'
											? 'var(--color-bad)'
											: 'var(--color-warn)'}"
									>
										<p class="text-sm font-semibold">
											<span
												class="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
												style="background: {issue.severity === 'problem'
													? '#ffe3e3'
													: '#fff4e6'}; color: {issue.severity === 'problem' ? '#a51111' : '#8a4b00'}"
											>
												{issue.severity === 'problem' ? 'Problem' : 'Tip'}
											</span>
											{issue.title}
										</p>
										<p class="mt-1 text-sm" style="color: var(--text-muted)">{issue.detail}</p>
										{#if issue.examples?.length}
											<ul class="mt-2 space-y-1 text-xs" style="color: var(--text-muted)">
												{#each issue.examples as example, i (i)}
													<li class="truncate">- {example}</li>
												{/each}
											</ul>
										{/if}
									</li>
								{:else}
									<li class="text-sm" style="color: var(--color-good)">
										Every check passed. Nothing to flag.
									</li>
								{/each}
							</ul>

							<button
								type="button"
								class="tap mt-3 rounded-lg px-4 py-2 text-sm font-medium"
								style={controlStyle}
								aria-expanded={showVerbs}
								onclick={() => (showVerbs = !showVerbs)}
							>
								{showVerbs ? 'Hide' : 'Show'} strong action verbs
							</button>
							{#if showVerbs}
								<div class="mt-2 max-h-48 overflow-y-auto rounded-lg p-3" style="background: var(--surface-sunken)">
									<p class="mb-2 text-xs" style="color: var(--text-muted)">
										Pick verbs to start your own bullets with. We do not write content for you.
									</p>
									<p class="text-sm leading-relaxed">{ACTION_VERBS.join(' \u00b7 ')}</p>
								</div>
							{/if}
						</section>
					{/if}
				{:else if resume}
					<section class="surface-card p-8 text-center">
						<h2 class="text-base font-semibold">Paste a job description to start</h2>
						<p class="mx-auto mt-2 max-w-md text-sm" style="color: var(--text-muted)">
							We will compare it against <strong>{resume.name}</strong> and show matched keywords,
							missing keywords and plain-language tips.
						</p>
					</section>
				{/if}
			</div>

			<!-- Right rail -->
			<div class="space-y-4">
				{#if result}
					<section class="surface-card p-4">
						<ScoreRing score={result.score} />
						<dl class="mt-3 space-y-1 text-xs" style="color: var(--text-muted)">
							<div class="flex justify-between">
								<dt>Required covered</dt>
								<dd class="font-medium">{result.requiredMatched} of {result.requiredTotal}</dd>
							</div>
							<div class="flex justify-between">
								<dt>Nice to have covered</dt>
								<dd class="font-medium">{result.niceMatched} of {result.niceTotal}</dd>
							</div>
							<div class="flex justify-between">
								<dt>Keywords found in the ad</dt>
								<dd class="font-medium">{result.totalKeywords}</dd>
							</div>
						</dl>
						<p
							class="mt-3 rounded-lg p-2.5 text-xs"
							style="background: var(--surface-sunken); color: var(--text-muted)"
						>
							{SCORE_DISCLAIMER}
						</p>
					</section>
				{/if}

				{#if resume?.scoreHistory.length}
					<section class="surface-card p-4">
						<h2 class="text-sm font-semibold">Score history</h2>
						<ul class="mt-2 space-y-1 text-xs">
							{#each resume.scoreHistory.slice().reverse() as entry, i (i)}
								<li class="flex justify-between">
									<span style="color: var(--text-muted)">{relativeDayLabel(entry.date)}</span>
									<span class="font-semibold tabular-nums">{entry.score}</span>
								</li>
							{/each}
						</ul>
						{#if resume.scoreHistory.length > 1}
							{@const first = resume.scoreHistory[0].score}
							{@const last = resume.scoreHistory[resume.scoreHistory.length - 1].score}
							<p class="mt-2 text-xs" style="color: var(--text-muted)">
								{last > first
									? `Up ${last - first} points since the first check.`
									: last < first
										? `Down ${first - last} points since the first check.`
										: 'No change since the first check.'}
							</p>
						{/if}
					</section>
				{/if}

				{#if resume}
					<section class="surface-card overflow-hidden p-3">
						<h2 class="mb-2 text-sm font-semibold">
							Preview{highlights.length ? ' with matches highlighted' : ''}
						</h2>
						<div class="max-h-[32rem] overflow-auto rounded-lg p-2" style="background: var(--surface-sunken)">
							<ResumePreview {resume} zoom={0.42} {highlights} />
						</div>
					</section>
				{/if}
			</div>
		</div>
	{/if}
</div>
