CREATE DATABASE IF NOT EXISTS tmc_development;

USE tmc_development;

CREATE TABLE IF NOT EXISTS `coverages` (
  `id` FixedString(26),
  `collected_at` DateTime,
  `source` LowCardinality(String),
  `office_code` LowCardinality(String),
  `updated_at` Nullable(DateTime),
  `records_count` Nullable(UInt64),
  `earliest_date` Nullable(Date32),
  `latest_date` Nullable(Date32),
  `navigation_id` Nullable(FixedString(26)),
  `id_date` Date MATERIALIZED toDate(ULIDStringToDateTime(`id`)) CODEC(DoubleDelta),
  `recorded_at` DateTime MATERIALIZED utc_timestamp() CODEC(DoubleDelta)
)
ENGINE = MergeTree
ORDER BY (`office_code`, `source`, `id`)
PARTITION BY toYYYYMM(id_date);

CREATE TABLE IF NOT EXISTS `marks`
(
  `id` FixedString(26),
  `collected_at` DateTime DEFAULT ULIDStringToDateTime(`id`) CODEC(DoubleDelta),
  `office_code` LowCardinality(String),
  `status` LowCardinality(Nullable(String)),
  `status_date` Nullable(Date32),
  `feature` LowCardinality(Nullable(String)),
  `effect` LowCardinality(Nullable(String)),
  `st13` Nullable(String),
  `name` Nullable(String),
  `application_number` Nullable(String),
  `application_date` Nullable(Date32),
  `application_language` Nullable(String),
  `registration_number` Nullable(String),
  `registration_date` Nullable(Date32),
  `issue_date` Nullable(Date32),
  `publication_date` Nullable(Date32),
  `expiry_date` Nullable(Date32),
  `renewal_date` Nullable(Date32),
  `renewal_request_date` Nullable(Date32),
  `event_date` Nullable(Date32),
  `removal_date` Nullable(Date32),
  `termination_date` Nullable(Date32),
  `surrender_date` Nullable(Date32),
  `restored_date` Nullable(Date32),
  `priorities` Nested(
      `serial_number` Nullable(String),
      `date` Nullable(Date32),
      `office_code` LowCardinality(Nullable(String)),
      `data` Nullable(String)
  ),
  `figurative_elements_description` Nullable(String),
  `reproduction_content_type` LowCardinality(Nullable(String)),
  `reproduction` Nullable(String),
  `characters` Nullable(String),
  `description` Nullable(String),
  `disclaimer` Nullable(String),
  `transliteration` Nullable(String),
  `translation` Nullable(String),
  `colors_claimed` Nullable(String),
  `comments` Nullable(String),
  `colors` Nullable(String),
  `classifications` Nested(
      `nice_class` LowCardinality(Nullable(String)),
      `local_class` LowCardinality(Nullable(String)),
      `description` Nullable(String)
  ),
  `vienna_classes` Array(String),
  `owners` Nested(
      name Nullable(String),
      identifier Nullable(String),
      address Nullable(String),
      country LowCardinality(Nullable(String))
  ),
  `assignees` Nested(
      name Nullable(String),
      identifier Nullable(String),
      address Nullable(String),
      country LowCardinality(Nullable(String))
  ),
  `applicants` Nested(
      name Nullable(String),
      identifier Nullable(String),
      address Nullable(String),
      country LowCardinality(Nullable(String))
  ),
  `representatives` Nested(
      name Nullable(String),
      identifier Nullable(String),
      address Nullable(String),
      country LowCardinality(Nullable(String))
  ),
  `correspondents` Nested(
      name Nullable(String),
      identifier Nullable(String),
      address Nullable(String),
      country LowCardinality(Nullable(String))
  ),
  `licensees` Nested(
      name Nullable(String),
      identifier Nullable(String),
      address Nullable(String),
      country LowCardinality(Nullable(String))
  ),
  `designations` Nested(
      `office_code` LowCardinality(Nullable(String)),
      `identifier` Nullable(String),
      `date` Nullable(Date32),
      `under_office_code` LowCardinality(Nullable(String))
  ),
  `histories` Nested(
      `type` Nullable(String),
      `timestamp` Nullable(DateTime),
      `description` Nullable(String),
      `publication_id` Nullable(String),
      `publication_date` Nullable(Date32)
  ),
  `events` Array(Map(LowCardinality(String), String)),
  `domain` LowCardinality(Nullable(String)),
  `host` LowCardinality(Nullable(String)),
  `url` Nullable(String),
  `tags` Map(LowCardinality(String), String),
  `content_location` Nullable(String),
  `screenshot_location` Nullable(String),
  `navigation_id` FixedString(26),
  `scrape` Nullable(String),
  `id_date` Date MATERIALIZED toDate(ULIDStringToDateTime(`id`)) CODEC(DoubleDelta),
  `recorded_at` DateTime MATERIALIZED utc_timestamp() CODEC(DoubleDelta)
)
ENGINE = MergeTree
ORDER BY (`office_code`, `id`)
PARTITION BY toYYYYMM(id_date);

CREATE TABLE IF NOT EXISTS `navigations`
(
  `id` FixedString(26),
  `attempt` UInt8,
  `parent_id` Nullable(FixedString(26)),
  `outcome` LowCardinality(String),
  `started_at` DateTime CODEC(DoubleDelta),
  `started_at_ms` UInt16,
  `ended_at` Nullable(DateTime),
  `ended_at_ms` Nullable(UInt16),
  `session_id` Nullable(String),
  `domain` LowCardinality(String),
  `host` LowCardinality(String),
  `url` String,
  `method` LowCardinality(String),
  `request_headers` Map(LowCardinality(String), String),
  `request_proxy` Map(LowCardinality(String), String),
  `upstream_proxy` Map(LowCardinality(String), String),
  `remote_address` Nullable(String),
  `remote_port` Nullable(UInt16),
  `security_details` Map(LowCardinality(String), String),
  `status_code` Nullable(UInt16),
  `redirected` Boolean,
  `response_headers` Map(LowCardinality(String), String),
  `landing_domain` LowCardinality(Nullable(String)),
  `landing_host` LowCardinality(Nullable(String)),
  `landing_url` Nullable(String),
  `title` Nullable(String),
  `content_location` Nullable(String),
  `screenshot_location` Nullable(String),
  `collected_urls` Nested(
      `label` LowCardinality(String),
      `url` String
  ),
  `office_code` LowCardinality(Nullable(String)),
  `tags` Map(LowCardinality(String), String),
  `exception_present` Boolean DEFAULT isNotNull(`exception_name`),
  `exception_name` LowCardinality(Nullable(String)),
  `exception_type` LowCardinality(Nullable(String)),
  `exception_message` Nullable(String),
  `exception_stack_trace` Nullable(String) CODEC(ZSTD(11)),
  `id_date` Date MATERIALIZED toDate(ULIDStringToDateTime(`id`)) CODEC(DoubleDelta),
  `recorded_at` DateTime MATERIALIZED utc_timestamp() CODEC(DoubleDelta)
)
ENGINE = MergeTree
ORDER BY (`id`, `attempt`)
PARTITION BY toYYYYMM(id_date);
