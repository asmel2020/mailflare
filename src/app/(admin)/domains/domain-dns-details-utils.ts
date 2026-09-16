import type { DnsRecord } from "./types";

export type DnsRecordLabels = {
	domain: string;
	priority: (value: number) => string;
};

export function getDnsRecordLabel(record: DnsRecord, labels: DnsRecordLabels): string {
	const recordName = record.name || labels.domain;
	const destination = record.content ? ` → ${record.content}` : "";
	const priority = record.priority === undefined ? "" : ` ${labels.priority(record.priority)}`;
	return `${record.type || "DNS"} · ${recordName}${destination}${priority}`;
}
