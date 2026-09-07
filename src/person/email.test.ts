import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { EmailSchema } from './email.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('EmailSchema', () => {
	it('should fold case and trim', () => {
		expect(EmailSchema().parse('  Ana@Example.COM ')).toBe('ana@example.com')
	})

	it.each([
		'ana..maria@example.com',
		'.ana@example.com',
		'ana.@example.com',
		'ana@example',
		'ana@.com',
		'ana@example..com',
		'@example.com',
		'ana@',
		'ana example@x.com',
	])('should reject %j', (value) => {
		expect(codeOf(EmailSchema().safeParse(value))).toBe('invalidEmail')
	})

	it('should enforce the RFC length caps', () => {
		const local = 'a'.repeat(65)

		expect(codeOf(EmailSchema().safeParse(`${local}@example.com`))).toBe(
			'invalidEmail',
		)
		expect(
			codeOf(EmailSchema().safeParse(`${'a'.repeat(250)}@example.com`)),
		).toBe('tooLong')
	})

	it('should block sub-addressing when asked', () => {
		expect(
			codeOf(
				EmailSchema({
					blockAlias: true,
				}).safeParse('ana+promo@x.com'),
			),
		).toBe('emailAliasNotAllowed')
		expect(codeOf(EmailSchema().safeParse('ana+promo@x.com'))).toBe('success')
	})

	it('should block throwaway providers when asked', () => {
		expect(
			codeOf(
				EmailSchema({
					blockDisposable: true,
				}).safeParse('ana@mailinator.com'),
			),
		).toBe('disposableEmail')
	})

	it('should restrict to an allowlist when given one', () => {
		const schema = EmailSchema({
			allowedDomains: [
				'turystack.com',
			],
		})

		expect(codeOf(schema.safeParse('ana@gmail.com'))).toBe('domainNotAllowed')
		expect(codeOf(schema.safeParse('ana@turystack.com'))).toBe('success')
	})

	it('should report a blank address as required', () => {
		expect(codeOf(EmailSchema().safeParse('   '))).toBe('required')
	})

	it('should keep case when folding is disabled', () => {
		expect(
			EmailSchema({
				lowercase: false,
			}).parse('Ana@Example.com'),
		).toBe('Ana@Example.com')
	})
})
