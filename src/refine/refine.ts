import type z from 'zod'

import { type FieldIssueCode, issue } from '@/internal/issue.js'
import { isBlank } from '@/internal/sanitize.js'

/** A refinement ready to hand to `.superRefine()`. */
export type Refinement<T> = (value: T, ctx: z.RefinementCtx) => void

/** Any record-shaped payload a refinement can inspect. */
type Payload = Record<string, unknown>

const filled = (value: unknown): boolean =>
	value !== undefined &&
	value !== null &&
	!(typeof value === 'string' && isBlank(value)) &&
	!(Array.isArray(value) && value.length === 0)

const report = (
	ctx: z.RefinementCtx,
	code: FieldIssueCode,
	path: string[],
	input: unknown,
	params?: Record<string, unknown>,
) => {
	ctx.addIssue({
		...issue(code, input, params),
		path,
	})
}

/**
 * Makes a field required only under a condition, and reports the error on that
 * field. Expressing the same rule in plain Zod means a discriminated union or
 * a raw `superRefine` whose issue lands on the object root, where no form
 * library can attach it to an input.
 *
 * @example
 * Schema.superRefine(RequiredIfRefine('phone', (value) => value.contact === 'phone'))
 */
export const RequiredIfRefine =
	<T extends Payload>(
		field: keyof T & string,
		when: (value: T) => boolean,
	): Refinement<T> =>
	(value, ctx) => {
		if (when(value) && !filled(value[field])) {
			report(
				ctx,
				'requiredIfMissing',
				[
					field,
				],
				value[field],
			)
		}
	}

/**
 * Requires at least one of a group of fields, reporting on every field in the
 * group so the form can highlight all of them instead of just the first.
 *
 * @example
 * Schema.superRefine(AtLeastOneOfRefine(['email', 'phone']))
 */
export const AtLeastOneOfRefine =
	<T extends Payload>(fields: readonly (keyof T & string)[]): Refinement<T> =>
	(value, ctx) => {
		if (fields.some((field) => filled(value[field]))) {
			return
		}

		for (const field of fields) {
			report(
				ctx,
				'atLeastOneRequired',
				[
					field,
				],
				value[field],
				{
					fields,
				},
			)
		}
	}

/**
 * Allows at most one of a group of fields to be filled in.
 *
 * @example
 * Schema.superRefine(MutuallyExclusiveRefine(['couponCode', 'giftCardId']))
 */
export const MutuallyExclusiveRefine =
	<T extends Payload>(fields: readonly (keyof T & string)[]): Refinement<T> =>
	(value, ctx) => {
		const used = fields.filter((field) => filled(value[field]))

		if (used.length <= 1) {
			return
		}

		for (const field of used) {
			report(
				ctx,
				'mutuallyExclusive',
				[
					field,
				],
				value[field],
				{
					fields,
				},
			)
		}
	}

/**
 * Requires two fields to hold the same value, reporting on the confirmation
 * field. A bare `.refine()` puts the error on the object root, which leaves the
 * message floating above the form instead of under the field that is wrong.
 *
 * @example
 * Schema.superRefine(MatchFieldRefine('password', 'passwordConfirmation'))
 */
export const MatchFieldRefine =
	<T extends Payload>(
		field: keyof T & string,
		confirmation: keyof T & string,
		code: FieldIssueCode = 'passwordMismatch',
	): Refinement<T> =>
	(value, ctx) => {
		if (value[field] !== value[confirmation]) {
			report(
				ctx,
				code,
				[
					confirmation,
				],
				value[confirmation],
			)
		}
	}

/**
 * Requires one date field to come no later than another, reporting on the end
 * field. Works on `YYYY-MM-DD` strings and on `Date` values alike.
 *
 * @example
 * Schema.superRefine(DateOrderRefine('startsOn', 'endsOn'))
 */
export const DateOrderRefine =
	<T extends Payload>(
		start: keyof T & string,
		end: keyof T & string,
	): Refinement<T> =>
	(value, ctx) => {
		const from = value[start]
		const to = value[end]

		if (!filled(from) || !filled(to)) {
			return
		}

		const left = from instanceof Date ? from.getTime() : String(from)
		const right = to instanceof Date ? to.getTime() : String(to)

		if (left > right) {
			report(
				ctx,
				'dateOutOfOrder',
				[
					end,
				],
				to,
				{
					start,
				},
			)
		}
	}

/**
 * Requires the parts to add up to the declared total, compared as integers so
 * the check is not defeated by floating point: three lines of `33.33` do not
 * quietly fail against a total of `99.99`.
 *
 * @example
 * Schema.superRefine(SumEqualsRefine('items', 'total', (item) => item.amountCents))
 */
export const SumEqualsRefine =
	<T extends Payload, Item = unknown>(
		items: keyof T & string,
		total: keyof T & string,
		amountOf: (item: Item) => number,
	): Refinement<T> =>
	(value, ctx) => {
		const list = value[items]
		const expected = value[total]

		if (!Array.isArray(list) || typeof expected !== 'number') {
			return
		}

		const sum = list.reduce<number>(
			(carry, item) => carry + Math.round(amountOf(item as Item)),
			0,
		)

		if (sum !== Math.round(expected)) {
			report(
				ctx,
				'sumMismatch',
				[
					total,
				],
				expected,
				{
					sum,
				},
			)
		}
	}
