import { describe, expect, it } from 'vitest'
import z from 'zod'

import { formatAllErrors, formatErrors } from './format.js'

import { RequiredStringSchema } from '@/text/text.js'

const Schema = z.object({
	profile: z.object({
		name: RequiredStringSchema({
			min: 3,
		}),
	}),
	tags: z.array(RequiredStringSchema()),
})

const errorOf = (input: unknown): z.ZodError => {
	const result = Schema.safeParse(input)

	if (result.success) {
		throw new Error('expected the parse to fail')
	}

	return result.error
}

describe('formatErrors', () => {
	it('should key failures by dotted path', () => {
		const errors = formatErrors(
			errorOf({
				profile: {
					name: '   ',
				},
				tags: [
					'ok',
					' ',
				],
			}),
		)

		expect(errors['profile.name']?.code).toBe('required')
		expect(errors['tags.1']?.code).toBe('required')
	})

	it('should default the message to the code', () => {
		const errors = formatErrors(
			errorOf({
				profile: {
					name: 'ab',
				},
				tags: [],
			}),
		)

		expect(errors['profile.name']).toEqual({
			code: 'tooShort',
			message: 'tooShort',
			params: {
				min: 3,
			},
			path: 'profile.name',
		})
	})

	it('should resolve the message when a resolver is given', () => {
		const messages: Record<string, string> = {
			tooShort: 'Muito curto',
		}
		const errors = formatErrors(
			errorOf({
				profile: {
					name: 'ab',
				},
				tags: [],
			}),
			(error) => messages[error.code] ?? error.code,
		)

		expect(errors['profile.name']?.message).toBe('Muito curto')
	})

	it('should translate a missing field into required', () => {
		const errors = formatErrors(
			errorOf({
				tags: [],
			}),
		)

		expect(errors.profile?.code).toBe('required')
	})

	it('should keep the first failure of a field', () => {
		const errors = formatErrors(
			errorOf({
				profile: {
					name: '',
				},
				tags: [],
			}),
		)

		expect(errors['profile.name']?.code).toBe('required')
	})
})

describe('formatAllErrors', () => {
	it('should keep every failure of a field', () => {
		const Password = z.object({
			password: z
				.string()
				.refine(() => false, {
					error: '',
					params: {
						code: 'tooShort',
					},
				})
				.refine(() => false, {
					error: '',
					params: {
						code: 'passwordTooWeak',
					},
				}),
		})
		const result = Password.safeParse({
			password: 'x',
		})

		if (result.success) {
			throw new Error('expected the parse to fail')
		}

		expect(
			formatAllErrors(result.error).password?.map((entry) => entry.code),
		).toEqual([
			'tooShort',
			'passwordTooWeak',
		])
	})

	it('should resolve messages as well', () => {
		const result = Schema.safeParse({
			profile: {
				name: '',
			},
			tags: [],
		})

		if (result.success) {
			throw new Error('expected the parse to fail')
		}

		expect(
			formatAllErrors(result.error, () => 'traduzido')['profile.name']?.[0]
				?.message,
		).toBe('traduzido')
	})
})
