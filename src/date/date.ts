import z from 'zod'

import {
	type CivilDate,
	civilOf,
	compareCivil,
	formatCivil,
	fullYearsBetween,
	parseCivil,
} from './civil.js'

import { issue } from '@/internal/issue.js'
import { isBlank } from '@/internal/sanitize.js'

/** ISO 8601 instant that carries an explicit offset. */
const OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i
const TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/

const isMissing = (value: unknown): boolean =>
	value === undefined ||
	value === null ||
	(typeof value === 'string' && isBlank(value))

export type ClockOptions = {
	/** Injectable clock, so relative rules stay testable. Default `Date.now`. */
	now?: () => Date
	/** Time zone used to decide what "today" means. Default: system zone. */
	timeZone?: string
}

export type DateOnlyOptions = ClockOptions & {
	/** Latest accepted date, as `YYYY-MM-DD`. */
	max?: string
	/** Earliest accepted date, as `YYYY-MM-DD`. */
	min?: string
	/** Reject dates after today. Default `false`. */
	notFuture?: boolean
	/** Reject dates before today. Default `false`. */
	notPast?: boolean
}

const today = (options?: ClockOptions): CivilDate =>
	civilOf(options?.now?.() ?? new Date(), options?.timeZone)

/**
 * Calendar date held as `YYYY-MM-DD`, never as a `Date`.
 *
 * This is the schema that removes the classic off-by-one-day bug: parsing
 * `'2026-01-01'` with `z.coerce.date()` produces midnight UTC, which is
 * 31 December in São Paulo, so a birth date or a due date shifts by a day the
 * moment it is formatted back for the user. Keeping the value as a civil date
 * means no instant, no zone and no shift.
 *
 * It also accepts `DD/MM/YYYY`, which is what a Brazilian form field sends,
 * and rejects dates the calendar does not have - `new Date('2026-02-30')`
 * quietly becomes 2 March.
 *
 * @example
 * DateOnlySchema().parse('28/02/2026')                      // '2026-02-28'
 * DateOnlySchema().safeParse('2026-02-30')                  // invalidDate
 * DateOnlySchema({ notFuture: true }).safeParse('2999-01-01') // dateInFuture
 */
export const DateOnlySchema = (options?: DateOnlyOptions) => {
	const { max, min, notFuture = false, notPast = false } = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			if (isMissing(value)) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const civil = parseCivil(value, options?.timeZone)

			if (civil === undefined) {
				ctx.issues.push(issue('invalidDate', value))

				return z.NEVER
			}

			const iso = formatCivil(civil)
			const reference = today(options)

			if (notFuture && compareCivil(civil, reference) > 0) {
				ctx.issues.push(issue('dateInFuture', value))

				return z.NEVER
			}

			if (notPast && compareCivil(civil, reference) < 0) {
				ctx.issues.push(issue('dateInPast', value))

				return z.NEVER
			}

			if (min !== undefined && iso < min) {
				ctx.issues.push(
					issue('outOfRange', value, {
						min,
					}),
				)

				return z.NEVER
			}

			if (max !== undefined && iso > max) {
				ctx.issues.push(
					issue('outOfRange', value, {
						max,
					}),
				)

				return z.NEVER
			}

			return iso
		})
		.meta({
			description: 'Calendar date, without time zone.',
			example: '2026-02-28',
		})
}

export type BirthDateOptions = ClockOptions & {
	/** Highest accepted age in full years. Default `130`. */
	maxAge?: number
	/** Lowest accepted age in full years. Default `0`. */
	minAge?: number
}

/**
 * Birth date with an age range measured in full years, so someone whose
 * birthday falls later this year is not counted as a year older. Built on
 * `DateOnlySchema`, so the value never shifts a day across time zones, and the
 * clock is injectable so the test suite does not start failing on a birthday.
 *
 * @example
 * BirthDateSchema({ minAge: 18 }).safeParse('2020-01-01') // ageTooLow
 */
export const BirthDateSchema = (options?: BirthDateOptions) => {
	const { maxAge = 130, minAge = 0 } = options ?? {}

	return DateOnlySchema({
		...options,
		notFuture: true,
	})
		.transform((value, ctx) => {
			const civil = parseCivil(value)

			if (civil === undefined) {
				return z.NEVER
			}

			const age = fullYearsBetween(civil, today(options))

			if (age < minAge) {
				ctx.issues.push(
					issue('ageTooLow', value, {
						minAge,
					}),
				)

				return z.NEVER
			}

			if (age > maxAge) {
				ctx.issues.push(
					issue('ageTooHigh', value, {
						maxAge,
					}),
				)

				return z.NEVER
			}

			return value
		})
		.meta({
			description: 'Birth date.',
			example: '1990-02-28',
		})
}

export type DateTimeOptions = ClockOptions & {
	/** Reject instants without an explicit offset. Default `true`. */
	requireOffset?: boolean
	/** Reject instants after now. Default `false`. */
	notFuture?: boolean
	/** Reject instants before now. Default `false`. */
	notPast?: boolean
}

/**
 * Instant in time, returned as a `Date`. Unlike `z.coerce.date()` it refuses an
 * ISO string with no offset: `'2026-01-01T10:00'` means a different moment in
 * every zone, and accepting it hides the ambiguity until a report comes out
 * three hours off.
 *
 * @example
 * DateTimeSchema().parse('2026-01-01T10:00:00-03:00')  // Date
 * DateTimeSchema().safeParse('2026-01-01T10:00:00')    // missingTimezone
 */
export const DateTimeSchema = (options?: DateTimeOptions) => {
	const {
		notFuture = false,
		notPast = false,
		requireOffset = true,
	} = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			if (isMissing(value)) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			if (
				typeof value === 'string' &&
				requireOffset &&
				!OFFSET.test(value.trim())
			) {
				ctx.issues.push(issue('missingTimezone', value))

				return z.NEVER
			}

			const date =
				value instanceof Date
					? value
					: typeof value === 'string' || typeof value === 'number'
						? new Date(value)
						: undefined

			if (date === undefined || Number.isNaN(date.getTime())) {
				ctx.issues.push(issue('invalidDate', value))

				return z.NEVER
			}

			const reference = options?.now?.() ?? new Date()

			if (notFuture && date.getTime() > reference.getTime()) {
				ctx.issues.push(issue('dateInFuture', value))

				return z.NEVER
			}

			if (notPast && date.getTime() < reference.getTime()) {
				ctx.issues.push(issue('dateInPast', value))

				return z.NEVER
			}

			return date
		})
		.meta({
			description: 'Instant with an explicit offset.',
			example: '2026-02-28T10:00:00-03:00',
		})
}

export type TimeOptions = {
	/** Require seconds. Default `false`. */
	seconds?: boolean
}

/**
 * Time of day as `HH:mm`, with real hour and minute ranges - a loose regex
 * accepts `25:99`, and `z.string()` accepts anything at all.
 *
 * @example
 * TimeSchema().parse(' 09:30 ')       // '09:30'
 * TimeSchema().safeParse('25:00')     // invalidTime
 */
export const TimeSchema = (options?: TimeOptions) => {
	const { seconds = false } = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			if (isMissing(value)) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const match = typeof value === 'string' ? TIME.exec(value.trim()) : null

			if (match === null) {
				ctx.issues.push(issue('invalidTime', value))

				return z.NEVER
			}

			const hour = Number(match[1])
			const minute = Number(match[2])
			const second = match[3] === undefined ? 0 : Number(match[3])

			if (hour > 23 || minute > 59 || second > 59) {
				ctx.issues.push(issue('invalidTime', value))

				return z.NEVER
			}

			if (seconds && match[3] === undefined) {
				ctx.issues.push(issue('invalidTime', value))

				return z.NEVER
			}

			const base = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

			return seconds ? `${base}:${String(second).padStart(2, '0')}` : base
		})
		.meta({
			description: 'Time of day.',
			example: '09:30',
		})
}
