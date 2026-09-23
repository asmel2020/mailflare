"use client";

let originalTitle: string | null = null;
let faviconLink: HTMLLinkElement | null = null;
let badgeCanvas: HTMLCanvasElement | null = null;
let defaultHref: string | null = null;

function ensureFaviconLink(): HTMLLinkElement | null {
	if (faviconLink && faviconLink.isConnected) return faviconLink;
	const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
	if (existing) {
		faviconLink = existing;
		if (defaultHref === null) defaultHref = existing.href;
		return existing;
	}
	const link = document.createElement("link");
	link.rel = "icon";
	link.type = "image/png";
	document.head.appendChild(link);
	faviconLink = link;
	return link;
}

function drawBadge(count: number): string {
	if (!badgeCanvas) badgeCanvas = document.createElement("canvas");
	const size = 64;
	badgeCanvas.width = size;
	badgeCanvas.height = size;
	const ctx = badgeCanvas.getContext("2d");
	if (!ctx) return "";

	ctx.clearRect(0, 0, size, size);
	ctx.fillStyle = "#2563eb";
	ctx.beginPath();
	ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
	ctx.fill();

	const label = count > 99 ? "99+" : String(count);
	ctx.fillStyle = "#ffffff";
	ctx.font = `bold ${count > 99 ? 22 : 28}px system-ui, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(label, size / 2, size / 2 + 1);
	return badgeCanvas.toDataURL("image/png");
}

export function setUnreadBadge(unread: number): void {
	if (typeof document === "undefined") return;
	const safe = Math.max(0, Math.floor(unread || 0));

	if (originalTitle === null) originalTitle = document.title;
	document.title = safe > 0 ? `(${safe}) ${originalTitle}` : originalTitle;

	const link = ensureFaviconLink();
	if (!link) return;

	if (safe === 0) {
		if (defaultHref) link.href = defaultHref;
		return;
	}
	link.href = drawBadge(safe);
}

export function clearUnreadBadge(): void {
	setUnreadBadge(0);
}
