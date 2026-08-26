'use server';

import {
	adminDisableOtherTotp,
	adminGetUser,
	adminGetUserTotpDevices,
} from '@/app/actions/auth';
import type { UserNormalRecord } from '@inverted-tech/fragments/Authentication';
import { UserTimeline } from '@/components/users/view-user/user-timeline';
import { UserDetails } from '@/components/users/view-user/user-details';
import { UserHeaderCard } from '@/components/users/view-user/user-header';
import { UserSubscriptions } from '@/components/users/view-user/user-subscriptions';
import { UserTotpDevices } from '@/components/users/view-user/user-totp-devices';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { grantRolesToUser, enableUser, disableUser } from '@/app/actions/auth';
import { create } from '@bufbuild/protobuf';
import {
	ModifyOtherUserRolesRequestSchema,
	DisableEnableOtherUserRequestSchema,
	DisableOtherTotpRequestSchema,
} from '@inverted-tech/fragments/Authentication';
import {
	getSubscriptionsForUser,
	cancelSubscribition,
	reRunFailedPayment,
	ReconcileOtherSubscription,
} from '@/app/actions/payment';
import { getSession } from '@/lib/cookies';
import { requireRole } from '@/lib/rbac';
import {
	isMemberManagerOrHigher,
	isSubscriptionManagerOrHigher,
	isAdminOrHigher,
} from '@/lib/roleHelpers';

function pick<T = unknown>(obj: any, paths: string[], fb?: T): T | undefined {
	for (const p of paths) {
		const v = p.split('.').reduce<any>((o, k) => (o ? o[k] : undefined), obj);
		if (v !== undefined && v !== null && v !== '') return v as T;
	}
	return fb;
}

export default async function ViewUserPage({
	params,
}: {
	params: { userId: string };
}) {
	await requireRole(isMemberManagerOrHigher);
	const session = await getSession();
	const sessionRoles = session?.roles ?? [];
	const canViewSubscriptions = isSubscriptionManagerOrHigher(sessionRoles);
	const canGrantRoles = isAdminOrHigher(sessionRoles);
	const canEditProfile = isMemberManagerOrHigher(sessionRoles);
	const canToggleUser = isAdminOrHigher(sessionRoles);
	const canViewTotp = isAdminOrHigher(sessionRoles);
	const { userId } = await params;
	const subs = canViewSubscriptions
		? await getSubscriptionsForUser(userId)
		: undefined;
	const res = await adminGetUser(userId);
	const user: UserNormalRecord | undefined = res?.Record;
	if (!user) notFound();

	// inferred fields across Public/Private shapes
	const id = pick<string>(user, ['UserID', 'Public.UserID'], userId) ?? userId;
	const displayName = pick<string>(
		user,
		['Public.Data.DisplayName', 'DisplayName'],
		'',
	)!;
	const userName =
		pick<string>(user, ['Public.Data.UserName', 'UserName'], '') || '';
	const email = pick<string>(user, ['Private.Data.Email', 'Email'], '') || '';
	const bio = pick<string>(user, ['Public.Data.Bio', 'Bio'], '') || '';
	const firstName =
		pick<string>(
			user,
			['Private.Data.FirstName', 'Public.Data.FirstName', 'FirstName'],
			'',
		) || '';
	const lastName =
		pick<string>(
			user,
			['Private.Data.LastName', 'Public.Data.LastName', 'LastName'],
			'',
		) || '';
	const postalCode =
		pick<string>(
			user,
			['Private.Data.PostalCode', 'Public.Data.PostalCode', 'PostalCode'],
			'',
		) || '';
	const microsoftUserId =
		pick<string>(
			user,
			[
				'Private.AuthProviders.Microsoft.UserId',
				'AuthProviders.Microsoft.UserId',
			],
			'',
		) || '';
	const createdOn = pick(user, ['Public.CreatedOnUTC', 'CreatedOnUTC']);
	const modifiedOn = pick(user, ['Public.ModifiedOnUTC', 'ModifiedOnUTC']);
	const disabledOn = pick(user, ['Private.DisabledOnUTC', 'DisabledOnUTC']);
	const profilePng = pick<string>(
		user,
		['Public.Data.ProfileImagePNG', 'ProfileImagePNG'],
		'',
	);
	const totpDevices = (await adminGetUserTotpDevices(userId)).Devices ?? [];
	const userRoles = pick<string[]>(user, ['Private.Roles', 'Roles'], []) ?? [];
	async function grantRolesAction(formData: FormData) {
		'use server';
		const selected = formData.getAll('roles')?.map((v) => String(v)) ?? [];
		const res = await grantRolesToUser(
			create(ModifyOtherUserRolesRequestSchema, {
				UserID: id,
				Roles: selected,
			}),
		);
		const reason = res.Error?.Reason as unknown;
		if (reason && reason !== 'ERROR_REASON_NO_ERROR') {
			throw new Error(res.Error?.Message || 'Failed to update roles');
		}
		revalidatePath(`/users/${id}`);
	}

	async function enableUserAction() {
		'use server';
		await enableUser(
			create(DisableEnableOtherUserRequestSchema, {
				UserID: id,
			}),
		);
		revalidatePath(`/users/${id}`);
	}

	async function disableUserAction() {
		'use server';
		await disableUser(
			create(DisableEnableOtherUserRequestSchema, {
				UserID: id,
			}),
		);
		revalidatePath(`/users/${id}`);
	}

	async function disableTotpAction(formData: FormData) {
		'use server';
		// TODO: Fix this
		const totpId = String(formData.get('totpId') ?? '').trim();
		if (!totpId) return;
		await adminDisableOtherTotp(
			create(DisableOtherTotpRequestSchema, {
				UserID: id,
				TotpID: totpId,
			}),
		);
		revalidatePath(`/users/${id}`);
	}

	async function cancelSubscriptionAction(formData: FormData) {
		'use server';
		await cancelSubscribition(formData);
		revalidatePath(`/users/${id}`);
	}

	async function reRunFailedPaymentAction(formData: FormData) {
		'use server';
		await reRunFailedPayment(formData);
		revalidatePath(`/users/${id}`);
	}

	async function reconcileSubscriptionAction(
		userId: string,
		internalSubscriptionId: string,
	) {
		'use server';
		const res = await ReconcileOtherSubscription(
			userId,
			internalSubscriptionId,
		);
		revalidatePath(`/users/${id}`);
		return { Error: res.Error };
	}

	return (
		<div>
			<div className="mb-6">
				<UserHeaderCard
					id={id}
					displayName={displayName}
					userName={userName}
					email={email}
					roles={userRoles}
					profilePng={profilePng}
					disabled={Boolean(disabledOn)}
					grantRolesAction={grantRolesAction}
					canGrantRoles={canGrantRoles}
					canEditProfile={canEditProfile}
					enableUserAction={canToggleUser ? enableUserAction : undefined}
					disableUserAction={canToggleUser ? disableUserAction : undefined}
				/>
			</div>
			<div className="mb-4">
				<UserTimeline
					createdOn={createdOn}
					modifiedOn={modifiedOn}
					disabledOn={disabledOn}
				/>
			</div>
			<div className="mb-4">
				<UserDetails
					id={id}
					email={email}
					bio={bio}
					firstName={firstName}
					lastName={lastName}
					postalCode={postalCode}
					userName={userName}
					displayName={displayName}
					roles={userRoles}
					canEditProfile={canEditProfile}
					microsoftUserId={microsoftUserId}
				/>
			</div>
			{canViewTotp ? (
				<div className="mb-4">
					<UserTotpDevices
						totpDevices={totpDevices}
						disableTotpAction={disableTotpAction}
						canViewTotp={canViewTotp}
					/>
				</div>
			) : null}
			{canViewSubscriptions ? (
				<div className="mb-4">
					<UserSubscriptions
						subscriptions={subs}
						cancelSubscriptionAction={cancelSubscriptionAction}
						reRunFailedPaymentAction={reRunFailedPaymentAction}
						reconcileSubscriptionAction={reconcileSubscriptionAction}
					/>
				</div>
			) : null}
		</div>
	);
}
