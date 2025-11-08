import axios from 'axios';

export interface UrlMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  oEmbed?: Record<string, any>;
  openGraph?: Record<string, any>;
}

export class UrlExpander {
  async expand(url: string): Promise<UrlMetadata> {
    try {
      // Skip non-HTTP URLs (e.g., exp://, file://, etc.)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log(`Skipping URL expansion for non-HTTP URL: ${url.substring(0, 50)}`);
        return {}; // Return empty metadata
      }

      // Try to fetch oEmbed first (for Instagram, Twitter, etc.)
      const oEmbedUrl = this.getOEmbedUrl(url);
      if (oEmbedUrl) {
        try {
          const oEmbedResponse = await axios.get(oEmbedUrl, { timeout: 10000 });
          if (oEmbedResponse.data) {
            return {
              title: oEmbedResponse.data.title,
              description: oEmbedResponse.data.description,
              imageUrl: oEmbedResponse.data.thumbnail_url,
              siteName: oEmbedResponse.data.provider_name,
              oEmbed: oEmbedResponse.data
            };
          }
        } catch (e) {
          // Fall through to OG tags
        }
      }

      // Fallback to fetching HTML and parsing OG tags
      const htmlResponse = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CalendarBot/1.0)'
        }
      });

      const ogTags = this.parseOpenGraph(htmlResponse.data);
      return {
        title: ogTags.title,
        description: ogTags.description,
        imageUrl: ogTags.image,
        siteName: ogTags.siteName,
        openGraph: ogTags
      };
    } catch (error: any) {
      // Only log if it's not a protocol error (those are expected for non-HTTP URLs)
      if (!error.message?.includes('Unsupported protocol')) {
        console.error('URL expansion error:', error.message);
      }
      return {}; // Return minimal object
    }
  }

  private getOEmbedUrl(url: string): string | null {
    // Instagram
    if (url.includes('instagram.com')) {
      return `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
    }
    // Twitter/X
    if (url.includes('twitter.com') || url.includes('x.com')) {
      return `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
    }
    // TikTok
    if (url.includes('tiktok.com')) {
      return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    }
    return null;
  }

  private parseOpenGraph(html: string): Record<string, string> {
    const ogTags: Record<string, string> = {};
    const ogRegex = /<meta\s+property="og:(\w+)"\s+content="([^"]+)"/gi;
    let match;

    while ((match = ogRegex.exec(html)) !== null) {
      ogTags[match[1]] = match[2];
    }

    // Also get title and description from regular meta tags
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && !ogTags.title) {
      ogTags.title = titleMatch[1];
    }

    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch && !ogTags.description) {
      ogTags.description = descMatch[1];
    }

    return ogTags;
  }
}

