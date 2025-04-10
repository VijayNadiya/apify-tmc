import { Dictionary } from "crawlee";
import { parse as parseUrl } from "tldts";
import { ulid } from "ulid";
import { formatDateInISO, formatTimestampInISO } from "../utils.js";

// https://www.wipo.int/export/sites/www/standards/en/pdf/03-60-01.pdf

// WIPO INID 550
export enum MarkFeature {
  Word = "Word",
  Figurative = "Figurative",
  Combined = "Combined",
  StylizedCharacters = "Stylized Characters",
  // ... add other enumeration values as needed
}

// WIPO INID 551
export enum MarkEffect {
  Individual = "Individual",
  Collective = "Collective",
  Certificate = "Certificate",
  // ... add other enumeration values as needed
}

export enum MarkStatus {
  Pending = "Pending",
  Withdrawn = "Withdrawn",
  Registered = "Registered",
  Cancelled = "Cancelled",
  Ended = "Ended",
  Expired = "Expired",
  // ... add other enumeration values as needed
}

export interface AddressInfo {
  name?: string;
  identifier?: string;
  address?: string;
  country?: string;
}

class AddressInfos {
  constructor(addressInfos: AddressInfo[]) {
    this.name = [];
    this.identifier = [];
    this.address = [];
    this.country = [];
    for (const addressInfo of addressInfos) {
      this.name.push(addressInfo.name ?? null);
      this.identifier.push(addressInfo.identifier ?? null);
      this.address.push(addressInfo.address ?? null);
      this.country.push(addressInfo.country ?? null);
    }
  }
  name: (string | null)[];
  identifier: (string | null)[];
  address: (string | null)[];
  country: (string | null)[];
}

export interface Classification {
  nice_class?: string;
  local_class?: string;
  description?: string;
}

class Classifications {
  constructor(classifications: Classification[]) {
    this.nice_class = [];
    this.local_class = [];
    this.description = [];
    for (const classification of classifications) {
      this.nice_class.push(classification.nice_class ?? null);
      this.local_class.push(classification.local_class ?? null);
      this.description.push(classification.description ?? null);
    }
  }
  nice_class: (string | null)[];
  local_class: (string | null)[];
  description: (string | null)[];
}

export interface Priority {
  serial_number?: string;
  date?: Date;
  office_code?: string;
  data?: string;
}

class Priorities {
  constructor(priorities: Priority[]) {
    this.serial_number = [];
    this.date = [];
    this.office_code = [];
    this.data = [];
    for (const priority of priorities) {
      this.serial_number.push(priority.serial_number ?? null);
      this.date.push(formatDateInISO(priority.date) ?? null);
      this.office_code.push(priority.office_code ?? null);
      this.data.push(priority.data ?? null);
    }
  }
  serial_number?: (string | null)[];
  date?: (string | null)[];
  office_code?: (string | null)[];
  data?: (string | null)[];
}

export interface History {
  type?: string;
  timestamp?: Date;
  description?: string;
  publication_id?: string;
  publication_date?: Date;
}

class Histories {
  constructor(histories: History[]) {
    this.type = [];
    this.timestamp = [];
    this.description = [];
    this.publication_id = [];
    this.publication_date = [];
    for (const history of histories) {
      this.timestamp.push(formatTimestampInISO(history.timestamp) ?? null);
      this.type.push(history.type ?? null);
      this.description.push(history.description ?? null);
      this.publication_id.push(history.publication_id ?? null);
      this.publication_date.push(
        formatDateInISO(history.publication_date) ?? null,
      );
    }
  }
  type?: (string | null)[];
  timestamp?: (string | null)[];
  description?: (string | null)[];
  publication_id?: (string | null)[];
  publication_date?: (string | null)[];
}

interface Designation {
  office_code?: string;
  identifier?: string;
  date?: Date;
  under_office_code?: string;
}

class Designations {
  constructor(designations: Designation[]) {
    this.office_code = [];
    this.identifier = [];
    this.date = [];
    this.under_office_code = [];
    for (const designation of designations) {
      this.office_code.push(designation.office_code ?? null);
      this.identifier.push(designation.identifier ?? null);
      this.date.push(formatDateInISO(designation.date) ?? null);
      this.under_office_code.push(designation.under_office_code ?? null);
    }
  }
  office_code: (string | null)[];
  identifier: (string | null)[];
  date: (string | null)[];
  under_office_code: (string | null)[];
}

export interface IMarkScrape {
  id: string;
  office_code: string;
  url: string;
  st13?: string;
  name?: string;
  webpage_title?: string;
  status_raw?: string;
  contacts_raw?: object;
  designations_raw?: object;
  classifications_raw?: object;
  vienna_classes_raw?: object;
  priorities_raw?: object;
  fields_raw?: object;
  image_raw?: string;
  feature_raw?: string;
}

export class Mark {
  constructor(scrape: IMarkScrape) {
    this.id = ulid();
    this.navigation_id = scrape.id;
    this.name = scrape.name;
    this.st13 = scrape.st13;
    this.scrape = scrape;
    this.office_code = scrape.office_code;
    this.url = scrape.url;
    const parsed_url = parseUrl(scrape.url);
    this.host = parsed_url.hostname ?? undefined;
    this.domain = parsed_url.domain ?? this.host;
  }
  id: string;
  office_code?: string;
  st13?: string;
  name?: string;
  status?: MarkStatus;
  status_date?: Date;
  feature?: MarkFeature;
  effect?: MarkEffect;
  application_number?: string;
  application_date?: Date;
  publication_date?: Date;
  application_language?: string;
  transliteration?: string;
  registration_number?: string;
  registration_date?: Date;
  issue_date?: Date;
  expiry_date?: Date;
  renewal_date?: Date;
  renewal_request_date?: Date;
  event_date?: Date;
  removal_date?: Date;
  termination_date?: Date;
  surrender_date?: Date;
  restored_date?: Date;
  description?: string;
  figurative_elements_description?: string;
  reproduction_content_type?: string;
  reproduction?: string;
  characters?: string;
  disclaimer?: string;
  translation?: string;
  colors_claimed?: string;
  comments?: string;
  colors?: string;
  classifications?: Classification[];
  priorities?: Priority[];
  owners?: AddressInfo[];
  assignees?: AddressInfo[];
  applicants?: AddressInfo[];
  representatives?: AddressInfo[];
  correspondents?: AddressInfo[];
  licensees?: AddressInfo[];
  vienna_classes?: string[];
  designations?: Designation[];
  histories?: History[];
  events?: MarkEvent[];
  navigation_id: string;
  domain?: string;
  host?: string;
  url?: string;
  tags?: Dictionary;
  content_location?: string;
  screenshot_location?: string;
  scrape?: IMarkScrape;

  toJSON() {
    return {
      ...this,
      // Format dates as ISO strings for ClickHouse
      status_date: formatDateInISO(this.status_date),
      application_date: formatDateInISO(this.application_date),
      publication_date: formatDateInISO(this.publication_date),
      registration_date: formatDateInISO(this.registration_date),
      issue_date: formatDateInISO(this.issue_date),
      expiry_date: formatDateInISO(this.expiry_date),
      renewal_date: formatDateInISO(this.renewal_date),
      renewal_request_date: formatDateInISO(this.renewal_request_date),
      event_date: formatDateInISO(this.event_date),
      removal_date: formatDateInISO(this.removal_date),
      termination_date: formatDateInISO(this.termination_date),
      surrender_date: formatDateInISO(this.surrender_date),
      restored_date: formatDateInISO(this.restored_date),

      // Transform nested types into field arrays for ClickHouse
      classifications: new Classifications(this.classifications ?? []),
      priorities: new Priorities(this.priorities ?? []),
      owners: new AddressInfos(this.owners ?? []),
      assignees: new AddressInfos(this.assignees ?? []),
      applicants: new AddressInfos(this.applicants ?? []),
      representatives: new AddressInfos(this.representatives ?? []),
      correspondents: new AddressInfos(this.correspondents ?? []),
      licensees: new AddressInfos(this.licensees ?? []),
      designations: new Designations(this.designations ?? []),
      histories: new Histories(this.histories ?? []),
    };
  }
}

export interface MarkEvent {
  publication_identifier?: string;
  publication_status?: string;
  industrial_property_type?: string;
}
