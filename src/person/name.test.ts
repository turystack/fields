import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { PersonNameSchema } from './name.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('PersonNameSchema', () => {
	it('should collapse spacing', () => {
		expect(PersonNameSchema().parse('  Ana   Maria ')).toBe('Ana Maria')
	})

	it.each([
		'Ana 123',
		'Ana!',
		'Ana@Maria',
		'123',
	])('should reject %j', (value) => {
		expect(codeOf(PersonNameSchema().safeParse(value))).toBe(
			'invalidPersonName',
		)
	})

	it.each([
		'Ana Maria',
		'José da Silva',
		"O'Brien",
		'Jean-Pierre',
	])('should accept %j', (value) => {
		expect(codeOf(PersonNameSchema().safeParse(value))).toBe('success')
	})

	it('should require two words when asked', () => {
		expect(
			codeOf(
				PersonNameSchema({
					requireFullName: true,
				}).safeParse('Ana'),
			),
		).toBe('fullNameRequired')
	})

	it('should title-case without uppercasing particles', () => {
		expect(
			PersonNameSchema({
				capitalize: true,
			}).parse('ANA DE SOUZA'),
		).toBe('Ana de Souza')
		expect(
			PersonNameSchema({
				capitalize: true,
			}).parse("o'brien-silva"),
		).toBe("O'Brien-Silva")
	})

	it('should apply the length bounds', () => {
		expect(codeOf(PersonNameSchema().safeParse('A'))).toBe('tooShort')
		expect(
			codeOf(
				PersonNameSchema({
					max: 3,
				}).safeParse('Anaa'),
			),
		).toBe('tooLong')
	})

	it('should report a blank name as required', () => {
		expect(codeOf(PersonNameSchema().safeParse('   '))).toBe('required')
	})
})
