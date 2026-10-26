<script lang="ts">
	// Anvil-inspired mark: a flat-topped anvil silhouette with a struck spark.
	// Original SVG, no emoji and no cartoon illustration.
	let { size = 28, title = 'ResumeForge' }: { size?: number; title?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 32 32"
	role="img"
	aria-label={title}
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
>
	<rect width="32" height="32" rx="7" fill="var(--logo-bg, #1F2933)" />
	<!-- anvil body -->
	<path
		d="M7 14h13.2c2.1 0 3.8-1.2 4.6-3l.3-.7 1.7.8-.4 1a7.1 7.1 0 0 1-4.3 3.9v1.6h1.8c.5 0 .9.4.9.9v1.1H9.2v-1.1c0-.5.4-.9.9-.9h1.8v-1.7H7.9c-.5 0-.9-.4-.9-.9V14z"
		fill="var(--logo-fg, #FAF8F5)"
	/>
	<!-- base -->
	<path
		d="M11.5 21.5h9l1.6 3.6c.2.4-.1.9-.6.9H10.5c-.5 0-.8-.5-.6-.9l1.6-3.6z"
		fill="var(--logo-fg, #FAF8F5)"
	/>
	<!-- spark -->
	<path d="M24.5 6.2l1.1 2.4 2.4 1.1-2.4 1.1-1.1 2.4-1.1-2.4-2.4-1.1 2.4-1.1 1.1-2.4z" fill="#E8590C" />
</svg>
