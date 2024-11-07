import globals from "globals";
import standard from "eslint-config-love";

export default [
	{
		...standard,
		files: ["**/*.{js,mjs,cjs,ts}"],
		ignores: ["**/dist/**", "eslint.config.js"],
		languageOptions: {
			...standard.languageOptions,
			parserOptions: {
				...standard.languageOptions?.parserOptions,
			},
			globals: {
				...globals.node,
				...standard.languageOptions?.globals,
			},
		},
		rules: {
			...standard.rules,
			"@typescript-eslint/no-magic-numbers": "off",
			"no-magic-numbers": "off",
			"no-mixed-spaces-and-tabs": "warn",
			"@typescript-eslint/ban-ts-comment": "off",
			"ban-ts-comment": "off",
			"indent": ["error", "tab"]
		}
	}
];