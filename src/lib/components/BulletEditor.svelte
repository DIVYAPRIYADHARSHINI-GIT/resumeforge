<script lang="ts">
	// Bullet list editor: add, remove, reorder (drag + keyboard buttons) and a character
	// guide that warns when a bullet runs long.
	import type { Bullet } from '#lib/types';
	import { newBullet } from '#lib/logic/factory';
	import { moveDown, moveUp } from '#lib/logic/reorder';
	import { BULLET_LONG_CHARS, startsWithActionVerb, weakPhrasesIn } from '#lib/logic/health';
	import { ACTION_VERBS } from '#lib/logic/dictionary';

	interface Props {
		bullets: Bullet[];
		onchange: (bullets: Bullet[]) => void;
	}

	let { bullets, onchange }: Props = $props();

	let dragIndex = $state<number | null>(null);
	let dropIndex = $state<number | null>(null);
	let verbsOpenFor = $state<string | null>(null);

	function update(index: number, text: string) {
		const next = bullets.map((b, i) => (i === index ? { ...b, text } : b));
		onchange(next);
	}

	function add() {
		onchange([...bullets, newBullet()]);
	}

	function remove(index: number) {
		onchange(bullets.filter((_, i) => i !== index));
	}

	function handleDrop(target: number) {
		if (dragIndex === null) return;
		const from = dragIndex;
		dragIndex = null;
		dropIndex = null;
		if (from === target) return;
		const copy = [...bullets];
		const [moved] = copy.splice(from, 1);
		copy.splice(target, 0, moved);
		onchange(copy);
	}
</script>

<div class="space-y-2">
	{#each bullets as bullet, index (bullet.id)}
		{@const len = bullet.text.trim().length}
		{@const long = len > BULLET_LONG_CHARS}
		{@const weak = weakPhrasesIn(bullet.text)}
		{@const noVerb = len > 0 && !startsWithActionVerb(bullet.text)}
		<div
			class="rounded-lg p-2 {dropIndex === index ? 'rf-drop-target' : ''} {dragIndex === index
				? 'rf-dragging'
				: ''}"
			style="background: var(--surface-sunken)"
			role="listitem"
			ondragover={(e) => {
				e.preventDefault();
				dropIndex = index;
			}}
			ondragleave={() => {
				if (dropIndex === index) dropIndex = null;
			}}
			ondrop={(e) => {
				e.preventDefault();
				handleDrop(index);
			}}
		>
			<div class="flex items-start gap-2">
				<span
					class="mt-2 cursor-grab select-none px-1 text-sm active:cursor-grabbing"
					style="color: var(--text-muted)"
					draggable="true"
					role="button"
					tabindex="-1"
					aria-hidden="true"
					title="Drag to reorder"
					ondragstart={() => (dragIndex = index)}
					ondragend={() => {
						dragIndex = null;
						dropIndex = null;
					}}
				>
					&#8942;&#8942;
				</span>

				<textarea
					value={bullet.text}
					rows="2"
					placeholder="Start with an action verb, e.g. Built, Led, Reduced..."
					aria-label="Bullet {index + 1}"
					class="min-w-0 flex-1 resize-y rounded-lg px-3 py-2 text-sm"
					style="background: var(--surface-raised); border: 1px solid var(--border); color: var(--text)"
					oninput={(e) => update(index, (e.currentTarget as HTMLTextAreaElement).value)}
				></textarea>

				<div class="flex shrink-0 flex-col gap-1">
					<button
						type="button"
						class="rounded px-2 py-1 text-xs"
						style="border: 1px solid var(--border); color: var(--text); min-height: 22px"
						disabled={index === 0}
						aria-label="Move bullet {index + 1} up"
						onclick={() => onchange(moveUp(bullets, index))}
					>
						&uarr;
					</button>
					<button
						type="button"
						class="rounded px-2 py-1 text-xs"
						style="border: 1px solid var(--border); color: var(--text); min-height: 22px"
						disabled={index === bullets.length - 1}
						aria-label="Move bullet {index + 1} down"
						onclick={() => onchange(moveDown(bullets, index))}
					>
						&darr;
					</button>
					<button
						type="button"
						class="rounded px-2 py-1 text-xs"
						style="border: 1px solid var(--border); color: var(--color-bad); min-height: 22px"
						aria-label="Remove bullet {index + 1}"
						onclick={() => remove(index)}
					>
						&times;
					</button>
				</div>
			</div>

			<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs">
				<span style="color: {long ? 'var(--color-warn)' : 'var(--text-muted)'}">
					{len} characters{long ? ' - longer than two lines' : ''}
				</span>
				{#if noVerb}
					<span style="color: var(--color-warn)">Does not start with an action verb</span>
				{/if}
				{#if weak.length}
					<span style="color: var(--color-warn)">Weak phrase: "{weak[0]}"</span>
				{/if}
				<button
					type="button"
					class="underline underline-offset-2"
					style="color: var(--text-muted)"
					aria-expanded={verbsOpenFor === bullet.id}
					onclick={() => (verbsOpenFor = verbsOpenFor === bullet.id ? null : bullet.id)}
				>
					Action verbs
				</button>
			</div>

			{#if verbsOpenFor === bullet.id}
				<div class="mt-2 ml-6 rounded-lg p-2" style="background: var(--surface-raised); border: 1px solid var(--border)">
					<p class="mb-2 text-xs" style="color: var(--text-muted)">
						Pick a verb to start this bullet with. You write the rest - we never write content for
						you.
					</p>
					<div class="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
						{#each ACTION_VERBS.slice(0, 120) as verb (verb)}
							<button
								type="button"
								class="rounded px-2 py-1 text-xs"
								style="background: var(--surface-sunken); color: var(--text)"
								onclick={() => {
									const rest = bullet.text.trim();
									update(index, rest ? `${verb} ${rest}` : `${verb} `);
									verbsOpenFor = null;
								}}
							>
								{verb}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/each}

	<button
		type="button"
		class="tap w-full rounded-lg px-3 py-2 text-sm font-medium"
		style="border: 1px dashed var(--border); color: var(--text-muted)"
		onclick={add}
	>
		+ Add bullet
	</button>
</div>
