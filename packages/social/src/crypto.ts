import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

import { encryptionSecret } from "./env";

function key(): Buffer {
	return createHash("sha256").update(`autopost:${encryptionSecret()}`).digest();
}

/** AES-256-GCM → "v1.iv.tag.ciphertext" (base64url). */
export function encrypt(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return ["v1", iv, cipher.getAuthTag(), data]
		.map((p) => (typeof p === "string" ? p : p.toString("base64url")))
		.join(".");
}

export function decrypt(payload: string): string {
	const [version, iv, tag, data] = payload.split(".");
	if (version !== "v1" || !iv || !tag || !data)
		throw new Error("Formato de dado criptografado inválido");
	const decipher = createDecipheriv(
		"aes-256-gcm",
		key(),
		Buffer.from(iv, "base64url"),
	);
	decipher.setAuthTag(Buffer.from(tag, "base64url"));
	return Buffer.concat([
		decipher.update(Buffer.from(data, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

export function encryptJson(value: unknown): string {
	return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
	return JSON.parse(decrypt(payload)) as T;
}

export function randomToken(bytes = 24): string {
	return randomBytes(bytes).toString("base64url");
}

export function pkcePair() {
	const verifier = randomToken(48);
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}
