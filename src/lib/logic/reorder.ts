// Reordering helpers shared by sections, items and bullets.
//
// Every list in the editor supports drag and drop AND Move up / Move down buttons, so
// reordering works with a keyboard and on a touch screen. Both paths call these functions.

/** Move the item at `from` to index `to`, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
	if (from === to) return items;
	if (from < 0 || from >= items.length) return items;
	const clamped = Math.max(0, Math.min(items.length - 1, to));
	const copy = [...items];
	const [moved] = copy.splice(from, 1);
	copy.splice(clamped, 0, moved);
	return copy;
}

/** Move one step up (towards index 0). */
export function moveUp<T>(items: T[], index: number): T[] {
	if (index <= 0) return items;
	return moveItem(items, index, index - 1);
}

/** Move one step down. */
export function moveDown<T>(items: T[], index: number): T[] {
	if (index >= items.length - 1) return items;
	return moveItem(items, index, index + 1);
}

export function canMoveUp(index: number): boolean {
	return index > 0;
}

export function canMoveDown(index: number, length: number): boolean {
	return index < length - 1;
}
