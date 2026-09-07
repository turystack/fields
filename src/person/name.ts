import z from 'zod'

import { check } from '@/internal/issue.js'
import { sanitize } from '@/internal/sanitize.js'

/** Letters, spaces and the punctuation that legitimately appears in names. */
const NAME = /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u

/** Particles that stay lowercase when title-casing a Portuguese name. */
const PARTICLES = new Set([
	'da',
	'das',
	'de',
	'del',
	'di',
	'do',
	'dos',
	'du',
	'e',
	'la',
	'le',
	'van',
	'von',
	'y',
])

export type PersonNameOptions = {
	/** Title-case the value, keeping particles lowercase. Default `false`. */
	capitalize?: boolean
	/** Maximum length. Default `100`. */
	max?: number
	/** Minimum length. Default `2`. */
	min?: number
	/** Require at least two words of two letters. Default `false`. */
	requireFullName?: boolean
}

const toTitleCase = (value: string): string =>
	value
		.split(' ')
		.map((word, index) => {
			const lower = word.toLocaleLowerCase()

			if (index > 0 && PARTICLES.has(lower)) {
				return lower
			}

			return lower.replace(
				/(^|[-'’])(\p{L})/gu,
				(_, boundary: string, letter: string) =>
					boundary + letter.toLocaleUpperCase(),
			)
		})
		.join(' ')

/**
 * Person name. Accepts accents, apostrophes and hyphens while rejecting the
 * digits and symbols that `z.string().min(2)` lets through, collapses repeated
 * spaces, and can require a full name or title-case the result without
 * uppercasing Portuguese particles.
 *
 * @example
 * PersonNameSchema().parse('  Ana   Maria ')                    // 'Ana Maria'
 * PersonNameSchema().safeParse('Ana 123')                       // invalidPersonName
 * PersonNameSchema({ requireFullName: true }).safeParse('Ana')  // fullNameRequired
 * PersonNameSchema({ capitalize: true }).parse('ANA DE SOUZA')  // 'Ana de Souza'
 */
export const PersonNameSchema = (options?: PersonNameOptions) => {
	const {
		capitalize = false,
		max = 100,
		min = 2,
		requireFullName = false,
	} = options ?? {}

	return z
		.string()
		.overwrite((value) => {
			const clean = sanitize(value)

			return capitalize ? toTitleCase(clean) : clean
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
		.refine((value) => NAME.test(value), {
			...check('invalidPersonName'),
			abort: true,
		})
		.refine(
			(value) =>
				!requireFullName ||
				value.split(' ').filter((word) => word.length >= 2).length >= 2,
			check('fullNameRequired'),
		)
		.meta({
			description: 'Person name.',
			example: 'Ana Maria de Souza',
		})
}
