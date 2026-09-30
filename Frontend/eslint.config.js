import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["dist"] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			"react-refresh/only-export-components": [
				"warn",
				{ allowConstantExport: true },
			],
			"@typescript-eslint/no-unused-vars": "off",
		},
	},
	// Module boundaries: lib <- contexts <- components <- pages. See ARCHITECTURE.md.
	{
		files: ["src/lib/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: [
								"@/contexts/*",
								"@/components/*",
								"@/components",
								"@/pages/*",
							],
							message:
								"lib is the lowest layer and must stay free of React state and UI.",
						},
					],
				},
			],
		},
	},
	{
		files: ["src/contexts/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@/components/*", "@/components", "@/pages/*"],
							message: "Contexts hold state only; they must not import UI.",
						},
					],
				},
			],
		},
	},
	{
		files: ["src/components/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@/pages/*"],
							message:
								"Components are shared; pages compose them, not the reverse.",
						},
					],
				},
			],
		},
	},
);
