import { MetadataRoute } from 'next';

const siteUrl = 'https://cbgpu.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/contact`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    { url: `${siteUrl}/services`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/download`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
