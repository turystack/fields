import { describe, expect, it } from 'vitest'
import type z from 'zod'

import {
	MultilineSchema,
	NullableStringSchema,
	OptionalStringSchema,
	RequiredStringSchema,
	SingleLineSchema,
} from './text.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('RequiredStringSchema', () => {
	it('should sanitize before validating', () => {
		expect(RequiredStringSchema().parse('  Ana   Maria ')).toBe('Ana Maria')
	})

	it.each([
		'',
		'   ',
		'\t\n',
		'\u200B\u200B',
		'\uFEFF',
	])('should report %j as required, not as tooShort', (value) => {
		expect(codeOf(RequiredStringSchema().safeParse(value))).toBe('required')
	})

	it('should measure length after sanitizing', () => {
		expect(
			codeOf(
				RequiredStringSchema({
					max: 3,
				}).safeParse('  abc  '),
			),
		).toBe('success')
	})

	it('should count emoji as one character', () => {
		expect(
			codeOf(
				RequiredStringSchema({
					max: 2,
				}).safeParse('a👍'),
			),
		).toBe('success')
	})

	it('should report tooShort and tooLong with their bounds', () => {
		expect(
			codeOf(
				RequiredStringSchema({
					min: 3,
				}).safeParse('ab'),
			),
		).toBe('tooShort')
		expect(
			codeOf(
				RequiredStringSchema({
					max: 2,
				}).safeParse('abc'),
			),
		).toBe('tooLong')
	})

	it('should default to a 255 character ceiling', () => {
		expect(codeOf(RequiredStringSchema().safeParse('a'.repeat(256)))).toBe(
			'tooLong',
		)
	})

	it('should report a missing value as required', () => {
		expect(codeOf(RequiredStringSchema().safeParse(undefined))).toBe('required')
	})
})

describe('OptionalStringSchema', () => {
	it.each([
		'',
		'   ',
		'\u200B',
		null,
		undefined,
	])('should turn %j into undefined', (value) => {
		expect(OptionalStringSchema().parse(value)).toBeUndefined()
	})

	it('should still sanitize a filled value', () => {
		expect(OptionalStringSchema().parse(' Ana  Maria ')).toBe('Ana Maria')
	})
})

describe('NullableStringSchema', () => {
	it.each([
		'',
		'   ',
		undefined,
	])('should turn %j into null', (value) => {
		expect(NullableStringSchema().parse(value)).toBeNull()
	})

	it('should still sanitize a filled value', () => {
		expect(NullableStringSchema().parse(' Ana ')).toBe('Ana')
	})
})

describe('SingleLineSchema', () => {
	it('should reject a line break instead of folding it', () => {
		expect(codeOf(SingleLineSchema().safeParse('Ana\nMaria'))).toBe(
			'lineBreakNotAllowed',
		)
	})

	it('should accept and sanitize a single line', () => {
		expect(SingleLineSchema().parse('  Ana   Maria ')).toBe('Ana Maria')
	})

	it.each([
		[
			'   ',
			'required',
		],
		[
			'ab',
			'tooShort',
		],
	] as const)('should report %j as %s', (value, expected) => {
		expect(
			codeOf(
				SingleLineSchema({
					min: 3,
				}).safeParse(value),
			),
		).toBe(expected)
	})

	it('should apply the max bound', () => {
		expect(
			codeOf(
				SingleLineSchema({
					max: 2,
				}).safeParse('abc'),
			),
		).toBe('tooLong')
	})
})

describe('MultilineSchema', () => {
	it('should normalize breaks and collapse blank runs', () => {
		expect(MultilineSchema().parse('a  \r\n\r\n\r\n  b')).toBe('a\n\nb')
	})

	it('should cap the number of lines', () => {
		expect(
			codeOf(
				MultilineSchema({
					maxLines: 2,
				}).safeParse('a\nb\nc'),
			),
		).toBe('tooManyLines')
	})

	it('should cap the length of a single line', () => {
		expect(
			codeOf(
				MultilineSchema({
					maxLineLength: 2,
				}).safeParse('ab\nabc'),
			),
		).toBe('tooLong')
	})

	it.each([
		[
			'   ',
			'required',
		],
		[
			'ab',
			'tooShort',
		],
	] as const)('should report %j as %s', (value, expected) => {
		expect(
			codeOf(
				MultilineSchema({
					min: 3,
				}).safeParse(value),
			),
		).toBe(expected)
	})

	it('should apply the max bound', () => {
		expect(
			codeOf(
				MultilineSchema({
					max: 2,
				}).safeParse('abc'),
			),
		).toBe('tooLong')
	})
})
