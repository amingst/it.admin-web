'use server';

import { create, toJsonString } from '@bufbuild/protobuf';
import { authHeaders } from '@/lib/cookies';

import {
	SearchAssetRequest,
	SearchAssetResponse,
	SearchAssetResponseSchema,
	CreateAssetRequest,
	CreateAssetResponse,
	CreateAssetResponseSchema,
	CreateAssetRequestSchema,
	GetAssetAdminResponse,
	GetAssetAdminResponseSchema,
} from '@inverted-tech/fragments/Content';
import { AssetType } from '@inverted-tech/fragments/Content';

const API_BASE_URL = process.env.API_BASE_URL!;
const DEFAULT_FETCH_TIMEOUT_MS = 30000;

async function fetchWithTimeout(
	input: string,
	init: RequestInit,
	timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(input, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

export async function getAsset(assetId: string) {
	try {
		const url = `${API_BASE_URL}/cms/admin/asset/${encodeURIComponent(assetId)}`;
		const res = await fetchWithTimeout(url, {
			method: 'GET',
			headers: { ...(await authHeaders()) },
		});
		if (!res) return create(GetAssetAdminResponseSchema);
		const body: GetAssetAdminResponse = await res.json();
		return body ?? create(GetAssetAdminResponseSchema);
	} catch (error) {
		console.error(error);
		return create(GetAssetAdminResponseSchema);
	}
}

export async function getImages(
	req?: Pick<SearchAssetRequest, 'PageSize' | 'PageOffset'>,
) {
	try {
		return await searchAssets(
			{
				AssetType: AssetType.AssetImage,
				PageSize: req?.PageSize,
				PageOffset: req?.PageOffset,
			},
			{ noCache: true },
		);
	} catch (error) {
		console.error(error);
		return create(SearchAssetResponseSchema);
	}
}

export async function searchAssets(
	req?: Partial<SearchAssetRequest> & { AssetType?: number | string },
	opts?: { noCache?: boolean },
) {
	try {
		const base = `${API_BASE_URL}/cms/admin/asset/search`;
		const url = new URL(base);
		if (req?.PageSize != null) {
			url.searchParams.set('PageSize', String(req.PageSize));
		}
		if (req?.PageOffset != null) {
			url.searchParams.set('PageOffset', String(req.PageOffset));
		}
		if (req?.Query) url.searchParams.set('Query', String(req.Query));
		if (req?.AssetType != null) {
			let at: string;
			if (typeof req.AssetType === 'number') {
				at = AssetType[req.AssetType] ?? String(req.AssetType);
			} else {
				at = String(req.AssetType);
			}
			url.searchParams.set('AssetType', at);
		}

		const fetchOptions: RequestInit = {
			method: 'GET',
			headers: { ...(await authHeaders()) },
		};
		if (opts?.noCache) {
			fetchOptions.cache = 'no-store';
			fetchOptions.next = { revalidate: 0 };
		}

		const res = await fetchWithTimeout(url.toString(), fetchOptions);

		if (!res) {
			return create(SearchAssetResponseSchema);
		}
		if (!res.ok) {
			return create(SearchAssetResponseSchema);
		}

		const body: SearchAssetResponse = await res.json();
		if (!body) {
			return create(SearchAssetResponseSchema);
		}

		return body;
	} catch (error) {
		console.error(error);
		return create(SearchAssetResponseSchema);
	}
}

export async function getAssetDataUrl(assetId: string): Promise<string> {
	return `${API_BASE_URL}/cms/asset/${encodeURIComponent(assetId)}/data`;
}

// TODO: Add Error.proto errors
export async function createAsset(req: CreateAssetRequest) {
	const url = `${API_BASE_URL}/cms/admin/asset`;

	try {
		// Ensure proper message instance for JSON encoding
		const msg = create(CreateAssetRequestSchema, req);
		const res = await fetchWithTimeout(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(CreateAssetRequestSchema, msg),
		});

		if (!res) {
			return create(CreateAssetResponseSchema);
		}

		const body: CreateAssetResponse = await res.json();
		if (!body) {
			return create(CreateAssetResponseSchema);
		}

		return body;
	} catch (error) {
		console.error(error);
		return create(CreateAssetResponseSchema);
	}
}
