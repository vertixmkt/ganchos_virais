export const config = {
  matcher: ['/content-hooks-data.js'],
};

export default function middleware(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const hasAuth = /tg_auth=[^;]+/.test(cookieHeader);
  if (!hasAuth) {
    const origin = new URL(request.url).origin;
    return Response.redirect(origin + '/', 302);
  }
}
