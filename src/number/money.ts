import z from 'zod'

import { type FieldIssue, numeric, rangeIssues } from './numeric.js'
import type { Separator } from './parse.js'
import { toFixedString, toScaledInteger } from './parse.js'

import { issue } from '@/internal/issue.js'

export type MoneyOptions = {
	/** ISO 4217 code, used only for documentation. Default `'BRL'`. */
	currency?: string
	/** Largest accepted amount, in minor units. */
	maxCents?: number
	/** Smallest accepted amount, in minor units. Default `0`. */
	minCents?: number
	/** Minor units per major unit, as a power of ten. Default `2`. */
	scale?: number
	/** Which character separates the decimal part. Default `'auto'`. */
	separator?: Separator
}

/**
 * Monetary amount, parsed from a masked field and returned as an integer in
 * minor units. Money never becomes a float here: the cents are assembled from
 * the digit string, so `1.005` yields `100` with `Math.round(value * 100)` but
 * `1005` at scale three, and no total ever drifts by a cent.
 *
 * Extra decimal places are rejected instead of rounded, because rounding a
 * price the user typed is a decision the server should not make silently.
 *
 * @example
 * MoneySchema().parse('R$ 1.234,56')          // 123456
 * MoneySchema().safeParse('10,999')           // tooManyDecimals
 * MoneySchema().safeParse('')                 // required
 */
export const MoneySchema = (options?: MoneyOptions) => {
	const {
		currency = 'BRL',
		maxCents,
		minCents = 0,
		scale = 2,
		separator = 'auto',
	} = options ?? {}

	return numeric(
		separator,
		(parsed, raw) => {
			if (parsed.fraction.length > scale) {
				return [
					issue('tooManyDecimals', raw, {
						scale,
					}),
				]
			}

			const cents = toScaledInteger(parsed, scale)

			if (!Number.isSafeInteger(cents)) {
				return [
					issue('unsafeInteger', raw),
				]
			}

			return rangeIssues(
				cents,
				{
					max: maxCents,
					min: minCents,
				},
				raw,
			)
		},
		(parsed) => toScaledInteger(parsed, scale),
	).meta({
		description: `Amount in ${currency} minor units.`,
		example: 123456,
	})
}

export type DecimalOptions = {
	/** Total number of digits allowed, as in `numeric(precision, scale)`. */
	precision: number
	/** Digits allowed after the decimal point. */
	scale: number
	/** Which character separates the decimal part. Default `'auto'`. */
	separator?: Separator
}

/**
 * Fixed-precision decimal returned as a normalized string, mirroring a
 * `numeric(precision, scale)` column. Validating precision here is what stops
 * an `INSERT` from failing at runtime on a value Zod happily accepted, and
 * keeping the value as a string means no digit is lost to binary floating
 * point on the way to the database.
 *
 * @example
 * DecimalSchema({ precision: 6, scale: 2 }).parse('1.234,5')   // '1234.50'
 * DecimalSchema({ precision: 4, scale: 2 }).safeParse('12345') // precisionExceeded
 */
export const DecimalSchema = (options: DecimalOptions) => {
	const { precision, scale, separator = 'auto' } = options

	return numeric(
		separator,
		(parsed, raw) => {
			const found: FieldIssue[] = []

			if (parsed.fraction.length > scale) {
				found.push(
					issue('tooManyDecimals', raw, {
						scale,
					}),
				)
			}

			if (parsed.integer.length > precision - scale) {
				found.push(
					issue('precisionExceeded', raw, {
						precision,
						scale,
					}),
				)
			}

			return found
		},
		(parsed) => toFixedString(parsed, scale),
	).meta({
		description: `Decimal with precision ${precision} and scale ${scale}.`,
		example: '1234.50',
	})
}
