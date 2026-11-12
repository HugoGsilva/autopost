import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ProviderError } from "./http";

function isPrivateIPv4(ip: string): boolean {
	const [a = 0, b = 0] = ip.split(".").map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		a >= 224
	);
}

export function isPrivateIp(ip: string): boolean {
	if (isIP(ip) === 4) return isPrivateIPv4(ip);
	const v6 = ip.toLowerCase();
	const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mapped) return isPrivateIPv4(mapped[1]!);
	// Mesma coisa em hex, como o URL normaliza: [::ffff:127.0.0.1] → ::ffff:7f00:1
	const hex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
	if (hex) {
		const [hi, lo] = [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16)];
		return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
	}
	return (
		v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
	);
}

/**
 * Barra SSRF em URLs digitadas pelo usuário (ex.: servidor do Bluesky):
 * só https, sem credenciais/porta estranha, e o host precisa resolver para IP público.
 */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new ProviderError("Endereço inválido");
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		(url.port && url.port !== "443")
	)
		throw new ProviderError("Use um endereço https:// válido");
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host)
		? [{ address: host }]
		: await lookup(host, { all: true }).catch(() => []);
	if (!addresses.length) throw new ProviderError("Servidor não encontrado");
	if (addresses.some((a) => isPrivateIp(a.address)))
		throw new ProviderError("Servidor não permitido");
	return url;
}
