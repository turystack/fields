import { describe, expect, it } from 'vitest'
import type z from 'zod'

import { FileSchema, ImageSchema } from './file.js'

import { issueCode } from '@/internal/issue.js'

const codeOf = (result: { error?: z.ZodError }): string =>
	result.error === undefined ? 'success' : issueCode(result.error.issues[0]!)

const fileOf = (name: string, type: string, size = 4) =>
	new File(
		[
			new Uint8Array(size),
		],
		name,
		{
			type,
		},
	)

describe('FileSchema', () => {
	it('should accept a consistent file', () => {
		expect(codeOf(FileSchema().safeParse(fileOf('a.png', 'image/png')))).toBe(
			'success',
		)
	})

	it('should reject a mime type the name contradicts', () => {
		expect(
			codeOf(FileSchema().safeParse(fileOf('payload.png', 'application/pdf'))),
		).toBe('fileExtensionMismatch')
	})

	it('should reject a type outside the allowlist', () => {
		expect(
			codeOf(
				FileSchema({
					accept: [
						'image/*',
					],
				}).safeParse(fileOf('a.pdf', 'application/pdf')),
			),
		).toBe('fileTypeNotAllowed')
	})

	it('should accept a wildcard match', () => {
		expect(
			codeOf(
				FileSchema({
					accept: [
						'image/*',
					],
				}).safeParse(fileOf('a.png', 'image/png')),
			),
		).toBe('success')
	})

	it.each([
		'../escape.png',
		'dir/a.png',
		'.hidden.png',
	])('should reject the file name %j', (name) => {
		expect(codeOf(FileSchema().safeParse(fileOf(name, 'image/png')))).toBe(
			'invalidFileName',
		)
	})

	it('should reject a name hiding its extension behind a bidi override', () => {
		expect(
			codeOf(FileSchema().safeParse(fileOf('a\u202Egnp.exe', 'image/png'))),
		).toBe('invalidFileName')
	})

	it('should apply the size bounds', () => {
		expect(
			codeOf(
				FileSchema({
					maxSize: 2,
				}).safeParse(fileOf('a.png', 'image/png', 4)),
			),
		).toBe('fileTooLarge')
		expect(
			codeOf(FileSchema().safeParse(fileOf('a.png', 'image/png', 0))),
		).toBe('required')
	})

	it('should report a value that is not a file as required', () => {
		expect(codeOf(FileSchema().safeParse('a.png'))).toBe('required')
	})
})

describe('ImageSchema', () => {
	it('should reject svg, which executes script when served inline', () => {
		expect(
			codeOf(ImageSchema().safeParse(fileOf('a.svg', 'image/svg+xml'))),
		).toBe('fileTypeNotAllowed')
	})

	it('should accept a raster image', () => {
		expect(
			codeOf(ImageSchema().safeParse(fileOf('a.webp', 'image/webp'))),
		).toBe('success')
	})
})
