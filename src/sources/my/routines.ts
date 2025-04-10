import { Dictionary, RequestOptions, log } from "crawlee";
import { formatDateInISO } from "../../utils.js";
import { MyFilterKey, MyFilterStrategy } from "./types.js";

export const MY_STARTING_URL =
  "https://iponlineext.myipo.gov.my/SPHI/Extra/Default.aspx";

export const MY_OFFICE_CODE = "MY";

export function composeRequests(
  startDate: Date,
  endDate: Date,
): RequestOptions[] {
  const requests: RequestOptions[] = [];

  // Iterate over dates.
  for (
    let date = startDate;
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    let filterKey: keyof typeof MyFilterKey;
    // Iterate over filter keys.
    for (filterKey in MyFilterKey) {
      if (!filterKey.includes("Date")) {
        continue;
      }

      const request = composeDateRequest(
        filterKey as MyFilterKey,
        new Date(date),
      );
      requests.push(request);
      log.debug("Generated MY Request.", request);
    }
  }

  return requests;
}

export function composeRequestsForDate(date: Date): RequestOptions[] {
  return composeRequests(new Date(date), new Date(date));
}

export function composeDateRequest(
  filterKey: MyFilterKey,
  date: Date,
): RequestOptions {
  const filterStrategy = MyFilterStrategy.Day;
  return {
    url: MY_STARTING_URL,
    userData: {
      filterKey,
      filterStrategy,
      filterValue: date,
      officeCode: MY_OFFICE_CODE,
    },
    uniqueKey: requestKey(filterKey, filterStrategy, date, 1),
  };
}

export function composeApplicationDateRequest(date: Date): RequestOptions {
  return composeDateRequest(MyFilterKey.ApplicationDate, date);
}

export function composePublicationDateRequest(date: Date): RequestOptions {
  return composeDateRequest(MyFilterKey.PublicationDate, date);
}

export function composeCaseNumberRequest(caseNumber: string): RequestOptions {
  return composeRequest({
    filterKey: MyFilterKey.CaseNumber,
    filterStrategy: MyFilterStrategy.Value,
    filterValue: caseNumber,
    officeCode: MY_OFFICE_CODE,
    pageNumber: 1,
    requestDate: new Date(),
  });
}

export function composeRequest(userData: Dictionary): RequestOptions {
  const dateKey = userData.filterKey?.includes("Date")
    ? userData.filterValue instanceof Date
      ? userData.filterValue
      : new Date(userData.filterValue as string)
    : userData.requestDate instanceof Date
      ? userData.requestDate
      : new Date();

  return {
    url: MY_STARTING_URL,
    userData,
    uniqueKey: requestKey(
      userData.filterKey as MyFilterKey,
      userData.filterStrategy as MyFilterStrategy,
      dateKey,
      userData.pageNumber,
    ),
  };
}

function requestKey(
  key: MyFilterKey,
  strategy: MyFilterStrategy,
  date: Date,
  page: number,
) {
  return [MY_OFFICE_CODE, key, strategy, formatDateInISO(date), page].join("-");
}
