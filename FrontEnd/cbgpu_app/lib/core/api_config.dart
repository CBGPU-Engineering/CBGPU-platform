/// Base URL for the Next.js app's /api/* routes. Several web features (meal,
/// timetable, school news, the eduset proxy) are server-side work — HTML
/// scraping, third-party calls with server secrets — that can't just be
/// re-run from a Flutter client. Rather than duplicating that logic in Dart,
/// the Flutter app calls the same live API routes the web app already calls,
/// same as any other backend. Only the pages became a landing page; the API
/// routes stay as the shared backend regardless of which client calls them.
class ApiConfig {
  static const baseUrl = 'https://cbgpu.vercel.app';
}
