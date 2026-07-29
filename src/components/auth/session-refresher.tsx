'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { refreshSession, logoutAction } from '@/app/actions/auth';

const REFRESH_BUFFER_MS = 60_000;
const MIN_DELAY_MS = 1_000;

export function SessionRefresher({ exp }: { exp: number }) {
	const router = useRouter();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		let cancelled = false;

		function schedule(expSeconds: number) {
			const delay = Math.max(
				expSeconds * 1000 - Date.now() - REFRESH_BUFFER_MS,
				MIN_DELAY_MS,
			);
			timeoutRef.current = setTimeout(doRefresh, delay);
		}

		async function doRefresh() {
			const result = await refreshSession();
			if (cancelled) return;

			if (result.ok && result.exp) {
				//console.log('Session refreshed, new expiration:', result.exp);
				schedule(result.exp);
				router.refresh();
			} else {
				//console.warn('Session refresh failed, logging out');
				await logoutAction();
				router.push('/login');
			}
		}

		schedule(exp);

		return () => {
			cancelled = true;
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, [exp, router]);

	return null;
}
