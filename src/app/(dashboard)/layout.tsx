import type { CSSProperties, ReactNode } from 'react';

import { AppSidebar, SiteHeader } from '@/components/layout/nav';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from 'sonner';
import { UserProvider, useUser } from '@/components/context/user-context';
import { SessionRefresher } from '@/components/auth/session-refresher';
import { getSession } from '@/lib/cookies';
import { redirect } from 'next/navigation';

type DashboardLayoutProps = {
	children: ReactNode;
};

/**
 * Shared chrome for dashboard pages: sidebar navigation and top header.
 */
export default async function DashboardLayout({
	children,
}: DashboardLayoutProps) {
	const user = await getSession();
	return (
		<UserProvider user={user}>
			{user && <SessionRefresher exp={user.exp} />}
			<SidebarProvider
				style={
					{
						'--sidebar-width': 'calc(var(--spacing) * 72)',
						'--header-height': 'calc(var(--spacing) * 12)',
					} as CSSProperties
				}
			>
				<AppSidebar variant='inset' />
				<SidebarInset>
					<SiteHeader />
					<div className='flex flex-1 flex-col'>
						<div className='dashboard-shell @container/main'>
							{children}
						</div>
					</div>
					<Toaster />
				</SidebarInset>
			</SidebarProvider>
		</UserProvider>
	);
}
