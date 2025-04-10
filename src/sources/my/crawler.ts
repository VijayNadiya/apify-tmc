import { buildPlaywrightCrawler } from "../../builders.js";
import { router } from "./routes.js";

export const crawler = buildPlaywrightCrawler(router);
