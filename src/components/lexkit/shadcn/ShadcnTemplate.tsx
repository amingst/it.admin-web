'use client';
import React from 'react';
import {
	$getRoot,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_EDITOR,
	KEY_TAB_COMMAND,
	OUTDENT_CONTENT_COMMAND,
} from 'lexical';
import {
	ALL_MARKDOWN_TRANSFORMERS,
	blockFormatExtension,
	boldExtension,
	codeExtension,
	codeFormatExtension,
	commandPaletteExtension,
	createEditorSystem,
	floatingToolbarExtension,
	historyExtension,
	htmlEmbedExtension,
	htmlExtension,
	imageExtension,
	italicExtension,
	linkExtension,
	listExtension,
	markdownExtension,
	RichText,
	strikethroughExtension,
	tableExtension,
	underlineExtension,
	horizontalRuleExtension,
	type EditorContextType,
	type Extension,
} from '@lexkit/editor';
import { indentExtension } from './indent-extension';
import { uploadEditorImage } from './image-upload';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { shadcnTheme } from './theme';
import { buildCommandPaletteItems } from './commands';
import './shadcn-styles.css';
import {
	Undo2,
	Redo2,
	Bold,
	Italic,
	Underline,
	Strikethrough,
	Heading1,
	Heading2,
	Heading3,
	Quote,
	List,
	ListOrdered,
	Minus,
	Link2,
	IndentIncrease,
	IndentDecrease,
	Eye,
	Code2,
	Command,
	AlignLeft,
	FileCode,
} from 'lucide-react';

const markdownExt =
	typeof markdownExtension.configure === 'function'
		? markdownExtension.configure({
				transformers: ALL_MARKDOWN_TRANSFORMERS,
			})
		: markdownExtension;

const imageExt = imageExtension.configure({
	uploadHandler: uploadEditorImage,
	forceUpload: true,
	pasteListener: { insert: true, replace: true },
});

const extensions = [
	historyExtension,
	boldExtension,
	italicExtension,
	underlineExtension,
	strikethroughExtension,
	codeExtension,
	codeFormatExtension,
	blockFormatExtension,
	linkExtension,
	listExtension,
	tableExtension,
	imageExt,
	horizontalRuleExtension,
	htmlEmbedExtension,
	htmlExtension,
	commandPaletteExtension,
	floatingToolbarExtension,
	markdownExt,
	indentExtension,
] as const satisfies readonly Extension[];

const { Provider, useEditor } = createEditorSystem<typeof extensions>();

export type ShadcnTemplateRef = {
	injectMarkdown: (md: string) => void;
	injectHTML: (html: string) => void;
	getMarkdown: () => Promise<string>;
	getHTML: () => Promise<string>;
};

type Mode = 'visual' | 'html' | 'markdown';

type ShadcnTemplateProps = {
	className?: string;
	placeholder?: string;
	readOnly?: boolean;
	onReady?: (ctx: EditorContextType<typeof extensions>) => void;
	onContentChange?: (html: string, markdown: string) => void;
};

function groupByCategory(items: ReturnType<typeof buildCommandPaletteItems>) {
	return items.reduce<Record<string, typeof items>>((acc, item) => {
		const key = item.category ?? 'General';
		(acc[key] ||= []).push(item);
		return acc;
	}, {});
}

function countWords(input: string) {
	const trimmed = input.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).filter(Boolean).length;
}

function IconButton({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side='top'>{label}</TooltipContent>
		</Tooltip>
	);
}

function formatHtml(input: string) {
	const raw = input.trim();
	if (!raw) return '';
	try {
		const doc = new DOMParser().parseFromString(raw, 'text/html');
		const body = doc.body;
		const lines: string[] = [];
		const voidTags = new Set([
			'area',
			'base',
			'br',
			'col',
			'embed',
			'hr',
			'img',
			'input',
			'link',
			'meta',
			'param',
			'source',
			'track',
			'wbr',
		]);

		function attrs(el: Element) {
			const parts: string[] = [];
			for (const attr of Array.from(el.attributes)) {
				parts.push(`${attr.name}="${attr.value}"`);
			}
			return parts.length ? ' ' + parts.join(' ') : '';
		}

		function walk(node: Node, depth: number) {
			const indent = '  '.repeat(depth);
			if (node.nodeType === Node.TEXT_NODE) {
				const text =
					node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
				if (text) lines.push(`${indent}${text}`);
				return;
			}
			if (node.nodeType === Node.COMMENT_NODE) {
				lines.push(`${indent}<!--${node.textContent ?? ''}-->`);
				return;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return;

			const el = node as Element;
			const tag = el.tagName.toLowerCase();
			const open = `<${tag}${attrs(el)}>`;
			const close = `</${tag}>`;
			const children = Array.from(el.childNodes);
			if (voidTags.has(tag)) {
				lines.push(`${indent}<${tag}${attrs(el)} />`);
				return;
			}
			if (children.length === 0) {
				lines.push(`${indent}${open}${close}`);
				return;
			}
			lines.push(`${indent}${open}`);
			for (const child of children) walk(child, depth + 1);
			lines.push(`${indent}${close}`);
		}

		for (const child of Array.from(body.childNodes)) walk(child, 0);
		return lines.join('\n').trim();
	} catch {
		return raw;
	}
}

const EditorSurface = React.forwardRef<ShadcnTemplateRef, ShadcnTemplateProps>(
	function EditorSurface(
		{
			className,
			placeholder = 'Write here...',
			onReady,
			onContentChange,
			readOnly,
		},
		ref,
	) {
		const ctx = useEditor();
		const {
			commands,
			activeStates,
			hasExtension,
			listeners,
			plugins,
			editor,
		} = ctx;
		const focusEditor = React.useCallback(() => {
			editor?.focus();
		}, [editor]);
		const ensureSelection = React.useCallback(() => {
			if (!editor) return;
			editor.update(() => {
				const selection = $getSelection();
				if (!selection || !$isRangeSelection(selection)) {
					$getRoot().selectEnd();
				}
			});
		}, [editor]);

		const [mode, setMode] = React.useState<Mode>('visual');
		const [htmlSource, setHtmlSource] = React.useState('');
		const [markdownSource, setMarkdownSource] = React.useState('');
		const [commandOpen, setCommandOpen] = React.useState(false);
		const [wordCount, setWordCount] = React.useState(0);
		const readyOnce = React.useRef(false);

		const paletteItems = React.useMemo(
			() =>
				buildCommandPaletteItems({
					commands,
					hasExtension: (name: string) => hasExtension(name as any),
				}),
			[commands, hasExtension],
		);
		const paletteGroups = React.useMemo(
			() => groupByCategory(paletteItems),
			[paletteItems],
		);

		React.useEffect(() => {
			if (readyOnce.current) return;
			readyOnce.current = true;
			onReady?.(ctx as EditorContextType<typeof extensions>);
		}, [onReady, ctx]);

		React.useImperativeHandle(
			ref,
			() => ({
				injectMarkdown: (md: string) => {
					void commands.importFromMarkdown?.(md ?? '');
				},
				injectHTML: (html: string) => {
					void commands.importFromHTML?.(html ?? '');
				},
				getMarkdown: () =>
					Promise.resolve(commands.exportToMarkdown?.() ?? ''),
				getHTML: () => Promise.resolve(commands.exportToHTML?.() ?? ''),
			}),
			[commands],
		);

		React.useEffect(() => {
			const unregister = listeners.registerUpdate?.(() => {
				const html = commands.exportToHTML?.() ?? '';
				const md = commands.exportToMarkdown?.() ?? '';
				setWordCount(countWords(md));
				onContentChange?.(html, md);
			});
			return () => {
				if (typeof unregister === 'function') unregister();
			};
		}, [listeners, commands, onContentChange]);

		React.useEffect(() => {
			if (mode === 'html') {
				setHtmlSource(commands.exportToHTML?.() ?? '');
			} else if (mode === 'markdown') {
				setMarkdownSource(commands.exportToMarkdown?.() ?? '');
			}
		}, [mode, commands]);

		React.useEffect(() => {
			const handler = (event: KeyboardEvent) => {
				if (
					(event.ctrlKey || event.metaKey) &&
					event.key.toLowerCase() === 'k'
				) {
					event.preventDefault();
					setCommandOpen(true);
				}
			};
			window.addEventListener('keydown', handler);
			return () => window.removeEventListener('keydown', handler);
		}, []);

		React.useEffect(() => {
			if (!editor) return;
			return editor.registerCommand(
				KEY_TAB_COMMAND,
				(event: KeyboardEvent) => {
					event.preventDefault();
					if (event.shiftKey) {
						editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
					} else {
						const selection = $getSelection();
						if ($isRangeSelection(selection)) {
							selection.insertText('\t');
						}
					}
					return true;
				},
				COMMAND_PRIORITY_EDITOR,
			);
		}, [editor]);

		return (
			<div className={cn('lexkit-container', className)}>
				<div className='lexkit-toolbar'>
					<div className='lexkit-toolbar-group'>
						<IconButton label='Undo'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									commands.undo?.();
								}}
								disabled={readOnly}
							>
								<Undo2 />
							</Button>
						</IconButton>
						<IconButton label='Redo'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									commands.redo?.();
								}}
								disabled={readOnly}
							>
								<Redo2 />
							</Button>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<IconButton label='Indent'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.indent?.();
								}}
								disabled={readOnly}
							>
								<IndentIncrease />
							</Button>
						</IconButton>
						<IconButton label='Outdent'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.outdent?.();
								}}
								disabled={readOnly}
							>
								<IndentDecrease />
							</Button>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<IconButton label='Bold'>
							<Toggle
								size='sm'
								variant='outline'
								pressed={Boolean(activeStates?.bold)}
								onPressedChange={() => {
									focusEditor();
									ensureSelection();
									commands.toggleBold?.();
								}}
								disabled={readOnly}
							>
								<Bold />
							</Toggle>
						</IconButton>
						<IconButton label='Italic'>
							<Toggle
								size='sm'
								variant='outline'
								pressed={Boolean(activeStates?.italic)}
								onPressedChange={() => {
									focusEditor();
									ensureSelection();
									commands.toggleItalic?.();
								}}
								disabled={readOnly}
							>
								<Italic />
							</Toggle>
						</IconButton>
						<IconButton label='Underline'>
							<Toggle
								size='sm'
								variant='outline'
								pressed={Boolean(activeStates?.underline)}
								onPressedChange={() => {
									focusEditor();
									ensureSelection();
									commands.toggleUnderline?.();
								}}
								disabled={readOnly}
							>
								<Underline />
							</Toggle>
						</IconButton>
						<IconButton label='Strikethrough'>
							<Toggle
								size='sm'
								variant='outline'
								pressed={Boolean(activeStates?.strikethrough)}
								onPressedChange={() => {
									focusEditor();
									ensureSelection();
									commands.toggleStrikethrough?.();
								}}
								disabled={readOnly}
							>
								<Strikethrough />
							</Toggle>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<IconButton label='Heading 1'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.toggleHeading?.('h1');
								}}
								disabled={readOnly}
							>
								<Heading1 />
							</Button>
						</IconButton>
						<IconButton label='Heading 2'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.toggleHeading?.('h2');
								}}
								disabled={readOnly}
							>
								<Heading2 />
							</Button>
						</IconButton>
						<IconButton label='Heading 3'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.toggleHeading?.('h3');
								}}
								disabled={readOnly}
							>
								<Heading3 />
							</Button>
						</IconButton>
						<IconButton label='Quote'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.toggleBlockFormat?.('quote');
								}}
								disabled={readOnly}
							>
								<Quote />
							</Button>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<IconButton label='Bulleted List'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.toggleUnorderedList?.();
								}}
								disabled={readOnly}
							>
								<List />
							</Button>
						</IconButton>
						<IconButton label='Numbered List'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.toggleOrderedList?.();
								}}
								disabled={readOnly}
							>
								<ListOrdered />
							</Button>
						</IconButton>
						<IconButton label='Horizontal Rule'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									commands.insertHorizontalRule?.();
								}}
								disabled={readOnly}
							>
								<Minus />
							</Button>
						</IconButton>
						<IconButton label='Insert HTML / Script Embed'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									(commands as any).insertHTMLEmbed?.();
								}}
								disabled={readOnly}
							>
								<FileCode />
							</Button>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<IconButton label='Link'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => {
									focusEditor();
									ensureSelection();
									const url = window.prompt('Link URL');
									if (!url) return;
									const text =
										window.prompt('Link text (optional)') ??
										undefined;
									commands.insertLink?.(url, text);
								}}
								disabled={readOnly}
							>
								<Link2 />
							</Button>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<IconButton label='Command Palette'>
							<Button
								type='button'
								variant='outline'
								size='icon-sm'
								onClick={() => setCommandOpen(true)}
							>
								<Command />
							</Button>
						</IconButton>
					</div>

					<div className='lexkit-toolbar-group'>
						<span className='text-xs text-muted-foreground tabular-nums'>
							{wordCount} words
						</span>
					</div>
				</div>

				<Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
					<TabsList>
						<IconButton label='Visual'>
							<TabsTrigger value='visual'>
								<Eye />
							</TabsTrigger>
						</IconButton>
						<IconButton label='HTML'>
							<TabsTrigger value='html'>
								<Code2 />
							</TabsTrigger>
						</IconButton>
						<IconButton label='Markdown'>
							<TabsTrigger value='markdown'>
								<AlignLeft />
							</TabsTrigger>
						</IconButton>
					</TabsList>

					<TabsContent value='visual'>
						<div className='lexkit-editor-surface'>
							<RichTextView placeholder={placeholder} />
							{plugins?.map((plugin, idx) => (
								<React.Fragment key={idx}>
									{plugin}
								</React.Fragment>
							))}
						</div>
					</TabsContent>

					<TabsContent value='html'>
						<div className='lexkit-source-editor'>
							<textarea
								className='lexkit-source-textarea'
								value={htmlSource}
								onChange={(e) => setHtmlSource(e.target.value)}
								disabled={readOnly}
							/>
						</div>
						<div className='mt-2 flex justify-end'>
							<Button
								type='button'
								variant='outline'
								onClick={() =>
									setHtmlSource(formatHtml(htmlSource))
								}
								disabled={readOnly}
								className='mr-2'
							>
								Format HTML
							</Button>
							<Button
								type='button'
								variant='secondary'
								onClick={() =>
									commands.importFromHTML?.(htmlSource)
								}
								disabled={readOnly}
							>
								Apply HTML
							</Button>
						</div>
					</TabsContent>

					<TabsContent value='markdown'>
						<div className='lexkit-source-editor'>
							<textarea
								className='lexkit-source-textarea'
								value={markdownSource}
								onChange={(e) =>
									setMarkdownSource(e.target.value)
								}
								disabled={readOnly}
							/>
						</div>
						<div className='mt-2 flex justify-end'>
							<Button
								type='button'
								variant='secondary'
								onClick={() =>
									commands.importFromMarkdown?.(
										markdownSource,
									)
								}
								disabled={readOnly}
							>
								Apply Markdown
							</Button>
						</div>
					</TabsContent>
				</Tabs>

				<CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
					<CommandInput placeholder='Search editor commands...' />
					<CommandList>
						<CommandEmpty>No matching commands.</CommandEmpty>
						{Object.entries(paletteGroups).map(([group, items]) => (
							<CommandGroup key={group} heading={group}>
								{items.map((item) => (
									<CommandItem
										key={item.id}
										onSelect={() => {
											focusEditor();
											ensureSelection();
											item.action();
											setCommandOpen(false);
										}}
									>
										<span>{item.label}</span>
										{item.shortcut && (
											<CommandShortcut>
												{item.shortcut}
											</CommandShortcut>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</CommandDialog>
			</div>
		);
	},
);

function RichTextView({
	placeholder = 'Write here...',
}: {
	placeholder?: string;
}) {
	return (
		<RichText
			placeholder={placeholder}
			classNames={{
				container: 'lexkit-wrapper',
				contentEditable: 'lexkit-editor-content',
				placeholder: 'lexkit-editor-placeholder',
			}}
		/>
	);
}

export const ShadcnTemplate = React.forwardRef<
	ShadcnTemplateRef,
	ShadcnTemplateProps
>(function ShadcnTemplate(props, ref) {
	return (
		<Provider
			extensions={extensions}
			config={{
				theme: shadcnTheme,
				editable: props.readOnly ? false : true,
			}}
		>
			<EditorSurface {...props} ref={ref} />
		</Provider>
	);
});
