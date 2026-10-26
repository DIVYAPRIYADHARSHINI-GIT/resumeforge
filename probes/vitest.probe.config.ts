// Separate config for live-server probes so they never run in the normal unit suite.
// `tsconfigRaw` keeps the transformer from trying to resolve SvelteKit's generated
// `$app/tsconfig`, which only exists for the app build.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			'#lib': fileURLToPath(new URL('../src/lib', import.meta.url))
		}
	},
	oxc: {
		// Point at the probe tsconfig so src/ files are not resolved against the app's
		// generated `$app/tsconfig`, which only exists during a SvelteKit build.
		tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url))
	},
	test: {
		include: ['probes/**/*.probe.ts'],
		environment: 'node'
	}
});
