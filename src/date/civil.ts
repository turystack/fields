/** A calendar date with no time and no time zone attached. */
export type CivilDate = {
	day: number
	month: number
	year: number
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/
const BR = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** Reports whether the numbers form a date that exists in the calendar. */
export const isRealDate = ({ day, month, year }: CivilDate): boolean => {
	if (month < 1 || month > 12 || day < 1) {
		return false
	}

	const lengths = [
		31,
		(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	]

	return day <= (lengths[month - 1] ?? 0)
}

/**
 * Reads the calendar date of an instant as seen from a time zone.
 *
 * @example
 * civilOf(new Date('2026-01-01T00:00:00Z'), 'America/Sao_Paulo') // 2025-12-31
 */
export const civilOf = (date: Date, timeZone?: string): CivilDate => {
	const parts = new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		month: '2-digit',
		timeZone,
		year: 'numeric',
	}).formatToParts(date)

	const read = (type: string) =>
		Number(parts.find((part) => part.type === type)?.value ?? Number.NaN)

	return {
		day: read('day'),
		month: read('month'),
		year: read('year'),
	}
}

/**
 * Parses a calendar date from ISO `YYYY-MM-DD`, Brazilian `DD/MM/YYYY` or a
 * `Date`. Returns `undefined` for dates the calendar does not have, which
 * `new Date('2026-02-30')` silently rolls over to March instead of rejecting.
 *
 * @example
 * parseCivil('2026-02-28')  // { year: 2026, month: 2, day: 28 }
 * parseCivil('28/02/2026')  // { year: 2026, month: 2, day: 28 }
 * parseCivil('2026-02-30')  // undefined
 */
export const parseCivil = (
	input: unknown,
	timeZone?: string,
): CivilDate | undefined => {
	if (input instanceof Date) {
		return Number.isNaN(input.getTime()) ? undefined : civilOf(input, timeZone)
	}

	if (typeof input !== 'string') {
		return undefined
	}

	const trimmed = input.trim()
	const iso = ISO.exec(trimmed)
	const br = BR.exec(trimmed)

	const candidate = iso
		? {
				day: Number(iso[3]),
				month: Number(iso[2]),
				year: Number(iso[1]),
			}
		: br
			? {
					day: Number(br[1]),
					month: Number(br[2]),
					year: Number(br[3]),
				}
			: undefined

	return candidate && isRealDate(candidate) ? candidate : undefined
}

/**
 * Renders a calendar date as `YYYY-MM-DD`.
 *
 * @example
 * formatCivil({ year: 2026, month: 2, day: 8 }) // '2026-02-08'
 */
export const formatCivil = ({ day, month, year }: CivilDate): string =>
	`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/**
 * Orders two calendar dates, returning a negative number when `left` is
 * earlier.
 *
 * @example
 * compareCivil({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 2, day: 1 }) // < 0
 */
export const compareCivil = (left: CivilDate, right: CivilDate): number =>
	formatCivil(left).localeCompare(formatCivil(right))

/**
 * Full years elapsed between two calendar dates, so a birthday later this year
 * does not count.
 *
 * @example
 * fullYearsBetween({ year: 2000, month: 12, day: 31 }, { year: 2026, month: 1, day: 1 }) // 25
 */
export const fullYearsBetween = (from: CivilDate, to: CivilDate): number => {
	const years = to.year - from.year
	const reachedBirthday =
		to.month > from.month || (to.month === from.month && to.day >= from.day)

	return reachedBirthday ? years : years - 1
}
