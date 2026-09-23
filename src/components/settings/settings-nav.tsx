"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isActiveSettingsPath, settingsNavSections } from "./settings-nav-utils";

export function SettingsNav() {
	const pathname = usePathname();
	const t = useTranslations("settingsNav");

	return (
		<aside className="w-full shrink-0 border-b border-blue-100/70 py-4 lg:min-h-full lg:w-64 lg:border-b-0 lg:border-r lg:px-4 lg:py-10">
			<div className="flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-6 lg:block lg:space-y-7 lg:overflow-visible lg:px-0 lg:pb-0">
				{settingsNavSections.map((section) => (
					<div key={section.label} className="flex shrink-0 gap-2 lg:block lg:space-y-3">
						<h2 className="hidden px-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 lg:block">
							{t(section.label)}
						</h2>
						<nav className="flex gap-2 lg:block lg:space-y-px">
							{section.items.map((item) => {
								const active = isActiveSettingsPath(pathname, item.href);
								return (
									<Link
										key={item.href}
										href={item.href}
										className={cn(
											"block whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
											active
												? "bg-blue-100 text-blue-900"
												: "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
										)}
									>
										{t(item.label)}
									</Link>
								);
							})}
						</nav>
					</div>
				))}
			</div>
		</aside>
	);
}
