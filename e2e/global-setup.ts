import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

export const SAMPLE_VIDEO = path.join(
	import.meta.dirname,
	".fixtures",
	"sample.webm",
);

/** Gera um vídeo WebM real (canvas + MediaRecorder) para os testes de upload. */
export default async function globalSetup() {
	if (existsSync(SAMPLE_VIDEO)) return;
	mkdirSync(path.dirname(SAMPLE_VIDEO), { recursive: true });
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const base64 = await page.evaluate(async () => {
		const canvas = document.createElement("canvas");
		canvas.width = 360;
		canvas.height = 640;
		const ctx = canvas.getContext("2d")!;
		const stream = canvas.captureStream(24);
		const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
		const chunks: Blob[] = [];
		rec.ondataavailable = (e) => chunks.push(e.data);
		let frame = 0;
		const timer = setInterval(() => {
			ctx.fillStyle = "#0d0a06";
			ctx.fillRect(0, 0, 360, 640);
			ctx.fillStyle = "#d4a82e";
			ctx.beginPath();
			ctx.arc(180, 320, 40 + (frame++ % 40), 0, Math.PI * 2);
			ctx.fill();
		}, 40);
		rec.start(200);
		await new Promise((r) => setTimeout(r, 1600));
		rec.stop();
		await new Promise((r) => (rec.onstop = r));
		clearInterval(timer);
		const buf = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
		let bin = "";
		for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
		return btoa(bin);
	});
	writeFileSync(SAMPLE_VIDEO, Buffer.from(base64, "base64"));
	await browser.close();
}
