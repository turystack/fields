# @turystack/fields

Zod schemas for entity fields — request bodies and forms.

Zod validates shapes. It does not know that `'   '` is an empty name, that
`''` should not reach a `NULL` column, that `Math.round(value * 100)` loses a
cent, or that `new Date('2026-01-01')` is 31 December in São Paulo. Every
schema here exists because that gap cost someone a bug.

## Installation

```bash
pnpm add @turystack/fields
```

### Peer dependencies

The host application provides these:

```bash
pnpm add zod
```

## Usage

```ts
import {
	EmailSchema,
	MoneySchema,
	RequiredStringSchema,
	formatErrors,
} from '@turystack/fields'
import { CpfSchema } from '@turystack/fields/br'
import z from 'zod'

const CreateCustomer = z.object({
	document: CpfSchema(),
	email: EmailSchema({ blockDisposable: true }),
	limitCents: MoneySchema({ maxCents: 1_000_00 }),
	name: RequiredStringSchema({ min: 3, max: 120 }),
})

const result = CreateCustomer.safeParse(input)

if (!result.success) {
	return formatErrors(result.error, (error) => messages[error.code])
	// { name: { code: 'required', message: 'Informe o nome', params: {}, path: 'name' } }
}
```

Every failure carries a stable `code` from a single taxonomy, so the frontend
never matches on Zod's English message text.

## What each schema adds

| Group | Schemas |
| --- | --- |
| Text | `RequiredStringSchema` `OptionalStringSchema` `NullableStringSchema` `SingleLineSchema` `MultilineSchema` `SlugSchema` `UsernameSchema` |
| Person | `PersonNameSchema` `EmailSchema` |
| Credential | `PasswordSchema` |
| Number | `NumberSchema` `IntSchema` `QuantitySchema` `PercentageSchema` `MoneySchema` `DecimalSchema` |
| Date | `DateOnlySchema` `BirthDateSchema` `DateTimeSchema` `TimeSchema` |
| Boolean | `BooleanInputSchema` `CheckboxSchema` `MustAcceptSchema` `TriStateSchema` |
| File | `FileSchema` `ImageSchema` `UrlSchema` |
| Collection | `RequiredArraySchema` `UniqueArraySchema` `NonEmptyObjectSchema` `IdSchema` |
| Cross-field | `RequiredIfRefine` `AtLeastOneOfRefine` `MutuallyExclusiveRefine` `MatchFieldRefine` `DateOrderRefine` `SumEqualsRefine` |
| Brazil (`/br`) | `CpfSchema` `CnpjSchema` `CpfOrCnpjSchema` `CepSchema` `PhoneSchema` `PisSchema` `CnsSchema` `VoterIdSchema` `RenavamSchema` `PlateSchema` |

Each export documents the specific failure it prevents. A few examples:

- `RequiredStringSchema` reports `'   '` and a zero-width space as `required`,
  not as `tooShort`, and measures length after sanitizing.
- `MoneySchema` returns integer minor units assembled from digits, so no amount
  is ever rounded through a float.
- `DateOnlySchema` keeps a calendar date as `YYYY-MM-DD`, which is what stops a
  birth date from shifting a day when it crosses a time zone.
- `UrlSchema` pins the protocol and can refuse private hosts, so a stored value
  cannot become `javascript:` in a link or an SSRF target in a server fetch.
- `CnpjSchema` validates the alphanumeric form issued from 2026, which a
  digits-only validator rejects outright.

## Documentation

Options, API reference and examples:

**https://tury.dev/libs/fields**

## Development

```bash
pnpm install
pnpm typecheck
pnpm check
pnpm test
pnpm build
```
