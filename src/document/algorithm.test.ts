import { describe, expect, it } from 'vitest'

import {
	isValidCnpj,
	isValidCns,
	isValidCpf,
	isValidPis,
	isValidRenavam,
	isValidVoterId,
	phoneKindOf,
} from './algorithm.js'

describe('isValidCpf', () => {
	it.each([
		'52998224725',
		'11144477735',
	])('should accept %s', (value) => {
		expect(isValidCpf(value)).toBe(true)
	})

	it.each([
		'11111111111',
		'00000000000',
		'52998224724',
		'5299822472',
		'',
	])('should reject %s', (value) => {
		expect(isValidCpf(value)).toBe(false)
	})
})

describe('isValidCnpj', () => {
	it.each([
		'11222333000181',
		'12ABC34501DE35',
	])('should accept %s', (value) => {
		expect(isValidCnpj(value)).toBe(true)
	})

	it.each([
		'11222333000182',
		'11111111111111',
		'12ABC34501DE36',
	])('should reject %s', (value) => {
		expect(isValidCnpj(value)).toBe(false)
	})
})

describe('isValidPis', () => {
	it('should accept a published number', () => {
		expect(isValidPis('12063431150')).toBe(true)
	})

	it.each([
		'12063431151',
		'11111111111',
		'1206343115',
	])('should reject %s', (value) => {
		expect(isValidPis(value)).toBe(false)
	})
})

describe('isValidCns', () => {
	it('should accept both card families', () => {
		expect(isValidCns('898001160125009')).toBe(true)
		expect(isValidCns('120634311500004')).toBe(true)
	})

	it('should reject an unknown prefix', () => {
		expect(isValidCns('398001160125009')).toBe(false)
	})

	it('should reject a mutated digit', () => {
		expect(isValidCns('898001160125008')).toBe(false)
		expect(isValidCns('120634311500005')).toBe(false)
	})

	it('should use the 001 filler when the first check digit lands on ten', () => {
		expect(isValidCns('100000000060018')).toBe(true)
		expect(isValidCns('100000000060008')).toBe(false)
	})

	it('should reject anything that is not fifteen digits', () => {
		expect(isValidCns('89800116012500')).toBe(false)
		expect(isValidCns('abc001160125009')).toBe(false)
	})
})

describe('isValidVoterId', () => {
	it('should accept a valid number', () => {
		expect(isValidVoterId('102385010671')).toBe(true)
	})

	it('should follow the São Paulo rule when the remainder is zero', () => {
		expect(isValidVoterId('000000000116')).toBe(true)
		expect(isValidVoterId('000000000106')).toBe(false)
	})

	it.each([
		'102385990671',
		'102385000671',
		'10238501067',
	])('should reject %s', (value) => {
		expect(isValidVoterId(value)).toBe(false)
	})

	it('should reject a wrong second check digit', () => {
		expect(isValidVoterId('102385010672')).toBe(false)
	})
})

describe('isValidRenavam', () => {
	it('should accept a valid number', () => {
		expect(isValidRenavam('00123456789')).toBe(true)
	})

	it('should map a remainder of ten onto a zero check digit', () => {
		expect(isValidRenavam('00000000060')).toBe(true)
	})

	it.each([
		'00123456788',
		'1234',
		'abcdefghijk',
	])('should reject %s', (value) => {
		expect(isValidRenavam(value)).toBe(false)
	})
})

describe('phoneKindOf', () => {
	it.each([
		[
			'11987654321',
			'mobile',
		],
		[
			'1133334444',
			'landline',
		],
	] as const)('should classify %s as %s', (value, kind) => {
		expect(phoneKindOf(value)).toBe(kind)
	})

	it.each([
		'20987654321',
		'11887654321',
		'1163334444',
		'119876543',
		'119876543210',
		'abcdefghijk',
	])('should reject %s', (value) => {
		expect(phoneKindOf(value)).toBeUndefined()
	})
})
