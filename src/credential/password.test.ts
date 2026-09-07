import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { PasswordSchema } from './password.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('PasswordSchema', () => {
	it('should accept a long passphrase', () => {
		expect(codeOf(PasswordSchema().safeParse('bateria-cavalo-grampo'))).toBe(
			'success',
		)
	})

	it('should reject whitespace at the edges instead of trimming it', () => {
		expect(codeOf(PasswordSchema().safeParse(' bateria-cavalo '))).toBe(
			'passwordHasWhitespace',
		)
	})

	it('should reject a password past the bcrypt byte limit', () => {
		expect(codeOf(PasswordSchema().safeParse('a1B!'.repeat(20)))).toBe(
			'passwordTooLong',
		)
	})

	it('should count bytes, not characters, against that limit', () => {
		expect(codeOf(PasswordSchema().safeParse(`${'á'.repeat(36)}X1!`))).toBe(
			'passwordTooLong',
		)
	})

	it.each([
		'senha123456',
		'password1234',
	])('should reject the common password %j', (value) => {
		expect(
			codeOf(
				PasswordSchema({
					minEntropy: 0,
				}).safeParse(value),
			),
		).toBe('passwordSequential')
	})

	it.each([
		'abcdefghijkl',
		'qwertyuiop12',
		'aaaabbbbcccc',
	])('should reject the walk or repetition in %j', (value) => {
		expect(codeOf(PasswordSchema().safeParse(value))).toBe('passwordSequential')
	})

	it('should reject a password built from the user own data', () => {
		expect(
			codeOf(
				PasswordSchema({
					context: [
						'ana.souza@example.com',
					],
				}).safeParse('AnaSouza!2x'),
			),
		).toBe('passwordContainsContext')
	})

	it('should reject a short password before anything else', () => {
		expect(codeOf(PasswordSchema().safeParse('aB3!x'))).toBe('tooShort')
	})

	it('should reject a low-entropy password', () => {
		expect(codeOf(PasswordSchema().safeParse('xyxyxyxyxyxy'))).toBe(
			'passwordTooWeak',
		)
	})

	it('should defer to an injected scorer', () => {
		const schema = PasswordSchema({
			strength: () => 1,
		})

		expect(codeOf(schema.safeParse('bateria-cavalo-grampo'))).toBe(
			'passwordTooWeak',
		)
	})

	it('should report a blank password as required', () => {
		expect(codeOf(PasswordSchema().safeParse(''))).toBe('required')
	})

	it('should normalize before hashing', () => {
		expect(PasswordSchema().parse('bateriá-cavalo')).toBe('bateriá-cavalo')
	})
})
