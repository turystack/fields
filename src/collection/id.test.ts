import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { IdSchema } from './id.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

const UUID = '018f6d3c-9f7a-7c3a-8f1e-2b6d5a4c3b2a'

describe('IdSchema', () => {
	it('should trim a valid uuid', () => {
		expect(IdSchema().parse(`  ${UUID} `)).toBe(UUID)
	})

	it.each([
		'018f6d3c-9f7a-0c3a-8f1e-2b6d5a4c3b2a',
		'018f6d3c-9f7a-7c3a-ff1e-2b6d5a4c3b2a',
		'not-a-uuid',
	])('should reject %j', (value) => {
		expect(codeOf(IdSchema().safeParse(value))).toBe('invalidId')
	})

	it('should accept a ulid when listed', () => {
		const schema = IdSchema({
			formats: [
				'ulid',
			],
		})

		expect(schema.parse('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(
			'01ARZ3NDEKTSV4RRFFQ69G5FAV',
		)
		expect(codeOf(schema.safeParse('81ARZ3NDEKTSV4RRFFQ69G5FAV'))).toBe(
			'invalidId',
		)
	})

	it('should reject a numeric id that is zero or unsafe', () => {
		const schema = IdSchema({
			formats: [
				'numeric',
			],
		})

		expect(schema.parse('42')).toBe('42')
		expect(codeOf(schema.safeParse('0'))).toBe('invalidId')
		expect(codeOf(schema.safeParse('9007199254740993'))).toBe('invalidId')
	})

	it('should report a blank id as required', () => {
		expect(codeOf(IdSchema().safeParse('  '))).toBe('required')
	})
})
