import { describe, expect, it } from 'vitest'
import type z from 'zod'

import {
	BooleanInputSchema,
	CheckboxSchema,
	MustAcceptSchema,
	TriStateSchema,
} from './boolean.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('BooleanInputSchema', () => {
	it.each([
		[
			'on',
			true,
		],
		[
			'true',
			true,
		],
		[
			'1',
			true,
		],
		[
			'Sim',
			true,
		],
		[
			1,
			true,
		],
		[
			true,
			true,
		],
		[
			'off',
			false,
		],
		[
			'false',
			false,
		],
		[
			'0',
			false,
		],
		[
			'Não',
			false,
		],
		[
			0,
			false,
		],
		[
			false,
			false,
		],
	] as const)('should read %j as %j', (input, expected) => {
		expect(BooleanInputSchema().parse(input)).toBe(expected)
	})

	it('should reject an unknown spelling instead of coercing it', () => {
		expect(Boolean('false')).toBe(true)
		expect(codeOf(BooleanInputSchema().safeParse('yep'))).toBe('invalidValue')
	})

	it('should report a missing value as required', () => {
		expect(codeOf(BooleanInputSchema().safeParse(undefined))).toBe('required')
	})
})

describe('CheckboxSchema', () => {
	it.each([
		undefined,
		null,
		'',
	])('should read the unsubmitted value %j as false', (value) => {
		expect(CheckboxSchema().parse(value)).toBe(false)
	})

	it('should read a checked box as true', () => {
		expect(CheckboxSchema().parse('on')).toBe(true)
	})

	it('should reject an unknown spelling', () => {
		expect(codeOf(CheckboxSchema().safeParse('yep'))).toBe('invalidValue')
	})
})

describe('MustAcceptSchema', () => {
	it('should accept only an affirmative value', () => {
		expect(MustAcceptSchema().parse('on')).toBe(true)
	})

	it.each([
		false,
		'off',
		undefined,
	])('should report %j as mustAccept', (value) => {
		expect(codeOf(MustAcceptSchema().safeParse(value))).toBe('mustAccept')
	})
})

describe('TriStateSchema', () => {
	it('should keep unanswered apart from no', () => {
		expect(TriStateSchema().parse('')).toBeNull()
		expect(TriStateSchema().parse('nao')).toBe(false)
		expect(TriStateSchema().parse('sim')).toBe(true)
	})

	it('should reject an unknown spelling', () => {
		expect(codeOf(TriStateSchema().safeParse('talvez'))).toBe('invalidValue')
	})
})
