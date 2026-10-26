<script lang="ts">
	// Hand-drawn SVG score ring - no chart library.
	import { scoreBand } from '#lib/logic/score';

	let { score = 0, size = 132 }: { score?: number; size?: number } = $props();

	const stroke = $derived(size * 0.1);
	const radius = $derived((size - stroke) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference * (1 - Math.max(0, Math.min(100, score)) / 100));
	const band = $derived(scoreBand(score));
	const colour = $derived(
		band.tone === 'good'
			? 'var(--color-good)'
			: band.tone === 'warn'
				? 'var(--color-warn)'
				: 'var(--color-bad)'
	);
</script>

<div class="flex flex-col items-center">
	<div class="relative" style="width: {size}px; height: {size}px">
		<svg
			width={size}
			height={size}
			viewBox="0 0 {size} {size}"
			role="img"
			aria-label="Keyword match estimate: {score} out of 100. {band.label}."
		>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke="var(--surface-sunken)"
				stroke-width={stroke}
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={colour}
				stroke-width={stroke}
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={offset}
				transform="rotate(-90 {size / 2} {size / 2})"
				style="transition: stroke-dashoffset 400ms ease"
			/>
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<span class="text-3xl font-semibold tabular-nums" style="color: var(--text)">{score}</span>
			<span class="text-[10px] font-medium uppercase tracking-wide" style="color: var(--text-muted)">
				of 100
			</span>
		</div>
	</div>
	<!-- The band is stated in words, so meaning never relies on colour alone. -->
	<p class="mt-2 text-center text-sm font-medium" style="color: {colour}">{band.label}</p>
</div>
