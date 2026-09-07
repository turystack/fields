import { describe, expect, it } from 'vitest'

import {
	parseDecimal,
	toFixedString,
	toNumber,
	toScaledInteger,
} from './parse.js'

describe('parseDecimal', () => {
	it.each([
		[
			'R$ 1.234,56',
			'auto',
			{
				fraction: '56',
				integer: '1234',
				sign: '',
			},
		],
		[
			'1.234,56',
			'auto',
			{
				fraction: '56',
				integer: '1234',
				sign: '',
			},
		],
		[
			'1,234.56',
			'auto',
			{
				fraction: '56',
				integer: '1234',
				sign: '',
			},
		],
		[
			'1.234',
			'comma',
			{
				fraction: '',
				integer: '1234',
				sign: '',
			},
		],
		[
			'1.234',
			'auto',
			{
				fraction: '234',
				integer: '1',
				sign: '',
			},
		],
		[
			'-45,5',
			'auto',
			{
				fraction: '5',
				integer: '45',
				sign: '-',
			},
		],
		[
			'0,50',
			'auto',
			{
				fraction: '50',
				integer: '0',
				sign: '',
			},
		],
		[
			',5',
			'auto',
			{
				fraction: '5',
				integer: '0',
				sign: '',
			},
		],
		[
			1234.56,
			'auto',
			{
				fraction: '56',
				integer: '1234',
				sign: '',
			},
		],
	] as const)(
		'should parse %j with separator %s',
		(input, separator, expected) => {
			expect(parseDecimal(input, separator)).toEqual(expected)
		},
	)

	it.each([
		[
			'1e5',
			'auto',
		],
		[
			'abc',
			'auto',
		],
		[
			'',
			'auto',
		],
		[
			'1.2.3',
			'auto',
		],
		[
			'1,23,456',
			'dot',
		],
		[
			'12.34.56',
			'comma',
		],
		[
			Number.NaN,
			'auto',
		],
		[
			Number.POSITIVE_INFINITY,
			'auto',
		],
		[
			1e21,
			'auto',
		],
		[
			null,
			'auto',
		],
		[
			{},
			'auto',
		],
	] as const)('should reject %j with separator %s', (input, separator) => {
		expect(parseDecimal(input, separator)).toBeUndefined()
	})

	it('should not report negative zero', () => {
		expect(parseDecimal('-0,00', 'auto')).toEqual({
			fraction: '00',
			integer: '0',
			sign: '',
		})
	})
})

describe('toScaledInteger', () => {
	it('should scale without float rounding', () => {
		expect(toScaledInteger(parseDecimal('1234.565', 'dot')!, 3)).toBe(1234565)
		expect(toScaledInteger(parseDecimal('8.165', 'dot')!, 2)).toBe(8165)
		expect(toScaledInteger(parseDecimal('5', 'dot')!, 2)).toBe(500)
	})

	it('should beat the float shortcut it replaces', () => {
		expect(Math.round(1.005 * 100)).toBe(100)
		expect(toScaledInteger(parseDecimal('1.005', 'dot')!, 2)).toBe(1005)
	})
})

describe('toNumber', () => {
	it('should rebuild the decimal value', () => {
		expect(toNumber(parseDecimal('1.234,56', 'auto')!)).toBe(1234.56)
		expect(toNumber(parseDecimal('-45', 'auto')!)).toBe(-45)
	})
})

describe('toFixedString', () => {
	it('should pad the fraction to the requested scale', () => {
		expect(toFixedString(parseDecimal('5,5', 'auto')!, 2)).toBe('5.50')
		expect(toFixedString(parseDecimal('5,5', 'auto')!, 0)).toBe('5')
	})
})
