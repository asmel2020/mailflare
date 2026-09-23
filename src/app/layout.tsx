import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("common");
	return {
		title: t("appName"),
		description: t("appDescription"),
		icons: {
			icon: "/api/branding/icon",
			apple: "/apple-touch-icon.png",
		},
		manifest: "/manifest.webmanifest",
		appleWebApp: {
			capable: true,
			statusBarStyle: "default",
			title: t("appName"),
		},
	};
}

export function generateViewport(): Viewport {
	return {
		themeColor: "#2563eb",
		width: "device-width",
		initialScale: 1,
	};
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html lang={locale}>
			<head>
				<link rel="icon" href="/api/branding/icon"></link>
				<script
					dangerouslySetInnerHTML={{
						__html:
							'(function(){window.__mailflareInstallPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__mailflareInstallPrompt=e;window.dispatchEvent(new Event("mailflare:install-available"))});window.addEventListener("appinstalled",function(){window.__mailflareInstallPrompt=null;window.dispatchEvent(new Event("mailflare:install-available"))})})();',
					}}
				/>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased light`}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					<Providers>{children}</Providers>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
