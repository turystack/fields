import z from 'zod'

import { issue } from '@/internal/issue.js'
import { deburr, sanitize } from '@/internal/sanitize.js'

const TRUTHY = new Set([
	'1',
	'on',
	'sim',
	't',
	'true',
	'y',
	'yes',
])
const FALSY = new Set([
	'0',
	'f',
	'false',
	'n',
	'nao',
	'no',
	'off',
])

/** Reads the many ways a form or a query string spells a boolean. */
const read = (value: unknown): boolean | undefined => {
	if (typeof value === 'boolean') {
		return value
	}

	if (typeof value === 'number') {
		return value === 1 ? true : value === 0 ? false : undefined
	}

	if (typeof value !== 'string') {
		return undefined
	}

	const token = deburr(sanitize(value)).toLowerCase()

	return TRUTHY.has(token) ? true : FALSY.has(token) ? false : undefined
}

/**
 * Boolean coming from a form or a JSON body. Accepts the spellings a browser
 * actually sends - `'on'` from a checkbox, `'1'`, `'sim'` - instead of only
 * `true` and `false`, and rejects anything else rather than coercing it, the
 * way `Boolean('false')` returns `true`.
 *
 * @example
 * BooleanInputSchema().parse('on')      // true
 * BooleanInputSchema().parse('Nao')     // false
 * BooleanInputSchema().safeParse('yep') // invalidValue
 */
export const BooleanInputSchema = () =>
	z
		.unknown()
		.transform((value, ctx) => {
			if (value === undefined || value === null) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const parsed = read(value)

			if (parsed === undefined) {
				ctx.issues.push(issue('invalidValue', value))

				return z.NEVER
			}

			return parsed
		})
		.meta({
			description: 'Boolean accepted in form and query spellings.',
			example: true,
		})

/**
 * Checkbox field. An unchecked box is not submitted at all, so a missing or
 * blank value means `false` here instead of the `required` error that
 * `z.boolean()` raises for every unchecked box on the form.
 *
 * @example
 * CheckboxSchema().parse(undefined)  // false
 * CheckboxSchema().parse('on')       // true
 */
export const CheckboxSchema = () =>
	z
		.unknown()
		.transform((value, ctx) => {
			if (value === undefined || value === null || value === '') {
				return false
			}

			const parsed = read(value)

			if (parsed === undefined) {
				ctx.issues.push(issue('invalidValue', value))

				return z.NEVER
			}

			return parsed
		})
		.meta({
			description: 'Checkbox, defaulting to false when absent.',
			example: false,
		})

/**
 * Consent box that must be checked. Reports `mustAccept` rather than the
 * `invalid_literal` that `z.literal(true)` produces, so the message shown next
 * to the terms checkbox can say what the user has to do.
 *
 * @example
 * MustAcceptSchema().safeParse(false)  // mustAccept
 */
export const MustAcceptSchema = () =>
	z
		.unknown()
		.transform((value, ctx) => {
			if (read(value) !== true) {
				ctx.issues.push(issue('mustAccept', value))

				return z.NEVER
			}

			return true as const
		})
		.meta({
			description: 'Consent that must be granted.',
			example: true,
		})

/**
 * Yes, no, or not answered. Keeps "unanswered" distinct from "no", which a
 * plain boolean cannot represent and a default of `false` quietly destroys.
 *
 * @example
 * TriStateSchema().parse('')     // null
 * TriStateSchema().parse('nao')  // false
 */
export const TriStateSchema = () =>
	z
		.unknown()
		.transform((value, ctx) => {
			if (value === undefined || value === null || value === '') {
				return null
			}

			const parsed = read(value)

			if (parsed === undefined) {
				ctx.issues.push(issue('invalidValue', value))

				return z.NEVER
			}

			return parsed
		})
		.meta({
			description: 'Yes, no, or unanswered.',
			example: null,
		})
