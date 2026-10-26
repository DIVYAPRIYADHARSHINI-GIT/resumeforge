// Extracts advance widths from the self-hosted TTFs into a JSON metrics table.
//
// Why: the preview (DOM), the paginator and the PDF writer must agree on how wide a line
// of text is, otherwise page breaks differ between the preview and the exported PDF. By
// measuring from the real font files once, all three use the same numbers.
//
// Run with: npm run metrics

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontDir = join(here, '..', 'static', 'fonts');
const outFile = join(here, '..', 'src', 'lib', 'logic', 'font-metrics.json');

/** Minimal big-endian reader for the TTF tables we need. */
class Reader {
	constructor(buf) {
		this.b = buf;
	}
	u8(o) {
		return this.b.readUInt8(o);
	}
	u16(o) {
		return this.b.readUInt16BE(o);
	}
	i16(o) {
		return this.b.readInt16BE(o);
	}
	u32(o) {
		return this.b.readUInt32BE(o);
	}
	tag(o) {
		return this.b.toString('ascii', o, o + 4);
	}
}

function readTables(r) {
	const numTables = r.u16(4);
	const tables = {};
	for (let i = 0; i < numTables; i += 1) {
		const off = 12 + i * 16;
		tables[r.tag(off)] = { offset: r.u32(off + 8), length: r.u32(off + 12) };
	}
	return tables;
}

/** Unicode -> glyph id, from a format 4 or format 12 cmap subtable. */
function readCmap(r, offset) {
	const numSubtables = r.u16(offset + 2);
	let best = null;
	for (let i = 0; i < numSubtables; i += 1) {
		const rec = offset + 4 + i * 8;
		const platform = r.u16(rec);
		const encoding = r.u16(rec + 2);
		const subOffset = offset + r.u32(rec + 4);
		const format = r.u16(subOffset);
		const score =
			(platform === 3 && encoding === 10) || format === 12
				? 4
				: platform === 3 && encoding === 1
					? 3
					: platform === 0
						? 2
						: 1;
		if (!best || score > best.score) best = { score, subOffset, format };
	}
	if (!best) return new Map();

	const map = new Map();
	const { subOffset, format } = best;
	if (format === 4) {
		const segCountX2 = r.u16(subOffset + 6);
		const segCount = segCountX2 / 2;
		const endBase = subOffset + 14;
		const startBase = endBase + segCountX2 + 2;
		const deltaBase = startBase + segCountX2;
		const rangeBase = deltaBase + segCountX2;
		for (let s = 0; s < segCount; s += 1) {
			const end = r.u16(endBase + s * 2);
			const start = r.u16(startBase + s * 2);
			const delta = r.i16(deltaBase + s * 2);
			const rangeOffset = r.u16(rangeBase + s * 2);
			if (start > end) continue;
			for (let c = start; c <= end && c !== 0xffff; c += 1) {
				let gid;
				if (rangeOffset === 0) {
					gid = (c + delta) & 0xffff;
				} else {
					const gi = rangeBase + s * 2 + rangeOffset + (c - start) * 2;
					if (gi + 1 >= r.b.length) continue;
					gid = r.u16(gi);
					if (gid !== 0) gid = (gid + delta) & 0xffff;
				}
				if (gid) map.set(c, gid);
			}
		}
	} else if (format === 12) {
		const nGroups = r.u32(subOffset + 12);
		for (let g = 0; g < nGroups; g += 1) {
			const rec = subOffset + 16 + g * 12;
			const start = r.u32(rec);
			const end = r.u32(rec + 4);
			const startGid = r.u32(rec + 8);
			for (let c = start; c <= end; c += 1) map.set(c, startGid + (c - start));
		}
	}
	return map;
}

function readHmtx(r, tables, numGlyphs, numHMetrics) {
	const base = tables.hmtx.offset;
	const widths = new Array(numGlyphs).fill(0);
	let last = 0;
	for (let i = 0; i < numGlyphs; i += 1) {
		if (i < numHMetrics) {
			last = r.u16(base + i * 4);
		}
		widths[i] = last;
	}
	return widths;
}

/**
 * Characters we store widths for: Latin-1 + Latin Extended-A (covers names such as
 * "Zoë Müller" and "Łukasz"), plus common punctuation and dashes used in resumes.
 */
function charset() {
	const codes = [];
	for (let c = 0x20; c <= 0x7e; c += 1) codes.push(c); // ASCII
	for (let c = 0xa0; c <= 0x17f; c += 1) codes.push(c); // Latin-1 Supplement + Extended-A
	for (const c of [
		0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e,
		0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122, 0x00b7, 0x2192, 0x25cf
	]) {
		codes.push(c);
	}
	return codes;
}

function metricsFor(file) {
	const buf = readFileSync(join(fontDir, file));
	const r = new Reader(buf);
	const tables = readTables(r);
	const unitsPerEm = r.u16(tables.head.offset + 18);
	const numHMetrics = r.u16(tables.hhea.offset + 34);
	const ascender = r.i16(tables.hhea.offset + 4);
	const descender = r.i16(tables.hhea.offset + 6);
	const lineGap = r.i16(tables.hhea.offset + 8);
	const numGlyphs = r.u16(tables.maxp.offset + 4);
	const cmap = readCmap(r, tables.cmap.offset);
	const hmtx = readHmtx(r, tables, numGlyphs, numHMetrics);

	const widths = {};
	for (const code of charset()) {
		const gid = cmap.get(code);
		if (gid == null) continue;
		const w = hmtx[gid];
		if (w == null) continue;
		// Store per-1000-em so the runtime maths is just width * size / 1000.
		widths[code] = Math.round((w / unitsPerEm) * 1000);
	}

	const spaceGid = cmap.get(0x20);
	return {
		unitsPerEm,
		ascender: Math.round((ascender / unitsPerEm) * 1000),
		descender: Math.round((descender / unitsPerEm) * 1000),
		lineGap: Math.round((lineGap / unitsPerEm) * 1000),
		defaultWidth: spaceGid != null ? Math.round((hmtx[spaceGid] / unitsPerEm) * 1000) : 250,
		widths
	};
}

const files = readdirSync(fontDir).filter((f) => f.endsWith('.ttf'));
const out = {};
for (const f of files.sort()) {
	const key = f.replace(/\.ttf$/, '');
	out[key] = metricsFor(f);
	const n = Object.keys(out[key].widths).length;
	console.log(`${key}: unitsPerEm=${out[key].unitsPerEm} glyphs=${n}`);
}

writeFileSync(outFile, `${JSON.stringify(out)}\n`);
console.log(`\nwrote ${outFile}`);
