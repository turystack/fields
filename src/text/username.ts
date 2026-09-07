import z from 'zod'

import { check } from '@/internal/issue.js'
import { sanitize } from '@/internal/sanitize.js'

/** Names that must never belong to a user account. */
const RESERVED = [
	'admin',
	'administrator',
	'api',
	'help',
	'me',
	'null',
	'root',
	'security',
	'settings',
	'support',
	'system',
	'undefined',
] as const

/** Characters that read alike and let one account impersonate another. */
const CONFUSABLE = /[0Oo1lI]/

export type UsernameOptions = {
	/** Separators allowed inside the name. Default `'._-'`. */
	separators?: string
	/** Lowercase the value. Default `true`. */
	lowercase?: boolean
	/** Maximum length. Default `30`. */
	max?: number
	/** Minimum length. Default `3`. */
	min?: number
	/** Values rejected as `reservedValue`. */
	reserved?: readonly string[]
	/** Reject digits and letters that look alike. Default `false`. */
	strictConfusables?: boolean
}

/**
 * Account handle. Beyond a length check it enforces the rules that keep
 * handles unique and unambiguous: it must start with a letter, may not end on
 * a separator, may not contain two separators in a row, and may not be a
 * reserved name. Case folding happens before validation, so `'Ana'` and
 * `'ana'` cannot both be taken.
 *
 * @example
 * UsernameSchema().parse(' Ana.Maria ')        // 'ana.maria'
 * UsernameSchema().safeParse('ana__maria')     // invalidUsername
 * UsernameSchema().safeParse('_ana')           // invalidUsername
 * UsernameSchema().safeParse('admin')          // reservedValue
 */
export const UsernameSchema = (options?: UsernameOptions) => {
	const {
		lowercase = true,
		max = 30,
		min = 3,
		reserved = RESERVED,
		separators = '._-',
		strictConfusables = false,
	} = options ?? {}

	const escaped = separators.replace(/[-\\\]^]/g, '\\$&')
	const pattern = new RegExp(`^[a-z][a-z0-9]*(?:[${escaped}][a-z0-9]+)*$`, 'i')
	const blocked = new Set(reserved)

	return z
		.string()
		.overwrite((value) => {
			const trimmed = sanitize(value)

			return lowercase ? trimmed.toLowerCase() : trimmed
		})
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine((value) => value.length >= min, {
			...check('tooShort', {
				min,
			}),
			abort: true,
		})
		.refine((value) => value.length <= max, {
			...check('tooLong', {
				max,
			}),
			abort: true,
		})
		.refine((value) => pattern.test(value), {
			...check('invalidUsername'),
			abort: true,
		})
		.refine(
			(value) => !blocked.has(value.toLowerCase()),
			check('reservedValue'),
		)
		.refine(
			(value) => !strictConfusables || !CONFUSABLE.test(value),
			check('confusableCharacters'),
		)
		.meta({
			description: 'Account handle.',
			example: 'ana.maria',
		})
}
