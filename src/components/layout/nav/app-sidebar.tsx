'use client';

import * as React from 'react';
import {
	IconChartBubble,
	IconHelp,
	IconInnerShadowTop,
	IconSearch,
} from '@tabler/icons-react';

import { NavUser } from '@/components/layout/nav/nav-user';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
	Bell,
	BookLockIcon,
	BriefcaseBusiness,
	CreditCard,
	FileText,
	FilesIcon,
	Images,
	MessageSquare,
	Palette,
	PlusSquare,
	Settings as SettingsIcon,
	ShoppingBag,
	UserIcon,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { NavMain } from './nav-main';
import { useUser } from '@/components/context/user-context';
import {
	isWriterOrHigher,
	isAdminOrHigher,
	isMemberManagerOrHigher,
	isOwner,
} from '@/lib/roleHelpers';

const data = {
	user: {
		name: 'shadcn',
		email: 'm@example.com',
		avatar: '/avatars/shadcn.jpg',
	},
	navMain: [
		{
			title: 'New Post',
			icon: PlusSquare,
			url: '/content/create',
		},
		{
			title: 'All Posts',
			icon: FileText,
			url: '/content',
		},
		{
			title: 'Asset Library',
			icon: Images,
			url: '/assets',
		},
		// {
		// 	title: 'Events',
		// 	icon: CalendarDays,
		// 	url: '/events',
		// 	items: [
		// 		{ title: 'Create', icon: CalendarDays, url: '/events/create' },
		// 		{
		// 			title: 'Create Recurring',
		// 			icon: CalendarDays,
		// 			url: '/events/create/recurring',
		// 		},
		// 		{
		// 			title: 'Events (future)',
		// 			icon: CalendarDays,
		// 			url: '/settings/events',
		// 		},
		// 	],
		// },
		{
			title: 'Members',
			icon: UserIcon,
			url: '/users',
		},
		{
			title: 'Audit Log',
			icon: BookLockIcon,
			url: '/audit-log',
		},
		{
			title: 'Careers',
			icon: BriefcaseBusiness,
			url: '/careers',
		},
		{
			title: 'Settings',
			icon: SettingsIcon,
			url: '/settings',
			items: [
				{
					title: 'Personalization Settings',
					icon: Palette,
					url: '/settings/personalization',
				},
				{
					title: 'Notifications Settings',
					icon: Bell,
					url: '/settings/notifications',
				},
				{
					title: 'Subscriptions Settings',
					icon: CreditCard,
					url: '/settings/subscriptions',
				},
				{
					title: 'Comments Settings',
					icon: MessageSquare,
					url: '/settings/comments',
				},
				{
					title: 'Content Settings',
					icon: FilesIcon,
					url: '/settings/content',
				},
				{
					title: 'Bulk Payment Actions',
					icon: CreditCard,
					url: '/settings/bulk-actions',
				},
				{
					title: 'Bulk Merch Actions',
					icon: ShoppingBag,
					url: '/settings/merch-bulk-actions',
				},
			],
		},
	],
	navQuick: [
		// { title: 'Upload Asset', url: '/asset/upload', icon: IconUpload }
	],
	navSecondary: [
		{
			title: 'Get Help',
			url: '#',
			icon: IconHelp,
		},
		{
			title: 'Search',
			url: '#',
			icon: IconSearch,
		},
	],
};

type NavItem = {
	title: string;
	icon: React.ComponentType<any>;
	url: string;
	items?: NavItem[];
};

export function AppSidebar({
	headerTitle = 'Inverted CMS',
	...props
}: React.ComponentProps<typeof Sidebar> & {
	headerTitle?: string;
}) {
	const user = useUser();
	const roles = user?.roles ?? [];

	const navMain = (data.navMain as NavItem[])
		.filter((item) => {
			switch (item.url) {
				case '/content/create':
				case '/content':
				case '/assets':
					return isWriterOrHigher(roles);
				case '/users':
					return isMemberManagerOrHigher(roles);
				case '/settings':
					return isAdminOrHigher(roles);
				case '/audit-log':
					return isAdminOrHigher(roles);
				case '/careers':
					return isAdminOrHigher(roles);

				default:
					return true;
			}
		})
		.map((item) => {
			if (item.url === '/settings' && item.items) {
				return {
					...item,
					items: item.items.filter((sub) => {
						if (sub.url === '/settings/notifications')
							return isOwner(roles);
						return isAdminOrHigher(roles);
					}),
				};
			}
			return item;
		});
	return (
		<Sidebar collapsible='offcanvas' {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className='data-[slot=sidebar-menu-button]:!p-1.5'
						>
							<a href='/'>
								<IconInnerShadowTop className='!size-5' />
								<span className='text-base font-semibold'>
									{headerTitle}
								</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{/* <NavQuick items={data.navQuick} /> */}
				<Separator />
				<NavMain items={navMain} />
				{/* <NavSecondary items={data.navSecondary} className='mt-auto' /> */}
			</SidebarContent>
			<SidebarFooter>
				{/* Figure out better way to give user data here */}
				<NavUser
					user={{
						name: user?.displayName || '',
						email: '',
						avatar: data.user.avatar,
					}}
				/>
			</SidebarFooter>
		</Sidebar>
	);
}
