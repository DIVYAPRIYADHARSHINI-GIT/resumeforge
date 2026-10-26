// Date formatting + validation.
// Intent: resumes show "Jan 2022 - Present" consistently. We never build a Date from a
// yyyy-mm-dd string via `new Date(str)` because that parses as UTC and can shift the day
// backwards in negative-offset time zones. Local dates are handled as plain components.

import type { MonthYear } from '#lib/types';

export const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

export const MONTH_NAMES_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export const PRESENT_LABEL = 'Present';

export function emptyMonthYear(): MonthYear {
	return { month: null, year: null, present: false };
}

/** "Jan 2022", "2022", "Present", or "" when empty. */
export function formatMonthYear(value: MonthYear | null | undefined): string {
	if (!value) return '';
	if (value.present) return PRESENT_LABEL;
	const { month, year } = value;
	if (year == null) return '';
	if (month == null || month < 1 || month > 12) return String(year);
	return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "Jan 2022 - Present". Uses an en dash. Collapses when one side is missing. */
export function formatDateRange(start: MonthYear | null, end: MonthYear | null): string {
	const a = formatMonthYear(start);
	const b = formatMonthYear(end);
	if (a && b) return `${a} \u2013 ${b}`;
	return a || b;
}

/** Sortable integer, or null. Used for comparisons only. */
export function monthYearToOrdinal(value: MonthYear | null | undefined): number | null {
	if (!value) return null;
	if (value.present) return Number.MAX_SAFE_INTEGER;
	if (value.year == null) return null;
	const m = value.month == null ? 1 : Math.min(12, Math.max(1, value.month));
	return value.year * 12 + (m - 1);
}

/** True when the end date is strictly before the start date (a user error worth warning about). */
export function isEndBeforeStart(start: MonthYear | null, end: MonthYear | null): boolean {
	const a = monthYearToOrdinal(start);
	const b = monthYearToOrdinal(end);
	if (a == null || b == null) return false;
	return b < a;
}

/** Local "today" as yyyy-mm-dd, with no UTC round-trip. */
export function todayLocalISODate(now: Date = new Date()): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Parse yyyy-mm-dd into local date parts without time-zone drift. */
export function parseLocalISODate(value: string): { y: number; m: number; d: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!match) return null;
	const y = Number(match[1]);
	const m = Number(match[2]);
	const d = Number(match[3]);
	if (m < 1 || m > 12 || d < 1 || d > 31) return null;
	// Reject impossible days such as 2023-02-30.
	const probe = new Date(y, m - 1, d);
	if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
		return null;
	}
	return { y, m, d };
}

/** "12 Mar 2024" from a local yyyy-mm-dd, never shifted by a day. */
export function formatLocalISODate(value: string): string {
	const parts = parseLocalISODate(value);
	if (!parts) return value;
	return `${parts.d} ${MONTH_NAMES[parts.m - 1]} ${parts.y}`;
}

/** Whole days between two local dates (b - a). Uses noon to dodge DST edges. */
export function daysBetweenLocal(aISO: string, bISO: string): number | null {
	const a = parseLocalISODate(aISO);
	const b = parseLocalISODate(bISO);
	if (!a || !b) return null;
	const da = new Date(a.y, a.m - 1, a.d, 12, 0, 0).getTime();
	const db = new Date(b.y, b.m - 1, b.d, 12, 0, 0).getTime();
	return Math.round((db - da) / 86_400_000);
}

/** Days since an ISO timestamp (or local date), measured in local days. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
	if (!iso) return null;
	const datePart = iso.length >= 10 ? iso.slice(0, 10) : iso;
	// An ISO timestamp's date part is UTC; convert through the real instant for timestamps.
	let localDate: string;
	if (iso.includes('T')) {
		const instant = new Date(iso);
		if (Number.isNaN(instant.getTime())) return null;
		localDate = todayLocalISODate(instant);
	} else {
		localDate = datePart;
	}
	return daysBetweenLocal(localDate, todayLocalISODate(now));
}

/** Friendly relative label used in lists ("Today", "Yesterday", "3 days ago", date). */
export function relativeDayLabel(iso: string | null, now: Date = new Date()): string {
	const days = daysSince(iso, now);
	if (iso == null || days == null) return 'Never';
	if (days <= 0) return 'Today';
	if (days === 1) return 'Yesterday';
	if (days < 30) return `${days} days ago`;
	const datePart = iso.includes('T') ? todayLocalISODate(new Date(iso)) : iso.slice(0, 10);
	return formatLocalISODate(datePart);
}

/**
 * Detect inconsistent date formats across a resume's entries. We only flag a real
 * inconsistency: some entries give month+year while others give year only.
 */
export function detectDateFormatInconsistency(values: MonthYear[]): boolean {
	let withMonth = 0;
	let withoutMonth = 0;
	for (const v of values) {
		if (!v || v.present || v.year == null) continue;
		if (v.month == null) withoutMonth += 1;
		else withMonth += 1;
	}
	return withMonth > 0 && withoutMonth > 0;
}
