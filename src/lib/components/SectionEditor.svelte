<script lang="ts">
	// Editor for one section. Handles every section kind, with per-item add/remove/hide and
	// reordering by drag handle and by Move up / Move down buttons.

	import type { ResumeSection, MonthYear } from '#lib/types';
	import {
		newAward,
		newCertification,
		newCustomItem,
		newEducation,
		newExperience,
		newLanguage,
		newProject,
		newSkillGroup,
		uid
	} from '#lib/logic/factory';
	import { moveDown, moveUp } from '#lib/logic/reorder';
	import { isEndBeforeStart } from '#lib/logic/dates';
	import MonthYearPicker from './MonthYearPicker.svelte';
	import BulletEditor from './BulletEditor.svelte';
	import { compressImage } from '#lib/logic/photo';

	interface Props {
		section: ResumeSection;
		onchange: (mutate: (section: ResumeSection) => void) => void;
		onphotoerror?: (message: string) => void;
	}

	let { section, onchange, onphotoerror }: Props = $props();

	let itemDrag = $state<number | null>(null);
	let itemDrop = $state<number | null>(null);

	const inputClass = 'tap w-full rounded-lg px-3 py-2 text-sm';
	const inputStyle =
		'background: var(--surface); border: 1px solid var(--border); color: var(--text)';

	function reorderEntries(from: number, to: number) {
		onchange((s) => {
			const items = s.items;
			if (items.type === 'skills') {
				const copy = [...items.groups];
				const [m] = copy.splice(from, 1);
				copy.splice(to, 0, m);
				items.groups = copy;
			} else if ('entries' in items) {
				const copy = [...(items.entries as unknown[])];
				const [m] = copy.splice(from, 1);
				copy.splice(to, 0, m);
				(items as { entries: unknown[] }).entries = copy;
			}
		});
	}

	function handleItemDrop(target: number) {
		if (itemDrag === null) return;
		const from = itemDrag;
		itemDrag = null;
		itemDrop = null;
		if (from !== target) reorderEntries(from, target);
	}

	async function onPhotoPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const dataUrl = await compressImage(file);
			onchange((s) => {
				if (s.items.type === 'personal') s.items.data.photo = dataUrl;
			});
		} catch (e) {
			onphotoerror?.(e instanceof Error ? e.message : 'Could not read that image.');
		} finally {
			input.value = '';
		}
	}
</script>

{#snippet itemControls(index: number, length: number, label: string, onRemove: () => void, hidden: boolean, onToggleHide: () => void)}
	<div class="flex shrink-0 items-center gap-1">
		<button
			type="button"
			class="tap rounded px-2 py-1 text-xs"
			style="border: 1px solid var(--border); color: var(--text)"
			disabled={index === 0}
			aria-label="Move {label} up"
			onclick={() => reorderEntries(index, index - 1)}
		>
			&uarr;
		</button>
		<button
			type="button"
			class="tap rounded px-2 py-1 text-xs"
			style="border: 1px solid var(--border); color: var(--text)"
			disabled={index === length - 1}
			aria-label="Move {label} down"
			onclick={() => reorderEntries(index, index + 1)}
		>
			&darr;
		</button>
		<button
			type="button"
			class="tap rounded px-2 py-1 text-xs"
			style="border: 1px solid var(--border); color: var(--text)"
			aria-pressed={hidden}
			aria-label="{hidden ? 'Show' : 'Hide'} {label}"
			onclick={onToggleHide}
		>
			{hidden ? 'Hidden' : 'Hide'}
		</button>
		<button
			type="button"
			class="tap rounded px-2 py-1 text-xs"
			style="border: 1px solid var(--border); color: var(--color-bad)"
			aria-label="Remove {label}"
			onclick={onRemove}
		>
			Remove
		</button>
	</div>
{/snippet}

{#snippet dragHandle(index: number)}
	<span
		class="cursor-grab select-none px-1 text-sm active:cursor-grabbing"
		style="color: var(--text-muted)"
		draggable="true"
		aria-hidden="true"
		title="Drag to reorder"
		ondragstart={() => (itemDrag = index)}
		ondragend={() => {
			itemDrag = null;
			itemDrop = null;
		}}
	>
		&#8942;&#8942;
	</span>
{/snippet}

<div class="space-y-4">
	{#if section.items.type === 'personal'}
		{@const p = section.items.data}
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="block text-sm">
				<span class="mb-1 block font-medium">Full name</span>
				<input
					class={inputClass}
					style={inputStyle}
					value={p.fullName}
					oninput={(e) =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.fullName = (e.currentTarget as HTMLInputElement).value;
						})}
				/>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block font-medium">Headline</span>
				<input
					class={inputClass}
					style={inputStyle}
					placeholder="e.g. Junior Software Developer"
					value={p.headline}
					oninput={(e) =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.headline = (e.currentTarget as HTMLInputElement).value;
						})}
				/>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block font-medium">Email</span>
				<input
					type="email"
					class={inputClass}
					style={inputStyle}
					value={p.email}
					oninput={(e) =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.email = (e.currentTarget as HTMLInputElement).value;
						})}
				/>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block font-medium">Phone</span>
				<input
					type="tel"
					class={inputClass}
					style={inputStyle}
					value={p.phone}
					oninput={(e) =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.phone = (e.currentTarget as HTMLInputElement).value;
						})}
				/>
			</label>
			<label class="block text-sm sm:col-span-2">
				<span class="mb-1 block font-medium">Location</span>
				<input
					class={inputClass}
					style={inputStyle}
					placeholder="City, Country"
					value={p.location}
					oninput={(e) =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.location = (e.currentTarget as HTMLInputElement).value;
						})}
				/>
			</label>
		</div>

		<div>
			<h4 class="text-sm font-medium">Links</h4>
			<div class="mt-2 space-y-2">
				{#each p.links as link, i (link.id)}
					<div class="flex flex-wrap items-end gap-2">
						<label class="min-w-0 flex-1 text-sm">
							<span class="mb-1 block text-xs" style="color: var(--text-muted)">Label</span>
							<input
								class={inputClass}
								style={inputStyle}
								value={link.label}
								placeholder="linkedin.com/in/you"
								oninput={(e) =>
									onchange((s) => {
										if (s.items.type === 'personal')
											s.items.data.links[i].label = (e.currentTarget as HTMLInputElement).value;
									})}
							/>
						</label>
						<label class="min-w-0 flex-1 text-sm">
							<span class="mb-1 block text-xs" style="color: var(--text-muted)">URL</span>
							<input
								class={inputClass}
								style={inputStyle}
								value={link.url}
								placeholder="https://..."
								oninput={(e) =>
									onchange((s) => {
										if (s.items.type === 'personal')
											s.items.data.links[i].url = (e.currentTarget as HTMLInputElement).value;
									})}
							/>
						</label>
						<button
							type="button"
							class="tap rounded-lg px-3 py-2 text-xs"
							style="border: 1px solid var(--border); color: var(--color-bad)"
							aria-label="Remove link {i + 1}"
							onclick={() =>
								onchange((s) => {
									if (s.items.type === 'personal')
										s.items.data.links = s.items.data.links.filter((_, j) => j !== i);
								})}
						>
							Remove
						</button>
					</div>
				{/each}
				<button
					type="button"
					class="tap rounded-lg px-3 py-2 text-sm font-medium"
					style="border: 1px dashed var(--border); color: var(--text-muted)"
					onclick={() =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.links = [...s.items.data.links, { id: uid('lnk'), label: '', url: '' }];
						})}
				>
					+ Add link
				</button>
			</div>
		</div>

		<div class="rounded-lg p-3" style="background: var(--surface-sunken)">
			<label class="tap flex items-center gap-2 text-sm font-medium">
				<input
					type="checkbox"
					class="h-4 w-4"
					checked={p.showPhoto}
					onchange={(e) =>
						onchange((s) => {
							if (s.items.type === 'personal')
								s.items.data.showPhoto = (e.currentTarget as HTMLInputElement).checked;
						})}
				/>
				Include a photo
			</label>
			<p class="mt-2 text-xs" style="color: var(--text-muted)">
				Photos are common in some regions, but they are not recommended for applications where
				automated screening is used. Photos are stored only in this browser and compressed to under
				100 KB.
			</p>
			{#if p.showPhoto}
				<div class="mt-3 flex items-center gap-3">
					{#if p.photo}
						<img src={p.photo} alt="Your uploaded profile" class="h-16 w-16 rounded-lg object-cover" />
					{/if}
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						class="text-xs"
						onchange={onPhotoPick}
						aria-label="Choose a photo"
					/>
					{#if p.photo}
						<button
							type="button"
							class="tap rounded-lg px-3 py-2 text-xs"
							style="border: 1px solid var(--border); color: var(--color-bad)"
							onclick={() =>
								onchange((s) => {
									if (s.items.type === 'personal') s.items.data.photo = null;
								})}
						>
							Remove photo
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{:else if section.items.type === 'summary'}
		<label class="block text-sm">
			<span class="mb-1 block font-medium">Summary</span>
			<textarea
				rows="5"
				class="w-full resize-y rounded-lg px-3 py-2 text-sm"
				style={inputStyle}
				placeholder="Two or three lines about who you are and what you do."
				value={section.items.text}
				oninput={(e) =>
					onchange((s) => {
						if (s.items.type === 'summary')
							s.items.text = (e.currentTarget as HTMLTextAreaElement).value;
					})}
			></textarea>
		</label>
		<p class="text-xs" style="color: var(--text-muted)">
			{section.items.text.trim().split(/\s+/).filter(Boolean).length} words
		</p>
	{:else if section.items.type === 'experience'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			{@const dateError = isEndBeforeStart(entry.start, entry.end)
				? 'End date is before the start date.'
				: null}
			<div
				class="rounded-lg p-3 {itemDrop === index ? 'rf-drop-target' : ''} {itemDrag === index
					? 'rf-dragging'
					: ''}"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
				ondragover={(e) => {
					e.preventDefault();
					itemDrop = index;
				}}
				ondragleave={() => {
					if (itemDrop === index) itemDrop = null;
				}}
				ondrop={(e) => {
					e.preventDefault();
					handleItemDrop(index);
				}}
				role="group"
				aria-label="Experience {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						entries.length,
						`experience ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'experience')
									s.items.entries = s.items.entries.filter((_, j) => j !== index);
							}),
						entry.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'experience')
									s.items.entries[index].hidden = !s.items.entries[index].hidden;
							})
					)}
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Role</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.role}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'experience')
										s.items.entries[index].role = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Company</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.company}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'experience')
										s.items.entries[index].company = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm sm:col-span-2">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Location</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.location}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'experience')
										s.items.entries[index].location = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<MonthYearPicker
						label="Start"
						value={entry.start}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'experience') s.items.entries[index].start = v;
							})}
					/>
					<MonthYearPicker
						label="End"
						value={entry.end}
						allowPresent
						invalid={dateError}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'experience') s.items.entries[index].end = v;
							})}
					/>
				</div>

				<div class="mt-3">
					<h4 class="mb-1.5 text-xs font-medium" style="color: var(--text-muted)">Bullet points</h4>
					<BulletEditor
						bullets={entry.bullets}
						onchange={(bullets) =>
							onchange((s) => {
								if (s.items.type === 'experience') s.items.entries[index].bullets = bullets;
							})}
					/>
				</div>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'experience') s.items.entries = [...s.items.entries, newExperience()];
				})}
		>
			+ Add role
		</button>
	{:else if section.items.type === 'education'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			{@const dateError = isEndBeforeStart(entry.start, entry.end)
				? 'End date is before the start date.'
				: null}
			<div
				class="rounded-lg p-3 {itemDrop === index ? 'rf-drop-target' : ''}"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
				ondragover={(e) => {
					e.preventDefault();
					itemDrop = index;
				}}
				ondrop={(e) => {
					e.preventDefault();
					handleItemDrop(index);
				}}
				role="group"
				aria-label="Education {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						entries.length,
						`education ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'education')
									s.items.entries = s.items.entries.filter((_, j) => j !== index);
							}),
						entry.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'education')
									s.items.entries[index].hidden = !s.items.entries[index].hidden;
							})
					)}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Degree</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.degree}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'education')
										s.items.entries[index].degree = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Institution</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.institution}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'education')
										s.items.entries[index].institution = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm sm:col-span-2">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Location</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.location}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'education')
										s.items.entries[index].location = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<MonthYearPicker
						label="Start"
						value={entry.start}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'education') s.items.entries[index].start = v;
							})}
					/>
					<MonthYearPicker
						label="End"
						value={entry.end}
						allowPresent
						invalid={dateError}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'education') s.items.entries[index].end = v;
							})}
					/>
					<label class="block text-sm sm:col-span-2">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Notes</span>
						<textarea
							rows="2"
							class="w-full resize-y rounded-lg px-3 py-2 text-sm"
							style={inputStyle}
							value={entry.notes}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'education')
										s.items.entries[index].notes = (e.currentTarget as HTMLTextAreaElement).value;
								})}
						></textarea>
					</label>
				</div>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'education') s.items.entries = [...s.items.entries, newEducation()];
				})}
		>
			+ Add education
		</button>
	{:else if section.items.type === 'skills'}
		{@const groups = section.items.groups}
		{#each groups as group, index (group.id)}
			<div
				class="rounded-lg p-3 {itemDrop === index ? 'rf-drop-target' : ''}"
				style="background: var(--surface-sunken); {group.hidden ? 'opacity:0.6' : ''}"
				ondragover={(e) => {
					e.preventDefault();
					itemDrop = index;
				}}
				ondrop={(e) => {
					e.preventDefault();
					handleItemDrop(index);
				}}
				role="group"
				aria-label="Skill group {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						groups.length,
						`skill group ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'skills')
									s.items.groups = s.items.groups.filter((_, j) => j !== index);
							}),
						group.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'skills')
									s.items.groups[index].hidden = !s.items.groups[index].hidden;
							})
					)}
				</div>
				<label class="block text-sm">
					<span class="mb-1 block text-xs" style="color: var(--text-muted)">Group name</span>
					<input
						class={inputClass}
						style={inputStyle}
						placeholder="Languages, Tools, Soft skills..."
						value={group.name}
						oninput={(e) =>
							onchange((s) => {
								if (s.items.type === 'skills')
									s.items.groups[index].name = (e.currentTarget as HTMLInputElement).value;
							})}
					/>
				</label>
				<label class="mt-2 block text-sm">
					<span class="mb-1 block text-xs" style="color: var(--text-muted)">
						Skills (comma separated)
					</span>
					<textarea
						rows="2"
						class="w-full resize-y rounded-lg px-3 py-2 text-sm"
						style={inputStyle}
						value={group.skills.join(', ')}
						oninput={(e) =>
							onchange((s) => {
								if (s.items.type === 'skills')
									s.items.groups[index].skills = (e.currentTarget as HTMLTextAreaElement).value
										.split(',')
										.map((x) => x.trim())
										.filter(Boolean);
							})}
					></textarea>
				</label>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'skills') s.items.groups = [...s.items.groups, newSkillGroup('')];
				})}
		>
			+ Add skill group
		</button>
	{:else if section.items.type === 'projects'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			<div
				class="rounded-lg p-3 {itemDrop === index ? 'rf-drop-target' : ''}"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
				ondragover={(e) => {
					e.preventDefault();
					itemDrop = index;
				}}
				ondrop={(e) => {
					e.preventDefault();
					handleItemDrop(index);
				}}
				role="group"
				aria-label="Project {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						entries.length,
						`project ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'projects')
									s.items.entries = s.items.entries.filter((_, j) => j !== index);
							}),
						entry.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'projects')
									s.items.entries[index].hidden = !s.items.entries[index].hidden;
							})
					)}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Name</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.name}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'projects')
										s.items.entries[index].name = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Link</span>
						<input
							class={inputClass}
							style={inputStyle}
							placeholder="https://..."
							value={entry.link}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'projects')
										s.items.entries[index].link = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm sm:col-span-2">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Description</span>
						<textarea
							rows="2"
							class="w-full resize-y rounded-lg px-3 py-2 text-sm"
							style={inputStyle}
							value={entry.description}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'projects')
										s.items.entries[index].description = (e.currentTarget as HTMLTextAreaElement)
											.value;
								})}
						></textarea>
					</label>
				</div>
				<div class="mt-3">
					<h4 class="mb-1.5 text-xs font-medium" style="color: var(--text-muted)">Bullet points</h4>
					<BulletEditor
						bullets={entry.bullets}
						onchange={(bullets) =>
							onchange((s) => {
								if (s.items.type === 'projects') s.items.entries[index].bullets = bullets;
							})}
					/>
				</div>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'projects') s.items.entries = [...s.items.entries, newProject()];
				})}
		>
			+ Add project
		</button>
	{:else if section.items.type === 'certifications'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			<div
				class="rounded-lg p-3 {itemDrop === index ? 'rf-drop-target' : ''}"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
				ondragover={(e) => {
					e.preventDefault();
					itemDrop = index;
				}}
				ondrop={(e) => {
					e.preventDefault();
					handleItemDrop(index);
				}}
				role="group"
				aria-label="Certification {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						entries.length,
						`certification ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'certifications')
									s.items.entries = s.items.entries.filter((_, j) => j !== index);
							}),
						entry.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'certifications')
									s.items.entries[index].hidden = !s.items.entries[index].hidden;
							})
					)}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Name</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.name}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'certifications')
										s.items.entries[index].name = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Issuer</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.issuer}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'certifications')
										s.items.entries[index].issuer = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<MonthYearPicker
						label="Date"
						value={entry.date}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'certifications') s.items.entries[index].date = v;
							})}
					/>
				</div>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'certifications')
						s.items.entries = [...s.items.entries, newCertification()];
				})}
		>
			+ Add certification
		</button>
	{:else if section.items.type === 'languages'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			<div
				class="flex flex-wrap items-end gap-2 rounded-lg p-3"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
			>
				<label class="min-w-0 flex-1 text-sm">
					<span class="mb-1 block text-xs" style="color: var(--text-muted)">Language</span>
					<input
						class={inputClass}
						style={inputStyle}
						value={entry.name}
						oninput={(e) =>
							onchange((s) => {
								if (s.items.type === 'languages')
									s.items.entries[index].name = (e.currentTarget as HTMLInputElement).value;
							})}
					/>
				</label>
				<label class="min-w-0 flex-1 text-sm">
					<span class="mb-1 block text-xs" style="color: var(--text-muted)">Level</span>
					<input
						class={inputClass}
						style={inputStyle}
						placeholder="Fluent, Native..."
						value={entry.level}
						oninput={(e) =>
							onchange((s) => {
								if (s.items.type === 'languages')
									s.items.entries[index].level = (e.currentTarget as HTMLInputElement).value;
							})}
					/>
				</label>
				{@render itemControls(
					index,
					entries.length,
					`language ${index + 1}`,
					() =>
						onchange((s) => {
							if (s.items.type === 'languages')
								s.items.entries = s.items.entries.filter((_, j) => j !== index);
						}),
					entry.hidden ?? false,
					() =>
						onchange((s) => {
							if (s.items.type === 'languages')
								s.items.entries[index].hidden = !s.items.entries[index].hidden;
						})
				)}
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'languages') s.items.entries = [...s.items.entries, newLanguage()];
				})}
		>
			+ Add language
		</button>
	{:else if section.items.type === 'awards'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			<div
				class="rounded-lg p-3"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
				role="group"
				aria-label="Award {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						entries.length,
						`award ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'awards')
									s.items.entries = s.items.entries.filter((_, j) => j !== index);
							}),
						entry.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'awards')
									s.items.entries[index].hidden = !s.items.entries[index].hidden;
							})
					)}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Name</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.name}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'awards')
										s.items.entries[index].name = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Issuer</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.issuer}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'awards')
										s.items.entries[index].issuer = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<MonthYearPicker
						label="Date"
						value={entry.date}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'awards') s.items.entries[index].date = v;
							})}
					/>
					<label class="block text-sm sm:col-span-2">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Description</span>
						<textarea
							rows="2"
							class="w-full resize-y rounded-lg px-3 py-2 text-sm"
							style={inputStyle}
							value={entry.description}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'awards')
										s.items.entries[index].description = (e.currentTarget as HTMLTextAreaElement)
											.value;
								})}
						></textarea>
					</label>
				</div>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'awards') s.items.entries = [...s.items.entries, newAward()];
				})}
		>
			+ Add award
		</button>
	{:else if section.items.type === 'custom'}
		{@const entries = section.items.entries}
		{#each entries as entry, index (entry.id)}
			<div
				class="rounded-lg p-3"
				style="background: var(--surface-sunken); {entry.hidden ? 'opacity:0.6' : ''}"
				role="group"
				aria-label="Item {index + 1}"
			>
				<div class="mb-2 flex items-center justify-between gap-2">
					{@render dragHandle(index)}
					{@render itemControls(
						index,
						entries.length,
						`item ${index + 1}`,
						() =>
							onchange((s) => {
								if (s.items.type === 'custom')
									s.items.entries = s.items.entries.filter((_, j) => j !== index);
							}),
						entry.hidden ?? false,
						() =>
							onchange((s) => {
								if (s.items.type === 'custom')
									s.items.entries[index].hidden = !s.items.entries[index].hidden;
							})
					)}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Title</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.title}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'custom')
										s.items.entries[index].title = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-xs" style="color: var(--text-muted)">Subtitle</span>
						<input
							class={inputClass}
							style={inputStyle}
							value={entry.subtitle}
							oninput={(e) =>
								onchange((s) => {
									if (s.items.type === 'custom')
										s.items.entries[index].subtitle = (e.currentTarget as HTMLInputElement).value;
								})}
						/>
					</label>
					<MonthYearPicker
						label="Date"
						value={entry.date}
						onchange={(v: MonthYear) =>
							onchange((s) => {
								if (s.items.type === 'custom') s.items.entries[index].date = v;
							})}
					/>
				</div>
				<div class="mt-3">
					<h4 class="mb-1.5 text-xs font-medium" style="color: var(--text-muted)">Bullet points</h4>
					<BulletEditor
						bullets={entry.bullets}
						onchange={(bullets) =>
							onchange((s) => {
								if (s.items.type === 'custom') s.items.entries[index].bullets = bullets;
							})}
					/>
				</div>
			</div>
		{/each}
		<button
			type="button"
			class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
			style="border: 1px dashed var(--border); color: var(--text-muted)"
			onclick={() =>
				onchange((s) => {
					if (s.items.type === 'custom') s.items.entries = [...s.items.entries, newCustomItem()];
				})}
		>
			+ Add item
		</button>
	{/if}
</div>
