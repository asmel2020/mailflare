import { useTranslations } from "next-intl";
import type { SpamScoreDetailsProps } from "./spam-score-details-types";
import { parseSpamSignals } from "./spam-score-details-utils";

export function SpamScoreDetails({ score, verdict, signals, analysisError }: SpamScoreDetailsProps) {
	const t = useTranslations("spam");
	if (score == null && !analysisError) return null;
	const parsedSignals = parseSpamSignals(signals);
	const verdictLabel = verdict === "spam"
		? t("verdictSpam")
		: verdict === "suspicious"
			? t("verdictSuspicious")
			: t("verdictInbox");
	return (
		<details className="mx-6 mb-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
			<summary className="cursor-pointer text-sm font-medium text-neutral-800">
				{score == null ? t("unavailable") : t("score", { score, verdict: verdictLabel })}
			</summary>
			{analysisError ? (
				<p className="mt-2 text-sm text-neutral-600">{t("analysisFailed")}</p>
			) : parsedSignals.length > 0 ? (
				<div className="mt-3 space-y-1.5 text-sm text-neutral-600">
					<p className="font-medium text-neutral-800">{t("whyThisScore")}</p>
					{parsedSignals.map((signal) => (
						<p key={signal.id}><span className={signal.score > 0 ? "text-red-600" : "text-green-700"}>{signal.score > 0 ? "+" : ""}{signal.score}</span>{" "}{signal.reason}</p>
					))}
				</div>
			) : (
				<p className="mt-2 text-sm text-neutral-600">{t("noSignals")}</p>
			)}
		</details>
	);
}
