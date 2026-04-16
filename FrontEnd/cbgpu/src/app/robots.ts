import { MetadataRoute } from 'next';

const siteUrl = 'https://cbgpu.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/schedule', '/contact'],
        disallow: ['/dashboard', '/admin', '/profile', '/auth'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
