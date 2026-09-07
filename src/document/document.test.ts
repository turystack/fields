import { describe, expect, it } from 'vitest'
import type z from 'zod'

import {
	CepSchema,
	CnpjSchema,
	CnsSchema,
	CpfOrCnpjSchema,
	CpfSchema,
	PhoneSchema,
	PisSchema,
	PlateSchema,
	RenavamSchema,
	VoterIdSchema,
} from './document.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('CpfSchema', () => {
	it('should accept the masked and the bare form alike', () => {
		expect(CpfSchema().parse('529.982.247-25')).toBe('52998224725')
		expect(CpfSchema().parse(' 52998224725 ')).toBe('52998224725')
	})

	it('should reject a repeated sequence that satisfies the checksum', () => {
		expect(codeOf(CpfSchema().safeParse('111.111.111-11'))).toBe('invalidCpf')
	})

	it('should return the masked form when asked', () => {
		expect(
			CpfSchema({
				format: 'masked',
			}).parse('52998224725'),
		).toBe('529.982.247-25')
	})

	it('should report a blank document as required', () => {
		expect(codeOf(CpfSchema().safeParse('  '))).toBe('required')
	})
})

describe('CnpjSchema', () => {
	it('should accept the numeric form', () => {
		expect(CnpjSchema().parse('11.222.333/0001-81')).toBe('11222333000181')
	})

	it('should accept the alphanumeric form issued from 2026', () => {
		expect(CnpjSchema().parse('12.ABC.345/01DE-35')).toBe('12ABC34501DE35')
		expect(CnpjSchema().parse('12abc34501de35')).toBe('12ABC34501DE35')
	})

	it('should reject a wrong check digit', () => {
		expect(codeOf(CnpjSchema().safeParse('11.222.333/0001-82'))).toBe(
			'invalidCnpj',
		)
	})

	it('should return the masked form when asked', () => {
		expect(
			CnpjSchema({
				format: 'masked',
			}).parse('11222333000181'),
		).toBe('11.222.333/0001-81')
	})
})

describe('CpfOrCnpjSchema', () => {
	it.each([
		[
			'529.982.247-25',
			'52998224725',
		],
		[
			'11.222.333/0001-81',
			'11222333000181',
		],
	])('should accept %j', (input, expected) => {
		expect(CpfOrCnpjSchema().parse(input)).toBe(expected)
	})

	it('should name the document that failed', () => {
		expect(codeOf(CpfOrCnpjSchema().safeParse('529.982.247-24'))).toBe(
			'invalidCpf',
		)
		expect(codeOf(CpfOrCnpjSchema().safeParse('11.222.333/0001-82'))).toBe(
			'invalidCnpj',
		)
	})

	it('should reject a length that is neither', () => {
		expect(codeOf(CpfOrCnpjSchema().safeParse('12345'))).toBe('invalidDocument')
	})
})

describe('CepSchema', () => {
	it('should accept the masked form', () => {
		expect(CepSchema().parse('01310-100')).toBe('01310100')
	})

	it('should reject an all-zero code', () => {
		expect(codeOf(CepSchema().safeParse('00000-000'))).toBe('invalidCep')
	})
})

describe('PhoneSchema', () => {
	it.each([
		'(11) 98765-4321',
		'+55 11 98765-4321',
		'11987654321',
	])('should read %j as E.164', (value) => {
		expect(PhoneSchema().parse(value)).toBe('+5511987654321')
	})

	it('should reject an area code ANATEL never assigned', () => {
		expect(codeOf(PhoneSchema().safeParse('(20) 98765-4321'))).toBe(
			'invalidPhone',
		)
	})

	it('should require the ninth digit on a mobile number', () => {
		expect(codeOf(PhoneSchema().safeParse('(11) 88765-4321'))).toBe(
			'invalidPhone',
		)
	})

	it('should filter by line kind', () => {
		expect(
			codeOf(
				PhoneSchema({
					kinds: [
						'mobile',
					],
				}).safeParse('1133334444'),
			),
		).toBe('invalidPhone')
		expect(
			PhoneSchema({
				format: 'digits',
			}).parse('1133334444'),
		).toBe('1133334444')
	})
})

describe('PisSchema', () => {
	it('should accept a valid number', () => {
		expect(PisSchema().parse('120.63431.15-0')).toBe('12063431150')
	})

	it('should reject a mutated check digit', () => {
		expect(codeOf(PisSchema().safeParse('12063431151'))).toBe('invalidPis')
	})
})

describe('CnsSchema', () => {
	it('should accept both card families', () => {
		expect(CnsSchema().parse('898 0011 6012 5009')).toBe('898001160125009')
		expect(CnsSchema().parse('120634311500004')).toBe('120634311500004')
	})

	it('should reject a mutated digit', () => {
		expect(codeOf(CnsSchema().safeParse('898001160125008'))).toBe('invalidCns')
	})
})

describe('VoterIdSchema', () => {
	it('should accept a valid number', () => {
		expect(VoterIdSchema().parse('1023 8501 0671')).toBe('102385010671')
	})

	it('should reject an unknown state code', () => {
		expect(codeOf(VoterIdSchema().safeParse('102385990671'))).toBe(
			'invalidVoterId',
		)
	})
})

describe('RenavamSchema', () => {
	it('should pad the legacy form before checking it', () => {
		expect(RenavamSchema().parse('123456789')).toBe('00123456789')
	})

	it('should reject a mutated check digit', () => {
		expect(codeOf(RenavamSchema().safeParse('00123456788'))).toBe(
			'invalidRenavam',
		)
	})
})

describe('PlateSchema', () => {
	it.each([
		[
			'abc-1d23',
			'ABC1D23',
		],
		[
			'abc-1234',
			'ABC1234',
		],
	])('should read %j as %j', (input, expected) => {
		expect(PlateSchema().parse(input)).toBe(expected)
	})

	it('should tell the two standards apart', () => {
		expect(
			codeOf(
				PlateSchema({
					standard: 'mercosul',
				}).safeParse('ABC1234'),
			),
		).toBe('invalidPlate')
		expect(
			codeOf(
				PlateSchema({
					standard: 'legacy',
				}).safeParse('ABC1D23'),
			),
		).toBe('invalidPlate')
	})

	it('should report a blank plate as required', () => {
		expect(codeOf(PlateSchema().safeParse(''))).toBe('required')
	})
})
