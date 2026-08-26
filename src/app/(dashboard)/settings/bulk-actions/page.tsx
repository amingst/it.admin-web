'use server';

import { BulkPaymentActionsView } from '@/components/admin/bulk-payment-actions-view';
import {
	GetPaymentBulkActionStatus,
	StartBulkPaymentAction,
	CancelPaymentBulkAction,
} from '@/app/actions/payment';
import { requireRole } from '@/lib/rbac';
import { isAdminOrHigher } from '@/lib/roleHelpers';
import { PaymentBulkAction } from '@inverted-tech/fragments/Authorization/Payment';

export default async function BulkPaymentActionsPage() {
	await requireRole(isAdminOrHigher);

	const status = await GetPaymentBulkActionStatus();

	async function startAction(action: PaymentBulkAction) {
		'use server';
		await requireRole(isAdminOrHigher);
		const res = await StartBulkPaymentAction(action);
		return { ok: Boolean(res), runningActions: res?.RunningActions ?? [] };
	}

	async function cancelAction(action: PaymentBulkAction) {
		'use server';
		await requireRole(isAdminOrHigher);
		const res = await CancelPaymentBulkAction(action);
		return { ok: Boolean(res), runningActions: res?.RunningActions ?? [] };
	}

	async function refreshStatus() {
		'use server';
		await requireRole(isAdminOrHigher);
		const res = await GetPaymentBulkActionStatus();
		return { ok: Boolean(res), runningActions: res?.RunningActions ?? [] };
	}

	return (
		<BulkPaymentActionsView
			initialActions={status?.RunningActions ?? []}
			startAction={startAction}
			cancelAction={cancelAction}
			refreshStatus={refreshStatus}
		/>
	);
}
