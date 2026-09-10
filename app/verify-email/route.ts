const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function resultPage(status: number, title: string, message: string) {
    return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f7f9fc;color:#111827;font-family:system-ui,sans-serif"><main style="max-width:520px;margin:12vh auto;padding:32px;text-align:center"><h1>${title}</h1><p style="line-height:1.6;color:#4b5563">${message}</p></main></body></html>`,
        {
            status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
                "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
                "Referrer-Policy": "no-referrer",
                "X-Content-Type-Options": "nosniff",
            },
        },
    );
}

export async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!TOKEN_PATTERN.test(token)) {
        return resultPage(400, "Invalid verification link", "This email verification link is not valid.");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        return resultPage(503, "Verification unavailable", "Please return to ParPlay and try again later.");
    }

    const upstreamUrl = new URL("/functions/v1/verify-email", supabaseUrl);
    upstreamUrl.searchParams.set("token", token);

    try {
        const upstream = await fetch(upstreamUrl, {
            method: "GET",
            cache: "no-store",
            redirect: "manual",
        });
        const contentType = upstream.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("text/html")) {
            return resultPage(502, "Verification unavailable", "Please return to ParPlay and try again later.");
        }

        return new Response(await upstream.text(), {
            status: upstream.status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
                "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
                "Referrer-Policy": "no-referrer",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return resultPage(502, "Verification unavailable", "Please return to ParPlay and try again later.");
    }
}
