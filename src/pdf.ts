import { PlaywrightCrawler } from "crawlee";
import { readFile, writeFile, mkdir } from "fs/promises";
import { glob } from "glob";
import { config } from "../config.js";
import { Page } from "playwright";
import puppeteer from 'puppeteer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Define the directory for saving PDFs
const pdfDir = join(dirname(fileURLToPath(import.meta.url)), '../pdfs');

// Create the directory if it doesn't exist
await mkdir(pdfDir, { recursive: true });

// Function to get page HTML content
export function getPageHtml(page: Page) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    return el?.innerText || "";
  }, config.selector);
}

// Function to create a PDF from HTML content using Puppeteer
async function createPdf(title, url, htmlContent, filePath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Create a structured HTML content for the PDF
  const structuredContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; color: gray; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
          @media print {
            @page {
              margin: 20mm;
            }
            header {
              position: fixed;
              top: 0;
              width: 100%;
              text-align: center;
              font-size: 12px;
            }
            footer {
              position: fixed;
              bottom: 0;
              width: 100%;
              text-align: center;
              font-size: 12px;
            }
            footer .page-number:after {
              content: counter(page);
            }
          }
          header, footer {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div style="margin-top: 60px;">
          <pre>${htmlContent}</pre>
        </div>
      </body>
    </html>
  `;

  await page.setContent(structuredContent, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: filePath,
    format: 'A4',
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        ${title} - ${url}
      </div>`,
    footerTemplate: `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`,
    margin: {
      top: '50px',
      bottom: '50px',
      left: '20px',
      right: '20px',
    }
  });
  await browser.close();
}

// Main crawler code
if (process.env.NO_CRAWL !== "true") {
  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log, pushData }) {
      if (config.cookie) {
        const cookie = {
          name: config.cookie.name,
          value: config.cookie.value,
          url: request.loadedUrl, 
        };
        await page.context().addCookies([cookie]);
      }

      const title = await page.title();
      log.info(`Crawling ${request.loadedUrl}...`);

      await page.waitForSelector(config.selector, {
        timeout: 1000,
      });

      const html = await getPageHtml(page);

      await pushData({ title, url: request.loadedUrl, html });

      if (config.onVisitPage) {
        await config.onVisitPage({ page, pushData });
      }

      await enqueueLinks({
        globs: [config.match],
      });
    },
    maxRequestsPerCrawl: config.maxPagesToCrawl,
  });

  await crawler.run([config.url]);
}

// Read JSON files and create PDFs
const jsonFiles = await glob("storage/datasets/default/*.json", {
  absolute: true,
});

const results = [];
for (const file of jsonFiles) {
  const data = JSON.parse(await readFile(file, "utf-8"));
  results.push(data);

  const pdfFileName = `${file.split('/').pop().replace('.json', '')}.pdf`;
  const pdfFilePath = join(pdfDir, pdfFileName);
  await createPdf(data.title, data.url, data.html, pdfFilePath);
}

console.log(results);

// Optionally write results to a text file
// await writeFile(config.outputFileName, results.map((r) => r.html).join("\n\n"));
