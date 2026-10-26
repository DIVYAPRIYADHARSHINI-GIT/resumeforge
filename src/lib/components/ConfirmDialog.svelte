<script lang="ts">
	// Confirmation dialog for destructive actions. Uses a native <dialog> so focus
	// trapping, Escape handling and the backdrop come from the platform.
	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: 'bad' | 'normal';
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open = $bindable(),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		tone = 'bad',
		onconfirm,
		oncancel
	}: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function cancel() {
		open = false;
		oncancel();
	}

	function confirm() {
		open = false;
		onconfirm();
	}
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 backdrop:bg-black/50"
	style="background: var(--surface-raised); color: var(--text); border: 1px solid var(--border);"
	oncancel={(e) => {
		e.preventDefault();
		cancel();
	}}
	onclose={() => {
		if (open) cancel();
	}}
	aria-labelledby="confirm-title"
	aria-describedby="confirm-message"
>
	<div class="p-5">
		<h2 id="confirm-title" class="text-lg font-semibold">{title}</h2>
		<p id="confirm-message" class="mt-2 text-sm" style="color: var(--text-muted)">{message}</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button
				type="button"
				class="tap rounded-lg px-4 py-2 text-sm font-medium"
				style="border: 1px solid var(--border); color: var(--text)"
				onclick={cancel}
			>
				{cancelLabel}
			</button>
			<button
				type="button"
				class="tap rounded-lg px-4 py-2 text-sm font-semibold text-white"
				style="background: {tone === 'bad' ? 'var(--color-bad)' : 'var(--color-ember)'}"
				onclick={confirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</dialog>
