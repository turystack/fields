import z from 'zod'

import { issue } from '@/internal/issue.js'
import { isBlank } from '@/internal/sanitize.js'

export type RequiredArrayOptions = {
	/** Largest accepted length. */
	max?: number
	/** Smallest accepted length. Default `1`. */
	min?: number
}

/**
 * List that must carry at least one real item. Blank strings are dropped
 * before the length is measured, because a form that renders three inputs
 * submits `['a', '', '']` and `z.array(...).min(1)` counts that as three.
 * An empty list reports `emptyList`, not `too_small`.
 *
 * @example
 * RequiredArraySchema(z.string()).parse(['a', '  ', ''])  // ['a']
 * RequiredArraySchema(z.string()).safeParse([])           // emptyList
 */
export const RequiredArraySchema = <T extends z.ZodTypeAny>(
	item: T,
	options?: RequiredArrayOptions,
) => {
	const { max, min = 1 } = options ?? {}

	return z.preprocess(
		(value) =>
			Array.isArray(value)
				? value.filter(
						(entry) =>
							entry !== undefined &&
							entry !== null &&
							!(typeof entry === 'string' && isBlank(entry)),
					)
				: value,
		z
			.array(item)
			.superRefine((value, ctx) => {
				if (value.length === 0) {
					ctx.addIssue(issue('emptyList', value))

					return
				}

				if (value.length < min) {
					ctx.addIssue(
						issue('tooShort', value, {
							min,
						}),
					)
				}

				if (max !== undefined && value.length > max) {
					ctx.addIssue(
						issue('tooLong', value, {
							max,
						}),
					)
				}
			})
			.meta({
				description: 'Non-empty list.',
				example: [],
			}),
	)
}

/**
 * List whose items must be distinct. Reports the duplicate at its own index,
 * so a form can highlight the offending row instead of the whole list, and
 * compares by a key when the items are objects.
 *
 * @example
 * UniqueArraySchema(z.string()).safeParse(['a', 'a'])                    // duplicateItem at [1]
 * UniqueArraySchema(Guest, (guest) => guest.email).safeParse(guests)     // compares by email
 */
export const UniqueArraySchema = <T extends z.ZodTypeAny>(
	item: T,
	by?: (value: z.infer<T>) => unknown,
) =>
	z
		.array(item)
		.superRefine((value, ctx) => {
			const seen = new Map<unknown, number>()

			value.forEach((entry, index) => {
				const key = by ? by(entry) : entry
				const first = seen.get(key)

				if (first === undefined) {
					seen.set(key, index)

					return
				}

				ctx.addIssue({
					...issue('duplicateItem', entry, {
						first,
					}),
					path: [
						index,
					],
				})
			})
		})
		.meta({
			description: 'List without duplicates.',
			example: [],
		})

/**
 * Object that must carry at least one defined property. Guards `PATCH` bodies:
 * a schema of optional fields accepts `{}`, and the handler then issues an
 * `UPDATE` with nothing to set.
 *
 * @example
 * NonEmptyObjectSchema(UpdateUser).safeParse({})  // emptyObject
 */
export const NonEmptyObjectSchema = <T extends z.ZodTypeAny>(shape: T) =>
	shape.superRefine((value: unknown, ctx: z.RefinementCtx) => {
		const defined =
			typeof value === 'object' &&
			value !== null &&
			Object.values(value).some((entry) => entry !== undefined)

		if (!defined) {
			ctx.addIssue(issue('emptyObject', value))
		}
	})
