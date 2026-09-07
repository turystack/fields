import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { UrlSchema } from './url.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

describe('UrlSchema', () => {
	it('should normalize the host without touching the path', () => {
		expect(UrlSchema().parse(' HTTPS://Example.com/A ')).toBe(
			'https://example.com/A',
		)
	})

	it.each([
		'javascript:alert(1)',
		'data:text/html,<script>',
		'file:///etc/passwd',
	])('should reject the protocol in %j', (value) => {
		expect(codeOf(UrlSchema().safeParse(value))).toBe('urlProtocolNotAllowed')
	})

	it('should require https when asked', () => {
		expect(
			codeOf(
				UrlSchema({
					requireHttps: true,
				}).safeParse('http://example.com'),
			),
		).toBe('urlProtocolNotAllowed')
	})

	it.each([
		'http://localhost:3000',
		'http://127.0.0.1',
		'http://169.254.169.254/latest/meta-data',
		'http://10.0.0.1',
		'http://192.168.0.1',
		'http://172.16.0.1',
		'http://service.internal',
	])('should reject the private host in %j', (value) => {
		expect(
			codeOf(
				UrlSchema({
					blockPrivateHosts: true,
				}).safeParse(value),
			),
		).toBe('urlHostNotAllowed')
	})

	it('should allow a private host when the guard is off', () => {
		expect(codeOf(UrlSchema().safeParse('http://localhost:3000'))).toBe(
			'success',
		)
	})

	it('should reject an unparseable value', () => {
		expect(codeOf(UrlSchema().safeParse('example.com'))).toBe('invalidUrl')
	})

	it('should apply the length cap', () => {
		expect(
			codeOf(
				UrlSchema({
					max: 20,
				}).safeParse(`https://example.com/${'a'.repeat(30)}`),
			),
		).toBe('tooLong')
	})

	it('should report a blank url as required', () => {
		expect(codeOf(UrlSchema().safeParse('  '))).toBe('required')
	})
})
