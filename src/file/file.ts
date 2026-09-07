import z from 'zod'

import { issue } from '@/internal/issue.js'
import { sanitize } from '@/internal/sanitize.js'

/** Extensions each MIME type is allowed to carry. */
const EXTENSIONS: Record<string, readonly string[]> = {
	'application/pdf': [
		'pdf',
	],
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
		'xlsx',
	],
	'application/zip': [
		'zip',
	],
	'image/gif': [
		'gif',
	],
	'image/jpeg': [
		'jpg',
		'jpeg',
	],
	'image/png': [
		'png',
	],
	'image/svg+xml': [
		'svg',
	],
	'image/webp': [
		'webp',
	],
	'text/csv': [
		'csv',
	],
	'text/plain': [
		'txt',
	],
}

/** Names that would escape the upload directory or confuse the shell. */
const UNSAFE_NAME = /[/\\]|^\.|\.\.|^\s|\s$/

const matches = (mime: string, allowed: readonly string[]): boolean =>
	allowed.some((entry) =>
		entry.endsWith('/*') ? mime.startsWith(entry.slice(0, -1)) : entry === mime,
	)

export type FileOptions = {
	/** Accepted MIME types. Wildcards such as `'image/*'` are allowed. */
	accept?: readonly string[]
	/** Largest accepted size in bytes. Default 5 MiB. */
	maxSize?: number
	/** Smallest accepted size in bytes. Default `1`, so empty files fail. */
	minSize?: number
	/** Reject a name whose extension contradicts its MIME type. Default `true`. */
	strictExtension?: boolean
}

/**
 * Uploaded file. Zod can only say "this is a File"; the checks that matter are
 * the ones here: a size ceiling, a MIME allowlist, a file name that cannot
 * traverse out of the upload directory or hide its real extension behind a
 * bidi override, and - most of all - agreement between the declared MIME type
 * and the extension. `payload.php` sent as `image/png` is the oldest upload
 * trick there is, and each check alone misses it.
 *
 * @example
 * FileSchema({ accept: ['image/*'] }).safeParse(pdfFile)      // fileTypeNotAllowed
 * FileSchema().safeParse(new File([], 'a.png', { type: 'application/pdf' }))
 * // fileExtensionMismatch
 */
export const FileSchema = (options?: FileOptions) => {
	const {
		accept,
		maxSize = 5 * 1024 * 1024,
		minSize = 1,
		strictExtension = true,
	} = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			if (!(value instanceof File)) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const name = sanitize(value.name, {
				whitespace: 'trim',
			})

			if (
				name.length === 0 ||
				UNSAFE_NAME.test(name) ||
				name !== value.name.trim()
			) {
				ctx.issues.push(issue('invalidFileName', value.name))

				return z.NEVER
			}

			if (value.size < minSize) {
				ctx.issues.push(issue('required', value.size))

				return z.NEVER
			}

			if (value.size > maxSize) {
				ctx.issues.push(
					issue('fileTooLarge', value.size, {
						maxSize,
					}),
				)

				return z.NEVER
			}

			if (accept !== undefined && !matches(value.type, accept)) {
				ctx.issues.push(
					issue('fileTypeNotAllowed', value.type, {
						accept,
					}),
				)

				return z.NEVER
			}

			const extension = name.includes('.')
				? name.slice(name.lastIndexOf('.') + 1).toLowerCase()
				: ''
			const expected = EXTENSIONS[value.type]

			if (
				strictExtension &&
				expected !== undefined &&
				!expected.includes(extension)
			) {
				ctx.issues.push(
					issue('fileExtensionMismatch', name, {
						expected,
						type: value.type,
					}),
				)

				return z.NEVER
			}

			return value
		})
		.meta({
			description: 'Uploaded file.',
			example: 'invoice.pdf',
		})
}

/**
 * Image upload. Same guarantees as `FileSchema` with the MIME allowlist
 * narrowed to raster formats; SVG is excluded by default because it executes
 * script when served inline.
 *
 * @example
 * ImageSchema().safeParse(svgFile)  // fileTypeNotAllowed
 */
export const ImageSchema = (options?: Omit<FileOptions, 'accept'>) =>
	FileSchema({
		...options,
		accept: [
			'image/gif',
			'image/jpeg',
			'image/png',
			'image/webp',
		],
	})
