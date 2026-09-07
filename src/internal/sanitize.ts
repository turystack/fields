/** Builds a character-class regex from explicit code point ranges. */
const classOf = (
	ranges: readonly (readonly [
		number,
		number,
	])[],
): RegExp => {
	const toEscape = (code: number) =>
		`\\u${code.toString(16).padStart(4, '0').toUpperCase()}`

	const body = ranges
		.map(([from, to]) =>
			from === to ? toEscape(from) : `${toEscape(from)}-${toEscape(to)}`,
		)
		.join('')

	return new RegExp(`[${body}]`, 'g')
}

/**
 * Zero-width, soft hyphen and bidi-override characters. They have a non-zero
 * `length`, so a field holding only these passes `z.string().min(1)`.
 */
const INVISIBLE = classOf([
	[
		0x00ad,
		0x00ad,
	], // soft hyphen
	[
		0x180e,
		0x180e,
	], // mongolian vowel separator
	[
		0x200b,
		0x200f,
	], // zero width space .. right-to-left mark
	[
		0x202a,
		0x202e,
	], // bidi embedding and override
	[
		0x2060,
		0x2064,
	], // word joiner .. invisible plus
	[
		0x2066,
		0x2069,
	], // bidi isolates
	[
		0xfeff,
		0xfeff,
	], // byte order mark
])

/** C0/C1 control characters, excluding tab, line feed and carriage return. */
const CONTROL = classOf([
	[
		0x0000,
		0x0008,
	],
	[
		0x000b,
		0x000c,
	],
	[
		0x000e,
		0x001f,
	],
	[
		0x007f,
		0x009f,
	],
])

/** Unicode spaces that are not U+0020 (NBSP, en/em spaces, ideographic space). */
const EXOTIC_SPACE = classOf([
	[
		0x00a0,
		0x00a0,
	],
	[
		0x1680,
		0x1680,
	],
	[
		0x2000,
		0x200a,
	],
	[
		0x202f,
		0x202f,
	],
	[
		0x205f,
		0x205f,
	],
	[
		0x3000,
		0x3000,
	],
])

/** Combining diacritical marks, removed after NFD normalization. */
const DIACRITIC = classOf([
	[
		0x0300,
		0x036f,
	],
])

/** How surrounding and inner whitespace is handled before validation. */
export type Whitespace = 'collapse' | 'preserve' | 'trim'

/** Unicode normalization form, or `false` to skip normalization. */
export type Unicode = 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | false

export type SanitizeOptions = {
	/** Keep invisible characters instead of stripping them. Default `false`. */
	allowInvisible?: boolean
	/** Keep line breaks. Default `false` - breaks collapse into spaces. */
	multiline?: boolean
	/** Unicode normalization form. Default `'NFC'`. */
	unicode?: Unicode
	/** Whitespace handling. Default `'collapse'`. */
	whitespace?: Whitespace
}

/**
 * Normalizes free text before validation: applies Unicode normalization,
 * strips invisible and control characters, folds exotic spaces into U+0020
 * and applies the whitespace policy.
 *
 * @example
 * sanitize('  Jose   Silva ')                  // 'Jose Silva'
 * sanitize('\u200B\u200B')                     // ''
 * sanitize('a\u00A0b')                       // 'a b' (NBSP folded)
 * sanitize('a\n\nb', { multiline: true })      // 'a\n\nb'
 */
export const sanitize = (value: string, options?: SanitizeOptions): string => {
	const {
		allowInvisible = false,
		multiline = false,
		unicode = 'NFC',
		whitespace = 'collapse',
	} = options ?? {}

	let result = unicode ? value.normalize(unicode) : value

	if (!allowInvisible) {
		result = result.replace(INVISIBLE, '').replace(CONTROL, '')
	}

	result = result.replace(EXOTIC_SPACE, ' ')

	result = multiline
		? result.replace(/\r\n?/g, '\n')
		: result.replace(/[\t\n\r]+/g, ' ')

	if (whitespace === 'preserve') {
		return result
	}

	if (whitespace === 'collapse') {
		result = multiline
			? result
					.split('\n')
					.map((line) => line.replace(/ {2,}/g, ' ').trim())
					.join('\n')
					.replace(/\n{3,}/g, '\n\n')
			: result.replace(/ {2,}/g, ' ')
	}

	return result.trim()
}

/**
 * Reports whether a value carries no meaning once sanitized. Covers `''`,
 * whitespace-only input and strings made solely of invisible characters.
 *
 * @example
 * isBlank('   ')         // true
 * isBlank('\u200B')      // true
 * isBlank('0')           // false
 */
export const isBlank = (value: string): boolean => sanitize(value).length === 0

/**
 * Removes every character that is not an ASCII digit.
 *
 * @example
 * onlyDigits('529.982.247-25') // '52998224725'
 */
export const onlyDigits = (value: string): string => value.replace(/\D+/g, '')

/**
 * Strips diacritics, leaving the base letters.
 *
 * @example
 * deburr('Acao') // 'Acao'
 */
export const deburr = (value: string): string =>
	value.normalize('NFD').replace(DIACRITIC, '')
