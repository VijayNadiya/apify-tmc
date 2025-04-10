import { log } from "crawlee";
import { crawler } from "../sources/my/crawler.js";
import {
  composeApplicationDateRequest,
  composeCaseNumberRequest,
  composeDateRequest,
  composePublicationDateRequest,
  composeRequests,
} from "../sources/my/routines.js";
import { MyFilterKey } from "../sources/my/types.js";

const aa = [
  "TM2024037385",
  "TM2024037387",
  "TM2024037392",
  "TM2024037568",
  "TM2024037570",
  "TM2024037571",
  "TM2024037572",
  "TM2024037573",
  "TM2024037574",
  "TM2024037576",
  "TM2024037581",
  "TM2024037587",
  "TM2024037588",
  "TM2024037707",
  "TM2024037711",
  "TM2024037712",
  "TM2024037713",
  "TM2024037715",
  "TM2024037717",
  "TM2024037718",
  "TM2024037730",
  "TM2024037734",
  "TM2024037759",
  "TM2024037760",
  "TM2024037772",
  "TM2024037780",
  "TM2024037781",
  "TM2024037782",
  "TM2024037783",
  "TM2024037785",
  "TM2024037786",
  "TM2024037787",
  "TM2024037795",
];
for (let i = 0; i < aa.length; i++) {
  const requests = [
    composeCaseNumberRequest(aa[i]),
    // composePublicationDateRequest(new Date("2025-01-02")),
    // composeApplicationDateRequest(new Date("2024-07-31")),
    // composeDateRequest(MyFilterKey.RegistrationDate, new Date("2024-05-31")),
    // ...composeRequests(new Date("2024-03-01"), new Date("2024-03-02")),
  ];

  log.info("Adding requests to crawler.", { count: requests.length });

  await crawler.run(requests, { waitForAllRequestsToBeAdded: true });
}
