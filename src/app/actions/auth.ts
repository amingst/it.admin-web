'use server';

import { Roles } from '@/lib/roles';
import { create, toJsonString } from '@bufbuild/protobuf';
import {
	AuthenticateUserRequest,
	AuthenticateUserResponseSchema,
	ChangeOtherPasswordRequest,
	ChangeOtherPasswordRequestSchema,
	ChangeOtherPasswordResponse,
	ChangeOtherPasswordResponseSchema,
	DisableEnableOtherUserRequest,
	DisableEnableOtherUserRequestSchema,
	DisableEnableOtherUserResponse,
	DisableEnableOtherUserResponseSchema,
	DisableOtherTotpRequest,
	DisableOtherTotpRequestSchema,
	DisableOtherTotpResponse,
	DisableOtherTotpResponseSchema,
	GetOtherTotpListResponse,
	GetOtherTotpListResponseSchema,
	GetOtherUserResponse,
	GetOtherUserResponseSchema,
	GetOwnUserResponse,
	GetOwnUserResponseSchema,
	ModifyOtherUserRequest,
	ModifyOtherUserRequestSchema,
	ModifyOtherUserResponse,
	ModifyOtherUserResponseSchema,
	ModifyOtherUserRolesRequest,
	ModifyOtherUserRolesRequestSchema,
	ModifyOtherUserRolesResponse,
	ModifyOtherUserRolesResponseSchema,
	RenewTokenResponse,
	RenewTokenResponseSchema,
	SearchUsersAdminRequest,
	SearchUsersAdminRequestSchema,
	SearchUsersAdminResponse,
	SearchUsersAdminResponseSchema,
	type AuthenticateUserResponse,
	AdminCreateUserRequest,
	AdminCreateUserRequestSchema,
	AdminCreateUserResponse,
	AdminCreateUserResponseSchema,
	ModifyOtherUserAuthProvidersRequest,
	ModifyOtherUserAuthProvidersRequestSchema,
	ModifyOtherUserAuthProvidersResponse,
	ModifyOtherUserAuthProvidersResponseSchema,
} from '@inverted-tech/fragments/Authentication';
import { toIso } from '@/lib/utils';
import { APIErrorReason, APIErrorSchema } from '@inverted-tech/fragments';
import {
	clearToken,
	authHeaders,
	getSession,
	setToken,
	decodeToken,
} from '@/lib/cookies';
// import {
// 	APIErrorReason,
// 	APIErrorSchema,
// } from '@inverted-tech/fragments/protos/Errors_pb';
const API_BASE_URL = process.env.API_BASE_URL!;
const API_BASE = `${API_BASE_URL}/auth`;
const ADMIN_API_BASE = `${API_BASE_URL}/auth/admin`;

export async function createUser(req: AdminCreateUserRequest) {
	try {
		const url = ADMIN_API_BASE.concat('/createuser');
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				...(await authHeaders()),
				'content-type': 'application/json',
			},
			body: toJsonString(AdminCreateUserRequestSchema, req),
		});
		if (!res) {
			return create(AdminCreateUserResponseSchema, {
				Error: create(APIErrorSchema, {
					Message: 'No Response Recieved From The Server',
					Reason: APIErrorReason.ERROR_REASON_SERVICE_UNAVAILABLE,
				}),
			});
		}

		const body: AdminCreateUserResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(AdminCreateUserResponseSchema, {
			Error: create(APIErrorSchema, {
				Message:
					error instanceof Error ? error.message : 'Unknown error',
				Reason: APIErrorReason.ERROR_REASON_UNKNOWN,
			}),
		});
	}
}

export async function logoutAction(): Promise<boolean> {
	'use server';
	try {
		await clearToken();
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
}

export async function getOwnUser() {
	try {
		const url = API_BASE.concat('/user');

		const res = await fetch(url, {
			method: 'GET',
			headers: { ...(await authHeaders()) },
		});

		const body: GetOwnUserResponse = await res.json();
		return body;
	} catch (error) {
		console.error('Error Getting Own User: ', error);
		return create(GetOwnUserResponseSchema, {});
	}
}

export async function loginAction(
	payload: AuthenticateUserRequest,
): Promise<AuthenticateUserResponse> {
	const url = process.env.AUTH_LOGIN_URL || `${API_BASE_URL}/auth/login`;

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			cache: 'no-store',
			credentials: 'include',
		});

		if (!res) {
			return create(AuthenticateUserResponseSchema, {
				ok: false,
				Error: create(APIErrorSchema, {
					Message: 'No Response Recieved From The Server',
					Reason: APIErrorReason.ERROR_REASON_SERVICE_UNAVAILABLE,
				}),
			});
		}

		const body: AuthenticateUserResponse = await res.json();

		if (body.ok) await setToken(body.BearerToken);

		return body;
	} catch (e: any) {
		return create(AuthenticateUserResponseSchema, {
			ok: false,
			Error: create(APIErrorSchema, {
				Message: 'Unknown Error',
				Reason: APIErrorReason.ERROR_REASON_UNKNOWN,
			}),
		});
	}
}

export async function listUsers(
	req: SearchUsersAdminRequest = create(SearchUsersAdminRequestSchema, {
		PageSize: 25,
		PageOffset: 0,
		CreatedAfter: undefined,
		CreatedBefore: undefined,
		UserIDs: [],
		IncludeDeleted: true,
		Roles: [...Roles],
	}),
) {
	try {
		const parts: string[] = [];
		const enc = (k: string, v: string | number | boolean) =>
			`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;

		if (req.PageSize != null) parts.push(enc('PageSize', req.PageSize));
		if (req.PageOffset != null)
			parts.push(enc('PageOffset', req.PageOffset));
		if (req.SearchString?.trim())
			parts.push(enc('SearchString', req.SearchString.trim()));
		if (Array.isArray(req.Roles))
			for (const r of req.Roles) if (r) parts.push(enc('Roles', r));
		if (Array.isArray(req.UserIDs))
			for (const id of req.UserIDs)
				if (id) parts.push(enc('UserIDs', id));
		const ca = toIso((req as any)?.CreatedAfter);
		const cb = toIso((req as any)?.CreatedBefore);
		if (ca) parts.push(enc('CreatedAfter', ca));
		if (cb) parts.push(enc('CreatedBefore', cb));

		if (typeof req.IncludeDeleted === 'boolean')
			parts.push(enc('IncludeDeleted', req.IncludeDeleted));

		const base = (ADMIN_API_BASE ?? '').replace(/\/+$/, '');
		const qs = parts.join('&');
		const url = `${base}/search${qs ? `?${qs}` : ''}`;

		const res = await fetch(url, {
			method: 'GET',
			cache: 'no-store',
			headers: { ...(await authHeaders()) },
		});

		if (!res.ok) return create(SearchUsersAdminResponseSchema);

		const body: SearchUsersAdminResponse = await res.json();
		return body;
	} catch (e) {
		console.error('listUsers error:', e);
		return create(SearchUsersAdminResponseSchema);
	}
}

export async function adminGetUser(userId: string) {
	try {
		const url = ADMIN_API_BASE.concat(`/user/${userId}`);
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
		});
		if (!res) {
			return create(GetOtherUserResponseSchema);
		}

		const body: GetOtherUserResponse = await res.json();
		return body;
	} catch (error) {
		return create(GetOtherUserResponseSchema);
	}
}

export async function renewToken() {
	try {
		const url = API_BASE.concat('/renewtoken');
		const res = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			method: 'GET',
		});

		if (!res) {
			return create(RenewTokenResponseSchema);
		}

		const body: RenewTokenResponse = await res.json();
		if (!body || body.BearerToken === '') {
			return create(RenewTokenResponseSchema);
		}

		return body;
	} catch (error) {
		console.error(error);
		return create(RenewTokenResponseSchema);
	}
}

/**
 * Renews the current bearer token and persists it to the session cookie.
 * Called proactively (before expiry) by the client-side session refresher.
 */
export async function refreshSession(): Promise<{ ok: boolean; exp?: number }> {
	try {
		const result = await renewToken();
		if (!result?.BearerToken) return { ok: false };

		await setToken(result.BearerToken);
		const decoded = decodeToken(result.BearerToken);
		return { ok: true, exp: decoded?.exp };
	} catch (error) {
		console.error('refreshSession error:', error);
		return { ok: false };
	}
}

export async function grantRolesToUser(req: ModifyOtherUserRolesRequest) {
	try {
		const res = await fetch(ADMIN_API_BASE.concat('/user/roles'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(ModifyOtherUserRolesRequestSchema, req),
		});

		if (!res || !res.ok) {
			return create(ModifyOtherUserRolesResponseSchema, {
				Error: create(APIErrorSchema, {
					Message: `Failed to update user roles${
						res ? ` (${res.status})` : ''
					}`,
					Reason: APIErrorReason.ERROR_REASON_DELIVERY_FAILED,
				}),
			});
		}

		const body: ModifyOtherUserRolesResponse = await res.json();
		console.log(body);
		return body;
	} catch (error) {
		console.error(error);
		return create(ModifyOtherUserRolesResponseSchema, {
			Error: create(APIErrorSchema, {
				Message: 'Unexpected error while updating user roles',
				Reason: APIErrorReason.ERROR_REASON_UNKNOWN,
			}),
		});
	}
}

export async function enableUser(req: DisableEnableOtherUserRequest) {
	try {
		const res = await fetch(
			ADMIN_API_BASE.concat(`/user/${req.UserID}/enable`),
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(await authHeaders()),
				},
				body: toJsonString(DisableEnableOtherUserRequestSchema, req),
			},
		);

		if (!res) return create(DisableEnableOtherUserResponseSchema);

		const body: DisableEnableOtherUserResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(DisableEnableOtherUserResponseSchema);
	}
}

export async function disableUser(req: DisableEnableOtherUserRequest) {
	try {
		const res = await fetch(
			ADMIN_API_BASE.concat(`/user/${req.UserID}/disable`),
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(await authHeaders()),
				},
				body: toJsonString(DisableEnableOtherUserRequestSchema, req),
			},
		);

		if (!res) return create(DisableEnableOtherUserResponseSchema);

		const body: DisableEnableOtherUserResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(DisableEnableOtherUserResponseSchema);
	}
}

export async function getSessionUser() {
	const session = await getSession();
	return {
		id: session?.id ?? '',
		userName: session?.userName ?? '',
		displayName: session?.displayName ?? '',
	};
}

export async function adminGetUserTotpDevices(userId: string) {
	try {
		const res = await fetch(ADMIN_API_BASE.concat(`/totp/${userId}`), {
			headers: { ...(await authHeaders()) },
		});

		const body: GetOtherTotpListResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(GetOtherTotpListResponseSchema, {});
	}
}

export async function adminDisableOtherTotp(req: DisableOtherTotpRequest) {
	try {
		const res = await fetch(ADMIN_API_BASE.concat('/totp/disable'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(DisableOtherTotpRequestSchema, req),
		});

		if (!res) return create(DisableOtherTotpResponseSchema, {});

		const body: DisableOtherTotpResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(DisableOtherTotpResponseSchema, {});
	}
}

export async function adminEditOtherUserPassword(
	req: ChangeOtherPasswordRequest,
) {
	try {
		const res = await fetch(ADMIN_API_BASE.concat('/password'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(ChangeOtherPasswordRequestSchema, req),
		});
		const body: ChangeOtherPasswordResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(ChangeOtherPasswordResponseSchema, {
			Error: create(APIErrorSchema, {
				Reason: APIErrorReason.ERROR_REASON_UNKNOWN,
				Message: 'An Error Has Occured Changing A Users Password',
				Validation: [],
			}),
		});
	}
}

export async function adminEditOtherUser(req: ModifyOtherUserRequest) {
	try {
		const res = await fetch(ADMIN_API_BASE.concat('/user'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(ModifyOtherUserRequestSchema, req),
		});

		const body: ModifyOtherUserResponse = await res.json();

		return body;
	} catch (error) {
		console.error(error);
		return create(ModifyOtherUserResponseSchema, {
			Error: create(APIErrorSchema, {
				Reason: APIErrorReason.ERROR_REASON_UNKNOWN,
				Message: 'An Error Ocurred While Trying To Modify Other User',
				Validation: [],
			}),
		});
	}
}

export async function adminEditOtherAuthProviders(
	req: ModifyOtherUserAuthProvidersRequest,
) {
	try {
		const res = await fetch(ADMIN_API_BASE.concat('/user/providers'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await authHeaders()),
			},
			body: toJsonString(ModifyOtherUserAuthProvidersRequestSchema, req),
		});

		const body: ModifyOtherUserAuthProvidersResponse = await res.json();
		return body;
	} catch (error) {
		console.error(error);
		return create(ModifyOtherUserAuthProvidersResponseSchema, {
			Error: create(APIErrorSchema, {
				Reason: APIErrorReason.ERROR_REASON_UNKNOWN,
				Message: 'An Error Ocurred While Trying To Modify Other User',
				Validation: [],
			}),
		});
	}
}
