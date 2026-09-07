import { describe, expect, it } from 'vitest'
import type z from 'zod'

import {
	BirthDateSchema,
	DateOnlySchema,
	DateTimeSchema,
	TimeSchema,
} from './date.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

const clock = (iso: string) => () => new Date(iso)

describe('DateOnlySchema', () => {
	it.each([
		[
			'2026-02-28',
			'2026-02-28',
		],
		[
			'28/02/2026',
			'2026-02-28',
		],
	])('should read %j as %j', (input, expected) => {
		expect(DateOnlySchema().parse(input)).toBe(expected)
	})

	it('should not shift the day across time zones', () => {
		const schema = DateOnlySchema({
			timeZone: 'America/Sao_Paulo',
		})

		expect(schema.parse('2026-01-01')).toBe('2026-01-01')
		expect(
			new Date('2026-01-01').toLocaleDateString('en-CA', {
				timeZone: 'America/Sao_Paulo',
			}),
		).toBe('2025-12-31')
	})

	it.each([
		'2026-02-30',
		'2025-02-29',
		'31/04/2026',
		'2026-13-01',
		'nope',
	])('should reject %j', (value) => {
		expect(codeOf(DateOnlySchema().safeParse(value))).toBe('invalidDate')
	})

	it('should accept a leap day', () => {
		expect(DateOnlySchema().parse('2024-02-29')).toBe('2024-02-29')
	})

	it('should apply the relative bounds against an injected clock', () => {
		const now = clock('2026-08-18T12:00:00Z')

		expect(
			codeOf(
				DateOnlySchema({
					notFuture: true,
					now,
				}).safeParse('2026-08-19'),
			),
		).toBe('dateInFuture')
		expect(
			codeOf(
				DateOnlySchema({
					notPast: true,
					now,
				}).safeParse('2026-08-17'),
			),
		).toBe('dateInPast')
	})

	it('should apply the absolute bounds', () => {
		expect(
			codeOf(
				DateOnlySchema({
					min: '2026-01-01',
				}).safeParse('2025-12-31'),
			),
		).toBe('outOfRange')
		expect(
			codeOf(
				DateOnlySchema({
					max: '2026-01-01',
				}).safeParse('2026-01-02'),
			),
		).toBe('outOfRange')
	})

	it('should report a blank date as required', () => {
		expect(codeOf(DateOnlySchema().safeParse('   '))).toBe('required')
	})
})

describe('BirthDateSchema', () => {
	const now = clock('2026-08-18T12:00:00Z')

	it('should count full years, not calendar years', () => {
		const schema = BirthDateSchema({
			minAge: 18,
			now,
		})

		expect(codeOf(schema.safeParse('2008-08-19'))).toBe('ageTooLow')
		expect(codeOf(schema.safeParse('2008-08-18'))).toBe('success')
	})

	it('should reject an implausible age', () => {
		expect(
			codeOf(
				BirthDateSchema({
					maxAge: 130,
					now,
				}).safeParse('1800-01-01'),
			),
		).toBe('ageTooHigh')
	})

	it('should reject a birth date in the future', () => {
		expect(
			codeOf(
				BirthDateSchema({
					now,
				}).safeParse('2030-01-01'),
			),
		).toBe('dateInFuture')
	})
})

describe('DateTimeSchema', () => {
	it('should require an explicit offset', () => {
		expect(codeOf(DateTimeSchema().safeParse('2026-01-01T10:00:00'))).toBe(
			'missingTimezone',
		)
	})

	it.each([
		'2026-01-01T10:00:00Z',
		'2026-01-01T10:00:00-03:00',
	])('should accept %j', (value) => {
		expect(DateTimeSchema().parse(value)).toBeInstanceOf(Date)
	})

	it('should accept a naive value when the offset is optional', () => {
		expect(
			DateTimeSchema({
				requireOffset: false,
			}).parse('2026-01-01T10:00:00'),
		).toBeInstanceOf(Date)
	})

	it('should reject an unparseable instant', () => {
		expect(codeOf(DateTimeSchema().safeParse('2026-99-99T10:00:00Z'))).toBe(
			'invalidDate',
		)
	})

	it('should apply the relative bounds', () => {
		const now = clock('2026-08-18T12:00:00Z')

		expect(
			codeOf(
				DateTimeSchema({
					notFuture: true,
					now,
				}).safeParse('2026-08-18T13:00:00Z'),
			),
		).toBe('dateInFuture')
		expect(
			codeOf(
				DateTimeSchema({
					notPast: true,
					now,
				}).safeParse('2026-08-18T11:00:00Z'),
			),
		).toBe('dateInPast')
	})

	it('should report a missing instant as required', () => {
		expect(codeOf(DateTimeSchema().safeParse(null))).toBe('required')
	})
})

describe('TimeSchema', () => {
	it('should normalize a valid time', () => {
		expect(TimeSchema().parse(' 09:30 ')).toBe('09:30')
	})

	it.each([
		'25:00',
		'10:60',
		'9:3',
		'nope',
	])('should reject %j', (value) => {
		expect(codeOf(TimeSchema().safeParse(value))).toBe('invalidTime')
	})

	it('should require seconds when asked', () => {
		expect(
			codeOf(
				TimeSchema({
					seconds: true,
				}).safeParse('09:30'),
			),
		).toBe('invalidTime')
		expect(
			TimeSchema({
				seconds: true,
			}).parse('09:30:15'),
		).toBe('09:30:15')
	})
})
