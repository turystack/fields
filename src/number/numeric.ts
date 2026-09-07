import z from 'zod'

import { type ParsedDecimal, parseDecimal, type Separator } from './parse.js'

import { issue } from '@/internal/issue.js'
import { isBlank } from '@/internal/sanitize.js'

/** Reports whether the raw input means "nothing was filled in". */
const isMissing = (value: unknown): boolean =>
	value === undefined ||
	value === null ||
	(typeof value === 'string' && isBlank(value))

/** An issue built by this package, before it reaches Zod. */
export type FieldIssue = ReturnType<typeof issue>

/**
 * Shared numeric front door. Rejects blank input as `required` instead of
 * coercing it to `0`, which is what `z.coerce.number().parse('')` does.
 */
export const numeric = <T>(
	separator: Separator,
	validate: (parsed: ParsedDecimal, raw: unknown) => FieldIssue[],
	map: (parsed: ParsedDecimal) => T,
) =>
	z.unknown().transform((value, ctx) => {
		if (isMissing(value)) {
			ctx.issues.push(issue('required', value))

			return z.NEVER
		}

		const parsed = parseDecimal(value, separator)

		if (parsed === undefined) {
			ctx.issues.push(issue('notANumber', value))

			return z.NEVER
		}

		const found = validate(parsed, value)

		if (found.length > 0) {
			for (const entry of found) {
				ctx.issues.push(entry)
			}

			return z.NEVER
		}

		return map(parsed)
	})

export const rangeIssues = (
	value: number,
	options: {
		max?: number
		min?: number
	},
	raw: unknown,
): FieldIssue[] => {
	const found: FieldIssue[] = []

	if (options.min !== undefined && value < options.min) {
		found.push(
			issue('outOfRange', raw, {
				min: options.min,
			}),
		)
	}

	if (options.max !== undefined && value > options.max) {
		found.push(
			issue('outOfRange', raw, {
				max: options.max,
			}),
		)
	}

	return found
}
