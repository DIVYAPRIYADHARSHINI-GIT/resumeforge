<script lang="ts">
	import { MONTH_NAMES_LONG } from '#lib/logic/dates';
	import type { MonthYear } from '#lib/types';

	interface Props {
		value: MonthYear;
		label: string;
		allowPresent?: boolean;
		onchange: (value: MonthYear) => void;
		/** Shown under the field when the range is invalid. */
		invalid?: string | null;
	}

	let { value, label, allowPresent = false, onchange, invalid = null }: Props = $props();

	const thisYear = new Date().getFullYear();
	const years = Array.from({ length: 60 }, (_, i) => thisYear + 5 - i);

	const id = `my-${Math.random().toString(36).slice(2, 8)}`;
</script>

<fieldset class="min-w-0">
	<legend class="mb-1 text-xs font-medium" style="color: var(--text-muted)">{label}</legend>
	<div class="flex flex-wrap items-center gap-1.5">
		<select
			class="tap min-w-0 flex-1 rounded-lg px-2 py-2 text-sm"
			style="background: var(--surface); border: 1px solid var(--border); color: var(--text)"
			value={value.month ?? ''}
			disabled={value.present}
			aria-label="{label} month"
			onchange={(e) => {
				const v = (e.currentTarget as HTMLSelectElement).value;
				onchange({ ...value, month: v === '' ? null : Number(v) });
			}}
		>
			<option value="">Month</option>
			{#each MONTH_NAMES_LONG as name, i (name)}
				<option value={i + 1}>{name}</option>
			{/each}
		</select>

		<select
			class="tap w-[5.5rem] rounded-lg px-2 py-2 text-sm"
			style="background: var(--surface); border: 1px solid var(--border); color: var(--text)"
			value={value.year ?? ''}
			disabled={value.present}
			aria-label="{label} year"
			onchange={(e) => {
				const v = (e.currentTarget as HTMLSelectElement).value;
				onchange({ ...value, year: v === '' ? null : Number(v) });
			}}
		>
			<option value="">Year</option>
			{#each years as year (year)}
				<option value={year}>{year}</option>
			{/each}
		</select>

		{#if allowPresent}
			<label class="tap flex items-center gap-1.5 px-1 text-sm" for="{id}-present">
				<input
					id="{id}-present"
					type="checkbox"
					class="h-4 w-4"
					checked={value.present ?? false}
					onchange={(e) =>
						onchange({ ...value, present: (e.currentTarget as HTMLInputElement).checked })}
				/>
				<span>Present</span>
			</label>
		{/if}
	</div>
	{#if invalid}
		<p class="mt-1 text-xs font-medium" style="color: var(--color-warn)" role="alert">
			{invalid}
		</p>
	{/if}
</fieldset>
