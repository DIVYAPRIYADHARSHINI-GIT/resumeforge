<script lang="ts">
	import { app } from '#lib/store/app-state.svelte';

	const toneClass: Record<string, string> = {
		info: 'border-l-4 border-l-[color:var(--color-ink)]',
		good: 'border-l-4 border-l-[color:var(--color-good)]',
		warn: 'border-l-4 border-l-[color:var(--color-warn)]',
		bad: 'border-l-4 border-l-[color:var(--color-bad)]'
	};

	// Meaning is carried by a word, not just the colour.
	const toneLabel: Record<string, string> = {
		info: 'Note',
		good: 'Done',
		warn: 'Warning',
		bad: 'Problem'
	};
</script>

<div
	class="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-4"
	aria-live="polite"
	aria-atomic="false"
>
	{#each app.toasts as toast (toast.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg {toneClass[
				toast.tone
			]}"
			style="background: var(--surface-raised); border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);"
			role="status"
		>
			<div class="min-w-0 flex-1 text-sm">
				<span class="font-semibold">{toneLabel[toast.tone]}:</span>
				<span style="color: var(--text)">{toast.message}</span>
			</div>
			<button
				type="button"
				class="shrink-0 rounded px-2 py-1 text-sm hover:opacity-70"
				style="color: var(--text-muted)"
				onclick={() => app.dismissToast(toast.id)}
				aria-label="Dismiss message"
			>
				&times;
			</button>
		</div>
	{/each}
</div>
