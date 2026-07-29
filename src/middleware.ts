import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';

const PUBLIC_PATHS = ['/login', '/login-failed', '/logged-out', '/unauthorized'];

function isExpired(token: string): boolean {
	try {
		const { exp } = decodeJwt(token);
		if (!exp) return true;
		return exp * 1000 <= Date.now();
	} catch {
		return true;
	}
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		return NextResponse.next();
	}

	const token = request.cookies.get('token')?.value;
	if (!token || isExpired(token)) {
		const response = NextResponse.redirect(new URL('/login', request.url));
		if (token) response.cookies.delete('token');
		return response;
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
