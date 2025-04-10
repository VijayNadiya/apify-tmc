import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { log } from "crawlee";
import { CORSEARCH_ENV as env } from "../config.js";
import { dateFormatFromId } from "../utils.js";

const endpoint = process.env.TMC_S3_ENDPOINT ?? process.env.S3_ENDPOINT;
const bucket = process.env.TMC_S3_BUCKET ?? process.env.S3_BUCKET;
const accessKeyId =
  process.env.TMC_S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.TMC_S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY;

let client: S3Client | undefined;
if (endpoint && bucket && accessKeyId && secretAccessKey) {
  client = new S3Client({
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    region: "us-east-1",
  });
  log.info("S3Client for Contrail initialized as Sink.", {
    endpoint,
    bucket,
    env,
    accessKeyId,
  });
} else {
  log.error("Missing S3 environment variables!");
}

export async function putScreenshotPng(ulid: string, body: string | Buffer) {
  return putObject(ulid, "screenshot", "png", body);
}

export async function putContentHtml(ulid: string, body: string | Buffer) {
  return putObject(ulid, "content", "html", body);
}

async function putObject(
  ulid: string,
  name: string,
  ext: string,
  body: string | Buffer,
) {
  if (!client) {
    log.warning("Called putObject but S3Client for Contrail not configured.", {
      ulid,
      name,
    });

    return;
  }

  const key = `${env}/${dateFormatFromId(
    ulid,
    "yyyyMMdd",
  )}/${ulid}/${ulid}_${name}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  });

  try {
    await client.send(command);
    log.info("Placed artifact into Contrail object storage.", {
      name,
      id: ulid,
      key,
    });

    return key;
  } catch (error) {
    log.exception(error as Error, "Error uploading to S3!", {
      id: ulid,
      key,
      error,
    });

    return;
  }
}
