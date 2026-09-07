import z from 'zod'

import {
	isValidCnpj,
	isValidCns,
	isValidCpf,
	isValidPis,
	isValidRenavam,
	isValidVoterId,
	type PhoneKind,
	phoneKindOf,
} from './algorithm.js'

import { type FieldIssueCode, issue } from '@/internal/issue.js'
import { deburr, onlyDigits, sanitize } from '@/internal/sanitize.js'

/** How the validated value is returned. */
export type DocumentFormat = 'digits' | 'masked'

const LEGACY_PLATE = /^[A-Z]{3}\d{4}$/
const MERCOSUL_PLATE = /^[A-Z]{3}\d[A-Z]\d{2}$/

const normalize = (value: unknown): string =>
	typeof value === 'string'
		? sanitize(value, {
				whitespace: 'trim',
			})
		: ''

const mask = (value: string, pattern: string): string => {
	let index = 0

	return [
		...pattern,
	]
		.map((char) => (char === '#' ? (value[index++] ?? '') : char))
		.join('')
}

/** Builds a digit-based document schema out of a checksum validator. */
const documentSchema = (
	code: FieldIssueCode,
	isValid: (value: string) => boolean,
	pattern: string,
	format: DocumentFormat,
	meta: {
		description: string
		example: string
	},
) =>
	z
		.unknown()
		.transform((value, ctx) => {
			const text = normalize(value)

			if (text.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const digits = onlyDigits(text)

			if (!isValid(digits)) {
				ctx.issues.push(issue(code, value))

				return z.NEVER
			}

			return format === 'masked' ? mask(digits, pattern) : digits
		})
		.meta(meta)

export type DocumentOptions = {
	/** Output shape. Default `'digits'`. */
	format?: DocumentFormat
}

/**
 * CPF. Accepts the value with or without its mask, verifies both check digits
 * and rejects the same-digit sequences that satisfy the checksum, then returns
 * a single canonical form so the same person cannot be stored twice under two
 * spellings.
 *
 * @example
 * CpfSchema().parse('529.982.247-25')       // '52998224725'
 * CpfSchema().safeParse('111.111.111-11')   // invalidCpf
 */
export const CpfSchema = (options?: DocumentOptions) =>
	documentSchema(
		'invalidCpf',
		isValidCpf,
		'###.###.###-##',
		options?.format ?? 'digits',
		{
			description: 'CPF.',
			example: '52998224725',
		},
	)

/**
 * CNPJ, numeric or alphanumeric. Since 2026 the root may contain letters, so
 * the value is normalized in upper case and every character weighs its ASCII
 * code minus 48 - a digits-only validator rejects every CNPJ issued under the
 * new rule.
 *
 * @example
 * CnpjSchema().parse('11.222.333/0001-81')  // '11222333000181'
 * CnpjSchema().parse('12.ABC.345/01DE-35')  // '12ABC34501DE35'
 */
export const CnpjSchema = (options?: DocumentOptions) => {
	const format = options?.format ?? 'digits'

	return z
		.unknown()
		.transform((value, ctx) => {
			const text = deburr(normalize(value)).toUpperCase()

			if (text.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const cleaned = text.replace(/[^0-9A-Z]/g, '')

			if (!isValidCnpj(cleaned)) {
				ctx.issues.push(issue('invalidCnpj', value))

				return z.NEVER
			}

			return format === 'masked' ? mask(cleaned, '##.###.###/####-##') : cleaned
		})
		.meta({
			description: 'CNPJ, numeric or alphanumeric.',
			example: '11222333000181',
		})
}

/**
 * CPF or CNPJ in the same field, discriminated by length. The error names the
 * document that failed rather than reporting a generic format mismatch.
 *
 * @example
 * CpfOrCnpjSchema().parse('529.982.247-25')  // '52998224725'
 */
export const CpfOrCnpjSchema = (options?: DocumentOptions) => {
	const format = options?.format ?? 'digits'

	return z
		.unknown()
		.transform((value, ctx) => {
			const text = deburr(normalize(value)).toUpperCase()
			const cleaned = text.replace(/[^0-9A-Z]/g, '')

			if (cleaned.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			if (cleaned.length === 11) {
				if (!isValidCpf(cleaned)) {
					ctx.issues.push(issue('invalidCpf', value))

					return z.NEVER
				}

				return format === 'masked' ? mask(cleaned, '###.###.###-##') : cleaned
			}

			if (cleaned.length === 14) {
				if (!isValidCnpj(cleaned)) {
					ctx.issues.push(issue('invalidCnpj', value))

					return z.NEVER
				}

				return format === 'masked'
					? mask(cleaned, '##.###.###/####-##')
					: cleaned
			}

			ctx.issues.push(issue('invalidDocument', value))

			return z.NEVER
		})
		.meta({
			description: 'CPF or CNPJ.',
			example: '52998224725',
		})
}

/**
 * Postal code. Eight digits with the mask optional, rejecting `00000000`,
 * which every regex accepts and no address has.
 *
 * @example
 * CepSchema().parse('01310-100')  // '01310100'
 */
export const CepSchema = (options?: DocumentOptions) =>
	documentSchema(
		'invalidCep',
		(value) => /^\d{8}$/.test(value) && value !== '00000000',
		'#####-###',
		options?.format ?? 'digits',
		{
			description: 'Postal code.',
			example: '01310100',
		},
	)

/**
 * PIS, PASEP or NIT, verified by its check digit.
 *
 * @example
 * PisSchema().parse('120.63431.15-0')  // '12063431150'
 */
export const PisSchema = (options?: DocumentOptions) =>
	documentSchema(
		'invalidPis',
		isValidPis,
		'###.#####.##-#',
		options?.format ?? 'digits',
		{
			description: 'PIS/PASEP/NIT.',
			example: '12063431150',
		},
	)

/**
 * National health card number, covering both the definitive and the
 * provisional families, which follow different check rules.
 *
 * @example
 * CnsSchema().parse('898 0011 6012 5009')  // '898001160125009'
 */
export const CnsSchema = (options?: DocumentOptions) =>
	documentSchema(
		'invalidCns',
		isValidCns,
		'### #### #### ####',
		options?.format ?? 'digits',
		{
			description: 'CNS.',
			example: '898001160125009',
		},
	)

/**
 * Voter registration number, whose check digits depend on the embedded state
 * code and follow a different rule for São Paulo and Minas Gerais.
 *
 * @example
 * VoterIdSchema().parse('1023 8501 0671')  // '102385010671'
 */
export const VoterIdSchema = (options?: DocumentOptions) =>
	documentSchema(
		'invalidVoterId',
		isValidVoterId,
		'#### #### ####',
		options?.format ?? 'digits',
		{
			description: 'Voter registration.',
			example: '102385010671',
		},
	)

/**
 * Vehicle registration number, padded to eleven digits before its check digit
 * is verified.
 *
 * @example
 * RenavamSchema().parse('123456789')  // '00123456789'
 */
export const RenavamSchema = () =>
	z
		.unknown()
		.transform((value, ctx) => {
			const digits = onlyDigits(normalize(value))

			if (digits.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			if (!isValidRenavam(digits)) {
				ctx.issues.push(issue('invalidRenavam', value))

				return z.NEVER
			}

			return digits.padStart(11, '0')
		})
		.meta({
			description: 'RENAVAM.',
			example: '00123456789',
		})

export type PhoneOptions = {
	/** Accepted line kinds. Default: both. */
	kinds?: readonly PhoneKind[]
	/** Output shape. Default `'e164'`. */
	format?: 'digits' | 'e164'
}

/**
 * Brazilian phone number. Strips the mask and the `+55` prefix, checks that
 * the area code is one ANATEL actually assigned, requires the ninth digit on
 * mobile numbers and the 2-5 range on landlines, and returns E.164 so the
 * value is ready for any messaging provider.
 *
 * @example
 * PhoneSchema().parse('(11) 98765-4321')                      // '+5511987654321'
 * PhoneSchema().safeParse('(20) 98765-4321')                  // invalidPhone
 * PhoneSchema({ kinds: ['mobile'] }).safeParse('1133334444')  // invalidPhone
 */
export const PhoneSchema = (options?: PhoneOptions) => {
	const {
		format = 'e164',
		kinds = [
			'landline',
			'mobile',
		],
	} = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			const digits = onlyDigits(normalize(value))

			if (digits.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const national =
				digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits
			const kind = phoneKindOf(national)

			if (kind === undefined || !kinds.includes(kind)) {
				ctx.issues.push(
					issue('invalidPhone', value, {
						kinds,
					}),
				)

				return z.NEVER
			}

			return format === 'e164' ? `+55${national}` : national
		})
		.meta({
			description: 'Brazilian phone number.',
			example: '+5511987654321',
		})
}

export type PlateOptions = {
	/** Accepted standard. Default `'any'`. */
	standard?: 'any' | 'legacy' | 'mercosul'
}

/**
 * Vehicle plate in the legacy `AAA0000` or the Mercosul `AAA0A00` layout. The
 * two differ only in the position of one letter, which a single loose regex
 * cannot tell apart.
 *
 * @example
 * PlateSchema().parse('abc-1d23')                          // 'ABC1D23'
 * PlateSchema({ standard: 'mercosul' }).safeParse('ABC1234') // invalidPlate
 */
export const PlateSchema = (options?: PlateOptions) => {
	const { standard = 'any' } = options ?? {}

	return z
		.unknown()
		.transform((value, ctx) => {
			const text = deburr(normalize(value))
				.toUpperCase()
				.replace(/[^0-9A-Z]/g, '')

			if (text.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			const legacy = LEGACY_PLATE.test(text)
			const mercosul = MERCOSUL_PLATE.test(text)
			const accepted =
				standard === 'legacy'
					? legacy
					: standard === 'mercosul'
						? mercosul
						: legacy || mercosul

			if (!accepted) {
				ctx.issues.push(
					issue('invalidPlate', value, {
						standard,
					}),
				)

				return z.NEVER
			}

			return text
		})
		.meta({
			description: 'Vehicle plate.',
			example: 'ABC1D23',
		})
}
