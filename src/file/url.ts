import z from 'zod'

import { issue } from '@/internal/issue.js'
import { sanitize } from '@/internal/sanitize.js'

/** Hosts that resolve back into the network the server itself sits on. */
const PRIVATE_HOST =
	/^(?:localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd])/i

export type UrlOptions = {
	/** Accepted protocols. Default `['https:', 'http:']`. */
	protocols?: readonly string[]
	/** Reject hosts inside the private network. Default `false`. */
	blockPrivateHosts?: boolean
	/** Largest accepted length. Default `2048`. */
	max?: number
	/** Accept only `https:`. Default `false`. */
	requireHttps?: boolean
}

/**
 * URL field. `z.url()` accepts `javascript:alert(1)` and
 * `http://169.254.169.254/`, both of which are exactly what an attacker wants
 * to store: the first executes when rendered as a link, the second turns any
 * server-side fetch of the value into a request to the cloud metadata service.
 * This schema pins the protocol, can refuse private hosts, caps the length and
 * lowercases the host so two spellings of the same URL do not become two rows.
 *
 * @example
 * UrlSchema().safeParse('javascript:alert(1)')                        // urlProtocolNotAllowed
 * UrlSchema({ blockPrivateHosts: true }).safeParse('http://127.0.0.1')  // urlHostNotAllowed
 * UrlSchema().parse(' HTTPS://Example.com/A ')                        // 'https://example.com/A'
 */
export const UrlSchema = (options?: UrlOptions) => {
	const {
		blockPrivateHosts = false,
		max = 2048,
		protocols = [
			'https:',
			'http:',
		],
		requireHttps = false,
	} = options ?? {}

	const allowed = requireHttps
		? [
				'https:',
			]
		: protocols

	return z
		.unknown()
		.transform((value, ctx) => {
			const text =
				typeof value === 'string'
					? sanitize(value, {
							whitespace: 'trim',
						})
					: ''

			if (text.length === 0) {
				ctx.issues.push(issue('required', value))

				return z.NEVER
			}

			if (text.length > max) {
				ctx.issues.push(
					issue('tooLong', value, {
						max,
					}),
				)

				return z.NEVER
			}

			let url: URL

			try {
				url = new URL(text)
			} catch {
				ctx.issues.push(issue('invalidUrl', value))

				return z.NEVER
			}

			if (!allowed.includes(url.protocol)) {
				ctx.issues.push(
					issue('urlProtocolNotAllowed', value, {
						allowed,
					}),
				)

				return z.NEVER
			}

			if (blockPrivateHosts && PRIVATE_HOST.test(url.hostname)) {
				ctx.issues.push(issue('urlHostNotAllowed', url.hostname))

				return z.NEVER
			}

			return url.toString()
		})
		.meta({
			description: 'Absolute URL.',
			example: 'https://example.com',
		})
}
