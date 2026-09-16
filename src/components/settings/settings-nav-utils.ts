import type { SettingsNavSection } from "./settings-nav-types";

/**
 * Labels are message keys resolved by `SettingsNav` against the `settingsNav`
 * namespace, not display text.
 */
export const settingsNavSections: SettingsNavSection[] = [
	{
		label: "sectionSettings",
		items: [
			{
				href: "/settings/account",
				label: "account",
			},
			{
				href: "/settings/inbox",
				label: "inbox",
			},
			{
				href: "/settings/rules",
				label: "rules",
			},
		],
	},
	{
		label: "sectionMailbox",
		items: [
			{
				href: "/settings/import",
				label: "import",
			},
			{
				href: "/settings/export",
				label: "export",
			},
		],
	},
];

export function isActiveSettingsPath(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}
