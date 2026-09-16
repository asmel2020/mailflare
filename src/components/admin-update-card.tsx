"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApplicationUpdateStatus, triggerApplicationUpdate } from "./admin-update-card-utils";
import type { UpdateStatusResponse, UpdateWorkflowResponse } from "./admin-update-card-types";

export function AdminUpdateCard() {
	const t = useTranslations("adminUpdate");
	const [status, setStatus] = useState<UpdateStatusResponse>();
	const [result, setResult] = useState<UpdateWorkflowResponse>();
	const [error, setError] = useState("");
	const [isChecking, setIsChecking] = useState(true);
	const [isPending, setIsPending] = useState(false);

	useEffect(() => {
		let isActive = true;

		getApplicationUpdateStatus()
			.then((updateStatus) => {
				if (isActive) setStatus(updateStatus);
			})
			.catch((statusError) => {
				if (isActive) {
					setError(statusError instanceof Error ? statusError.message : t("couldNotCheckForUpdates"));
				}
			})
			.finally(() => {
				if (isActive) setIsChecking(false);
			});

		return () => {
			isActive = false;
		};
	}, [t]);

	async function handleUpdate() {
		setError("");
		setResult(undefined);
		setIsPending(true);

		try {
			setResult(await triggerApplicationUpdate());
		} catch (updateError) {
			setError(updateError instanceof Error ? updateError.message : t("couldNotStartUpdate"));
		} finally {
			setIsPending(false);
		}
	}

	return (
		<Card className="rounded-3xl border-0 bg-white p-6">
			<CardHeader className="flex-row items-center gap-4 space-y-0 py-0">
				<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
					<RefreshCw className="h-5 w-5" />
				</div>
				<div>
					<CardTitle className="text-base">{t("title")}</CardTitle>
					<p className="mt-1 text-sm text-neutral-500">
						{t("description")}
					</p>
				</div>
			</CardHeader>
			<CardContent className="flex items-center gap-4 pt-5">
				<Button type="button" onClick={handleUpdate} disabled={isChecking || isPending || !status?.available}>
					<RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
					{isPending ? t("startingUpdate") : t("updateButton")}
				</Button>
				{isChecking && <Skeleton className="h-4 w-44" />}
				{!isChecking && status?.available && (
					<p className="text-sm text-amber-700">
						{t("updateAvailable", { currentVersion: status.currentVersion ?? "", targetVersion: status.targetVersion ?? "" })}
					</p>
				)}
				{!isChecking && status && !status.available && (
					<p className="text-sm text-green-700">{t("upToDate", { version: status.currentVersion ?? "" })}</p>
				)}
				{result?.ok && (
					<p className="text-sm text-green-700">
						{t("updateStarted", { repository: result.repository ?? "", ref: result.ref ?? "" })}{" "}
						{result.runUrl && (
							<a className="font-medium underline" href={result.runUrl} target="_blank" rel="noreferrer">
								{t("viewWorkflow")}
							</a>
						)}
					</p>
				)}
				{error && <p className="text-sm text-red-600">{error}</p>}
			</CardContent>
		</Card>
	);
}
