import { describe, expect, it } from 'vitest'
import z from 'zod'

import {
	NonEmptyObjectSchema,
	RequiredArraySchema,
	UniqueArraySchema,
} from './collection.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('RequiredArraySchema', () => {
	it('should drop blank entries before measuring', () => {
		expect(
			RequiredArraySchema(z.string()).parse([
				'a',
				'  ',
				'',
			]),
		).toEqual([
			'a',
		])
	})

	it('should report an empty list as emptyList', () => {
		expect(codeOf(RequiredArraySchema(z.string()).safeParse([]))).toBe(
			'emptyList',
		)
		expect(
			codeOf(
				RequiredArraySchema(z.string()).safeParse([
					'',
					' ',
				]),
			),
		).toBe('emptyList')
	})

	it('should apply the length bounds', () => {
		expect(
			codeOf(
				RequiredArraySchema(z.string(), {
					min: 2,
				}).safeParse([
					'a',
				]),
			),
		).toBe('tooShort')
		expect(
			codeOf(
				RequiredArraySchema(z.string(), {
					max: 1,
				}).safeParse([
					'a',
					'b',
				]),
			),
		).toBe('tooLong')
	})
})

describe('UniqueArraySchema', () => {
	it('should report the duplicate at its own index', () => {
		const result = UniqueArraySchema(z.string()).safeParse([
			'a',
			'b',
			'a',
		])

		expect(result.success).toBe(false)
		expect(result.error?.issues[0]).toMatchObject({
			params: {
				code: 'duplicateItem',
				first: 0,
			},
			path: [
				2,
			],
		})
	})

	it('should compare by a key when given one', () => {
		const schema = UniqueArraySchema(
			z.object({
				email: z.string(),
			}),
			(guest) => guest.email,
		)

		expect(
			codeOf(
				schema.safeParse([
					{
						email: 'a',
					},
					{
						email: 'a',
					},
				]),
			),
		).toBe('duplicateItem')
		expect(
			codeOf(
				schema.safeParse([
					{
						email: 'a',
					},
					{
						email: 'b',
					},
				]),
			),
		).toBe('success')
	})
})

describe('NonEmptyObjectSchema', () => {
	const Patch = NonEmptyObjectSchema(
		z.object({
			name: z.string().optional(),
			nickname: z.string().optional(),
		}),
	)

	it('should reject a patch with nothing to set', () => {
		expect(codeOf(Patch.safeParse({}))).toBe('emptyObject')
		expect(
			codeOf(
				Patch.safeParse({
					name: undefined,
				}),
			),
		).toBe('emptyObject')
	})

	it('should accept a patch carrying a field', () => {
		expect(
			codeOf(
				Patch.safeParse({
					name: 'Ana',
				}),
			),
		).toBe('success')
	})
})
