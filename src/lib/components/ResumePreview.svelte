<script lang="ts">
	// Renders the LayoutResult as real paper pages.
	//
	// Every run is absolutely positioned at exactly the point coordinates the layout engine
	// produced - the same coordinates the PDF writer uses. The only transform is a CSS
	// scale for zoom, which does not affect the underlying geometry.

	import type { Resume } from '#lib/types';
	import { layoutResume, type LayoutResult } from '#lib/logic/layout';
	import { FONT_CSS } from '#lib/logic/measure';

	interface Props {
		resume: Resume;
		zoom?: number;
		/** Lowercased keyword surface forms to highlight in the preview. */
		highlights?: string[];
		overrides?: { fontSize?: number; lineSpacing?: number; sectionSpacing?: number };
	}

	let { resume, zoom = 1, highlights = [], overrides = {} }: Props = $props();

	const layout = $derived<LayoutResult>(layoutResume(resume, overrides));
	const fontCss = $derived(FONT_CSS[resume.style.font] ?? FONT_CSS.inter);

	// Build one case-insensitive regex for all highlight terms.
	const highlightRe = $derived.by(() => {
		if (!highlights.length) return null;
		const escaped = highlights
			.filter((h) => h && h.length > 1)
			.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.sort((a, b) => b.length - a.length);
		if (!escaped.length) return null;
		try {
			return new RegExp(`(${escaped.join('|')})`, 'gi');
		} catch {
			return null;
		}
	});

	/** Split a run's text into highlighted / plain parts. */
	function parts(text: string): { text: string; hit: boolean }[] {
		const re = highlightRe;
		if (!re) return [{ text, hit: false }];
		const out: { text: string; hit: boolean }[] = [];
		let last = 0;
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
			out.push({ text: m[0], hit: true });
			last = m.index + m[0].length;
			if (m[0].length === 0) re.lastIndex += 1;
		}
		if (last < text.length) out.push({ text: text.slice(last), hit: false });
		return out.length ? out : [{ text, hit: false }];
	}
</script>

<div class="flex flex-col items-center gap-6">
	{#each layout.pages as layoutPage, pageIndex (pageIndex)}
		<div
			class="rf-page shrink-0"
			style="
				width: {layout.pageWidth}pt;
				height: {layout.pageHeight}pt;
				transform: scale({zoom});
				transform-origin: top center;
				margin-bottom: {(zoom - 1) * layout.pageHeight}pt;
				font-family: {fontCss};
			"
			role="document"
			aria-label="Resume page {pageIndex + 1} of {layout.pages.length}"
		>
			{#each layoutPage.rules as rule, ruleIndex (ruleIndex)}
				<div
					aria-hidden="true"
					style="
						position: absolute;
						left: {rule.x}pt;
						top: {rule.y}pt;
						width: {rule.width}pt;
						height: {rule.thickness}pt;
						background: {rule.color};
					"
				></div>
			{/each}

			{#each layoutPage.runs as run, runIndex (runIndex)}
				<div
					style="
						position: absolute;
						left: {run.x}pt;
						top: {run.y}pt;
						font-size: {run.size}pt;
						font-weight: {run.weight === 'bold' ? 700 : 400};
						font-style: {run.weight === 'italic' ? 'italic' : 'normal'};
						color: {run.color};
						white-space: pre;
						line-height: 1.18;
						{run.tracking ? `letter-spacing: ${run.tracking}pt;` : ''}
					"
				>
					{#if run.href}<a
							href={run.href}
							style="color: inherit; text-decoration: none"
							target="_blank"
							rel="noopener noreferrer">{#each parts(run.text) as part, i (i)}{#if part.hit}<span
										class="rf-kw">{part.text}</span
									>{:else}{part.text}{/if}{/each}</a
						>{:else}{#each parts(run.text) as part, i (i)}{#if part.hit}<span class="rf-kw"
									>{part.text}</span
								>{:else}{part.text}{/if}{/each}{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>
