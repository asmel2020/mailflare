import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { licenseSettings } from "@/db/schema";

// Local fork override: this installation does not use the hosted license
// service, so Team mailbox sharing stays enabled. Revert by setting this
// back to false.
const TEAM_SHARING_UNLOCKED = true;

export async function isTeamMailboxSharingEnabled(db: AppDatabase): Promise<boolean> {
	if (TEAM_SHARING_UNLOCKED) return true;

	try {
		const [license] = await db
			.select({ plan: licenseSettings.plan, state: licenseSettings.state })
			.from(licenseSettings)
			.where(eq(licenseSettings.id, "default"))
			.limit(1);

		return license?.plan === "team" && license.state === "active";
	} catch {
		return false;
	}
}
