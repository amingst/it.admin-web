'use server';

import { MerchBulkActionsView } from '@/components/admin/merch-bulk-actions-view';
import {
	GetMerchBulkActionStatus,
	StartMerchBulkAction,
	CancelMerchBulkAction,
} from '@/app/actions/merch';
import { requireRole } from '@/lib/rbac';
import { isAdminOrHigher } from '@/lib/roleHelpers';
import { MerchBulkAction } from '@inverted-tech/fragments/Merch';

export default async function MerchBulkActionsPage() {
	await requireRole(isAdminOrHigher);

	const status = await GetMerchBulkActionStatus();

	async function startAction(action: MerchBulkAction) {
		'use server';
		await requireRole(isAdminOrHigher);
		const res = await StartMerchBulkAction(action);
		return { ok: Boolean(res), runningActions: res?.RunningActions ?? [] };
	}

	async function cancelAction(action: MerchBulkAction) {
		'use server';
		await requireRole(isAdminOrHigher);
		const res = await CancelMerchBulkAction(action);
		return { ok: Boolean(res), runningActions: res?.RunningActions ?? [] };
	}

	async function refreshStatus() {
		'use server';
		await requireRole(isAdminOrHigher);
		const res = await GetMerchBulkActionStatus();
		return { ok: Boolean(res), runningActions: res?.RunningActions ?? [] };
	}

	return (
		<MerchBulkActionsView
			initialActions={status?.RunningActions ?? []}
			startAction={startAction}
			cancelAction={cancelAction}
			refreshStatus={refreshStatus}
		/>
	);
}
