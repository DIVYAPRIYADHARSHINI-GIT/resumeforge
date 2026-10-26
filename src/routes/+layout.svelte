<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { app, BACKUP_REMINDER_DAYS } from '#lib/store/app-state.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import { relativeDayLabel } from '#lib/logic/dates';

	let { children } = $props();

	// Load from the ResumeStore on first mount (client only - localStorage is per browser).
	$effect(() => {
		app.init();
	});

	const NAV = [
		{ href: '/resumes', label: 'Resumes', icon: 'stack' },
		{ href: '/editor', label: 'Editor', icon: 'pen' },
		{ href: '/job-match', label: 'Job match', icon: 'target' },
		{ href: '/cover-letters', label: 'Cover letters', icon: 'letter' },
		{ href: '/applications', label: 'Applications', icon: 'list' },
		{ href: '/settings', label: 'Settings', icon: 'gear' }
	] as const;

	const current = $derived(page.url.pathname);

	function isActive(href: string): boolean {
		if (href === '/resumes') return current === '/' || current.startsWith('/resumes');
		return current.startsWith(href);
	}

	const saveLabel = $derived(
		app.saveState === 'saving'
			? 'Saving...'
			: app.saveState === 'saved'
				? 'Saved'
				: app.saveState === 'error'
					? 'Not saved'
					: ''
	);

	const backupDays = $derived(app.daysSinceBackup);
	const showBackupReminder = $derived(app.loaded && app.needsBackupReminder);
</script>

<svelte:head>
	<title>ResumeForge - Build it. Tailor it. Land it.</title>
</svelte:head>

<div class="flex min-h-full flex-col rf-print-root">
	<!-- Top bar -->
	<header
		class="no-print sticky top-0 z-30 flex items-center gap-3 px-3 py-2 text-white md:px-4"
		style="background: var(--topbar)"
	>
		<a href="/resumes" class="flex items-center gap-2.5 rounded-lg px-1 py-1" aria-label="ResumeForge home">
			<Logo size={30} />
			<span class="flex flex-col leading-none">
				<span class="text-[15px] font-semibold tracking-tight">ResumeForge</span>
				<span class="mt-0.5 hidden text-[11px] text-white/60 sm:block">Build it. Tailor it. Land it.</span>
			</span>
		</a>

		<div class="ml-auto flex items-center gap-2">
			{#if saveLabel}
				<span
					class="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex"
					style="background: rgba(255,255,255,0.1)"
					aria-live="polite"
				>
					<span
						class="inline-block h-1.5 w-1.5 rounded-full"
						style="background: {app.saveState === 'error'
							? 'var(--color-bad)'
							: app.saveState === 'saved'
								? 'var(--color-good)'
								: '#ffffff'}"
					></span>
					{saveLabel}
				</span>
			{/if}

			<!-- Persistent storage badge, required on every screen -->
			<a
				href="/privacy"
				class="tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/90 hover:text-white"
				style="background: rgba(255,255,255,0.1)"
				title="Read about storage and backups"
			>
				<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path
						d="M8 1.5l5 2v4c0 3-2.1 5.6-5 6.9C5.1 13.1 3 10.5 3 7.5v-4l5-2z"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linejoin="round"
					/>
				</svg>
				<span class="hidden sm:inline">Your data stays in this browser</span>
				<span class="sm:hidden">Local only</span>
			</a>
		</div>
	</header>

	{#if showBackupReminder}
		<div
			class="no-print flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
			style="background: #fff4e6; color: #7a3d02; border-bottom: 1px solid #ffd8a8"
			role="status"
		>
			<strong class="font-semibold">Backup reminder:</strong>
			<span>
				{#if app.data.settings.lastBackupAt == null}
					You have not exported a backup yet. Your data only exists in this browser.
				{:else}
					Your last backup was {backupDays} days ago (over {BACKUP_REMINDER_DAYS} days).
				{/if}
			</span>
			<a href="/privacy" class="font-semibold underline underline-offset-2">Export a backup</a>
		</div>
	{/if}

	<div class="flex flex-1 flex-col md:flex-row">
		<!-- Desktop sidebar -->
		<nav
			class="no-print hidden w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex"
			style="border-color: var(--border); background: var(--panel)"
			aria-label="Main"
		>
			{#each NAV as item (item.href)}
				<a
					href={item.href}
					class="tap flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
					style={isActive(item.href)
						? 'background: var(--color-ember); color: #fff;'
						: 'color: var(--text);'}
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<span aria-hidden="true" class="inline-flex w-4 justify-center">
						{#if item.icon === 'stack'}
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5l6-3 6 3-6 3-6-3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 8.5l6 3 6-3M2 11.5l6 3 6-3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
						{:else if item.icon === 'pen'}
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
						{:else if item.icon === 'target'}
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
						{:else if item.icon === 'letter'}
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 4.5L8 8.5l5.5-4" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
						{:else if item.icon === 'list'}
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
						{:else}
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
						{/if}
					</span>
					{item.label}
				</a>
			{/each}

			<div class="mt-auto pt-3 text-xs" style="color: var(--text-muted)">
				<p class="px-3">
					Last backup: {relativeDayLabel(app.data.settings.lastBackupAt)}
				</p>
				<a href="/privacy" class="mt-1 block px-3 underline underline-offset-2">Privacy and backup</a>
			</div>
		</nav>

		<main class="min-w-0 flex-1 pb-20 md:pb-0">
			{@render children()}
		</main>
	</div>

	<!-- Mobile bottom tab bar -->
	<nav
		class="no-print fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t md:hidden"
		style="border-color: var(--border); background: var(--surface-raised)"
		aria-label="Main"
	>
		{#each NAV as item (item.href)}
			<a
				href={item.href}
				class="tap flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium"
				style={isActive(item.href) ? 'color: var(--color-ember)' : 'color: var(--text-muted)'}
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				<span aria-hidden="true">
					{#if item.icon === 'stack'}
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 5l6-3 6 3-6 3-6-3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 8.5l6 3 6-3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
					{:else if item.icon === 'pen'}
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
					{:else if item.icon === 'target'}
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
					{:else if item.icon === 'letter'}
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 4.5L8 8.5l5.5-4" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
					{:else if item.icon === 'list'}
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
					{:else}
						<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
					{/if}
				</span>
				<span>{item.label === 'Cover letters' ? 'Letters' : item.label === 'Applications' ? 'Applied' : item.label}</span>
			</a>
		{/each}
	</nav>

	<Toasts />
</div>
