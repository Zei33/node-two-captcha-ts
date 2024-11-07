/**
 * Represents a captcha
 * @class
 */
export default class Captcha {
	private _id: string;
	private _text: string;
	private _apiResponse: string;

	constructor() {
		this._id = '';
		this._text = '';
		this._apiResponse = '';
	}

	/**
	 * Captcha ID, as provided from 2Captcha
	 */
	get id(): string {
		return this._id;
	}

	set id(newId: string) {
		this._id = newId;
	}

	/**
	 * Text from captcha
	 */
	get text(): string {
		return this._text;
	}

	set text(newText: string) {
		this._text = newText;
	}

	/**
	 * API response for captcha request
	 */
	get apiResponse(): string {
		return this._apiResponse;
	}

	set apiResponse(newApiResponse: string) {
		this._apiResponse = newApiResponse;
	}

	/**
	 * If the captcha sent was tile-like, this function returns the indexes of the clicks on an array.
	 *
	 * @returns An array of indexes clicked
	 */
	indexes(): number[] {
		const matches = this._text
			.replace('click:', '')
			.match(/\d+/g);
		return matches !== null ? matches.map(Number) : [];
	}

	/**
	 * If the captcha sent was an image, this function returns the coordinates (X, Y) clicked
	 *
	 * @returns An array of coordinate tuples
	 */
	coordinates(): number[][] {
		const coordinateParser = (text: string): number[] => {
			const regex = /x=([0-9]+),y=([0-9]+)/;
			const match = regex.exec(text);
			if (match !== null) {
				return [Number(match[1]), Number(match[2])];
			}
			return [];
		};

		const matches = this._text.match(/x=([0-9]+),y=([0-9]+)/g);
		return matches !== null ? matches.map(coordinateParser) : [];
	}
}
