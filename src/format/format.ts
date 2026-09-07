import type z from 'zod'

import { type FieldIssueCode, issueCode } from '@/internal/issue.js'

/** A single failure, addressed by the field it belongs to. */
export type FieldError = {
	/** Stable code from this package's taxonomy. */
	code: FieldIssueCode
	/** Message produced by the resolver. Defaults to the code itself. */
	message: string
	/** Extra data carried by the issue, such as `min` or `max`. */
	params: Record<string, unknown>
	/** Dotted path of the field, `''` for the object root. */
	path: string
}

/** Turns a failure into a human message, usually from a translation table. */
export type MessageResolver = (error: Omit<FieldError, 'message'>) => string

const toPath = (segments: readonly PropertyKey[]): string =>
	segments.map((segment) => String(segment)).join('.')

const paramsOf = (candidate: unknown): Record<string, unknown> => {
	if (typeof candidate !== 'object' || candidate === null) {
		return {}
	}

	const { code: _code, ...rest } = candidate as Record<string, unknown>

	return rest
}

/**
 * Flattens a `ZodError` into one entry per failing field, keyed by dotted
 * path and carrying a stable code.
 *
 * This is the half of the contract that a form consumes: without it every
 * caller ends up matching on Zod's English message text, which changes with
 * the library version and cannot be translated.
 *
 * The first failure per field wins, so a field shows one message at a time.
 *
 * @example
 * formatErrors(result.error)
 * // { 'user.email': { code: 'invalidEmail', message: 'invalidEmail', params: {}, path: 'user.email' } }
 *
 * formatErrors(result.error, (error) => messages[error.code])
 * // { 'user.email': { code: 'invalidEmail', message: 'E-mail invalido', ... } }
 */
export const formatErrors = (
	error: z.ZodError,
	resolve?: MessageResolver,
): Record<string, FieldError> => {
	const result: Record<string, FieldError> = {}

	for (const candidate of error.issues) {
		const path = toPath(candidate.path)

		if (result[path] !== undefined) {
			continue
		}

		const partial = {
			code: issueCode(candidate),
			params: paramsOf(
				(
					candidate as {
						params?: unknown
					}
				).params,
			),
			path,
		}

		result[path] = {
			...partial,
			message: resolve ? resolve(partial) : partial.code,
		}
	}

	return result
}

/**
 * Same as `formatErrors`, keeping every failure of a field instead of the
 * first one - useful for a password field that lists all unmet rules at once.
 *
 * @example
 * formatAllErrors(result.error).password.map((error) => error.code)
 * // ['tooShort', 'passwordTooWeak']
 */
export const formatAllErrors = (
	error: z.ZodError,
	resolve?: MessageResolver,
): Record<string, FieldError[]> => {
	const result: Record<string, FieldError[]> = {}

	for (const candidate of error.issues) {
		const path = toPath(candidate.path)
		const partial = {
			code: issueCode(candidate),
			params: paramsOf(
				(
					candidate as {
						params?: unknown
					}
				).params,
			),
			path,
		}

		const entry = {
			...partial,
			message: resolve ? resolve(partial) : partial.code,
		}

		result[path] = [
			...(result[path] ?? []),
			entry,
		]
	}

	return result
}
