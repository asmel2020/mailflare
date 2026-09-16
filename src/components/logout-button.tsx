"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { logoutClientSession } from "@/lib/auth/logout";

export function LogoutButton() {
	const t = useTranslations("shell");
	const router = useRouter();
	return (
		<Button
			variant="outline"
			className="w-full"
			onClick={async () => {
				await logoutClientSession();
				router.replace("/login");
				router.refresh();
			}}
		>
			{t("logOut")}
		</Button>
	);
}
