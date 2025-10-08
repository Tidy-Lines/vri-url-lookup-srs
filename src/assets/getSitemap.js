export default async function getSitemap(data) {

  console.log(data) 
  const sitemapData = [];

  for (const element of data) {
    const sitemapUrl = `https://${element.domain}/contentsitemap.xml`;

    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap for ${element.domain}: ${response.statusText}`);
      }

      const xml = await response.text();
      sitemapData.push({ domain: element.domain, xml });
    } catch (error) {
      console.error(`Error fetching ${sitemapUrl}:`, error);
    }
  }

  return sitemapData;
}
