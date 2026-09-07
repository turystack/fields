import z from 'zod'

import { issue } from '@/internal/issue.js'
import { sanitize } from '@/internal/sanitize.js'

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ULID = /^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/i
const NUMERIC = /^[1-9]\d*$/

/** Identifier formats this package can validate. */
export type IdFormat = 'numeric' | 'ulid' | 'uuid'

export type IdOptions = {
	/** Accepted formats. Default `['uuid']`. */
	formats?: readonly IdFormat[]
}

const MATCHERS: Record<IdFormat, (value: string) => boolean> = {
	numeric: (value) =>
		NUMERIC.test(value) && Number.isSafeInteger(Number(value)),
	ulid: (value) => ULID.test(value),
	uuid: (value) => UUID.test(value),
}

/**
 * Entity identifier. Beyond the shape it rejects the values that pass a naive
 * regex but can never exist: a UUID with an invalid version or variant nibble,
 * a ULID above the 48-bit timestamp ceiling, and a numeric id past
 * `Number.MAX_SAFE_INTEGER`. It also states which format was expected, so the
 * error is actionable when several are accepted.
 *
 * @example
 * IdSchema().parse(' 018f6d3c-... ')                          // trimmed uuid
 * IdSchema({ formats: ['numeric'] }).safeParse('0')           // invalidId
 */
export const IdSchema = (options?: IdOptions) => {
	const {
		formats = [
			'uuid',
		],
	} = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			const text = typeof value === 'string' ? sanitize(value) : ''

			if (text.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			if (!formats.some((format) => MATCHERS[format](text))) {
				ctx.issues.push(
					issue('invalidId', value, {
						formats,
					}),
				)

				return z.NEVER
			}

			return text
		})
		.meta({
			description: `Identifier (${formats.join(', ')}).`,
			example: '018f6d3c-9f7a-7c3a-8f1e-2b6d5a4c3b2a',
		})
}
