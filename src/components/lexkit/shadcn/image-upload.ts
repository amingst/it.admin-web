import { create } from '@bufbuild/protobuf';
import { CreateAssetRequestSchema, ImageAssetDataSchema } from '@inverted-tech/fragments/Content';
import { createAsset, getAssetDataUrl } from '@/app/actions/assets';
import { compressImage } from '@/lib/imageCompression';
import { slugify } from '@/lib/slugify';

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

export async function uploadEditorImage(file: File): Promise<string> {
	const compressed = await compressImage(file);
	const title = file.name.replace(/\.[^.]+$/, '') || 'Pasted image';

	// TODO: asset-service image binding disabled in favor of inline base64-encoded images.
	// const req = create(CreateAssetRequestSchema, {
	// 	CreateAssetRequestOneof: {
	// 		case: 'Image',
	// 		value: create(ImageAssetDataSchema, {
	// 			Public: {
	// 				Title: title,
	// 				Caption: '',
	// 				URL: slugify(title),
	// 				MimeType: compressed.mimeType,
	// 				Height: compressed.height,
	// 				Width: compressed.width,
	// 				Data: compressed.data,
	// 			},
	// 			Private: { OldAssetID: '' },
	// 		}),
	// 	},
	// });
	//
	// const res = await createAsset(req);
	// const rec = (res as any)?.Record ?? (res as any)?.record ?? res;
	// const assetId =
	// 	rec?.AssetID ??
	// 	rec?.assetId ??
	// 	rec?.assetID ??
	// 	rec?.Image?.AssetID ??
	// 	rec?.image?.assetId ??
	// 	rec?.Image?.Public?.AssetID ??
	// 	rec?.image?.public?.assetId;
	//
	// if (!assetId) {
	// 	throw new Error('Upload completed but no asset ID was returned.');
	// }
	//
	// return getAssetDataUrl(assetId);

	return `data:${compressed.mimeType};base64,${bytesToBase64(compressed.data)}`;
}
