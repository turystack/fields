import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { SlugSchema } from './slug.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('SlugSchema', () => {
	it.each([
		[
			'  Acao   Rapida! ',
			'acao-rapida',
		],
		[
			'Ação Rápida',
			'acao-rapida',
		],
		[
			'---a---b---',
			'a-b',
		],
		[
			'Já!!!',
			'ja',
		],
	])('should turn %j into %j', (input, expected) => {
		expect(SlugSchema().parse(input)).toBe(expected)
	})

	it('should reject a route-colliding name', () => {
		expect(codeOf(SlugSchema().safeParse('admin'))).toBe('reservedValue')
	})

	it('should honour a custom reserved list', () => {
		expect(
			codeOf(
				SlugSchema({
					reserved: [
						'ana',
					],
				}).safeParse('Ana'),
			),
		).toBe('reservedValue')
	})

	it('should report an empty result as required', () => {
		expect(codeOf(SlugSchema().safeParse('!!!'))).toBe('required')
	})

	it('should validate instead of converting in strict mode', () => {
		expect(
			codeOf(
				SlugSchema({
					strict: true,
				}).safeParse('Ola Mundo'),
			),
		).toBe('invalidSlug')
		expect(
			SlugSchema({
				strict: true,
			}).parse('ola-mundo'),
		).toBe('ola-mundo')
	})

	it('should apply the length bounds', () => {
		expect(
			codeOf(
				SlugSchema({
					min: 5,
				}).safeParse('ab'),
			),
		).toBe('tooShort')
		expect(
			codeOf(
				SlugSchema({
					max: 2,
				}).safeParse('abc'),
			),
		).toBe('tooLong')
	})
})
