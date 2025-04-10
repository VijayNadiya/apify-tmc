import { log } from "crawlee";
import { crawler } from "./sources/wipo/crawler.js";
import { composeRequests } from "./sources/wipo/routines.js";

const offices = ["BN", "EG", "DZ", "IL", "MN", "TN", "PH"];
const startDate = new Date("2018-04-14");
const endDate = new Date("2018-04-21");

const requests = composeRequests(offices, startDate, endDate);

log.info("Adding requests to crawler.", { count: requests.length });

await crawler.run(requests, { waitForAllRequestsToBeAdded: true });
