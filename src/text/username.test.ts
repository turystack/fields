import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { UsernameSchema } from './username.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('UsernameSchema', () => {
	it('should fold case so a handle cannot be taken twice', () => {
		expect(UsernameSchema().parse(' Ana.Maria ')).toBe('ana.maria')
	})

	it.each([
		'ana__maria',
		'_ana',
		'ana_',
		'1ana',
		'ana maria',
		'ana..maria',
	])('should reject %j', (value) => {
		expect(codeOf(UsernameSchema().safeParse(value))).toBe('invalidUsername')
	})

	it('should reject a reserved handle', () => {
		expect(codeOf(UsernameSchema().safeParse('Admin'))).toBe('reservedValue')
	})

	it('should apply the length bounds', () => {
		expect(codeOf(UsernameSchema().safeParse('ab'))).toBe('tooShort')
		expect(
			codeOf(
				UsernameSchema({
					max: 4,
				}).safeParse('abcde'),
			),
		).toBe('tooLong')
	})

	it('should report a blank handle as required', () => {
		expect(codeOf(UsernameSchema().safeParse('   '))).toBe('required')
	})

	it('should reject look-alike characters when asked', () => {
		expect(
			codeOf(
				UsernameSchema({
					strictConfusables: true,
				}).safeParse('an0nima'),
			),
		).toBe('confusableCharacters')
	})

	it('should keep case when folding is disabled', () => {
		expect(
			UsernameSchema({
				lowercase: false,
			}).parse('Ana'),
		).toBe('Ana')
	})
})
