import { describe, expect, it } from 'vitest'

import { check, issue, issueCode } from './issue.js'

describe('issue', () => {
	it('should build a custom issue carrying the code', () => {
		expect(
			issue('required', '  ', {
				min: 1,
			}),
		).toEqual({
			code: 'custom',
			input: '  ',
			message: '',
			params: {
				code: 'required',
				min: 1,
			},
		})
	})
})

describe('check', () => {
	it('should build refinement params carrying the code', () => {
		expect(
			check('tooLong', {
				max: 5,
			}),
		).toEqual({
			error: '',
			params: {
				code: 'tooLong',
				max: 5,
			},
		})
	})
})

describe('issueCode', () => {
	it('should prefer the code written by this package', () => {
		expect(
			issueCode({
				code: 'custom',
				params: {
					code: 'invalidCpf',
				},
			}),
		).toBe('invalidCpf')
	})

	it.each([
		[
			{
				code: 'invalid_type',
				input: undefined,
			},
			'required',
		],
		[
			{
				code: 'invalid_type',
				input: null,
			},
			'required',
		],
		[
			{
				code: 'invalid_type',
				input: 42,
			},
			'invalidValue',
		],
		[
			{
				code: 'too_big',
				origin: 'string',
			},
			'tooLong',
		],
		[
			{
				code: 'too_small',
				origin: 'string',
			},
			'tooShort',
		],
		[
			{
				code: 'too_big',
				origin: 'number',
			},
			'outOfRange',
		],
		[
			{
				code: 'not_multiple_of',
			},
			'notAMultipleOf',
		],
		[
			{
				code: 'unrecognized_keys',
			},
			'invalidValue',
		],
		[
			{},
			'invalidValue',
		],
		[
			{
				params: 'nonsense',
			},
			'invalidValue',
		],
	] as const)('should map %j to %s', (candidate, expected) => {
		expect(issueCode(candidate)).toBe(expected)
	})
})
