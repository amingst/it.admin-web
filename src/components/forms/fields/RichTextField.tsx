'use client';
import React from 'react';
import { useStore } from '@tanstack/react-form';
import { useFieldContext, useFormContext } from '@/hooks/form-context';
import {
	Field as UIField,
	FieldLabel,
	FieldDescription,
	FieldError,
} from '@/components/ui/field';
import { normalizeFieldErrors } from '@/hooks/use-proto-validation';
import { matchFieldErrors } from './utils';
import {
	ShadcnTemplate,
	type ShadcnTemplateRef,
} from '@/components/lexkit/shadcn/ShadcnTemplate';

export function RichTextField({
	label,
	description,
	disabled,
	placeholder,
}: {
	label?: React.ReactNode;
	description?: React.ReactNode;
	disabled?: boolean;
	placeholder?: string;
}) {
	const field = useFieldContext<string | undefined>();
	const form = useFormContext();
	const errState = useStore(form.store as any, (s: any) => ({
		submit: s?.submitErrors,
		sync: s?.errors,
	}));

	const submitField =
		matchFieldErrors(errState?.submit?.fields as any, field.name) ?? [];
	const syncField =
		matchFieldErrors(errState?.sync?.fields as any, field.name) ?? [];
	const base = Array.isArray(field.state.meta.errors)
		? (field.state.meta.errors as any)
		: [];
	const errors =
		normalizeFieldErrors([...base, ...submitField, ...syncField] as any) ?? [];
	const isInvalid = errors.length > 0;

	const editorRef = React.useRef<ShadcnTemplateRef | null>(null);
	const lastLocalValue = React.useRef<string | null>(null);
	const readyOnce = React.useRef(false);

	const value = (field.state.value ?? '') as string;

	const handleReady = React.useCallback(() => {
		if (readyOnce.current) return;
		readyOnce.current = true;
		if (!editorRef.current) return;
		lastLocalValue.current = value;
		// injectHTML performs a discrete (synchronous) editor update, which
		// flushes decorator state via ReactDOM.flushSync internally. Deferring
		// to a microtask keeps that flush outside of React's render/commit
		// pass, avoiding "flushSync called from inside a lifecycle method".
		queueMicrotask(() => editorRef.current?.injectHTML(value));
	}, [value]);

	React.useEffect(() => {
		if (!editorRef.current) return;
		if (lastLocalValue.current === value) return;
		queueMicrotask(() => editorRef.current?.injectHTML(value));
	}, [value]);

	return (
		<UIField data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name}>{label ?? field.name}</FieldLabel>

			<div className="mt-2">
				<ShadcnTemplate
					ref={editorRef}
					placeholder={placeholder}
					readOnly={disabled}
					onReady={handleReady}
					onContentChange={(html) => {
						lastLocalValue.current = html;
						field.handleChange(html);
					}}
				/>
			</div>

			{isInvalid && <FieldError errors={errors} />}
		</UIField>
	);
}
