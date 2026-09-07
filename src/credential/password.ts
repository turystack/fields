import z from 'zod'

import { check } from '@/internal/issue.js'
import { deburr } from '@/internal/sanitize.js'

/** bcrypt silently truncates the input after 72 bytes. */
const MAX_BYTES = 72

/** Passwords common enough that an attacker tries them first. */
const COMMON = new Set([
	'000000',
	'102030',
	'11111111',
	'123123',
	'12345678',
	'123456789',
	'1234567890',
	'abc123',
	'admin',
	'admin123',
	'iloveyou',
	'mudar123',
	'password',
	'password1',
	'qwerty',
	'qwerty123',
	'senha',
	'senha123',
	'senha1234',
	'welcome',
])

/** Keyboard rows walked in either direction. */
const ROWS = [
	'qwertyuiop',
	'asdfghjkl',
	'zxcvbnm',
	'1234567890',
]

const CHARSETS = [
	{
		pattern: /[a-z]/,
		size: 26,
	},
	{
		pattern: /[A-Z]/,
		size: 26,
	},
	{
		pattern: /[0-9]/,
		size: 10,
	},
	{
		pattern: /[^a-zA-Z0-9]/,
		size: 33,
	},
] as const

/** Estimates entropy from the character pool actually used. */
const entropyOf = (value: string): number => {
	const pool = CHARSETS.reduce(
		(total, charset) =>
			charset.pattern.test(value) ? total + charset.size : total,
		0,
	)

	if (pool === 0) {
		return 0
	}

	const unique = new Set(value).size
	const variety = unique / value.length

	return value.length * Math.log2(pool) * variety
}

/** Detects runs like `abcd`, `4321` or `qwer`. */
const hasSequence = (value: string, run: number): boolean => {
	const lower = value.toLowerCase()

	for (let index = 0; index <= lower.length - run; index += 1) {
		const slice = lower.slice(index, index + run)
		const codes = [
			...slice,
		].map((char) => char.charCodeAt(0))
		const ascending = codes.every(
			(code, position) => position === 0 || code === codes[position - 1]! + 1,
		)
		const descending = codes.every(
			(code, position) => position === 0 || code === codes[position - 1]! - 1,
		)

		if (ascending || descending) {
			return true
		}

		const reversed = [
			...slice,
		]
			.reverse()
			.join('')

		if (ROWS.some((row) => row.includes(slice) || row.includes(reversed))) {
			return true
		}
	}

	return false
}

/** Detects the same character repeated `run` times. */
const hasRepeat = (value: string, run: number): boolean =>
	new RegExp(`(.)\\1{${run - 1},}`).test(value)

export type PasswordOptions = {
	/** Words the password must not contain, such as the email or the name. */
	context?: readonly string[]
	/** Maximum length in bytes. Default `72`, the bcrypt limit. */
	maxBytes?: number
	/** Minimum estimated entropy, in bits. Default `45`. */
	minEntropy?: number
	/** Minimum length. Default `10`. */
	min?: number
	/** Minimum score when `strength` is supplied. Default `3`. */
	minStrength?: number
	/** Unicode normalization applied before hashing. Default `'NFKC'`. */
	normalize?: 'NFKC' | false
	/** Length of a sequence or repetition that fails the check. Default `4`. */
	run?: number
	/** External scorer, such as zxcvbn, returning a 0-4 score. */
	strength?: (value: string) => number
}

/**
 * Password field. Length alone accepts `Senha@123`, so this also measures the
 * entropy of the character pool actually used, rejects keyboard walks and
 * repeated runs, rejects anything containing the user's own email or name, and
 * caps the value at 72 bytes - past that bcrypt truncates and two different
 * passwords start unlocking the same account.
 *
 * Whitespace at the edges is rejected rather than trimmed: trimming changes
 * the secret, and the user cannot see what was removed.
 *
 * Normalization must match between sign-up and sign-in; keep this schema as
 * the single definition of both.
 *
 * @example
 * PasswordSchema().safeParse(' abc ')                          // passwordHasWhitespace
 * PasswordSchema().safeParse('abcdefghijkl')                   // passwordSequential
 * PasswordSchema({ context: ['ana@x.com'] }).safeParse('ana@x.com!2')  // passwordContainsContext
 */
export const PasswordSchema = (options?: PasswordOptions) => {
	const {
		context = [],
		maxBytes = MAX_BYTES,
		min = 10,
		minEntropy = 45,
		minStrength = 3,
		normalize = 'NFKC',
		run = 4,
		strength,
	} = options ?? {}

	const encoder = new TextEncoder()
	const words = context
		.flatMap((entry) => [
			entry,
			entry.split('@')[0] ?? '',
			...entry.split(/[\s.@]+/),
		])
		.map((entry) => deburr(entry).toLowerCase())
		.filter((entry) => entry.length >= 4)

	return z
		.string()
		.overwrite((value) => (normalize ? value.normalize(normalize) : value))
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine((value) => value.trim() === value, {
			...check('passwordHasWhitespace'),
			abort: true,
		})
		.refine((value) => value.length >= min, {
			...check('tooShort', {
				min,
			}),
			abort: true,
		})
		.refine((value) => encoder.encode(value).length <= maxBytes, {
			...check('passwordTooLong', {
				maxBytes,
			}),
			abort: true,
		})
		.refine(
			(value) => !COMMON.has(value.toLowerCase()),
			check('passwordTooWeak', {
				reason: 'common',
			}),
		)
		.refine(
			(value) => !hasSequence(value, run) && !hasRepeat(value, run),
			check('passwordSequential', {
				run,
			}),
		)
		.refine((value) => {
			const haystack = deburr(value).toLowerCase()

			return !words.some((word) => haystack.includes(word))
		}, check('passwordContainsContext'))
		.refine(
			(value) => entropyOf(value) >= minEntropy,
			check('passwordTooWeak', {
				minEntropy,
			}),
		)
		.refine(
			(value) => strength === undefined || strength(value) >= minStrength,
			check('passwordTooWeak', {
				minStrength,
			}),
		)
		.meta({
			description: 'Password.',
			example: 'correta-bateria-cavalo-grampo',
		})
}
