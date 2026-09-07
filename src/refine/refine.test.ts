import { describe, expect, it } from 'vitest'
import z from 'zod'

import {
	AtLeastOneOfRefine,
	DateOrderRefine,
	MatchFieldRefine,
	MutuallyExclusiveRefine,
	RequiredIfRefine,
	SumEqualsRefine,
} from './refine.js'

import { formatErrors } from '@/format/format.js'

const errorsOf = (result: { error?: z.ZodError }) =>
	result.error === undefined ? {} : formatErrors(result.error)

describe('RequiredIfRefine', () => {
	const Schema = z
		.object({
			contact: z.string(),
			phone: z.string().optional(),
		})
		.superRefine(
			RequiredIfRefine('phone', (value) => value.contact === 'phone'),
		)

	it('should report on the dependent field', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					contact: 'phone',
				}),
			).phone?.code,
		).toBe('requiredIfMissing')
	})

	it('should stay quiet when the condition does not hold', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					contact: 'email',
				}),
			),
		).toEqual({})
	})

	it('should treat a blank string as missing', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					contact: 'phone',
					phone: '   ',
				}),
			).phone?.code,
		).toBe('requiredIfMissing')
	})
})

describe('AtLeastOneOfRefine', () => {
	const Schema = z
		.object({
			email: z.string().optional(),
			phone: z.string().optional(),
		})
		.superRefine(
			AtLeastOneOfRefine([
				'email',
				'phone',
			]),
		)

	it('should report on every field of the group', () => {
		const errors = errorsOf(Schema.safeParse({}))

		expect(errors.email?.code).toBe('atLeastOneRequired')
		expect(errors.phone?.code).toBe('atLeastOneRequired')
	})

	it('should accept when one is filled in', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					email: 'ana@x.com',
				}),
			),
		).toEqual({})
	})
})

describe('MutuallyExclusiveRefine', () => {
	const Schema = z
		.object({
			coupon: z.string().optional(),
			giftCard: z.string().optional(),
		})
		.superRefine(
			MutuallyExclusiveRefine([
				'coupon',
				'giftCard',
			]),
		)

	it('should report on both fields when both are used', () => {
		const errors = errorsOf(
			Schema.safeParse({
				coupon: 'a',
				giftCard: 'b',
			}),
		)

		expect(errors.coupon?.code).toBe('mutuallyExclusive')
		expect(errors.giftCard?.code).toBe('mutuallyExclusive')
	})

	it('should accept a single choice', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					coupon: 'a',
				}),
			),
		).toEqual({})
	})
})

describe('MatchFieldRefine', () => {
	const Schema = z
		.object({
			password: z.string(),
			passwordConfirmation: z.string(),
		})
		.superRefine(MatchFieldRefine('password', 'passwordConfirmation'))

	it('should report on the confirmation field, not the root', () => {
		const errors = errorsOf(
			Schema.safeParse({
				password: 'a',
				passwordConfirmation: 'b',
			}),
		)

		expect(errors.passwordConfirmation?.code).toBe('passwordMismatch')
		expect(errors['']).toBeUndefined()
	})
})

describe('DateOrderRefine', () => {
	const Schema = z
		.object({
			endsOn: z.string().optional(),
			startsOn: z.string().optional(),
		})
		.superRefine(DateOrderRefine('startsOn', 'endsOn'))

	it('should report on the end field', () => {
		const errors = errorsOf(
			Schema.safeParse({
				endsOn: '2026-01-01',
				startsOn: '2026-02-01',
			}),
		)

		expect(errors.endsOn?.code).toBe('dateOutOfOrder')
	})

	it('should accept an ordered pair', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					endsOn: '2026-02-01',
					startsOn: '2026-01-01',
				}),
			),
		).toEqual({})
	})

	it('should stay quiet while a side is missing', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					startsOn: '2026-01-01',
				}),
			),
		).toEqual({})
	})
})

describe('SumEqualsRefine', () => {
	const Schema = z
		.object({
			items: z.array(
				z.object({
					amountCents: z.number(),
				}),
			),
			totalCents: z.number(),
		})
		.superRefine(
			SumEqualsRefine(
				'items',
				'totalCents',
				(item: { amountCents: number }) => item.amountCents,
			),
		)

	it('should report a total that does not add up', () => {
		const errors = errorsOf(
			Schema.safeParse({
				items: [
					{
						amountCents: 3333,
					},
					{
						amountCents: 3333,
					},
				],
				totalCents: 9999,
			}),
		)

		expect(errors.totalCents?.code).toBe('sumMismatch')
	})

	it('should accept a total that adds up', () => {
		expect(
			errorsOf(
				Schema.safeParse({
					items: [
						{
							amountCents: 3333,
						},
						{
							amountCents: 6666,
						},
					],
					totalCents: 9999,
				}),
			),
		).toEqual({})
	})
})
