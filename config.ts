import { Page } from "playwright";

type Config = {
  /** URL to start the crawl */
  url: string;
  /** Pattern to match against for links on a page to subsequently crawl */
  match: string;
  /** Selector to grab the inner text from */
  selector: string;
  /** Don't crawl more than this many pages */
  maxPagesToCrawl: number;
  /** File name for the finished data */
  outputFileName: string;
  /** Optional cookie to be set. E.g. for Cookie Consent */
  cookie?: {name: string; value: string}
  /** Optional function to run for each page found */
  onVisitPage?: (options: {
    page: Page;
    pushData: (data: any) => Promise<void>;
  }) => Promise<void>;
};

export const config: Config = {
  url: "https://python.langchain.com/docs/get_started/introduction",
  match: "https://python.langchain.com/docs/**",
  selector: `.docMainContainer_gTbr`,
  maxPagesToCrawl: 1000,
  outputFileName: "output.json",
};
