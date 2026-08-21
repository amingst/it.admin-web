'use client';

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
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
import {
	PaymentStatus,
	SubscriptionStatus,
	type GenericPaymentRecord,
	type GenericSubscriptionFullRecord,
} from '@inverted-tech/fragments/Authorization/Payment';

const subscriptionStatusMap = {
	Subscription_Unknown: { label: 'Unknown', variant: 'secondary' },
	Subscription_Pending: { label: 'Pending', variant: 'secondary' },
	Subscription_Active: { label: 'Active', variant: 'default' },
	Subscription_Stopped: { label: 'Stopped', variant: 'destructive' },
	Subscription_Paused: { label: 'Paused', variant: 'outline' },
} as const;

const paymentStatusMap = {
	Payment_Unknown: { label: 'Unknown', variant: 'secondary' },
	Payment_Pending: { label: 'Pending', variant: 'secondary' },
	Payment_Complete: { label: 'Complete', variant: 'default' },
	Payment_Failed: { label: 'Failed', variant: 'destructive' },
	Payment_Refunded: { label: 'Refunded', variant: 'outline' },
} as const;

function centsToCurrency(cents?: number) {
	if (typeof cents !== 'number') return '-';
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: 'USD',
		}).format(cents / 100);
	} catch {
		return `$${(cents / 100).toFixed(2)}`;
	}
}

type MaybeTimestamp = unknown;
function toJsDate(value: MaybeTimestamp): Date | undefined {
	if (!value) return;
	if (value instanceof Date) return value;
	if (typeof value === 'string') {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? undefined : d;
	}
	if (typeof value === 'object' && value && 'seconds' in (value as any)) {
		const s = Number((value as any).seconds ?? 0);
		const n = Number((value as any).nanos ?? 0);
		const d = new Date(s * 1000 + Math.floor(n / 1_000_000));
		return Number.isNaN(d.getTime()) ? undefined : d;
	}
}

function fmtDate(v?: MaybeTimestamp) {
	const d = v ? toJsDate(v) : undefined;
	return d ? d.toLocaleString() : '-';
}

function subscriptionStatusMeta(status?: unknown) {
	if (typeof status === 'string') {
		return (
			subscriptionStatusMap[status as keyof typeof subscriptionStatusMap] ??
			subscriptionStatusMap.Subscription_Unknown
		);
	}
	if (typeof status === 'number') {
		switch (status) {
			case SubscriptionStatus.Subscription_Active:
				return subscriptionStatusMap.Subscription_Active;
			case SubscriptionStatus.Subscription_Pending:
				return subscriptionStatusMap.Subscription_Pending;
			case SubscriptionStatus.Subscription_Paused:
				return subscriptionStatusMap.Subscription_Paused;
			case SubscriptionStatus.Subscription_Stopped:
				return subscriptionStatusMap.Subscription_Stopped;
			default:
				return subscriptionStatusMap.Subscription_Unknown;
		}
	}
	return subscriptionStatusMap.Subscription_Unknown;
}

function paymentStatusMeta(status?: unknown) {
	if (typeof status === 'string') {
		return (
			paymentStatusMap[status as keyof typeof paymentStatusMap] ??
			paymentStatusMap.Payment_Unknown
		);
	}
	if (typeof status === 'number') {
		switch (status) {
			case PaymentStatus.Payment_Complete:
				return paymentStatusMap.Payment_Complete;
			case PaymentStatus.Payment_Pending:
				return paymentStatusMap.Payment_Pending;
			case PaymentStatus.Payment_Refunded:
				return paymentStatusMap.Payment_Refunded;
			case PaymentStatus.Payment_Failed:
				return paymentStatusMap.Payment_Failed;
			default:
				return paymentStatusMap.Payment_Unknown;
		}
	}
	return paymentStatusMap.Payment_Unknown;
}

function isFailedPayment(status?: unknown) {
	if (typeof status === 'string') return status === 'Payment_Failed';
	if (typeof status === 'number') return status === PaymentStatus.Payment_Failed;
	return false;
}

function SummaryRow({
	label,
	value,
}: {
	label: string;
	value: string | number | undefined;
}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b pb-2 text-sm last:border-b-0">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-right">{value ?? '-'}</span>
		</div>
	);
}

type GenericSubscriptionLike = GenericSubscriptionFullRecord & {
	SubscriptionRecord?: GenericSubscriptionFullRecord['SubscriptionRecord'] & {
		Status?: unknown;
		UserID?: string;
	};
	UserID?: string;
	Payments?: (GenericPaymentRecord & { Status?: unknown })[];
	LastPaidUTC?: unknown;
	PaidThruUTC?: unknown;
	RenewsOnUTC?: unknown;
};

function PaymentCard({
	payment,
	userId,
	internalSubscriptionId,
	reRunFailedPaymentAction,
	rerunFormId,
}: {
	payment: GenericPaymentRecord & { Status?: unknown };
	userId?: string;
	internalSubscriptionId?: string;
	reRunFailedPaymentAction?: (formData: FormData) => Promise<void>;
	rerunFormId: string;
}) {
	const status = paymentStatusMeta(payment.Status);
	const canRerun =
		isFailedPayment(payment.Status) &&
		Boolean(reRunFailedPaymentAction) &&
		Boolean(userId) &&
		Boolean(internalSubscriptionId);
	return (
		<Card>
			<CardContent className="space-y-3 pt-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="text-sm font-medium">
							{payment.InternalPaymentID || 'Payment'}
						</div>
						<div className="text-xs text-muted-foreground">
							{fmtDate(payment.CreatedOnUTC)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Badge variant={status.variant}>{status.label}</Badge>
						{canRerun ? (
							<>
								<form
									id={rerunFormId}
									action={reRunFailedPaymentAction}
								>
									<input
										type="hidden"
										name="userId"
										value={userId}
									/>
									<input
										type="hidden"
										name="internalSubscriptionId"
										value={internalSubscriptionId}
									/>
								</form>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="outline"
											size="sm"
										>
											Rerun Payment
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Rerun failed payment?</AlertDialogTitle>
											<AlertDialogDescription>
												This will attempt to process this subscription&apos;s
												payment again.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction asChild>
												<Button
													size="sm"
													form={rerunFormId}
													type="submit"
												>
													Rerun Payment
												</Button>
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</>
						) : null}
					</div>
				</div>
				<div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
					<div>
						<div className="text-xs text-muted-foreground">Amount</div>
						<div>{centsToCurrency(payment.AmountCents)}</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">Tax</div>
						<div>{centsToCurrency(payment.TaxCents)}</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">Total</div>
						<div>{centsToCurrency(payment.TotalCents)}</div>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-2">
					<div>Paid: {fmtDate(payment.PaidOnUTC)}</div>
					<div>Paid Thru: {fmtDate(payment.PaidThruUTC)}</div>
					<div>Processor Payment ID: {payment.ProcessorPaymentID || '-'}</div>
					<div>Created By: {payment.CreatedBy || '-'}</div>
				</div>
			</CardContent>
		</Card>
	);
}

function SubscriptionItem({
	item,
	index,
	userId,
	cancelSubscriptionAction,
	reRunFailedPaymentAction,
}: {
	item: GenericSubscriptionLike;
	index: number;
	userId?: string;
	cancelSubscriptionAction?: (formData: FormData) => Promise<void>;
	reRunFailedPaymentAction?: (formData: FormData) => Promise<void>;
}) {
	const record = item.SubscriptionRecord;
	const status = subscriptionStatusMeta(record?.Status);
	const payments = item.Payments ?? [];
	const title = record?.InternalSubscriptionID || `Subscription ${index + 1}`;
	const internalSubscriptionId = record?.InternalSubscriptionID ?? '';
	const cancelUserId = record?.UserID || item.UserID || userId || '';
	const canCancel =
		Boolean(cancelSubscriptionAction) &&
		Boolean(cancelUserId) &&
		Boolean(internalSubscriptionId);
	const canceledAt =
		toJsDate((record as { CancelOnUTC?: unknown } | undefined)?.CancelOnUTC) ??
		toJsDate(record?.CanceledOnUTC);
	const isCanceled = Boolean(canceledAt && canceledAt.getTime() > 0);
	const cancelFormId = `cancel-subscription-${internalSubscriptionId || index}`;

	// TODO: Add Reconcile Subscription Button
	return (
		<AccordionItem value={`sub-${index}`}>
			<AccordionTrigger>
				<div className="flex flex-1 flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<div className="text-sm font-medium">{title}</div>
						<div className="text-xs text-muted-foreground">
							{record?.ProcessorName || '-'} �{' '}
							{centsToCurrency(record?.AmountCents)}
						</div>
					</div>
					<Badge variant={status.variant}>{status.label}</Badge>
				</div>
			</AccordionTrigger>
			<AccordionContent>
				<div className="space-y-6">
					<div className="flex flex-wrap items-center justify-end gap-2">
						{!isCanceled && internalSubscriptionId ? (
							canCancel ? (
								<form
									id={cancelFormId}
									action={cancelSubscriptionAction}
								>
									<input
										type="hidden"
										name="userId"
										value={cancelUserId}
									/>
									<input
										type="hidden"
										name="internalSubscriptionId"
										value={internalSubscriptionId}
									/>
									<input
										type="hidden"
										name="reason"
										value="Canceled via admin portal"
									/>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="destructive"
												size="sm"
											>
												Cancel Subscription
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Cancel subscription?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This will cancel the subscription immediately and stop
													future renewals.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction asChild>
													<Button
														variant="destructive"
														size="sm"
														form={cancelFormId}
														type="submit"
													>
														Cancel Subscription
													</Button>
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</form>
							) : (
								<Button
									variant="destructive"
									size="sm"
									disabled
								>
									Cancel Subscription
								</Button>
							)
						) : null}
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2 rounded-lg border p-4">
							<div className="text-sm font-medium">Subscription Details</div>
							<SummaryRow
								label="Processor Customer ID"
								value={record?.ProcessorCustomerID || '-'}
							/>
							<SummaryRow
								label="Processor Subscription ID"
								value={record?.ProcessorSubscriptionID || '-'}
							/>
							<SummaryRow
								label="Total"
								value={centsToCurrency(record?.TotalCents)}
							/>
							<SummaryRow
								label="Tax"
								value={centsToCurrency(record?.TaxCents)}
							/>
							<SummaryRow
								label="Created"
								value={fmtDate(record?.CreatedOnUTC)}
							/>
							<SummaryRow
								label="Modified"
								value={fmtDate(record?.ModifiedOnUTC)}
							/>
							<SummaryRow
								label="Canceled"
								value={fmtDate(record?.CanceledOnUTC)}
							/>
						</div>
						<div className="space-y-2 rounded-lg border p-4">
							<div className="text-sm font-medium">Billing Timeline</div>
							<SummaryRow
								label="Last Paid"
								value={fmtDate(item.LastPaidUTC)}
							/>
							<SummaryRow
								label="Paid Thru"
								value={fmtDate(item.PaidThruUTC)}
							/>
							<SummaryRow
								label="Renews On"
								value={fmtDate(item.RenewsOnUTC)}
							/>
						</div>
					</div>

					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="text-sm font-medium">Payments</div>
							<div className="text-xs text-muted-foreground">
								{payments.length} total
							</div>
						</div>
						{payments.length ? (
							<div className="space-y-3">
								{payments.map((payment, idx) => (
									<PaymentCard
										key={`${payment.InternalPaymentID}-${idx}`}
										payment={payment}
										userId={cancelUserId}
										internalSubscriptionId={internalSubscriptionId}
										reRunFailedPaymentAction={reRunFailedPaymentAction}
										rerunFormId={`rerun-payment-${internalSubscriptionId || index}-${payment.InternalPaymentID || idx}`}
									/>
								))}
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No payments recorded.
							</div>
						)}
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

export function UserSubscriptions({
	subscriptions,
	userId,
	cancelSubscriptionAction,
	reRunFailedPaymentAction,
}: {
	subscriptions?: {
		Generic?: GenericSubscriptionFullRecord[] | GenericSubscriptionFullRecord;
	};
	userId?: string;
	cancelSubscriptionAction?: (formData: FormData) => Promise<void>;
	reRunFailedPaymentAction?: (formData: FormData) => Promise<void>;
}) {
	const genericList = Array.isArray(subscriptions?.Generic)
		? (subscriptions?.Generic as GenericSubscriptionLike[])
		: subscriptions?.Generic
			? ([subscriptions.Generic] as GenericSubscriptionLike[])
			: [];

	if (!genericList.length) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Subscriptions</CardTitle>
					<CardDescription>Generic subscription records</CardDescription>
				</CardHeader>
				<CardContent>
					<Empty className="border">
						<EmptyHeader>
							<EmptyTitle>No subscriptions</EmptyTitle>
							<EmptyDescription>
								This user has no subscription records yet.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Subscriptions</CardTitle>
				<CardDescription>Generic subscription records</CardDescription>
			</CardHeader>
			<CardContent>
				<Accordion
					type="multiple"
					className="space-y-2"
				>
					{genericList.map((item, index) => (
						<SubscriptionItem
							key={`sub-${index}`}
							item={item}
							index={index}
							userId={userId}
							cancelSubscriptionAction={cancelSubscriptionAction}
							reRunFailedPaymentAction={reRunFailedPaymentAction}
						/>
					))}
				</Accordion>
			</CardContent>
		</Card>
	);
}
