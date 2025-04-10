import { log } from "crawlee";
import { parse } from "ts-command-line-args";
import { crawler } from "../sources/my/crawler.js";
import {
  composeCaseNumberRequest,
  composeDateRequest,
  composeRequests,
} from "../sources/my/routines.js";
import { MyFilterKey } from "../sources/my/types.js";

interface ICommandLineArguments {
  startDate?: string;
  endDate?: string;
  scanDate?: string;
  filterKey?: string;
  caseNumber?: string;
}

export const args = parse<ICommandLineArguments>({
  startDate: { type: String, optional: true },
  endDate: { type: String, optional: true },
  scanDate: { type: String, optional: true },
  filterKey: { type: String, optional: true },
  caseNumber: { type: String, optional: true },
});

let scanDate = new Date();
if (
  args.scanDate != null &&
  args.scanDate !== "" &&
  Date.parse(args.scanDate)
) {
  scanDate = new Date(args.scanDate);
}

let requests = [];
if (
  args.filterKey != null &&
  args.filterKey.toLowerCase() === "casenumber" &&
  args.caseNumber != null
) {
  requests = [composeCaseNumberRequest(args.caseNumber, scanDate)];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "applicationdate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.ApplicationDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "acceptancedate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.AcceptanceDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "prioritydate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.PriorityDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "publicationdate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.PublicationDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "registrationdate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.RegistrationDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "renewalduedate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.RenewalDueDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.filterKey != null &&
  args.filterKey?.toLowerCase() === "certificateissuedate" &&
  args.startDate != null &&
  args.startDate !== ""
) {
  requests = [
    composeDateRequest(
      MyFilterKey.CertificateIssueDate,
      new Date(args.startDate),
      scanDate,
    ),
  ];
} else if (
  args.startDate != null &&
  args.startDate !== "" &&
  args.endDate != null &&
  args.endDate !== ""
) {
  requests = [
    ...composeRequests(
      new Date(args.startDate),
      new Date(args.endDate),
      scanDate,
    ),
  ];
} else {
  requests = [...composeRequests(new Date(), new Date(), scanDate)];
}

log.info("Adding requests to crawler.", { count: requests.length });

await crawler.run(requests, { waitForAllRequestsToBeAdded: true });
