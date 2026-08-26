'use server';

import { create, toJsonString } from '@bufbuild/protobuf';
import { authHeaders } from '@/lib/cookies';
import {
	MerchBulkAction,
	MerchBulkActionStartRequestSchema,
	MerchBulkActionStartResponse,
	MerchBulkActionCancelRequestSchema,
	MerchBulkActionCancelResponse,
	MerchBulkActionStatusRequestSchema,
	MerchBulkActionStatusResponse,
} from '@inverted-tech/fragments/Merch';

const API_BASE_URL = process.env.API_BASE_URL!;
const API_BASE = `${API_BASE_URL}`;

export async function StartMerchBulkAction(action: MerchBulkAction) {
	try {
		const url = `${API_BASE}/merch/admin/bulk/start`;
		const req = create(MerchBulkActionStartRequestSchema, {
			Action: action,
		});

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(MerchBulkActionStartRequestSchema, req),
		});

		const body: MerchBulkActionStartResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return undefined;
	}
}

export async function CancelMerchBulkAction(action: MerchBulkAction) {
	try {
		const url = `${API_BASE}/merch/admin/bulk/cancel`;
		const req = create(MerchBulkActionCancelRequestSchema, {
			Action: action,
		});

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(MerchBulkActionCancelRequestSchema, req),
		});

		const body: MerchBulkActionCancelResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return undefined;
	}
}

export async function GetMerchBulkActionStatus() {
	try {
		const url = `${API_BASE}/merch/admin/bulk`;
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				...(await authHeaders()),
			},
		});

		const body: MerchBulkActionStatusResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return undefined;
	}
}
