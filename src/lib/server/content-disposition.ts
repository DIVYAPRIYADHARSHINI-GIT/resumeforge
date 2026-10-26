// Builds a Content-Disposition header that is safe for non-English file names.
//
// HTTP header values are Latin-1 only, so a name like "Resume_Łukasz_Østergaard.pdf"
// throws when set directly. RFC 6266/5987 solves this: send an ASCII-only `filename` for
// old clients plus a percent-encoded UTF-8 `filename*` that modern browsers prefer.

/** Strip a name down to characters that are safe inside a quoted Latin-1 header. */
function asciiFallback(filename: string): string {
	let out = '';
	for (const ch of filename) {
		const code = ch.codePointAt(0) ?? 0;
		if (code >= 32 && code <= 126 && ch !== '"' && ch !== '\\') {
			out += ch;
		} else if (code > 126) {
			// Drop accents where we can, otherwise use an underscore.
			const folded = ch
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^\x20-\x7e]/g, '');
			out += folded || '_';
		}
	}
	// Collapse the underscores a fold may have produced and keep a sane name.
	const cleaned = out.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
	return cleaned || 'download';
}

export function contentDisposition(filename: string): string {
	const fallback = asciiFallback(filename);
	const encoded = encodeURIComponent(filename);
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
