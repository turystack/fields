import z from 'zod'

import { check } from '@/internal/issue.js'
import { deburr, sanitize } from '@/internal/sanitize.js'

/** Paths that would collide with routes if used as a slug. */
const RESERVED = [
	'admin',
	'api',
	'assets',
	'auth',
	'edit',
	'new',
	'public',
	'settings',
	'static',
] as const

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type SlugOptions = {
	/** Maximum length. Default `80`. */
	max?: number
	/** Minimum length. Default `1`. */
	min?: number
	/** Values rejected as `reservedValue`. Defaults to common route names. */
	reserved?: readonly string[]
	/** Reject input that is not already a slug instead of converting it. */
	strict?: boolean
}

/**
 * Converts free text into a URL slug, or validates one when `strict`.
 * Removes diacritics, lowercases, collapses separators and trims stray
 * hyphens - so `'  Ola   Mundo!  '` and `'ola-mundo'` produce the same value
 * instead of two rows that look identical in a listing.
 *
 * Also rejects route-colliding names, which a regex alone never catches.
 *
 * @example
 * SlugSchema().parse('  Acao   Rapida! ')       // 'acao-rapida'
 * SlugSchema().safeParse('admin')               // reservedValue
 * SlugSchema({ strict: true }).safeParse('Ola') // invalidSlug
 */
export const SlugSchema = (options?: SlugOptions) => {
	const {
		max = 80,
		min = 1,
		reserved = RESERVED,
		strict = false,
	} = options ?? {}
	const blocked = new Set(reserved)

	return z
		.string()
		.overwrite((value) => {
			const trimmed = sanitize(value)

			if (strict) {
				return trimmed
			}

			return deburr(trimmed)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/-{2,}/g, '-')
				.replace(/^-|-$/g, '')
		})
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine((value) => SLUG.test(value), {
			...check('invalidSlug'),
			abort: true,
		})
		.refine(
			(value) => value.length >= min,
			check('tooShort', {
				min,
			}),
		)
		.refine(
			(value) => value.length <= max,
			check('tooLong', {
				max,
			}),
		)
		.refine((value) => !blocked.has(value), check('reservedValue'))
		.meta({
			description: 'URL-safe slug.',
			example: 'acao-rapida',
		})
}
