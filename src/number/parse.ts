import { sanitize } from '@/internal/sanitize.js'

/** Which character separates the decimal part. */
export type Separator = 'auto' | 'comma' | 'dot'

/** A decimal split into exact digit strings, so no float ever rounds it. */
export type ParsedDecimal = {
	fraction: string
	integer: string
	sign: '' | '-'
}

/** Currency and percent marks stripped before parsing. */
const ORNAMENT = /[R$€£%\s]/g

const GROUPED = (separator: string) =>
	new RegExp(`^\\d{1,3}(?:\\${separator}\\d{3})+$`)

const stripLeadingZeros = (digits: string): string =>
	digits.replace(/^0+(?=\d)/, '')

/**
 * Parses a decimal from a number or a masked string into exact digit strings.
 * Returns `undefined` when the input is not a finite decimal.
 *
 * `'auto'` treats the last of `.` and `,` as the decimal separator when both
 * appear. With a single `.` it is read as the decimal point, so masked pt-BR
 * input such as `'1.234'` should be parsed with `separator: 'comma'`.
 *
 * @example
 * parseDecimal('R$ 1.234,56', 'auto')  // { sign: '', integer: '1234', fraction: '56' }
 * parseDecimal('1.234', 'comma')       // { sign: '', integer: '1234', fraction: '' }
 * parseDecimal('1e5', 'auto')          // undefined
 */
export const parseDecimal = (
	input: unknown,
	separator: Separator = 'auto',
): ParsedDecimal | undefined => {
	if (typeof input === 'number') {
		if (!Number.isFinite(input)) {
			return undefined
		}

		const text = String(input)

		return text.includes('e') || text.includes('E')
			? undefined
			: parseDecimal(text, 'dot')
	}

	if (typeof input !== 'string') {
		return undefined
	}

	const cleaned = sanitize(input, {
		whitespace: 'trim',
	}).replace(ORNAMENT, '')

	if (!/^[+-]?[\d.,]+$/.test(cleaned)) {
		return undefined
	}

	const sign = cleaned.startsWith('-') ? '-' : ''
	const body = cleaned.replace(/^[+-]/, '')
	const lastDot = body.lastIndexOf('.')
	const lastComma = body.lastIndexOf(',')

	let decimal: string | undefined

	if (separator === 'comma') {
		decimal = lastComma === -1 ? undefined : ','
	} else if (separator === 'dot') {
		decimal = lastDot === -1 ? undefined : '.'
	} else if (lastDot !== -1 && lastComma !== -1) {
		decimal = lastDot > lastComma ? '.' : ','
	} else if (lastComma !== -1) {
		decimal = ','
	} else if (lastDot !== -1 && body.indexOf('.') === lastDot) {
		decimal = '.'
	}

	const parts = decimal
		? body.split(decimal)
		: [
				body,
			]

	if (parts.length > 2) {
		return undefined
	}

	const rawInteger = parts[0] ?? ''
	const rawFraction = parts[1] ?? ''
	const groupChars = (
		decimal === '.'
			? [
					',',
				]
			: decimal === ','
				? [
						'.',
					]
				: [
						'.',
						',',
					]
	).filter((char) => rawInteger.includes(char))

	if (
		groupChars.length > 1 ||
		rawFraction.includes('.') ||
		rawFraction.includes(',')
	) {
		return undefined
	}

	const group = groupChars[0]

	if (group !== undefined && !GROUPED(group).test(rawInteger)) {
		return undefined
	}

	const integerDigits = group ? rawInteger.split(group).join('') : rawInteger

	if (!/^\d*$/.test(integerDigits) || !/^\d*$/.test(rawFraction)) {
		return undefined
	}

	if (integerDigits.length === 0 && rawFraction.length === 0) {
		return undefined
	}

	const integer = stripLeadingZeros(integerDigits || '0')
	const isZero = integer === '0' && /^0*$/.test(rawFraction)

	return {
		fraction: rawFraction,
		integer,
		sign: isZero ? '' : sign,
	}
}

/**
 * Converts a parsed decimal to a JavaScript number.
 *
 * @example
 * toNumber({ sign: '', integer: '1234', fraction: '56' }) // 1234.56
 */
export const toNumber = (parsed: ParsedDecimal): number =>
	Number(`${parsed.sign}${parsed.integer}.${parsed.fraction || '0'}`)

/**
 * Converts a parsed decimal to a scaled integer using digit arithmetic, so
 * `1234.565` never lands on the wrong side of a float rounding error the way
 * `Math.round(value * 100)` does.
 *
 * @example
 * toScaledInteger({ sign: '', integer: '1234', fraction: '56' }, 2) // 123456
 */
export const toScaledInteger = (parsed: ParsedDecimal, scale: number): number =>
	Number(`${parsed.sign}${parsed.integer}${parsed.fraction.padEnd(scale, '0')}`)

/**
 * Renders a parsed decimal with a fixed number of fraction digits.
 *
 * @example
 * toFixedString({ sign: '', integer: '5', fraction: '5' }, 2) // '5.50'
 */
export const toFixedString = (parsed: ParsedDecimal, scale: number): string => {
	const fraction = parsed.fraction.padEnd(scale, '0')

	return scale === 0
		? `${parsed.sign}${parsed.integer}`
		: `${parsed.sign}${parsed.integer}.${fraction}`
}
