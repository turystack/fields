/** Every digit the same, which passes any checksum built on differences. */
const REPEATED = /^(\d)\1+$/

const digitsOf = (value: string): number[] =>
	[
		...value,
	].map((char) => Number(char))

const weightedSum = (
	values: number[],
	weight: (index: number) => number,
): number =>
	values.reduce((total, value, index) => total + value * weight(index), 0)

/** Modulus 11 check digit as used by CPF: `0` when the remainder is 10. */
const mod11Cpf = (values: number[]): number => {
	const remainder =
		(weightedSum(values, (index) => values.length + 1 - index) * 10) % 11

	return remainder === 10 ? 0 : remainder
}

/** Modulus 11 check digit as used by CNPJ, PIS and RENAVAM. */
const mod11 = (values: number[], weights: readonly number[]): number => {
	const remainder = weightedSum(values, (index) => weights[index] ?? 0) % 11

	return remainder < 2 ? 0 : 11 - remainder
}

/**
 * Validates a CPF by its two check digits. Also rejects the eleven
 * same-digit sequences such as `111.111.111-11`, which satisfy the checksum
 * and are the value most often typed to get past a form.
 *
 * @example
 * isValidCpf('52998224725')  // true
 * isValidCpf('11111111111')  // false
 */
export const isValidCpf = (value: string): boolean => {
	if (!/^\d{11}$/.test(value) || REPEATED.test(value)) {
		return false
	}

	const digits = digitsOf(value)
	const first = mod11Cpf(digits.slice(0, 9))
	const second = mod11Cpf(digits.slice(0, 10))

	return first === digits[9] && second === digits[10]
}

const CNPJ_FIRST = [
	5,
	4,
	3,
	2,
	9,
	8,
	7,
	6,
	5,
	4,
	3,
	2,
] as const
const CNPJ_SECOND = [
	6,
	5,
	4,
	3,
	2,
	9,
	8,
	7,
	6,
	5,
	4,
	3,
	2,
] as const

/**
 * Validates a CNPJ, numeric or alphanumeric. From 2026 the first twelve
 * characters may be letters, and each character weighs its ASCII code minus
 * 48 - so `'A'` counts as 17. A digit-only regex silently rejects every new
 * CNPJ issued under that rule.
 *
 * @example
 * isValidCnpj('11222333000181')  // true
 * isValidCnpj('12ABC34501DE35')  // true
 */
export const isValidCnpj = (value: string): boolean => {
	if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || REPEATED.test(value)) {
		return false
	}

	const values = [
		...value,
	].map((char) => char.charCodeAt(0) - 48)
	const digits = digitsOf(value.slice(12))
	const first = mod11(values.slice(0, 12), CNPJ_FIRST)
	const second = mod11(
		[
			...values.slice(0, 12),
			first,
		],
		CNPJ_SECOND,
	)

	return first === digits[0] && second === digits[1]
}

const PIS = [
	3,
	2,
	9,
	8,
	7,
	6,
	5,
	4,
	3,
	2,
] as const

/**
 * Validates a PIS/PASEP/NIT by its check digit.
 *
 * @example
 * isValidPis('12063431150')  // true
 */
export const isValidPis = (value: string): boolean => {
	if (!/^\d{11}$/.test(value) || REPEATED.test(value)) {
		return false
	}

	const digits = digitsOf(value)
	const remainder =
		weightedSum(digits.slice(0, 10), (index) => PIS[index] ?? 0) % 11
	const expected = remainder < 2 ? 0 : 11 - remainder

	return expected === digits[10]
}

/**
 * Validates a CNS. Cards beginning with 1 or 2 are derived from a PIS and use
 * a filler segment, while cards beginning with 7, 8 or 9 are provisional and
 * only have to satisfy a weighted sum - two different rules a length check
 * cannot tell apart.
 *
 * @example
 * isValidCns('898001160125804')  // depends on the checksum
 */
export const isValidCns = (value: string): boolean => {
	if (!/^\d{15}$/.test(value)) {
		return false
	}

	const digits = digitsOf(value)

	if (/^[789]/.test(value)) {
		return weightedSum(digits, (index) => 15 - index) % 11 === 0
	}

	if (!/^[12]/.test(value)) {
		return false
	}

	const pis = digits.slice(0, 11)
	const remainder = weightedSum(pis, (index) => 15 - index) % 11
	let check = 11 - remainder
	let filler = '000'

	if (check === 11) {
		check = 0
	}

	if (check === 10) {
		check = 11 - ((weightedSum(pis, (index) => 15 - index) + 2) % 11)
		filler = '001'
	}

	return value === `${value.slice(0, 11)}${filler}${check}`
}

const VOTER_STATES = 28

/**
 * Validates a voter registration number. The two check digits depend on the
 * state code embedded in the number, and São Paulo and Minas Gerais follow a
 * different rule when the remainder is zero - a detail every generic modulus
 * 11 helper gets wrong.
 *
 * @example
 * isValidVoterId('102345670949')  // depends on the checksum
 */
export const isValidVoterId = (value: string): boolean => {
	if (!/^\d{12}$/.test(value)) {
		return false
	}

	const digits = digitsOf(value)
	const state = Number(value.slice(8, 10))

	if (state < 1 || state > VOTER_STATES) {
		return false
	}

	const special = state === 1 || state === 2
	const firstRemainder =
		weightedSum(digits.slice(0, 8), (index) => index + 2) % 11
	const first =
		firstRemainder === 0
			? special
				? 1
				: 0
			: firstRemainder === 10
				? 0
				: firstRemainder

	if (first !== digits[10]) {
		return false
	}

	const secondRemainder =
		((digits[8] ?? 0) * 7 + (digits[9] ?? 0) * 8 + first * 9) % 11
	const second =
		secondRemainder === 0
			? special
				? 1
				: 0
			: secondRemainder === 10
				? 0
				: secondRemainder

	return second === digits[11]
}

const RENAVAM = [
	3,
	2,
	9,
	8,
	7,
	6,
	5,
	4,
	3,
	2,
] as const

/**
 * Validates a RENAVAM by its check digit, padding the short legacy form to
 * eleven digits first.
 *
 * @example
 * isValidRenavam('00123456789')  // depends on the checksum
 */
export const isValidRenavam = (value: string): boolean => {
	if (!/^\d{9,11}$/.test(value)) {
		return false
	}

	const padded = value.padStart(11, '0')
	const digits = digitsOf(padded)
	const remainder =
		(weightedSum(digits.slice(0, 10), (index) => RENAVAM[index] ?? 0) * 10) % 11

	return (remainder === 10 ? 0 : remainder) === digits[10]
}

/** Area codes actually assigned by ANATEL. */
export const AREA_CODES = new Set([
	11,
	12,
	13,
	14,
	15,
	16,
	17,
	18,
	19,
	21,
	22,
	24,
	27,
	28,
	31,
	32,
	33,
	34,
	35,
	37,
	38,
	41,
	42,
	43,
	44,
	45,
	46,
	47,
	48,
	49,
	51,
	53,
	54,
	55,
	61,
	62,
	63,
	64,
	65,
	66,
	67,
	68,
	69,
	71,
	73,
	74,
	75,
	77,
	79,
	81,
	82,
	83,
	84,
	85,
	86,
	87,
	88,
	89,
	91,
	92,
	93,
	94,
	95,
	96,
	97,
	98,
	99,
])

/** What kind of line a phone number belongs to. */
export type PhoneKind = 'landline' | 'mobile'

/**
 * Validates a Brazilian phone number and reports its kind. Checks that the
 * area code exists, that a mobile number carries the ninth digit and that a
 * landline starts in the 2-5 range - none of which a `\d{10,11}` regex sees.
 *
 * @example
 * phoneKindOf('11987654321')  // 'mobile'
 * phoneKindOf('11387654321')  // undefined
 */
export const phoneKindOf = (value: string): PhoneKind | undefined => {
	if (!/^\d{10,11}$/.test(value)) {
		return undefined
	}

	if (!AREA_CODES.has(Number(value.slice(0, 2)))) {
		return undefined
	}

	const subscriber = value.slice(2)

	if (subscriber.length === 9) {
		return subscriber.startsWith('9') ? 'mobile' : undefined
	}

	return /^[2-5]/.test(subscriber) ? 'landline' : undefined
}
