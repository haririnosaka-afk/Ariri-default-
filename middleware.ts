import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  if (!url || !anon) {
    if (path.startsWith("/login") || path.startsWith("/api/auth") || path.startsWith("/auth/callback")) return response;
    return NextResponse.redirect(new URL("/login?setup=1", request.url));
  }
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options?: any }[]) => cookiesToSet.forEach(({ name, value, options }) => {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }),
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !path.startsWith("/login") && !path.startsWith("/api/auth") && !path.startsWith("/auth/callback")) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }
  if (user && path === "/login") return NextResponse.redirect(new URL("/", request.url));
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
