'use client';

import * as React from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { tsToDate } from '@/lib/utils';
import { PaymentBulkAction } from '@inverted-tech/fragments/Authorization/Payment';

type BulkActionProgressLike = {
	Action: PaymentBulkAction;
	Progress?: number;
	StatusMessage?: string;
	CreatedOnUTC?: unknown;
	CanceledOnUTC?: unknown;
	CompletedOnUTC?: unknown;
	CreatedBy?: string;
	CanceledBy?: string;
};

type ActionResult = {
	ok: boolean;
	runningActions: BulkActionProgressLike[];
};

type BulkActionFn = (action: PaymentBulkAction) => Promise<ActionResult>;
type RefreshFn = () => Promise<ActionResult>;

const BULK_ACTION_META: Record<
	PaymentBulkAction,
	{ label: string; description: string }
> = {
	[PaymentBulkAction.LookForNewPaymentsOneDay]: {
		label: 'Look For New Payments (1 Day)',
		description:
			'Scans the last 24 hours of processor activity for payments not yet recorded.',
	},
	[PaymentBulkAction.LookForNewPaymentsOneWeek]: {
		label: 'Look For New Payments (1 Week)',
		description:
			'Scans the last 7 days of processor activity for payments not yet recorded.',
	},
	[PaymentBulkAction.LookForNewPaymentsOneMonth]: {
		label: 'Look For New Payments (1 Month)',
		description:
			'Scans the last 30 days of processor activity for payments not yet recorded.',
	},
	[PaymentBulkAction.ReconcileAll]: {
		label: 'Reconcile All Subscriptions',
		description:
			'Reconciles every subscription record against the payment processor.',
	},
	[PaymentBulkAction.ReconcileStripeTaxRates]: {
		label: 'Reconcile Stripe Tax Rates',
		description: 'Syncs tax rate configuration with Stripe.',
	},
	[PaymentBulkAction.LookForMissingSubscriptions]: {
		label: 'Look For Missing Subscriptions',
		description:
			'Scans the payment processor for subscriptions missing from our records.',
	},
};

const BULK_ACTIONS = Object.values(PaymentBulkAction).filter(
	(v) => typeof v === 'number',
) as PaymentBulkAction[];

const BULK_ACTION_NAME_TO_VALUE: Record<string, PaymentBulkAction> =
	Object.fromEntries(
		Object.entries(PaymentBulkAction).filter(
			(entry): entry is [string, PaymentBulkAction] =>
				typeof entry[1] === 'number',
		),
	);

const POLL_INTERVAL_MS = 5000;

function normalizeAction(action: unknown): PaymentBulkAction | undefined {
	if (typeof action === 'number') return action as PaymentBulkAction;
	if (typeof action === 'string') return BULK_ACTION_NAME_TO_VALUE[action];
	return undefined;
}

function fmtDate(v?: unknown) {
	const d = tsToDate(v);
	return d ? d.toLocaleString() : '-';
}

function progressPercent(p?: number) {
	if (typeof p !== 'number' || Number.isNaN(p)) return 0;
	const pct = p <= 1 ? p * 100 : p;
	return Math.min(100, Math.max(0, Math.round(pct)));
}

function statusOf(item?: BulkActionProgressLike) {
	if (!item) return 'idle' as const;
	if (tsToDate(item.CanceledOnUTC)) return 'canceled' as const;
	if (tsToDate(item.CompletedOnUTC)) return 'completed' as const;
	return 'running' as const;
}

function StatusBadge({ status }: { status: ReturnType<typeof statusOf> }) {
	switch (status) {
		case 'running':
			return <Badge>Running</Badge>;
		case 'completed':
			return <Badge variant='outline'>Completed</Badge>;
		case 'canceled':
			return <Badge variant='secondary'>Canceled</Badge>;
		default:
			return <Badge variant='secondary'>Idle</Badge>;
	}
}

function BulkActionRow({
	action,
	item,
	onStart,
	onCancel,
	busy,
}: {
	action: PaymentBulkAction;
	item?: BulkActionProgressLike;
	onStart: (action: PaymentBulkAction) => void;
	onCancel: (action: PaymentBulkAction) => void;
	busy: boolean;
}) {
	const meta = BULK_ACTION_META[action];
	const status = statusOf(item);
	const isRunning = status === 'running';
	const pct = progressPercent(item?.Progress);

	return (
		<div className='space-y-3 rounded-lg border p-4'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div className='space-y-1'>
					<div className='flex items-center gap-2'>
						<div className='text-sm font-medium'>{meta.label}</div>
						<StatusBadge status={status} />
					</div>
					<div className='text-xs text-muted-foreground'>
						{meta.description}
					</div>
				</div>
				<div className='flex shrink-0 items-center gap-2'>
					{isRunning ? (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant='destructive'
									size='sm'
									disabled={busy}
								>
									Cancel
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Cancel {meta.label}?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This will stop the running job. Work
										already completed will not be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Back</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => onCancel(action)}
									>
										Cancel Job
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					) : (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button size='sm' disabled={busy}>
									Start
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Start {meta.label}?
									</AlertDialogTitle>
									<AlertDialogDescription>
										{meta.description}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => onStart(action)}
									>
										Start
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</div>

			{item ? (
				<div className='space-y-2'>
					<Progress value={pct} />
					<div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
						<span>{item.StatusMessage || '-'}</span>
						<span>{pct}%</span>
					</div>
					<div className='grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2'>
						<div>Started: {fmtDate(item.CreatedOnUTC)}</div>
						<div>Created By: {item.CreatedBy || '-'}</div>
						{status === 'completed' ? (
							<div>Completed: {fmtDate(item.CompletedOnUTC)}</div>
						) : null}
						{status === 'canceled' ? (
							<>
								<div>Canceled: {fmtDate(item.CanceledOnUTC)}</div>
								<div>Canceled By: {item.CanceledBy || '-'}</div>
							</>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}

export function BulkPaymentActionsView({
	initialActions,
	startAction,
	cancelAction,
	refreshStatus,
}: {
	initialActions: BulkActionProgressLike[];
	startAction: BulkActionFn;
	cancelAction: BulkActionFn;
	refreshStatus: RefreshFn;
}) {
	const [actions, setActions] =
		React.useState<BulkActionProgressLike[]>(initialActions);
	const [busyAction, setBusyAction] = React.useState<PaymentBulkAction | null>(
		null,
	);
	const [isRefreshing, setIsRefreshing] = React.useState(false);

	const byAction = React.useMemo(() => {
		const map = new Map<PaymentBulkAction, BulkActionProgressLike>();
		for (const item of actions) {
			const action = normalizeAction(item.Action);
			if (action !== undefined) map.set(action, item);
		}
		return map;
	}, [actions]);

	const runningActions = actions.filter((a) => statusOf(a) === 'running');
	const hasRunning = runningActions.length > 0;

	const doRefresh = React.useCallback(
		async (silent = false) => {
			if (!silent) setIsRefreshing(true);
			try {
				const res = await refreshStatus();
				if (res.ok) {
					setActions(res.runningActions);
				} else if (!silent) {
					toast.error('Failed to load bulk action status');
				}
			} catch {
				if (!silent) toast.error('Failed to load bulk action status');
			} finally {
				if (!silent) setIsRefreshing(false);
			}
		},
		[refreshStatus],
	);

	React.useEffect(() => {
		doRefresh(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	React.useEffect(() => {
		// No push channel from the server (no SSE/websocket) — while a job is
		// running, keep polling for status until it finishes or is canceled.
		if (!hasRunning) return;
		const id = setInterval(() => doRefresh(true), POLL_INTERVAL_MS);
		return () => clearInterval(id);
	}, [hasRunning, doRefresh]);

	async function handleStart(action: PaymentBulkAction) {
		setBusyAction(action);
		try {
			const res = await startAction(action);
			if (res.ok) {
				setActions(res.runningActions);
				toast.success(`${BULK_ACTION_META[action].label} started`);
			} else {
				toast.error(`Failed to start ${BULK_ACTION_META[action].label}`);
			}
		} catch {
			toast.error(`Failed to start ${BULK_ACTION_META[action].label}`);
		} finally {
			setBusyAction(null);
		}
	}

	async function handleCancel(action: PaymentBulkAction) {
		setBusyAction(action);
		try {
			const res = await cancelAction(action);
			if (res.ok) {
				setActions(res.runningActions);
				toast.success(`${BULK_ACTION_META[action].label} canceled`);
			} else {
				toast.error(`Failed to cancel ${BULK_ACTION_META[action].label}`);
			}
		} catch {
			toast.error(`Failed to cancel ${BULK_ACTION_META[action].label}`);
		} finally {
			setBusyAction(null);
		}
	}

	return (
		<Card>
			<CardHeader className='flex flex-row items-start justify-between gap-4'>
				<div>
					<CardTitle>Bulk Payment Actions</CardTitle>
					<CardDescription>
						Start, cancel, and monitor bulk payment reconciliation
						jobs.
					</CardDescription>
				</div>
				<Button
					variant='outline'
					size='sm'
					disabled={isRefreshing}
					onClick={() => doRefresh(false)}
				>
					<RefreshCw
						className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
					/>
					Refresh
				</Button>
			</CardHeader>
			<CardContent className='space-y-6'>
				<div className='space-y-3'>
					<div className='text-sm font-medium'>Running Jobs</div>
					{runningActions.length ? (
						<div className='space-y-3'>
							{runningActions.map((item) => {
								const action = normalizeAction(item.Action);
								const label =
									action !== undefined
										? BULK_ACTION_META[action].label
										: 'Unknown Action';
								const pct = progressPercent(item.Progress);
								return (
									<div
										key={`running-${action}-${String(item.CreatedOnUTC)}`}
										className='space-y-2 rounded-lg border p-4'
									>
										<div className='flex flex-wrap items-center justify-between gap-2'>
											<div className='text-sm font-medium'>
												{label}
											</div>
											<Badge>Running</Badge>
										</div>
										<Progress value={pct} />
										<div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
											<span>{item.StatusMessage || '-'}</span>
											<span>{pct}%</span>
										</div>
										<div className='grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2'>
											<div>Started: {fmtDate(item.CreatedOnUTC)}</div>
											<div>
												Created By: {item.CreatedBy || '-'}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className='text-sm text-muted-foreground'>
							No jobs currently running.
						</div>
					)}
				</div>
				<div className='space-y-3'>
					<div className='text-sm font-medium'>Available Actions</div>
					<div className='space-y-3'>
						{BULK_ACTIONS.map((action) => (
							<BulkActionRow
								key={action}
								action={action}
								item={byAction.get(action)}
								onStart={handleStart}
								onCancel={handleCancel}
								busy={busyAction !== null}
							/>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
