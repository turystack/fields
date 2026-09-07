/**
 * Every issue this package can raise. Messages are intentionally empty: the
 * code is the contract, so applications map it to a localized message instead
 * of matching on Zod's English strings.
 */
export type FieldIssueCode =
	| 'ageTooHigh'
	| 'ageTooLow'
	| 'atLeastOneRequired'
	| 'confusableCharacters'
	| 'dateInFuture'
	| 'dateInPast'
	| 'dateOutOfOrder'
	| 'disposableEmail'
	| 'domainNotAllowed'
	| 'duplicateItem'
	| 'emailAliasNotAllowed'
	| 'emptyList'
	| 'emptyObject'
	| 'fileExtensionMismatch'
	| 'fileTooLarge'
	| 'fileTypeNotAllowed'
	| 'fullNameRequired'
	| 'invalidCep'
	| 'invalidCnpj'
	| 'invalidCns'
	| 'invalidCpf'
	| 'invalidDate'
	| 'invalidDocument'
	| 'invalidEmail'
	| 'invalidFileName'
	| 'invalidId'
	| 'invalidMoney'
	| 'invalidPersonName'
	| 'invalidPhone'
	| 'invalidPis'
	| 'invalidPlate'
	| 'invalidRenavam'
	| 'invalidSlug'
	| 'invalidTime'
	| 'invalidUrl'
	| 'invalidUsername'
	| 'invalidValue'
	| 'invalidVoterId'
	| 'invisibleCharacters'
	| 'lineBreakNotAllowed'
	| 'missingTimezone'
	| 'mustAccept'
	| 'mutuallyExclusive'
	| 'notAMultipleOf'
	| 'notANumber'
	| 'notAnInteger'
	| 'outOfRange'
	| 'passwordContainsContext'
	| 'passwordHasWhitespace'
	| 'passwordMismatch'
	| 'passwordSequential'
	| 'passwordTooLong'
	| 'passwordTooWeak'
	| 'precisionExceeded'
	| 'required'
	| 'requiredIfMissing'
	| 'reservedValue'
	| 'sumMismatch'
	| 'tooLong'
	| 'tooManyDecimals'
	| 'tooManyLines'
	| 'tooShort'
	| 'unsafeInteger'
	| 'urlHostNotAllowed'
	| 'urlProtocolNotAllowed'

/** Extra data attached to an issue, consumed by the message resolver. */
export type FieldIssueParams = Record<string, unknown>

/**
 * Builds a custom Zod issue carrying a stable `params.code`.
 * Works both with `ctx.addIssue(...)` and `ctx.issues.push(...)`.
 *
 * @example
 * ctx.addIssue(issue('required', value))
 * ctx.issues.push(issue('tooLong', value, { max: 255 }))
 */
export const issue = (
	code: FieldIssueCode,
	input: unknown,
	params?: FieldIssueParams,
) =>
	({
		code: 'custom',
		input,
		message: '',
		params: {
			code,
			...params,
		},
	}) as const

/**
 * Builds the params object for `.refine()` / `.check()` so a failed check
 * reports a stable code instead of Zod's default message.
 *
 * @example
 * z.string().refine((v) => v.length > 0, check('required'))
 */
export const check = (code: FieldIssueCode, params?: FieldIssueParams) => ({
	error: '',
	params: {
		code,
		...params,
	},
})

/**
 * Maps Zod's native issue codes onto this package's taxonomy. Zod only carries
 * `params` on `custom` issues, so built-in checks (`.min()`, `.max()`, type
 * mismatches) are translated here instead of being trusted to report a code.
 */
const NATIVE_CODES: Record<string, FieldIssueCode> = {
	invalid_format: 'invalidDocument',
	invalid_type: 'required',
	not_multiple_of: 'notAMultipleOf',
	too_big: 'tooLong',
	too_small: 'tooShort',
}

/** Shape shared by every Zod issue, narrowed to what the resolver reads. */
type ResolvableIssue = {
	code?: string
	input?: unknown
	origin?: string
	params?: unknown
	received?: unknown
}

/**
 * Resolves the stable code of a Zod issue. Prefers `params.code` written by
 * this package, then falls back to Zod's native code so `.min()`, `.max()` and
 * type mismatches still land in the taxonomy.
 *
 * A missing or nullish value always resolves to `required`, never to
 * `invalid_type` - the distinction is meaningless to whoever fills the form.
 *
 * @example
 * issueCode({ code: 'custom', params: { code: 'invalidCpf' } }) // 'invalidCpf'
 * issueCode({ code: 'invalid_type', input: undefined })         // 'required'
 * issueCode({ code: 'too_big', origin: 'number' })              // 'outOfRange'
 */
export const issueCode = (candidate: ResolvableIssue): FieldIssueCode => {
	const params = candidate.params

	if (typeof params === 'object' && params !== null) {
		const code = (
			params as {
				code?: unknown
			}
		).code

		if (typeof code === 'string') {
			return code as FieldIssueCode
		}
	}

	const native = candidate.code ?? ''

	if (native === 'invalid_type' || native === 'invalid_value') {
		return candidate.input === undefined || candidate.input === null
			? 'required'
			: 'invalidValue'
	}

	if (
		(native === 'too_big' || native === 'too_small') &&
		candidate.origin !== 'string'
	) {
		return 'outOfRange'
	}

	return NATIVE_CODES[native] ?? 'invalidValue'
}
