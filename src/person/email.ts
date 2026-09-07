import z from 'zod'

import { check } from '@/internal/issue.js'
import { sanitize } from '@/internal/sanitize.js'

/** Free providers that hand out throwaway inboxes. */
const DISPOSABLE = [
	'10minutemail.com',
	'guerrillamail.com',
	'mailinator.com',
	'tempmail.com',
	'trashmail.com',
	'yopmail.com',
] as const

/** RFC 5321 caps the whole address at 254 and the local part at 64 octets. */
const MAX_LENGTH = 254
const MAX_LOCAL = 64

const LOCAL =
	/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/
const DOMAIN =
	/^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}$/u

export type EmailOptions = {
	/** Reject addresses whose domain is not listed. */
	allowedDomains?: readonly string[]
	/** Reject sub-addressing such as `ana+promo@x.com`. Default `false`. */
	blockAlias?: boolean
	/** Reject known throwaway providers. Default `false`. */
	blockDisposable?: boolean
	/** Extra domains rejected as `disposableEmail`. */
	blockedDomains?: readonly string[]
	/** Lowercase the whole address. Default `true`. */
	lowercase?: boolean
}

const split = (value: string) => {
	const at = value.lastIndexOf('@')

	return at === -1
		? undefined
		: {
				domain: value.slice(at + 1),
				local: value.slice(0, at),
			}
}

/**
 * Email address. `z.email()` only checks the shape; this adds the parts that
 * decide whether the address is storable and deliverable: the RFC length caps
 * (254 total, 64 for the local part), rejection of dots at the edges or
 * doubled up, case folding so one person cannot register twice, and optional
 * blocking of sub-addressing and throwaway providers.
 *
 * Unicode domains are accepted and normalized, never silently mangled.
 *
 * @example
 * EmailSchema().parse('  Ana@Example.COM ')                 // 'ana@example.com'
 * EmailSchema().safeParse('ana..maria@example.com')         // invalidEmail
 * EmailSchema({ blockAlias: true }).safeParse('a+x@e.com')  // emailAliasNotAllowed
 */
export const EmailSchema = (options?: EmailOptions) => {
	const {
		allowedDomains,
		blockAlias = false,
		blockDisposable = false,
		blockedDomains = [],
		lowercase = true,
	} = options ?? {}

	const blocked = new Set<string>([
		...(blockDisposable ? DISPOSABLE : []),
		...blockedDomains,
	])
	const allowed = allowedDomains ? new Set(allowedDomains) : undefined

	return z
		.string()
		.overwrite((value) => {
			const clean = sanitize(value, {
				whitespace: 'trim',
			})

			return lowercase ? clean.toLowerCase() : clean
		})
		.refine((value) => value.length > 0, {
			...check('required'),
			abort: true,
		})
		.refine((value) => value.length <= MAX_LENGTH, {
			...check('tooLong', {
				max: MAX_LENGTH,
			}),
			abort: true,
		})
		.refine(
			(value) => {
				const parts = split(value)

				return (
					parts !== undefined &&
					parts.local.length > 0 &&
					parts.local.length <= MAX_LOCAL &&
					LOCAL.test(parts.local) &&
					DOMAIN.test(parts.domain)
				)
			},
			{
				...check('invalidEmail'),
				abort: true,
			},
		)
		.refine(
			(value) => !blockAlias || !split(value)?.local.includes('+'),
			check('emailAliasNotAllowed'),
		)
		.refine((value) => {
			const domain = split(value)?.domain ?? ''

			return !blocked.has(domain)
		}, check('disposableEmail'))
		.refine((value) => {
			const domain = split(value)?.domain ?? ''

			return allowed === undefined || allowed.has(domain)
		}, check('domainNotAllowed'))
		.meta({
			description: 'Email address.',
			example: 'ana@example.com',
		})
}
