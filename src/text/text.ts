import z from 'zod'

import { check, issue } from '@/internal/issue.js'
import { isBlank, type SanitizeOptions, sanitize } from '@/internal/sanitize.js'

export type TextOptions = SanitizeOptions & {
	/** Maximum length in code points. Default `255`. */
	max?: number
	/** Minimum length in code points. Default `1`. */
	min?: number
}

/** Counts code points, so an emoji counts as one character and not two. */
const size = (value: string): number =>
	[
		...value,
	].length

const describe = (description: string, example: string) => ({
	description,
	example,
})

/**
 * Text field that rejects whitespace-only and invisible-only input as
 * `required`, not as `tooShort`. Sanitizes before measuring, so the length
 * limits apply to the value that actually reaches the database.
 *
 * Length is counted in code points, matching how Postgres counts `varchar`.
 *
 * @example
 * RequiredStringSchema().parse('  Ana   Maria ')  // 'Ana Maria'
 * RequiredStringSchema().safeParse('   ')         // required
 * RequiredStringSchema().safeParse('\u200B')      // required
 */
export const RequiredStringSchema = (options?: TextOptions) => {
	const { max = 255, min = 1, ...sanitizeOptions } = options ?? {}

	return z
		.string()
		.overwrite((value) => sanitize(value, sanitizeOptions))
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine(
			(value) => size(value) >= min,
			check('tooShort', {
				min,
			}),
		)
		.refine(
			(value) => size(value) <= max,
			check('tooLong', {
				max,
			}),
		)
		.meta(
			describe(
				`Required text between ${min} and ${max} characters.`,
				'Ana Maria',
			),
		)
}

/**
 * Optional text where blank input collapses to `undefined`. Prevents empty
 * strings from being written as if the user had typed something - `z.string()
 * .optional()` accepts `''` and stores it.
 *
 * @example
 * OptionalStringSchema().parse('   ')      // undefined
 * OptionalStringSchema().parse(null)       // undefined
 * OptionalStringSchema().parse(' hi ')     // 'hi'
 */
export const OptionalStringSchema = (options?: TextOptions) =>
	z.preprocess(
		(value) =>
			value === null || (typeof value === 'string' && isBlank(value))
				? undefined
				: value,
		RequiredStringSchema(options).optional(),
	)

/**
 * Optional text where blank input collapses to `null`, so a nullable column
 * never has to distinguish between `''` and `NULL`.
 *
 * @example
 * NullableStringSchema().parse('   ')   // null
 * NullableStringSchema().parse(' hi ')  // 'hi'
 */
export const NullableStringSchema = (options?: TextOptions) =>
	z.preprocess(
		(value) =>
			value === undefined || (typeof value === 'string' && isBlank(value))
				? null
				: value,
		RequiredStringSchema(options).nullable(),
	)

/**
 * Text that must stay on a single line. Rejects line breaks instead of
 * silently folding them, which is what a name field pasted from a PDF or a
 * spreadsheet cell needs.
 *
 * @example
 * SingleLineSchema().safeParse('Ana\nMaria')  // lineBreakNotAllowed
 */
export const SingleLineSchema = (options?: TextOptions) =>
	z
		.string()
		.refine((value) => !/[\r\n]/.test(value), {
			...check('lineBreakNotAllowed'),
			abort: true,
		})
		.overwrite((value) =>
			sanitize(value, {
				...options,
				multiline: false,
			}),
		)
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine(
			(value) => size(value) >= (options?.min ?? 1),
			check('tooShort', {
				min: options?.min ?? 1,
			}),
		)
		.refine(
			(value) => size(value) <= (options?.max ?? 255),
			check('tooLong', {
				max: options?.max ?? 255,
			}),
		)
		.meta(describe('Single-line text.', 'Ana Maria'))

export type MultilineOptions = TextOptions & {
	/** Maximum length of any single line, in code points. */
	maxLineLength?: number
	/** Maximum number of lines. */
	maxLines?: number
}

/**
 * Free-form text that keeps line breaks. Normalizes `\r\n` to `\n`, trims each
 * line, collapses runs of blank lines and can cap the number and length of
 * lines - none of which `z.string()` does.
 *
 * @example
 * MultilineSchema().parse('a  \r\n\r\n\r\n  b')  // 'a\n\nb'
 * MultilineSchema({ maxLines: 2 }).safeParse('a\nb\nc')  // tooManyLines
 */
export const MultilineSchema = (options?: MultilineOptions) => {
	const {
		max = 5000,
		maxLineLength,
		maxLines,
		min = 1,
		...sanitizeOptions
	} = options ?? {}

	return z
		.string()
		.overwrite((value) =>
			sanitize(value, {
				...sanitizeOptions,
				multiline: true,
			}),
		)
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine(
			(value) => size(value) >= min,
			check('tooShort', {
				min,
			}),
		)
		.refine(
			(value) => size(value) <= max,
			check('tooLong', {
				max,
			}),
		)
		.superRefine((value, ctx) => {
			const lines = value.split('\n')

			if (maxLines !== undefined && lines.length > maxLines) {
				ctx.addIssue(
					issue('tooManyLines', value, {
						maxLines,
					}),
				)
			}

			if (
				maxLineLength !== undefined &&
				lines.some((line) => size(line) > maxLineLength)
			) {
				ctx.addIssue(
					issue('tooLong', value, {
						maxLineLength,
					}),
				)
			}
		})
		.meta(describe('Multi-line text.', 'First line\nSecond line'))
}
