import vision from "@google-cloud/vision";
import { log } from "crawlee";

// Creates a client
const client = new vision.ImageAnnotatorClient();

export async function ocr(base64Image: string): Promise<string | undefined> {
  // The base64 image needs to be converted to a Buffer for the Vision API
  const imageBuffer = Buffer.from(base64Image, "base64");

  const request = {
    image: {
      content: imageBuffer,
    },
  };

  const [result] = await client.textDetection(request);
  const detection = result.fullTextAnnotation;

  if (!detection) {
    return undefined;
  }

  log.debug(`Found following text: ${detection.text}`, detection);

  return detection.text ?? undefined;
}
