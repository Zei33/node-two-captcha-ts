import { readFile } from 'fs/promises';
import Captcha from './Captcha.js';
import constants from './constants.js';
import { HTTPRequest } from './http_request.js';

const baseUrl = 'https://2captcha.com/<action>.php';

export class TwoCaptchaClient {
	key: string;
	timeout: number;
	polling: number;
	throwErrors: boolean;

	/**
	 * Constructor for the 2Captcha client object
	 *
	 * @param key - Your 2Captcha API key
	 * @param params - Params for the client
	 */
	constructor(
		key: string,
		{
			timeout = 60000,
			polling = 5000,
			throwErrors = false,
		}: { timeout?: number; polling?: number; throwErrors?: boolean } = {}
	) {
		this.key = key;
		this.timeout = timeout;
		this.polling = polling;
		this.throwErrors = throwErrors;

		if (typeof key !== 'string') this._throwError('2Captcha key must be a string');
	}

	/**
	 * Get balance from your account
	 *
	 * @returns Account balance in USD
	 */
	async balance(): Promise<number> {
		const res = await this._request('res', 'get', {
			action: 'getbalance',
		});
		return parseFloat(res);
	}

	/**
	 * Gets the response from a solved captcha
	 *
	 * @param captchaId - The id of the desired captcha
	 * @returns A promise for the captcha
	 */
	async captcha(captchaId: string): Promise<Captcha> {
		const res = await this._request('res', 'get', {
			id: captchaId,
			action: 'get',
		});

		const decodedCaptcha = new Captcha();
		decodedCaptcha.id = captchaId;
		decodedCaptcha.apiResponse = res;
		const [, text] = res.split('|', 2);
		decodedCaptcha.text = text;

		return decodedCaptcha;
	}

	/**
	 * Sends an image captcha and polls for its response
	 *
	 * @param options - Parameters for the requests
	 * @returns Promise for a Captcha object
	 */
	async decode(options: {
		base64?: string;
		buffer?: Buffer;
		path?: string;
		url?: string;
		method?: 'base64' | 'multipart';
	} = {}): Promise<Captcha> {
		const startedAt = Date.now();

		if (typeof this.key !== 'string') this._throwError('2Captcha key must be a string');

		const base64 = await this._loadCaptcha(options);

		let decodedCaptcha = await this._upload({ ...options, base64 });

		// Keep polling until the answer is ready
		while (decodedCaptcha.text === '') {
			await TwoCaptchaClient._sleep(this.polling);
			if (Date.now() - startedAt > this.timeout) {
				this._throwError('Captcha timeout');
				return decodedCaptcha;
			}
			decodedCaptcha = await this.captcha(decodedCaptcha.id);
		}

		return decodedCaptcha;
	}

	/**
	 * Sends a ReCaptcha v2 and polls for its response
	 *
	 * @param options - Parameters for the request
	 * @returns Promise for a Captcha object
	 */
	async decodeRecaptchaV2(options: {
		googlekey: string;
		pageurl: string;
		invisible?: boolean;
		enterprise?: boolean;
	}): Promise<Captcha> {
		const startedAt = Date.now();

		// eslint-disable-next-line -- linter is shit
		if (!options.googlekey) this._throwError('Missing googlekey parameter');
		// eslint-disable-next-line -- linter is shit
		if (!options.pageurl) this._throwError('Missing pageurl parameter');

		const uploadOptions: {
			method: 'userrecaptcha';
			googlekey: string;
			pageurl: string;
			invisible: number;
			enterprise: number;
		} = {
			method: 'userrecaptcha',
			googlekey: options.googlekey,
			pageurl: options.pageurl,
			invisible: (options.invisible ?? false) ? 1 : 0,
			enterprise: (options.enterprise ?? false) ? 1 : 0,
		};

		let decodedCaptcha = await this._upload(uploadOptions);

		// Keep polling until the answer is ready
		while (decodedCaptcha.text === '') {
			await TwoCaptchaClient._sleep(Math.max(this.polling, 10000)); // Sleep at least 10 seconds
			if (Date.now() - startedAt > this.timeout) {
				this._throwError('Captcha timeout');
				return decodedCaptcha;
			}
			decodedCaptcha = await this.captcha(decodedCaptcha.id);
		}

		return decodedCaptcha;
	}

	/**
	 * Sends a ReCaptcha v3 and polls for its response
	 *
	 * @param options - Parameters for the request
	 * @returns Promise for a Captcha object
	 */
	async decodeRecaptchaV3(options: {
		googlekey: string;
		pageurl: string;
		action?: string;
		enterprise?: boolean;
	}): Promise<Captcha> {
		const startedAt = Date.now();

		// eslint-disable-next-line -- linter
		if (!options.googlekey) this._throwError('Missing googlekey parameter');
		// eslint-disable-next-line -- linter
		if (!options.pageurl) this._throwError('Missing pageurl parameter');

		const uploadOptions: {
			method: 'userrecaptcha';
			googlekey: string;
			pageurl: string;
			version: string;
			action: string;
			enterprise: number;
		} = {
			method: 'userrecaptcha',
			googlekey: options.googlekey,
			pageurl: options.pageurl,
			version: 'v3',
			action: options.action ?? '',
			enterprise: options.enterprise ?? false ? 1 : 0,
		};

		let decodedCaptcha = await this._upload(uploadOptions);

		// Keep polling until the answer is ready
		while (decodedCaptcha.text === '') {
			await TwoCaptchaClient._sleep(Math.max(this.polling, 10000)); // Sleep at least 10 seconds
			if (Date.now() - startedAt > this.timeout) {
				this._throwError('Captcha timeout');
				return decodedCaptcha;
			}
			decodedCaptcha = await this.captcha(decodedCaptcha.id);
		}

		return decodedCaptcha;
	}

	/**
	 * Sends an hCaptcha and polls for its response
	 *
	 * @param options - Parameters for the request
	 * @returns Promise for a Captcha object
	 */
	async decodeHCaptcha(options: {
		sitekey: string;
		pageurl: string;
		invisible?: boolean;
	}): Promise<Captcha> {
		const startedAt = Date.now();

		// eslint-disable-next-line -- linter
		if (!options.sitekey) this._throwError('Missing sitekey parameter');
		// eslint-disable-next-line -- linter
		if (!options.pageurl) this._throwError('Missing pageurl parameter');

		const uploadOptions: {
			method: 'hcaptcha';
			sitekey: string;
			pageurl: string;
			invisible: number;
		} = {
			method: 'hcaptcha',
			sitekey: options.sitekey,
			pageurl: options.pageurl,
			invisible: (options.invisible ?? false) ? 1 : 0,
		};

		let decodedCaptcha = await this._upload(uploadOptions);

		// Keep polling until the answer is ready
		while (decodedCaptcha.text === '') {
			await TwoCaptchaClient._sleep(Math.max(this.polling, 10000)); // Sleep at least 10 seconds
			if (Date.now() - startedAt > this.timeout) {
				this._throwError('Captcha timeout');
				return decodedCaptcha;
			}
			decodedCaptcha = await this.captcha(decodedCaptcha.id);
		}

		return decodedCaptcha;
	}

	/**
	 * @deprecated /load.php route is returning error 500
	 * Get current load from 2Captcha service
	 *
	 * @returns Promise for a string containing current load from 2Captcha service
	 */
	async load(): Promise<string> {
		return await this._request('load', 'get');
	}

	/**
	 * Reports an incorrectly solved captcha for a refund
	 *
	 * @param captchaId - The id of the incorrectly solved captcha
	 * @param bad - If reporting an incorrectly solved captcha. Default is true.
	 * @returns Promise indicating if the report was received
	 */
	async report(captchaId: string, bad = true): Promise<boolean> {
		const res = await this._request('res', 'get', {
			action: bad ? 'reportbad' : 'reportgood',
			id: captchaId,
		});
		return res === 'OK_REPORT_RECORDED';
	}

	/**
	 * Get usage statistics from your account
	 *
	 * @param date - Date for the target day
	 * @returns Promise for a string containing statistics about the target day
	 */
	async stats(date: Date): Promise<string> {
		const res = await this._request('res', 'get', {
			action: 'getstats',
			date: date.toISOString().slice(0, 10),
		});
		return res;
	}

	/**
	 * Blocks the code for the specified amount of time
	 *
	 * @param ms - The time in milliseconds to block the code
	 * @returns Promise that resolves after ms milliseconds
	 */
	private static async _sleep(ms: number): Promise<void> {
		await new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	/**
	 * Makes an HTTP request to the 2Captcha API
	 *
	 * @param action - Path used in the 2Captcha API URL
	 * @param method - HTTP verb to be used
	 * @param payload - Body of the request
	 * @returns Promise for the response body
	 */
	private async _request(
		action: string,
		method: 'get' | 'post' | 'multipart' = 'get',
		payload: Record<string, string | number | boolean> = {}
	): Promise<string> {
		const req = await HTTPRequest.request({
			url: baseUrl.replace('<action>', action),
			timeout: this.timeout,
			method,
			payload: { ...payload, key: this.key, soft_id: 2386 },
		});

		this._validateResponse(req);

		return req;
	}

	/**
	 * Throws an Error if this.throwErrors is true. If this.throwErrors is false,
	 * a warning is logged in the console.
	 *
	 * @param message - Message of the error
	 * @returns If an error wasn't thrown, returns false.
	 */
	private _throwError(message: string): false | never {
		if (message === 'Your captcha is not solved yet.') return false;
		if (this.throwErrors) {
			throw new Error(message);
		} else {
			console.warn(message);
			return false;
		}
	}

	/**
	 * Uploads a captcha to the 2Captcha API
	 *
	 * @param options - Parameters controlling the request
	 * @returns Promise for Captcha object containing the captcha ID
	 */
	private async _upload(options: { base64?: string; buffer?: Buffer; path?: string; url?: string; method?: 'base64' | 'multipart' | 'userrecaptcha' | 'hcaptcha'; googlekey?: string; pageurl?: string; invisible?: number; enterprise?: number; sitekey?: string }): Promise<Captcha> {
		let args: Record<string, string | number | boolean> = {};
		const { base64 } = options;
		if (base64 != null && base64 !== '') args.body = base64;
		args.method = options.method ?? 'base64';

		// Merge args with any other required field
		const { buffer, ...restOptions } = options;
		args = { ...args, ...restOptions };

		// Remove unnecessary fields
		delete args.base64;
		delete args.buffer;
		delete args.path;
		delete args.url;

		const res = await this._request('in', 'post', args);

		this._validateResponse(res);

		const decodedCaptcha = new Captcha();
		const [, captchaId] = res.split('|', 2);
		decodedCaptcha.id = captchaId;

		return decodedCaptcha;
	}

	/**
	 * Loads a captcha image and converts it to base64
	 *
	 * @param options - The source of the image
	 * @returns Promise for a base64 string representation of an image
	 */
	private async _loadCaptcha(options: {
		base64?: string;
		buffer?: Buffer;
		path?: string;
		url?: string;
	}): Promise<string> {
		if (options.base64 != null && options.base64 !== '') {
			return options.base64;
		} else if (options.buffer != null) {
			return options.buffer.toString('base64');
		} else if (options.path != null && options.path !== '') {
			const fileBinary = await readFile(options.path);
			return Buffer.from(fileBinary).toString('base64');
		} else if (options.url != null && options.url !== '') {
			const image = await HTTPRequest.openDataURL(options.url);
			return Buffer.from(image).toString('base64');
		} else {
			this._throwError('No image data received');
			return '';
		}
	}

	/**
	 * Checks if the response from 2Captcha is an Error. It may throw an error if
	 * the class parameter throwErrors is true. If it is false, only a warning
	 * will be logged.
	 *
	 * @param body - Body from the 2Captcha response
	 * @returns Returns true if response is valid
	 */
	private _validateResponse(body: string): boolean {
		let message = '';
		const { errors } = constants;
		const { [body]: error } = errors;
		if (typeof error === 'string' && error !== '') {
			message = error;
		} else if (body === '' || body.toString().includes('ERROR')) {
			message = `Unknown 2Captcha error: ${body}`;
		} else {
			return true;
		}

		this._throwError(message);
		return false;
	}
}
