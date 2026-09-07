import { describe, expect, it } from 'vitest'
import type z from 'zod'

import {
	IntSchema,
	NumberSchema,
	PercentageSchema,
	QuantitySchema,
} from './number.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('NumberSchema', () => {
	it('should read masked input', () => {
		expect(NumberSchema().parse('1.234,56')).toBe(1234.56)
	})

	it.each([
		'',
		'   ',
		null,
		undefined,
	])('should report %j as required instead of coercing it to zero', (value) => {
		expect(codeOf(NumberSchema().safeParse(value))).toBe('required')
	})

	it.each([
		'abc',
		'1e5',
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])('should reject %j', (value) => {
		expect(codeOf(NumberSchema().safeParse(value))).toBe('notANumber')
	})

	it('should cap the decimal places', () => {
		expect(
			codeOf(
				NumberSchema({
					maxDecimals: 2,
				}).safeParse('1,239'),
			),
		).toBe('tooManyDecimals')
	})

	it('should apply the range', () => {
		expect(
			codeOf(
				NumberSchema({
					min: 10,
				}).safeParse('9'),
			),
		).toBe('outOfRange')
		expect(
			codeOf(
				NumberSchema({
					max: 10,
				}).safeParse('11'),
			),
		).toBe('outOfRange')
	})
})

describe('IntSchema', () => {
	it('should reject a fraction instead of truncating it', () => {
		expect(codeOf(IntSchema().safeParse('4.2'))).toBe('notAnInteger')
	})

	it('should reject a value past the safe integer range', () => {
		expect(codeOf(IntSchema().safeParse('9007199254740993'))).toBe(
			'unsafeInteger',
		)
	})

	it('should accept a trailing zero fraction', () => {
		expect(IntSchema().parse('42,0')).toBe(42)
	})

	it('should apply the range', () => {
		expect(
			codeOf(
				IntSchema({
					min: 1,
				}).safeParse('0'),
			),
		).toBe('outOfRange')
	})
})

describe('QuantitySchema', () => {
	it('should enforce the step from the minimum', () => {
		const schema = QuantitySchema({
			min: 6,
			step: 6,
		})

		expect(schema.parse('12')).toBe(12)
		expect(codeOf(schema.safeParse('8'))).toBe('notAMultipleOf')
	})

	it('should default to a minimum of one', () => {
		expect(codeOf(QuantitySchema().safeParse('0'))).toBe('outOfRange')
	})

	it('should reject a fraction', () => {
		expect(codeOf(QuantitySchema().safeParse('1,5'))).toBe('notAnInteger')
	})
})

describe('PercentageSchema', () => {
	it('should accept a percent sign', () => {
		expect(PercentageSchema().parse('45%')).toBe(45)
	})

	it('should keep the two scales apart', () => {
		expect(
			codeOf(
				PercentageSchema({
					of: 1,
				}).safeParse(45),
			),
		).toBe('outOfRange')
		expect(
			PercentageSchema({
				of: 1,
			}).parse('0,45'),
		).toBe(0.45)
	})

	it('should cap the decimal places', () => {
		expect(codeOf(PercentageSchema().safeParse('1,239'))).toBe(
			'tooManyDecimals',
		)
	})
})
