<script lang="ts">
	// The resume editor: section list + editor on the left, live preview on the right.
	// On mobile the two stack behind a Preview toggle.

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '#lib/store/app-state.svelte';
	import { newResume, newSection, SECTION_LABELS } from '#lib/logic/factory';
	import { moveDown, moveUp } from '#lib/logic/reorder';
	import { layoutResume, TEMPLATE_LIST, TEMPLATES } from '#lib/logic/layout';
	import { FONT_LABELS } from '#lib/logic/measure';
	import { fitToOnePage } from '#lib/logic/fit';
	import {
		exportResumeDocx,
		exportResumeJson,
		exportResumePdf,
		exportResumeText
	} from '#lib/logic/export-client';
	import SectionEditor from '#lib/components/SectionEditor.svelte';
	import ResumePreview from '#lib/components/ResumePreview.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import type { SectionKind } from '#lib/types';

	const ACCENTS = [
		{ hex: '#E8590C', name: 'Ember' },
		{ hex: '#1F2933', name: 'Charcoal' },
		{ hex: '#2F6FE8', name: 'Blue' },
		{ hex: '#2F9E44', name: 'Green' },
		{ hex: '#862E9C', name: 'Plum' },
		{ hex: '#C92A2A', name: 'Red' }
	];

	const HEADING_STYLES = [
		{ id: 'rule', label: 'Full rule' },
		{ id: 'underline', label: 'Short underline' },
		{ id: 'caps', label: 'Caps only' },
		{ id: 'plain', label: 'Plain' }
	] as const;

	// Resume selection comes from ?id=, falling back to the first in the library.
	const requestedId = $derived(page.url.searchParams.get('id'));
	const resume = $derived(app.getResume(requestedId) ?? app.data.resumes[0] ?? null);

	let openSectionId = $state<string | null>(null);
	let showPreviewMobile = $state(false);
	let zoom = $state(0.72);
	let addSectionKind = $state<SectionKind>('projects');
	let customName = $state('');
	let deleteSectionId = $state<string | null>(null);
	let exporting = $state<string | null>(null);
	let fitMessage = $state<string | null>(null);
	let sectionDrag = $state<number | null>(null);
	let sectionDrop = $state<number | null>(null);

	const layout = $derived(resume ? layoutResume(resume) : null);
	const pageCount = $derived(layout?.pageCount ?? 0);

	// Keep one section expanded by default so the editor is never empty-looking.
	$effect(() => {
		if (resume && openSectionId === null && resume.sections.length) {
			openSectionId = resume.sections[0].id;
		}
	});

	function createFirst() {
		const r = newResume('My resume');
		app.addResume(r);
		goto(`/editor?id=${r.id}`);
	}

	function updateSection(sectionId: string, mutate: (section: typeof s) => void) {
		if (!resume) return;
		const id = resume.id;
		app.updateResume(id, (r) => {
			const s = r.sections.find((x) => x.id === sectionId);
			if (s) mutate(s);
		});
	}
	// `s` is only used for typing above.
	let s: NonNullable<typeof resume>['sections'][number];

	function addSection() {
		if (!resume) return;
		const name = addSectionKind === 'custom' ? customName.trim() || 'Custom section' : undefined;
		const section = newSection(addSectionKind, name);
		app.updateResume(resume.id, (r) => {
			r.sections = [...r.sections, section];
		});
		openSectionId = section.id;
		customName = '';
		app.pushToast('Section added.', 'good');
	}

	function removeSection() {
		if (!resume || !deleteSectionId) return;
		const id = deleteSectionId;
		app.updateResume(resume.id, (r) => {
			r.sections = r.sections.filter((x) => x.id !== id);
		});
		deleteSectionId = null;
		app.pushToast('Section removed.', 'good');
	}

	function reorderSections(from: number, to: number) {
		if (!resume) return;
		app.updateResume(resume.id, (r) => {
			const copy = [...r.sections];
			const [m] = copy.splice(from, 1);
			copy.splice(to, 0, m);
			r.sections = copy;
		});
	}

	function runFit() {
		if (!resume) return;
		const result = fitToOnePage(resume);
		app.updateResume(resume.id, (r) => {
			r.page.fontSize = result.settings.fontSize;
			r.page.lineSpacing = result.settings.lineSpacing;
			r.page.sectionSpacing = result.settings.sectionSpacing;
		});
		fitMessage = result.message;
		app.pushToast(result.message, result.fits ? 'good' : 'warn');
	}

	async function doExport(kind: 'pdf' | 'docx' | 'txt' | 'json') {
		if (!resume) return;
		exporting = kind;
		try {
			if (kind === 'pdf') {
				const { warning } = await exportResumePdf(resume);
				app.pushToast('PDF downloaded.', 'good');
				// Tell the user about missing glyphs rather than letting them find "?" later.
				if (warning) app.pushToast(warning, 'warn');
				return;
			}
			if (kind === 'docx') await exportResumeDocx(resume);
			else if (kind === 'txt') exportResumeText(resume);
			else exportResumeJson(resume);
			app.pushToast(`${kind.toUpperCase()} downloaded.`, 'good');
		} catch (e) {
			app.pushToast(
				e instanceof Error
					? `${e.message} You can still use "Print or save as PDF".`
					: 'Export failed.',
				'bad'
			);
		} finally {
			exporting = null;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		const mod = event.metaKey || event.ctrlKey;
		if (!mod) return;
		if (event.key === 'z' && !event.shiftKey) {
			event.preventDefault();
			app.undo();
		} else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
			event.preventDefault();
			app.redo();
		}
	}

	const controlStyle =
		'background: var(--surface); border: 1px solid var(--border); color: var(--text)';
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !resume}
	<div class="mx-auto max-w-xl p-6 text-center">
		<h1 class="text-xl font-semibold">No resume to edit</h1>
		<p class="mt-2 text-sm" style="color: var(--text-muted)">
			Create a resume to get started, or load the sample data from Settings.
		</p>
		<button
			type="button"
			class="tap mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
			style="background: var(--color-ember)"
			onclick={createFirst}
		>
			New resume
		</button>
	</div>
{:else}
	<div class="flex h-full flex-col">
		<!-- Editor toolbar -->
		<div
			class="no-print flex flex-wrap items-center gap-2 border-b px-3 py-2"
			style="border-color: var(--border); background: var(--panel)"
		>
			<input
				class="tap min-w-0 max-w-[14rem] flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold"
				style={controlStyle}
				value={resume.name}
				aria-label="Resume name"
				oninput={(e) =>
					app.updateResume(resume.id, (r) => {
						r.name = (e.currentTarget as HTMLInputElement).value;
					})}
			/>
			<input
				class="tap w-32 rounded-lg px-3 py-1.5 text-sm"
				style={controlStyle}
				value={resume.targetRole}
				placeholder="Target role"
				aria-label="Target role, used in export file names"
				oninput={(e) =>
					app.updateResume(resume.id, (r) => {
						r.targetRole = (e.currentTarget as HTMLInputElement).value;
					})}
			/>

			<div class="flex items-center gap-1">
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm"
					style={controlStyle}
					disabled={!app.canUndo}
					onclick={() => app.undo()}
					title="Undo (Cmd/Ctrl+Z)"
				>
					Undo
				</button>
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm"
					style={controlStyle}
					disabled={!app.canRedo}
					onclick={() => app.redo()}
					title="Redo (Cmd/Ctrl+Shift+Z)"
				>
					Redo
				</button>
			</div>

			<div class="ml-auto flex flex-wrap items-center gap-1">
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
					style={controlStyle}
					onclick={runFit}
				>
					Fit to one page
				</button>
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
					style={controlStyle}
					onclick={() => window.print()}
				>
					Print or save as PDF
				</button>
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
					style="background: var(--color-ember)"
					disabled={exporting !== null}
					onclick={() => doExport('pdf')}
				>
					{exporting === 'pdf' ? 'Building...' : 'PDF'}
				</button>
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
					style={controlStyle}
					disabled={exporting !== null}
					onclick={() => doExport('docx')}
				>
					{exporting === 'docx' ? '...' : 'Word'}
				</button>
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
					style={controlStyle}
					onclick={() => doExport('txt')}
				>
					Text
				</button>
				<button
					type="button"
					class="tap rounded-lg px-3 py-1.5 text-sm font-medium"
					style={controlStyle}
					onclick={() => doExport('json')}
				>
					JSON
				</button>
			</div>

			<button
				type="button"
				class="tap w-full rounded-lg px-3 py-1.5 text-sm font-medium md:hidden"
				style="background: var(--color-ink); color: #fff"
				onclick={() => (showPreviewMobile = !showPreviewMobile)}
				aria-expanded={showPreviewMobile}
			>
				{showPreviewMobile ? 'Back to editor' : `Preview (${pageCount} page${pageCount === 1 ? '' : 's'})`}
			</button>
		</div>

		{#if fitMessage}
			<p
				class="no-print px-3 py-2 text-sm"
				style="background: var(--color-ember-soft); color: #7a3d02"
				role="status"
			>
				{fitMessage}
			</p>
		{/if}

		<div class="flex min-h-0 flex-1 flex-col md:flex-row">
			<!-- Left: sections -->
			<div
				class="no-print min-w-0 flex-1 overflow-y-auto p-3 md:max-w-[30rem] md:border-r {showPreviewMobile
					? 'hidden md:block'
					: ''}"
				style="border-color: var(--border)"
			>
				<!-- Style controls -->
				<details class="surface-card mb-3 p-3" open>
					<summary class="cursor-pointer text-sm font-semibold">Template and style</summary>

					<div class="mt-3 space-y-3">
						<div>
							<span class="mb-1.5 block text-xs font-medium" style="color: var(--text-muted)">
								Template
							</span>
							<div class="grid grid-cols-2 gap-1.5">
								{#each TEMPLATE_LIST as template (template.id)}
									<button
										type="button"
										class="tap rounded-lg px-2 py-2 text-left text-sm"
										style={resume.style.template === template.id
											? 'background: var(--color-ember); color: #fff'
											: controlStyle}
										aria-pressed={resume.style.template === template.id}
										onclick={() =>
											app.updateResume(resume.id, (r) => {
												r.style.template = template.id;
											})}
									>
										<span class="block font-medium">{template.label}</span>
										<span class="block text-[10px] opacity-80">
											{template.columns === 2 ? 'Two column' : 'Single column'}
										</span>
									</button>
								{/each}
							</div>
							{#if TEMPLATES[resume.style.template].atsNote}
								<p class="mt-1.5 text-xs font-medium" style="color: var(--color-warn)">
									{TEMPLATES[resume.style.template].atsNote}
								</p>
							{/if}
						</div>

						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">Font</span>
							<select
								class="tap w-full rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								aria-label="Resume font"
								value={resume.style.font}
								onchange={(e) =>
									app.updateResume(resume.id, (r) => {
										r.style.font = (e.currentTarget as HTMLSelectElement)
											.value as typeof r.style.font;
									})}
							>
								{#each Object.entries(FONT_LABELS) as [id, label] (id)}
									<option value={id}>{label}</option>
								{/each}
							</select>
						</label>

						<div>
							<span class="mb-1.5 block text-xs font-medium" style="color: var(--text-muted)">
								Accent colour
							</span>
							<div class="flex flex-wrap gap-1.5">
								{#each ACCENTS as accent (accent.hex)}
									<button
										type="button"
										class="tap rounded-lg px-2.5 py-1.5 text-xs font-medium"
										style="background: {accent.hex}; color: #fff; outline: {resume.style.accent ===
										accent.hex
											? '3px solid var(--text)'
											: 'none'}; outline-offset: 2px"
										aria-pressed={resume.style.accent === accent.hex}
										onclick={() =>
											app.updateResume(resume.id, (r) => {
												r.style.accent = accent.hex;
											})}
									>
										{accent.name}
									</button>
								{/each}
							</div>
						</div>

						<label class="block text-sm">
							<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
								Heading style
							</span>
							<select
								class="tap w-full rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								value={resume.style.headingStyle}
								onchange={(e) =>
									app.updateResume(resume.id, (r) => {
										r.style.headingStyle = (e.currentTarget as HTMLSelectElement)
											.value as typeof r.style.headingStyle;
									})}
							>
								{#each HEADING_STYLES as hs (hs.id)}
									<option value={hs.id}>{hs.label}</option>
								{/each}
							</select>
						</label>

						<button
							type="button"
							class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
							style={controlStyle}
							onclick={() => {
								app.saveDefaultStyle(resume.style);
								app.pushToast('Saved as your default style for new resumes.', 'good');
							}}
						>
							Save as my default style
						</button>
					</div>
				</details>

				<!-- Page setup -->
				<details class="surface-card mb-3 p-3">
					<summary class="cursor-pointer text-sm font-semibold">Page setup</summary>
					<div class="mt-3 grid gap-3 sm:grid-cols-2">
						<label class="block text-sm">
							<span class="mb-1 block text-xs" style="color: var(--text-muted)">Paper size</span>
							<select
								class="tap w-full rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								value={resume.page.size}
								onchange={(e) =>
									app.updateResume(resume.id, (r) => {
										r.page.size = (e.currentTarget as HTMLSelectElement).value as 'a4' | 'letter';
									})}
							>
								<option value="a4">A4</option>
								<option value="letter">US Letter</option>
							</select>
						</label>

						{#each [{ key: 'fontSize', label: 'Font size (pt)', min: 8, max: 16, step: 0.5 }, { key: 'lineSpacing', label: 'Line spacing', min: 0.9, max: 2, step: 0.05 }, { key: 'sectionSpacing', label: 'Section spacing (pt)', min: 0, max: 30, step: 1 }, { key: 'marginTop', label: 'Top margin (mm)', min: 8, max: 40, step: 1 }, { key: 'marginBottom', label: 'Bottom margin (mm)', min: 8, max: 40, step: 1 }, { key: 'marginSide', label: 'Side margins (mm)', min: 8, max: 40, step: 1 }] as field (field.key)}
							<label class="block text-sm">
								<span class="mb-1 flex justify-between text-xs" style="color: var(--text-muted)">
									<span>{field.label}</span>
									<span class="font-medium">
										{resume.page[field.key as keyof typeof resume.page]}
									</span>
								</span>
								<input
									type="range"
									class="w-full"
									min={field.min}
									max={field.max}
									step={field.step}
									value={resume.page[field.key as keyof typeof resume.page]}
									oninput={(e) => {
										const v = Number((e.currentTarget as HTMLInputElement).value);
										app.updateResume(
											resume.id,
											(r) => {
												(r.page as unknown as Record<string, number>)[field.key] = v;
											},
											false
										);
									}}
								/>
							</label>
						{/each}
					</div>
				</details>

				<!-- Sections -->
				<h2 class="mb-2 px-1 text-sm font-semibold">Sections</h2>
				<div class="space-y-2">
					{#each resume.sections as section, index (section.id)}
						<div
							class="surface-card {sectionDrop === index ? 'rf-drop-target' : ''} {sectionDrag ===
							index
								? 'rf-dragging'
								: ''}"
							ondragover={(e) => {
								e.preventDefault();
								sectionDrop = index;
							}}
							ondragleave={() => {
								if (sectionDrop === index) sectionDrop = null;
							}}
							ondrop={(e) => {
								e.preventDefault();
								if (sectionDrag !== null && sectionDrag !== index) {
									reorderSections(sectionDrag, index);
								}
								sectionDrag = null;
								sectionDrop = null;
							}}
							role="group"
							aria-label={section.name || SECTION_LABELS[section.kind]}
						>
							<div class="flex items-center gap-1 p-2" style={section.hidden ? 'opacity:0.6' : ''}>
								<span
									class="cursor-grab select-none px-1 active:cursor-grabbing"
									style="color: var(--text-muted)"
									draggable="true"
									aria-hidden="true"
									title="Drag to reorder"
									ondragstart={() => (sectionDrag = index)}
									ondragend={() => {
										sectionDrag = null;
										sectionDrop = null;
									}}
								>
									&#8942;&#8942;
								</span>

								<button
									type="button"
									class="min-w-0 flex-1 text-left"
									aria-expanded={openSectionId === section.id}
									onclick={() => (openSectionId = openSectionId === section.id ? null : section.id)}
								>
									<span class="block truncate text-sm font-semibold">
										{section.name || SECTION_LABELS[section.kind]}
									</span>
									<span class="block text-xs" style="color: var(--text-muted)">
										{SECTION_LABELS[section.kind]}{section.hidden ? ' - hidden' : ''}
									</span>
								</button>

								<button
									type="button"
									class="tap rounded px-2 py-1 text-xs"
									style="border: 1px solid var(--border); color: var(--text)"
									disabled={index === 0}
									aria-label="Move {section.name} up"
									onclick={() => reorderSections(index, index - 1)}
								>
									&uarr;
								</button>
								<button
									type="button"
									class="tap rounded px-2 py-1 text-xs"
									style="border: 1px solid var(--border); color: var(--text)"
									disabled={index === resume.sections.length - 1}
									aria-label="Move {section.name} down"
									onclick={() => reorderSections(index, index + 1)}
								>
									&darr;
								</button>
								<button
									type="button"
									class="tap rounded px-2 py-1 text-xs"
									style="border: 1px solid var(--border); color: var(--text)"
									aria-pressed={section.hidden}
									aria-label="{section.hidden ? 'Show' : 'Hide'} {section.name}"
									onclick={() =>
										updateSection(section.id, (sec) => {
											sec.hidden = !sec.hidden;
										})}
								>
									{section.hidden ? 'Show' : 'Hide'}
								</button>
								{#if section.kind !== 'personal'}
									<button
										type="button"
										class="tap rounded px-2 py-1 text-xs"
										style="border: 1px solid var(--border); color: var(--color-bad)"
										aria-label="Delete {section.name}"
										onclick={() => (deleteSectionId = section.id)}
									>
										&times;
									</button>
								{/if}
							</div>

							{#if openSectionId === section.id}
								<div class="border-t p-3" style="border-color: var(--border)">
									<label class="mb-3 block text-sm">
										<span class="mb-1 block text-xs font-medium" style="color: var(--text-muted)">
											Section heading
										</span>
										<input
											class="tap w-full rounded-lg px-3 py-2 text-sm"
											style={controlStyle}
											value={section.name}
											oninput={(e) =>
												updateSection(section.id, (sec) => {
													sec.name = (e.currentTarget as HTMLInputElement).value;
												})}
										/>
									</label>
									<SectionEditor
										{section}
										onchange={(mutate) => updateSection(section.id, mutate)}
										onphotoerror={(m) => app.pushToast(m, 'bad')}
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Add section -->
				<div class="surface-card mt-3 p-3">
					<h3 class="text-sm font-semibold">Add a section</h3>
					<div class="mt-2 flex flex-wrap gap-2">
						<select
							class="tap min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
							style={controlStyle}
							bind:value={addSectionKind}
							aria-label="Section type"
						>
							{#each Object.entries(SECTION_LABELS) as [kind, label] (kind)}
								{#if kind !== 'personal'}
									<option value={kind}>{label}</option>
								{/if}
							{/each}
						</select>
						{#if addSectionKind === 'custom'}
							<input
								class="tap min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
								style={controlStyle}
								bind:value={customName}
								placeholder="Section name"
								aria-label="Custom section name"
							/>
						{/if}
						<button
							type="button"
							class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
							style="background: var(--color-ink)"
							onclick={addSection}
						>
							Add
						</button>
					</div>
				</div>
			</div>

			<!-- Right: preview -->
			<div
				class="min-w-0 flex-1 overflow-auto p-4 {showPreviewMobile ? '' : 'hidden md:block'}"
				style="background: var(--surface-sunken)"
			>
				<div
					class="no-print mb-3 flex flex-wrap items-center justify-between gap-2"
					style="color: var(--text-muted)"
				>
					<span class="text-sm font-medium">
						{pageCount} page{pageCount === 1 ? '' : 's'}
					</span>
					<div class="flex items-center gap-1">
						<button
							type="button"
							class="tap rounded-lg px-3 py-1.5 text-sm"
							style={controlStyle}
							onclick={() => (zoom = Math.max(0.4, Math.round((zoom - 0.1) * 100) / 100))}
							aria-label="Zoom out"
						>
							-
						</button>
						<span class="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
						<button
							type="button"
							class="tap rounded-lg px-3 py-1.5 text-sm"
							style={controlStyle}
							onclick={() => (zoom = Math.min(1.5, Math.round((zoom + 0.1) * 100) / 100))}
							aria-label="Zoom in"
						>
							+
						</button>
						<button
							type="button"
							class="tap rounded-lg px-3 py-1.5 text-sm"
							style={controlStyle}
							onclick={() => (zoom = 0.72)}
						>
							Fit
						</button>
					</div>
				</div>

				<ResumePreview {resume} {zoom} />
			</div>
		</div>
	</div>
{/if}

<ConfirmDialog
	open={deleteSectionId !== null}
	title="Delete this section?"
	message="The section and everything in it will be removed from this resume."
	confirmLabel="Delete"
	onconfirm={removeSection}
	oncancel={() => (deleteSectionId = null)}
/>
