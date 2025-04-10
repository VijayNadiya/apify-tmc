import { ulid } from "ulid";
import { dateFromId, formatDateInISO } from "../utils.js";

export class Coverage {
  constructor(
    office_code: string,
    source: string,
    navigation_id?: string,
    updated_at?: Date,
    records_count?: number,
    earliest_date?: Date,
    latest_date?: Date,
  ) {
    const id = ulid();
    this.id = id;
    this.collected_at = dateFromId(id);
    this.office_code = office_code;
    this.source = source;
    this.updated_at = updated_at;
    this.records_count = records_count;
    this.earliest_date = earliest_date;
    this.latest_date = latest_date;
    this.navigation_id = navigation_id;
  }
  id: string;
  collected_at: Date;
  office_code: string;
  source: string;
  updated_at?: Date;
  records_count?: number;
  earliest_date?: Date;
  latest_date?: Date;
  navigation_id?: string;

  toJSON() {
    return {
      ...this,
      // Format dates as ISO strings for ClickHouse
      earliest_date: formatDateInISO(this.earliest_date),
      latest_date: formatDateInISO(this.latest_date),
    };
  }
}
