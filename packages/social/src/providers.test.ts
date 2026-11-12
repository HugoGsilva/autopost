import { afterEach, beforeAll, describe, expect, test } from "bun:test";

process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.APP_URL = "http://localhost:3001";

import { decrypt, decryptJson, encrypt, encryptJson, pkcePair } from "./crypto";
import { escapeLinkedIn } from "./providers/linkedin";
import { bskyFacets } from "./providers/manual";
import { tiktokChunks } from "./providers/tiktok";
import { providers } from "./registry";
import { mockFetch, publishInput, tempVideo } from "./test-utils";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe("crypto", () => {
	test("roundtrip e IV aleatório", () => {
		const a = encrypt("segredo");
		expect(a).not.toBe(encrypt("segredo"));
		expect(decrypt(a)).toBe("segredo");
		expect(decryptJson<{ x: number }>(encryptJson({ x: 1 }))).toEqual({ x: 1 });
	});
	test("detecta adulteração", () => {
		const parts = encrypt("segredo").split(".");
		parts[3] = Buffer.from("outra coisa").toString("base64url");
		expect(() => decrypt(parts.join("."))).toThrow();
	});
	test("pkce S256", () => {
		const { verifier, challenge } = pkcePair();
		expect(verifier.length).toBeGreaterThan(43);
		expect(challenge).not.toContain("=");
	});
});

describe("regras auxiliares", () => {
	test("chunks do TikTok", () => {
		const MB = 1024 * 1024;
		expect(tiktokChunks(3 * MB)).toEqual({ chunkSize: 3 * MB, count: 1 });
		expect(tiktokChunks(64 * MB)).toEqual({ chunkSize: 64 * MB, count: 1 });
		const big = tiktokChunks(105 * MB);
		expect(big.count).toBe(10);
		// último chunk absorve o resto e fica ≤ 128MB
		expect(105 * MB - big.chunkSize * (big.count - 1)).toBeLessThanOrEqual(
			128 * MB,
		);
	});
	test("facets do Bluesky em bytes UTF-8", () => {
		const text = "Ação #lançamento https://ia2s.com.br";
		const facets = bskyFacets(text) as {
			index: { byteStart: number; byteEnd: number };
			features: { tag?: string; uri?: string }[];
		}[];
		const bytes = new TextEncoder().encode(text);
		const slice = (f: (typeof facets)[number]) =>
			new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd));
		expect(facets.map(slice).sort()).toEqual(
			["#lançamento", "https://ia2s.com.br"].sort(),
		);
		expect(facets.find((f) => f.features[0]?.tag)?.features[0]?.tag).toBe(
			"lançamento",
		);
	});
	test("escape do LinkedIn", () => {
		expect(escapeLinkedIn("Oi (teste) #tag")).toBe("Oi \\(teste\\) \\#tag");
	});
	test("todas as plataformas têm metadados mínimos", () => {
		for (const p of Object.values(providers)) {
			expect(p.captionLimit).toBeGreaterThan(0);
			if (p.auth === "oauth") {
				expect(p.getAuthUrl).toBeDefined();
				expect(p.exchangeCode).toBeDefined();
				expect(p.setup?.steps.length).toBeGreaterThan(0);
			} else expect(p.connectManual).toBeDefined();
		}
	});
});

describe("URLs de autorização", () => {
	const ctx = {
		clientId: "cid",
		clientSecret: "s",
		redirectUri: "https://cast.x/cb",
		state: "st",
		codeChallenge: "ch",
	};
	test.each(
		Object.values(providers)
			.filter((p) => p.getAuthUrl)
			.map((p) => [p.id, p] as const),
	)("%s", (_id, p) => {
		const url = new URL(p.getAuthUrl!(ctx));
		expect(url.protocol).toBe("https:");
		expect(url.searchParams.get("state")).toBe("st");
		expect(url.searchParams.get("redirect_uri")).toBe("https://cast.x/cb");
		expect(
			url.searchParams.get("client_id") ?? url.searchParams.get("client_key"),
		).toBe("cid");
	});
	test("X usa PKCE", () => {
		const url = new URL(providers.x.getAuthUrl!(ctx));
		expect(url.searchParams.get("code_challenge")).toBe("ch");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
	});
});

describe("publicação (fetch simulado)", () => {
	let media: ReturnType<typeof tempVideo>;
	beforeAll(() => {
		media = tempVideo();
	});

	test("Instagram: container com video_url → status → publish", async () => {
		const m = mockFetch([
			[
				"POST https://graph.instagram.com/v24.0/acc-1/media_publish",
				() => ({ id: "post-9" }),
			],
			[
				"POST https://graph.instagram.com/v24.0/acc-1/media",
				() => ({ id: "c-1" }),
			],
			[
				"GET https://graph.instagram.com/v24.0/c-1",
				() => ({ status_code: "FINISHED" }),
			],
			[
				"GET https://graph.instagram.com/v24.0/post-9",
				() => ({ permalink: "https://instagram.com/reel/abc" }),
			],
		]);
		restore = m.restore;
		const res = await providers.instagram.publish(publishInput({ media }));
		expect(res).toEqual({
			externalId: "post-9",
			url: "https://instagram.com/reel/abc",
		});
		const create = m.calls[0]!;
		expect((create.body as Record<string, string>).media_type).toBe("REELS");
		expect((create.body as Record<string, string>).video_url).toBe(
			media.publicUrl,
		);
		expect(m.calls.some((c) => c.url.includes("rupload"))).toBe(false);
	});

	test("YouTube: sessão resumable + PUT, título da 1ª linha e Short vertical", async () => {
		const m = mockFetch([
			[
				"POST https://www.googleapis.com/upload/youtube/v3/videos",
				() =>
					new Response("{}", {
						status: 200,
						headers: { location: "https://upload.example/session-1" },
					}),
			],
			["PUT https://upload.example/session-1", () => ({ id: "vid123" })],
		]);
		restore = m.restore;
		const res = await providers.youtube.publish(
			publishInput({
				media,
				caption: "Título bom\nresto",
				options: { privacy: "unlisted" },
			}),
		);
		expect(res.url).toBe("https://www.youtube.com/shorts/vid123");
		const meta = m.calls[0]!.body as {
			snippet: { title: string };
			status: { privacyStatus: string };
		};
		expect(meta.snippet.title).toBe("Título bom");
		expect(meta.status.privacyStatus).toBe("unlisted");
		expect(m.calls[0]!.headers.get("x-upload-content-length")).toBe(
			String(media.size),
		);
	});

	test("TikTok: envia exatamente as opções que o usuário escolheu", async () => {
		const m = mockFetch([
			[
				"POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
				() => ({
					data: {
						privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
						duet_disabled: true,
					},
					error: { code: "ok" },
				}),
			],
			[
				"POST https://open.tiktokapis.com/v2/post/publish/video/init/",
				() => ({
					data: { publish_id: "p-1", upload_url: "https://upload.tiktok/u1" },
					error: { code: "ok" },
				}),
			],
			["PUT https://upload.tiktok/u1", () => ({})],
			[
				"POST https://open.tiktokapis.com/v2/post/publish/status/fetch/",
				() => ({
					data: {
						status: "PUBLISH_COMPLETE",
						publicaly_available_post_id: [777],
					},
					error: { code: "ok" },
				}),
			],
		]);
		restore = m.restore;
		const logs: string[] = [];
		const res = await providers.tiktok.publish(
			publishInput({
				media,
				log: (l) => logs.push(l),
				options: {
					privacy: "PUBLIC_TO_EVERYONE",
					allowComment: "true",
					allowDuet: "true",
					commercial: "true",
					brandOrganic: "true",
				},
			}),
		);
		expect(res.externalId).toBe("777");
		const init = m.calls[1]!.body as {
			post_info: Record<string, unknown>;
			source_info: { video_size: number; total_chunk_count: number };
		};
		expect(init.post_info).toMatchObject({
			privacy_level: "PUBLIC_TO_EVERYONE",
			disable_comment: false,
			// o criador desligou o Duet na conta: vale o que está no TikTok
			disable_duet: true,
			disable_stitch: true,
			brand_organic_toggle: true,
			brand_content_toggle: false,
		});
		expect(init.source_info).toMatchObject({
			video_size: media.size,
			total_chunk_count: 1,
		});
		expect(m.calls[2]!.headers.get("content-range")).toBe(
			`bytes 0-${media.size - 1}/${media.size}`,
		);
		expect(logs.some((l) => l.includes("PUBLIC_TO_EVERYONE"))).toBe(true);
	});

	test("TikTok: sem privacidade escolhida não publica nem troca sozinho", async () => {
		const creator = (options: string[]) =>
			mockFetch([
				[
					"POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
					() => ({
						data: { privacy_level_options: options },
						error: { code: "ok" },
					}),
				],
			]);
		let m = creator(["SELF_ONLY"]);
		restore = m.restore;
		await expect(
			providers.tiktok.publish(publishInput({ media })),
		).rejects.toThrow(/Escolha quem pode ver/);
		expect(m.calls).toHaveLength(1);
		m.restore();

		m = creator(["SELF_ONLY"]);
		restore = m.restore;
		await expect(
			providers.tiktok.publish(
				publishInput({ media, options: { privacy: "PUBLIC_TO_EVERYONE" } }),
			),
		).rejects.toThrow(/não está disponível/);
		expect(m.calls).toHaveLength(1);
	});

	test("TikTok: conteúdo de marca exige rótulo e não pode ser privado", async () => {
		const { tiktokPostProblems } = await import("./tiktok-rules");
		expect(
			tiktokPostProblems({ privacy: "PUBLIC_TO_EVERYONE", commercial: "true" }),
		).toEqual([
			"Indique se o conteúdo promove você, uma marca de terceiros ou os dois",
		]);
		expect(
			tiktokPostProblems({
				privacy: "SELF_ONLY",
				commercial: "true",
				brandContent: "true",
			}),
		).toEqual(["Conteúdo de marca não pode ser publicado como “Só eu”"]);
		expect(tiktokPostProblems({ mode: "inbox" })).toEqual([]);
		expect(
			tiktokPostProblems(
				{ privacy: "SELF_ONLY" },
				{ privacyOptions: ["SELF_ONLY"], maxDurationSec: 60 },
				90,
			),
		).toEqual(["Esta conta do TikTok aceita vídeos de até 1 min"]);
	});

	test("TikTok: erro da API vira ProviderError legível", async () => {
		const m = mockFetch([
			[
				"POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
				() =>
					new Response(
						JSON.stringify({
							error: {
								code: "access_token_invalid",
								message: "token expirado",
							},
						}),
						{ status: 401 },
					),
			],
		]);
		restore = m.restore;
		await expect(
			providers.tiktok.publish(publishInput({ media })),
		).rejects.toThrow(/access_token_invalid/);
	});

	test("LinkedIn: initialize → PUT partes (ETag) → finalize → post", async () => {
		const m = mockFetch([
			[
				"POST https://api.linkedin.com/rest/videos?action=initializeUpload",
				() => ({
					value: {
						video: "urn:li:video:V1",
						uploadToken: "",
						uploadInstructions: [
							{
								uploadUrl: "https://up.linkedin/p1",
								firstByte: 0,
								lastByte: media.size - 1,
							},
						],
					},
				}),
			],
			[
				"PUT https://up.linkedin/p1",
				() => new Response("", { status: 200, headers: { etag: "etag-1" } }),
			],
			[
				"POST https://api.linkedin.com/rest/videos?action=finalizeUpload",
				() => ({}),
			],
			[
				"GET https://api.linkedin.com/rest/videos/",
				() => ({ status: "AVAILABLE" }),
			],
			[
				"POST https://api.linkedin.com/rest/posts",
				() =>
					new Response("", {
						status: 201,
						headers: { "x-restli-id": "urn:li:share:9" },
					}),
			],
		]);
		restore = m.restore;
		const res = await providers.linkedin.publish(publishInput({ media }));
		expect(res.externalId).toBe("urn:li:share:9");
		const fin = m.calls[2]!.body as {
			finalizeUploadRequest: { uploadedPartIds: string[] };
		};
		expect(fin.finalizeUploadRequest.uploadedPartIds).toEqual(["etag-1"]);
		expect(m.calls[0]!.headers.get("linkedin-version")).toMatch(/^\d{6}$/);
	});

	test("X: initialize → append → finalize → tweet", async () => {
		const m = mockFetch([
			[
				"POST https://api.x.com/2/media/upload/initialize",
				() => ({ data: { id: "m1" } }),
			],
			["POST https://api.x.com/2/media/upload/m1/append", () => ({})],
			[
				"POST https://api.x.com/2/media/upload/m1/finalize",
				() => ({ data: { id: "m1" } }),
			],
			["POST https://api.x.com/2/tweets", () => ({ data: { id: "t1" } })],
		]);
		restore = m.restore;
		const res = await providers.x.publish(publishInput({ media }));
		expect(res.url).toBe("https://x.com/conta/status/t1");
		expect(
			(m.calls[3]!.body as { media: { media_ids: string[] } }).media.media_ids,
		).toEqual(["m1"]);
	});

	test("Bluesky: sessão → uploadBlob → createRecord com embed de vídeo", async () => {
		const m = mockFetch([
			[
				"POST https://bsky.social/xrpc/com.atproto.server.createSession",
				() => ({
					accessJwt: "jwt",
					did: "did:plc:1",
					handle: "ia2s.bsky.social",
				}),
			],
			[
				"POST https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
				() => ({ blob: { $type: "blob", ref: { $link: "b" } } }),
			],
			[
				"POST https://bsky.social/xrpc/com.atproto.repo.createRecord",
				() => ({ uri: "at://did:plc:1/app.bsky.feed.post/3abc" }),
			],
		]);
		restore = m.restore;
		const res = await providers.bluesky.publish(
			publishInput({
				media,
				account: {
					externalId: "did:plc:1",
					name: "IA2S",
					username: null,
					credentials: { identifier: "a", password: "b" },
					meta: {},
				},
			}),
		);
		expect(res.url).toBe("https://bsky.app/profile/ia2s.bsky.social/post/3abc");
		const record = (
			m.calls[2]!.body as { record: { embed: { $type: string } } }
		).record;
		expect(record.embed.$type).toBe("app.bsky.embed.video");
		expect(m.calls.every((c) => c.redirect === "manual")).toBe(true);
	});

	test("Bluesky: não segue redirecionamento nem expõe o corpo da resposta", async () => {
		const m = mockFetch([
			[
				"POST https://bsky.social/xrpc/com.atproto.server.createSession",
				() =>
					new Response("dado interno", {
						status: 302,
						headers: { location: "http://10.0.0.1/" },
					}),
			],
		]);
		restore = m.restore;
		const err = await providers
			.bluesky.connectManual!({ identifier: "a", password: "b" })
			.catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).not.toContain("dado interno");
		expect(m.calls).toHaveLength(1);
		expect(m.calls[0]!.redirect).toBe("manual");
	});

	test("Telegram: sendVideo com link público do canal", async () => {
		const m = mockFetch([
			[
				"POST https://api.telegram.org/botT/sendVideo",
				() => ({ ok: true, result: { message_id: 42 } }),
			],
		]);
		restore = m.restore;
		const res = await providers.telegram.publish(
			publishInput({
				media,
				account: {
					externalId: "-100",
					name: "Canal",
					username: "ia2s",
					credentials: { botToken: "T" },
					meta: {},
				},
			}),
		);
		expect(res).toEqual({ externalId: "42", url: "https://t.me/ia2s/42" });
	});

	test("Demo: #falha simula erro", async () => {
		const input = publishInput({
			media,
			caption: "teste #falha",
			account: {
				externalId: "d",
				name: "D",
				username: null,
				credentials: { delayMs: 1 },
				meta: {},
			},
		});
		await expect(providers.demo.publish(input)).rejects.toThrow(/simulada/);
	});
});

describe("segurança e mensagens", () => {
	test("bloqueia IPs internos (SSRF)", async () => {
		const { isPrivateIp, assertPublicHttpsUrl } = await import("./safe-url");
		for (const ip of [
			"127.0.0.1",
			"10.1.2.3",
			"172.20.0.1",
			"192.168.0.10",
			"169.254.169.254",
			"::1",
			"fd00::1",
			"::ffff:10.0.0.1",
			"100.64.0.1",
		])
			expect(isPrivateIp(ip)).toBe(true);
		for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"])
			expect(isPrivateIp(ip)).toBe(false);
		await expect(assertPublicHttpsUrl("http://bsky.social")).rejects.toThrow(
			/https/,
		);
		await expect(
			assertPublicHttpsUrl("https://user:pw@bsky.social"),
		).rejects.toThrow(/https/);
		await expect(assertPublicHttpsUrl("https://10.0.0.1")).rejects.toThrow(
			/não permitido/,
		);
		await expect(assertPublicHttpsUrl("https://[::1]")).rejects.toThrow(
			/não permitido/,
		);
	});

	test("erros técnicos viram mensagem simples com ação", async () => {
		const { humanizeError } = await import("./errors");
		expect(
			humanizeError("401: Error validating access token: Session has expired")
				?.action,
		).toBe("reconnect");
		expect(
			humanizeError("TikTok falhou: file_format_check_failed")?.action,
		).toBe("replace-video");
		expect(humanizeError("429: Too Many Requests")?.message).toMatch(/limitou/);
		expect(humanizeError("Falha de rede: fetch failed")?.action).toBe("retry");
		expect(
			humanizeError("403: unaudited_client_can_only_post_to_private_accounts")
				?.message,
		).toMatch(/privadas/);
		const unknown = humanizeError("algo estranho");
		expect(unknown?.detail).toBe("algo estranho");
		expect(humanizeError(null)).toBeNull();
	});

	test("todas as redes declaram formatos aceitos; Instagram e Threads exigem URL pública", () => {
		for (const p of Object.values(providers))
			expect(p.acceptedTypes.length).toBeGreaterThan(0);
		expect(providers.instagram.acceptedTypes).not.toContain("video/webm");
		expect(providers.instagram.requiresPublicUrl).toBe(true);
		expect(providers.threads.requiresPublicUrl).toBe(true);
	});

	test("TikTok avisa quando publica como privado", async () => {
		const media = tempVideo();
		const m = mockFetch([
			[
				"POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
				() => ({
					data: { privacy_level_options: ["SELF_ONLY"] },
					error: { code: "ok" },
				}),
			],
			[
				"POST https://open.tiktokapis.com/v2/post/publish/video/init/",
				() => ({
					data: { publish_id: "p", upload_url: "https://u.tiktok/x" },
					error: { code: "ok" },
				}),
			],
			["PUT https://u.tiktok/x", () => ({})],
			[
				"POST https://open.tiktokapis.com/v2/post/publish/status/fetch/",
				() => ({ data: { status: "PUBLISH_COMPLETE" }, error: { code: "ok" } }),
			],
		]);
		restore = m.restore;
		const res = await providers.tiktok.publish(
			publishInput({ media, options: { privacy: "SELF_ONLY" } }),
		);
		expect(res.note).toMatch(/Só eu/);
	});
});

describe("upload", () => {
	test("reconhece vídeo pela assinatura do arquivo", async () => {
		const { looksLikeVideo } = await import("./media");
		const { writeFileSync, mkdtempSync } = await import("node:fs");
		const { tmpdir } = await import("node:os");
		const path = await import("node:path");
		const dir = mkdtempSync(path.join(tmpdir(), "sig-"));
		const mp4 = path.join(dir, "a.mp4");
		writeFileSync(
			mp4,
			Buffer.from([
				0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
			]),
		);
		const webm = path.join(dir, "a.webm");
		writeFileSync(
			webm,
			Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]),
		);
		const html = path.join(dir, "a.html");
		writeFileSync(html, "<script>alert(1)</script>");
		expect(await looksLikeVideo(mp4, "video/mp4")).toBe(true);
		expect(await looksLikeVideo(webm, "video/webm")).toBe(true);
		expect(await looksLikeVideo(html, "video/mp4")).toBe(false);
		expect(await looksLikeVideo(mp4, "video/webm")).toBe(false);
	});
});
