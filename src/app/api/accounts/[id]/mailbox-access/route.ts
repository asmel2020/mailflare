import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export async function GET() {
	const t = await getTranslations("errors");
	return NextResponse.json({ error: t("multipleAccountsUnavailable") }, { status: 410 });
}

export async function POST() {
	const t = await getTranslations("errors");
	return NextResponse.json({ error: t("multipleAccountsUnavailable") }, { status: 410 });
}

export async function DELETE() {
	const t = await getTranslations("errors");
	return NextResponse.json({ error: t("multipleAccountsUnavailable") }, { status: 410 });
}
