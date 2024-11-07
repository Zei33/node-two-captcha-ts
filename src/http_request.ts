import axios from 'axios';
import constants from './constants.js';
import querystring from 'querystring';

interface RequestOptions {
	url: string;
	method?: 'get' | 'post' | 'multipart';
	payload?: Record<string, string | number | boolean>;
	timeout?: number;
}

/**
 * Class with static methods used in HTTP requests
 * @class
 */
export const HTTPRequest = {
	/**
	 * Performs a GET to a URL and returns a promise to its body as a Buffer
	 *
	 * @param url - URL of the desired content to GET
	 * @returns Buffer with the content of the body from the HTTP response
	 */
	async openDataURL(url: string): Promise<Buffer> {
		if (typeof url !== 'string') throw new Error('You must inform a string URL');

		try {
			const res = await axios.get(url, {
				responseType: 'arraybuffer',
			}) as unknown as { data: Buffer };
			return Buffer.from(res.data);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to fetch data from URL: ${url}. Error: ${error.message}`);
			} else {
				throw new Error(`Failed to fetch data from URL: ${url}.`);
			}
		}
	},

	/**
	 * Performs a request and returns a promise to the body as a string
	 *
	 * @param options - Object with the parameters for the request
	 * @returns Response data as a string
	 */
	async request(options: RequestOptions): Promise<string> {
		const { url, method = 'get', payload = {}, timeout = 60000 } = options;
		const headers: Record<string, string> = {
			'User-Agent': constants.userAgent,
		};

		// eslint-disable-next-line -- This is a workaround to get the response as a string
		let res;

		switch (method) {
		case 'get':
			// eslint-disable-next-line -- This is a workaround to get the response as a string
			res = await axios.get(`${url}?${querystring.stringify(payload)}`, {
				headers,
				timeout,
			}) as { data: string };
			break;
		case 'post':
			res = await axios.post<string>(url, querystring.stringify(payload), {
				headers,
				timeout,
			});
			break;
		case 'multipart':
			headers['Content-Type'] = 'multipart/form-data';
			res = await axios.post<string>(url, payload, {
				headers,
				timeout,
			}) as { data: string };
			break;
		}

		return res.data;
	}
};
