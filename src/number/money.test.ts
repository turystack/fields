import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { DecimalSchema, MoneySchema } from './money.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('MoneySchema', () => {
	it('should return minor units from a masked amount', () => {
		expect(MoneySchema().parse('R$ 1.234,56')).toBe(123456)
	})

	it('should not round through a float', () => {
		expect(Math.round(1.005 * 100)).toBe(100)
		expect(
			MoneySchema({
				scale: 3,
			}).parse('1,005'),
		).toBe(1005)
		expect(MoneySchema().parse('8,16')).toBe(816)
	})

	it('should reject more decimals than the scale allows', () => {
		expect(
			codeOf(
				MoneySchema({
					scale: 2,
				}).safeParse('10,999'),
			),
		).toBe('tooManyDecimals')
	})

	it('should apply the range in minor units', () => {
		expect(
			codeOf(
				MoneySchema({
					minCents: 100,
				}).safeParse('0,50'),
			),
		).toBe('outOfRange')
		expect(
			codeOf(
				MoneySchema({
					maxCents: 100,
				}).safeParse('2,00'),
			),
		).toBe('outOfRange')
	})

	it('should reject a negative amount by default', () => {
		expect(codeOf(MoneySchema().safeParse('-1,00'))).toBe('outOfRange')
	})

	it('should report a blank amount as required', () => {
		expect(codeOf(MoneySchema().safeParse(''))).toBe('required')
	})
})

describe('DecimalSchema', () => {
	it('should return a normalized string padded to the scale', () => {
		expect(
			DecimalSchema({
				precision: 6,
				scale: 2,
			}).parse('1.234,5'),
		).toBe('1234.50')
	})

	it('should reject a value that would not fit the column', () => {
		expect(
			codeOf(
				DecimalSchema({
					precision: 4,
					scale: 2,
				}).safeParse('12345'),
			),
		).toBe('precisionExceeded')
	})

	it('should reject more decimals than the scale allows', () => {
		expect(
			codeOf(
				DecimalSchema({
					precision: 10,
					scale: 2,
				}).safeParse('1,239'),
			),
		).toBe('tooManyDecimals')
	})
})
