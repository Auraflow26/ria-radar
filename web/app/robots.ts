import type { MetadataRoute } from 'next'

// Block ALL crawlers. This is a named list of RIA firms scored as sales
// targets — it must never be search-indexed, regardless of deploy protection.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
