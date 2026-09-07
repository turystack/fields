import { describe, expect, it } from 'vitest'

import { deburr, isBlank, onlyDigits, sanitize } from './sanitize.js'

const ZERO_WIDTH = '\u200B'
const NBSP = ' '
const RTL_OVERRIDE = '\u202E'

describe('sanitize', () => {
	it('should trim and collapse inner whitespace', () => {
		expect(sanitize('  Ana   Maria  ')).toBe('Ana Maria')
	})

	it('should strip invisible characters that survive a length check', () => {
		expect(sanitize(`${ZERO_WIDTH}Ana${RTL_OVERRIDE}`)).toBe('Ana')
	})

	it('should fold exotic spaces into a plain space', () => {
		expect(sanitize(`Ana${NBSP}Maria`)).toBe('Ana Maria')
	})

	it('should normalize decomposed accents', () => {
		const decomposed = 'Jose\u0301'
		const composed = 'Jos\u00E9'

		expect(decomposed).not.toBe(composed)
		expect(sanitize(decomposed)).toBe(composed)
	})

	it('should fold line breaks into spaces by default', () => {
		expect(sanitize('Ana\nMaria')).toBe('Ana Maria')
	})

	it('should keep line breaks in multiline mode', () => {
		expect(
			sanitize('a  \r\n\r\n\r\n  b', {
				multiline: true,
			}),
		).toBe('a\n\nb')
	})

	it('should preserve inner spacing when asked', () => {
		expect(
			sanitize('  a   b  ', {
				whitespace: 'preserve',
			}),
		).toBe('  a   b  ')
	})

	it('should keep invisible characters when allowed', () => {
		expect(
			sanitize(`a${ZERO_WIDTH}b`, {
				allowInvisible: true,
			}),
		).toBe(`a${ZERO_WIDTH}b`)
	})

	it('should skip normalization when disabled', () => {
		expect(
			sanitize('José', {
				unicode: false,
			}),
		).toBe('José')
	})
})

describe('isBlank', () => {
	it.each([
		'',
		'   ',
		'\t\n',
		ZERO_WIDTH,
		NBSP,
	])('should report %j as blank', (value) => {
		expect(isBlank(value)).toBe(true)
	})

	it.each([
		'0',
		'a',
	])('should report %j as filled', (value) => {
		expect(isBlank(value)).toBe(false)
	})
})

describe('onlyDigits', () => {
	it('should keep digits only', () => {
		expect(onlyDigits('529.982.247-25')).toBe('52998224725')
	})
})

describe('deburr', () => {
	it('should strip diacritics', () => {
		expect(deburr('Ação')).toBe('Acao')
	})
})
