import path from "path";
import { log } from "crawlee";
import { mkdir, writeFile } from "fs/promises";
import {
  CLICKHOUSE_DB,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_URL,
  CLICKHOUSE_USER,
  COVERAGE_WRITE_LOCAL_PATH,
  MARK_WRITE_LOCAL_PATH,
  NAVIGATION_WRITE_LOCAL_PATH,
} from "../config.js";
import { Coverage } from "../types/coverage.js";
import { Mark } from "../types/mark.js";
import { Navigation } from "../types/navigation.js";
import { dateFormatFromId } from "../utils.js";

log.info("ClickHouse HTTP client initialized as Sink.", {
  url: CLICKHOUSE_URL,
  db: CLICKHOUSE_DB,
  user: CLICKHOUSE_USER,
});

export enum ClickHouseTable {
  Coverage = "coverages",
  Mark = "marks",
  Navigation = "navigations",
}

export function saveCoverage(data: Coverage) {
  const dbPromise = insertClickHouseData(ClickHouseTable.Coverage, data);
  const localPromise = writeLocalData(
    COVERAGE_WRITE_LOCAL_PATH,
    Coverage.name,
    data.id,
    "",
    data,
  );

  return Promise.all([localPromise, dbPromise]);
}

export function saveNavigation(data: Navigation) {
  const dbPromise = insertClickHouseData(ClickHouseTable.Navigation, data);
  const localPromise = writeLocalData(
    NAVIGATION_WRITE_LOCAL_PATH,
    Navigation.name,
    data.id,
    `${data.attempt}`,
    data,
  );

  return Promise.all([localPromise, dbPromise]);
}

export function saveMark(data: Mark) {
  const dbPromise = insertClickHouseData(ClickHouseTable.Mark, data);
  const localPromise = writeLocalData(
    MARK_WRITE_LOCAL_PATH,
    Mark.name,
    data.id,
    "",
    data,
  );

  return Promise.all([localPromise, dbPromise]);
}

// Function to write data to local file; helpful for development & debugging
async function writeLocalData<T>(
  dir: string | null | undefined,
  type: string,
  id: string,
  name: string,
  data: T,
) {
  if (!dir) {
    return;
  }

  // Nest in date directory like Contrail
  const date = dateFormatFromId(id, "yyyyMMdd");
  const basePath = path.join(dir, date);

  // Create directory if it doesn't exist
  await mkdir(basePath, { recursive: true });

  // Write data to file
  const filePath = path.join(basePath, `${[id, name, type].join("_")}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2));
  log.info(`Local ${type} file written for ${id}.`, {
    type,
    id,
    name,
    filePath,
  });
}

// Function to insert data into ClickHouse
async function insertClickHouseData<T extends { id: string }>(
  table: ClickHouseTable,
  data: T,
) {
  const query = `
    INSERT INTO \`${table}\`
    SETTINGS
      async_insert=1,
      date_time_input_format='best_effort',
      input_format_import_nested_json=1
    FORMAT JSONEachRow`;

  const body = JSON.stringify(data);
  log.debug("Inserting data into ClickHouse.", {
    clickhouseDatabase: CLICKHOUSE_DB,
    query,
    body,
  });

  try {
    const response = await fetch(
      `${CLICKHOUSE_URL}/?database=${CLICKHOUSE_DB}&query=${encodeURIComponent(
        query,
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ClickHouse-User": CLICKHOUSE_USER,
          "X-ClickHouse-Key": CLICKHOUSE_PASSWORD,
        },
        body: body,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to insert data into ClickHouse. Status: ${
          response.status
        }\n${await response.text()}`,
      );
    }

    log.info("Data inserted successfully into ClickHouse.", {
      table,
      id: data.id,
    });
  } catch (error) {
    log.error("Error inserting data into ClickHouse:", { error, body });
  }
}
