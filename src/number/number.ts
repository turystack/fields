import z from 'zod'

import { numeric, rangeIssues } from './numeric.js'
import type { Separator } from './parse.js'
import { toNumber } from './parse.js'

import { issue } from '@/internal/issue.js'

export type NumberOptions = {
	/** Largest accepted value. */
	max?: number
	/** Maximum number of decimal places. */
	maxDecimals?: number
	/** Smallest accepted value. */
	min?: number
	/** Which character separates the decimal part. Default `'auto'`. */
	separator?: Separator
}

/**
 * Decimal number from a form field or a JSON body. Blank input is `required`
 * rather than `0`, `NaN` and `Infinity` are rejected instead of flowing into
 * the domain, exponent notation is refused, and masked input such as
 * `'1.234,56'` is understood.
 *
 * @example
 * NumberSchema().parse('1.234,56')                  // 1234.56
 * NumberSchema().safeParse('')                      // required
 * NumberSchema().safeParse('abc')                   // notANumber
 * NumberSchema({ maxDecimals: 2 }).safeParse('1,239') // tooManyDecimals
 */
export const NumberSchema = (options?: NumberOptions) => {
	const { max, maxDecimals, min, separator = 'auto' } = options ?? {}

	return numeric(
		separator,
		(parsed, raw) => [
			...(maxDecimals !== undefined && parsed.fraction.length > maxDecimals
				? [
						issue('tooManyDecimals', raw, {
							maxDecimals,
						}),
					]
				: []),
			...rangeIssues(
				toNumber(parsed),
				{
					max,
					min,
				},
				raw,
			),
		],
		(parsed) => toNumber(parsed),
	).meta({
		description: 'Decimal number.',
		example: 1234.56,
	})
}

/**
 * Integer field. Rejects a fractional input outright instead of truncating it,
 * and refuses values past `Number.MAX_SAFE_INTEGER`, where arithmetic silently
 * stops being exact.
 *
 * @example
 * IntSchema().parse('42')          // 42
 * IntSchema().safeParse('4.2')     // notAnInteger
 * IntSchema().safeParse('1e999')   // notANumber
 */
export const IntSchema = (options?: Omit<NumberOptions, 'maxDecimals'>) => {
	const { max, min, separator = 'auto' } = options ?? {}

	return numeric(
		separator,
		(parsed, raw) => {
			if (Number(parsed.fraction || '0') !== 0) {
				return [
					issue('notAnInteger', raw),
				]
			}

			const value = toNumber(parsed)

			if (!Number.isSafeInteger(value)) {
				return [
					issue('unsafeInteger', raw),
				]
			}

			return rangeIssues(
				value,
				{
					max,
					min,
				},
				raw,
			)
		},
		(parsed) => toNumber(parsed),
	).meta({
		description: 'Integer.',
		example: 42,
	})
}

export type QuantityOptions = {
	/** Largest accepted quantity. */
	max?: number
	/** Smallest accepted quantity. Default `1`. */
	min?: number
	/** Allowed increment above `min`. Default `1`. */
	step?: number
}

/**
 * Countable quantity: a positive integer constrained to a step. The step check
 * is measured from `min`, so a pack sold in sixes starting at six accepts 6 and
 * 12 but not 8.
 *
 * @example
 * QuantitySchema({ step: 6 }).safeParse(8)  // notAMultipleOf
 */
export const QuantitySchema = (options?: QuantityOptions) => {
	const { max, min = 1, step = 1 } = options ?? {}

	return numeric(
		'auto',
		(parsed, raw) => {
			if (Number(parsed.fraction || '0') !== 0) {
				return [
					issue('notAnInteger', raw),
				]
			}

			const value = toNumber(parsed)
			const found = rangeIssues(
				value,
				{
					max,
					min,
				},
				raw,
			)

			if (value >= min && (value - min) % step !== 0) {
				found.push(
					issue('notAMultipleOf', raw, {
						min,
						step,
					}),
				)
			}

			return found
		},
		(parsed) => toNumber(parsed),
	).meta({
		description: 'Quantity.',
		example: 1,
	})
}

export type PercentageOptions = {
	/** Scale of the value: `100` for `0-100`, `1` for `0-1`. Default `100`. */
	of?: 1 | 100
	/** Maximum number of decimal places. Default `2`. */
	maxDecimals?: number
}

/**
 * Percentage. Accepts `'45%'` and states its scale explicitly, so a `0-1`
 * ratio and a `0-100` reading can never be confused for one another.
 *
 * @example
 * PercentageSchema().parse('45%')             // 45
 * PercentageSchema({ of: 1 }).safeParse(45)   // outOfRange
 */
export const PercentageSchema = (options?: PercentageOptions) => {
	const { maxDecimals = 2, of = 100 } = options ?? {}

	return numeric(
		'auto',
		(parsed, raw) => [
			...(parsed.fraction.length > maxDecimals
				? [
						issue('tooManyDecimals', raw, {
							maxDecimals,
						}),
					]
				: []),
			...rangeIssues(
				toNumber(parsed),
				{
					max: of,
					min: 0,
				},
				raw,
			),
		],
		(parsed) => toNumber(parsed),
	).meta({
		description: `Percentage between 0 and ${of}.`,
		example: of === 1 ? 0.45 : 45,
	})
}
