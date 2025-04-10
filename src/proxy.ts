import { ProxyConfiguration } from "crawlee";
import {
  PROXY_DISABLED,
  PROXY_HOST,
  PROXY_PASSWORD,
  PROXY_PORT,
  PROXY_URL_TEMPLATE,
  PROXY_USER,
} from "./config.js";

// TODO: Improve integration with ipswitch.
let proxyConfiguration: ProxyConfiguration | undefined;

if (PROXY_DISABLED) {
  proxyConfiguration = undefined;
} else {
  proxyConfiguration = new ProxyConfiguration({
    newUrlFunction: async (sessionId) => {
      const template =
        PROXY_URL_TEMPLATE ??
        "http://{{USERNAME}}:{{PASSWORD}}@{{HOST}}:{{PORT}}";

      return template
        .replace("{{HOST}}", PROXY_HOST ?? "")
        .replace("{{PORT}}", PROXY_PORT ?? "")
        .replace("{{USERNAME}}", PROXY_USER ?? "")
        .replace("{{PASSWORD}}", PROXY_PASSWORD ?? "")
        .replace("{{SESSION}}", `${sessionId}`);
    },
  });

  proxyConfiguration.isManInTheMiddle = true;
}

export { proxyConfiguration };
