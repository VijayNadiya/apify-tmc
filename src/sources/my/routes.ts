import { createPlaywrightRouter } from "crawlee";
import { format as formatDate } from "date-fns";
import { Locator } from "playwright";
import { saveMark } from "../../sinks/clickhouse.js";
import { putContentHtml, putScreenshotPng } from "../../sinks/contrail.js";
import { ResponseTimeoutError } from "../../types/errors.js";
import {
  Classification,
  History,
  IMarkScrape,
  Mark,
  MarkEvent,
  MarkFeature,
} from "../../types/mark.js";
import { Navigation } from "../../types/navigation.js";
import {
  endNavigationAsSuccess,
  normalizeText,
  parseDate,
  spawnUserData,
} from "../../utils.js";
import { composeRequest } from "./routines.js";
import { MyFilterKey, MyFilterStrategy } from "./types.js";

const _COUNTRY_CODE_PARENTHETICAL_REGEX = /\(([A-Z]{2})\)/;
const _PAGE_LINK_FIRST_LAST_REGEX = /<<|>>/;
const _PAGE_LINK_NUMBER_REGEX = /Page\$(\d+)/;
const _TM_MARK_PATH_REGEX = /SPHI\/Extra\/IP\/Mutual\/Browse\.aspx/;
const _TM_SEARCH_PATH_REGEX = /SPHI\/Extra\/IP\/TM\/Qbe\.aspx/;

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ request, page, log, crawler }) => {
  // Pull Navigation object from request.
  const nav = request.userData.navigation as Navigation;

  // Validate Navigation object
  const officeCode = nav.office_code;
  if (!officeCode) {
    throw new Error("Missing `office_code` on Navigation object!");
  }

  // Validate Request.userData contents
  if (!request.userData.filterStrategy) {
    throw new Error("Missing `filterStrategy` on Request.userData!");
  }
  if (!request.userData.filterKey) {
    throw new Error("Missing `filterKey` on Request.userData!");
  }

  // TODO: Validate date range for DateRange strategy
  // TODO: Handle a single `filterValue` for Day strategy
  if (!request.userData.filterValue) {
    throw new Error("Missing `filterValue` on Request.userData!");
  }

  // Extract Request.userData contents
  const filterValue = request.userData.filterValue;
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  if (Array.isArray(filterValue)) {
    startDate = new Date(filterValue[0]);
    endDate = new Date(filterValue[1]);
  } else {
    startDate = new Date(filterValue);
    endDate = startDate;
  }
  const filterStrategy = request.userData.filterStrategy as MyFilterStrategy;
  const filterKey = request.userData.filterKey as MyFilterKey;
  const pageNumber = Number(request.userData.pageNumber ?? 1);
  const markTags = {
    officeCode,
    filterStrategy,
    filterKey,
    filterValue,
    pageNumber,
  };
  const context = { id: nav.id, ...markTags };

  // Define common locators
  const loadingLocator = page.locator("div#overlayLoading");
  const noResultsModalLocator = page.locator("div#msgDialogModal .modal-body");
  const errorHeaderLocator = page.locator(
    "div.modal-header > h5.modal-title:text('Error')",
  );
  const markContentLocator = page.locator("div#MainContent_divMainTab");
  const itemsCountLocator = page.locator(
    "#MainContent_ctrlTMSearch_ctrlProcList_hdrNbItems",
  );

  //  Click on TM Search link
  await page.locator("a#MainContent_lnkTMSearch").click({ delay: 100 });

  // Wait for TM Search page to load
  await page.waitForURL(_TM_SEARCH_PATH_REGEX, { waitUntil: "networkidle" });

  // Click on Advanced Search link
  await page
    .locator("a#MainContent_ctrlTMSearch_lnkAdvanceSearch")
    .click({ delay: 100 });

  log.debug("Waiting for Advanced Search form to load.", {
    ...context,
    currentUrl: page.url(),
  });

  // Wait for loading overlay to disappear
  await loadingLocator.waitFor({ state: "hidden" });

  // Wait for Advanced Search form elements to load
  await page.isVisible("#MainContent_ctrlTMSearch_divApplicationDate");

  log.debug("Populating Advanced Search form.", {
    ...context,
    currentUrl: page.url(),
  });

  // Populate Advanced Search form element for the search key
  const formFieldSelectors = getFilterKeyElementSelectors(filterKey);
  if (
    filterStrategy === MyFilterStrategy.Day ||
    filterStrategy === MyFilterStrategy.DateRange
  ) {
    await page
      .locator(formFieldSelectors[0])
      .fill(formatDate(startDate, "dd/MM/yyyy"));
    await page
      .locator(formFieldSelectors[1])
      .fill(formatDate(endDate, "dd/MM/yyyy"));
  } else if (filterStrategy === MyFilterStrategy.Value) {
    await page.locator(formFieldSelectors[0]).fill(filterValue as string);
  }

  log.debug("Initiating Advanced Search.", {
    ...context,
    currentUrl: page.url(),
  });

  const resultsPromise = page
    .waitForResponse(_TM_SEARCH_PATH_REGEX)
    .catch(() => undefined);

  // Click on Search button
  await page.locator("a#MainContent_ctrlTMSearch_lnkbtnSearch").click();

  const resultsResponse = await resultsPromise;
  if (!resultsResponse) {
    throw new ResponseTimeoutError("Failed to get search results.");
  }

  // Wait for loading overlay to disappear
  await loadingLocator.waitFor({ state: "hidden" });

  // Wait for no results modal, SERP, or single record to load
  await noResultsModalLocator
    .or(errorHeaderLocator)
    .or(itemsCountLocator)
    .or(markContentLocator)
    .waitFor({ state: "visible" });

  // Check for no results modal
  if (
    (await noResultsModalLocator.isVisible()) &&
    (await noResultsModalLocator.textContent()) ===
      "Your search returned no results"
  ) {
    log.info("Search returned no results.", {
      ...context,
      currentUrl: page.url(),
    });
    await endNavigationAsSuccess(nav, page);

    return;
  }

  // Check for error modal
  if (await errorHeaderLocator.isVisible()) {
    const errorModal = page
      .locator("div.modal-dialog")
      .filter({ has: errorHeaderLocator });
    const errorModalText = await errorModal.textContent();
    log.error("Error modal found during search.", {
      ...context,
      errorModalText,
      currentUrl: page.url(),
    });

    throw new Error(`Error modal found during search: ${errorModalText}`);
  }

  // Check for single result redirect
  if (await markContentLocator.isVisible()) {
    log.info(
      "Search returned and redirected to single result; navigating back.",
      {
        ...context,
        currentUrl: page.url(),
      },
    );

    // Go back to search results
    await page.goBack();

    // Wait for TM Search page to load
    await page.waitForURL(_TM_SEARCH_PATH_REGEX, { waitUntil: "networkidle" });

    // Wait for loading overlay to disappear
    await loadingLocator.waitFor({ state: "hidden" });
  }

  // Parse the total number of items found in the search
  const itemsCountRaw = await itemsCountLocator.textContent();
  const itemsCountMatch = itemsCountRaw?.match(/(\d+)/);
  if (!itemsCountMatch) {
    throw new Error("Failed to parse total result count for search.");
  }

  const lastNumber = Number(parseInt(itemsCountMatch[0]));
  // last page number found and getting ids
  const totalPages = Number(Math.floor(lastNumber / 50));

  log.info("Total items returned in search and pages found.", {
    ...context,
    totalPages,
    currentUrl: page.url(),
  });

  // Check current page number
  let pageNumberCurrent = 1;
  const pageNumberCurrentLocator = page.locator(
    "#MainContent_ctrlTMSearch_upProcList tr.gridview_pager span",
  );
  if (await pageNumberCurrentLocator.isVisible()) {
    pageNumberCurrent = Number(await pageNumberCurrentLocator.textContent());
  }

  log.debug("Current page number found.", {
    ...context,
    pageNumberCurrent,
    totalPages,
    currentUrl: page.url(),
  });

  async function parsePageLinks(): Promise<[number, Locator][]> {
    // Check for other pages
    const otherPagesLocator = page.locator(
      "table[id$=_gvwIPCases] tr.gridview_pager table a",
      { hasNotText: _PAGE_LINK_FIRST_LAST_REGEX },
    );

    const otherPageAnchors: [number, Locator][] = [];
    if (!(await otherPagesLocator.first().isVisible())) {
      return otherPageAnchors;
    }

    // Loop over other page links to enqueue & find the target
    for (const pageElement of await otherPagesLocator.all()) {
      const href = await pageElement.getAttribute("href");
      if (!href) {
        continue;
      }

      const pageMatch = href.match(_PAGE_LINK_NUMBER_REGEX);
      if (!pageMatch) {
        continue;
      }

      otherPageAnchors.push([Number(pageMatch[1]), pageElement]);
    }

    log.debug("Parsed other page links.", {
      ...context,
      otherPageAnchors: otherPageAnchors.map(([k, _]) => k),
      currentUrl: page.url(),
    });

    return otherPageAnchors;
  }

  async function addPageRequests(otherPageAnchors: [number, Locator][]) {
    if (otherPageAnchors.length === 0) {
      return;
    }

    const otherPages = [];
    for (const [linkPageNumber, _] of otherPageAnchors) {
      const { pageNumberOg, ...userData } = spawnUserData(request.userData);
      userData.pageNumber = linkPageNumber;
      otherPages.push(composeRequest(userData));
    }
    // Enqueue requests for other pages
    const results = await crawler.addRequests(otherPages);
    log.info("Enqueued requests for other pages.", {
      ...context,
      results,
      currentUrl: page.url(),
    });
  }

  // Compare the current page number with the page number from the request
  while (pageNumberCurrent !== pageNumber) {
    log.info("Attempting to navigate to the page number of request.", {
      ...context,
      pageNumberCurrent,
      currentUrl: page.url(),
    });

    // Get other page links
    const otherPageAnchors = await parsePageLinks();

    // Enqueue requests for the other pages
    await addPageRequests(otherPageAnchors);

    // Click on the exact page number or the last ("...") link
    const pageToClick =
      otherPageAnchors.find(([k, _]) => k === pageNumber) ??
      otherPageAnchors.at(-1);

    if (pageToClick === undefined) {
      throw new Error(
        `Failed to find link to click to advance to page ${pageNumber}! Current page: ${pageNumberCurrent}.`,
      );
    }
    log.debug("Clicking on page link to navigate to target page.", {
      ...context,
      pageNumberCurrent,
      pageToClick: pageToClick[0],
      currentUrl: page.url(),
    });

    const pagePromise = page
      .waitForResponse(_TM_SEARCH_PATH_REGEX)
      .catch(() => undefined);

    await pageToClick[1].click();

    const pageResponse = await pagePromise;
    if (!pageResponse) {
      throw new ResponseTimeoutError("Failed to page in search results.");
    }

    // Wait for loading overlay to disappear
    await loadingLocator.waitFor({ state: "hidden" });

    // Validate current page number has changed
    const newPageNumber = Number(await pageNumberCurrentLocator.textContent());
    if (newPageNumber === pageNumberCurrent) {
      throw new Error(
        `Failed to navigate to different page from ${newPageNumber}! Target page: ${pageNumber}.`,
      );
    }

    // Update current page number
    pageNumberCurrent = newPageNumber;
  }

  // Get other page links
  const otherPageAnchors = await parsePageLinks();

  // Enqueue requests for the other pages
  await addPageRequests(otherPageAnchors);

  // Locate all result links
  const resultsCount = await page
    .locator(
      "a[id^=MainContent_ctrlTMSearch_ctrlProcList_gvwIPCases_lnkBtnCaseBrowser_]",
    )
    .count();

  log.debug("Parsed total results count on current page.", {
    ...context,
    resultsCount,
    currentUrl: page.url(),
  });

  // Loop over result locators, click, and parse Marks.
  for (let index = 0; index < resultsCount; index++) {
    log.info("Visiting search results to parse Mark.", {
      ...context,
      position: index + 1,
      currentUrl: page.url(),
    });

    // Click on the result link
    await page
      .locator(
        `a#MainContent_ctrlTMSearch_ctrlProcList_gvwIPCases_lnkBtnCaseBrowser_${index}`,
      )
      .click();

    // Wait for TM Search page to load
    await page.waitForURL(_TM_MARK_PATH_REGEX, {
      waitUntil: "networkidle",
    });

    //  Here add some default value for mark table
    const url = page.url();
    const title = await page.title();
    // TODO: Split the webpage title parts to get the name
    const name = title;

    // Raw fields for Scrape object
    const rawFields = new Map<string, string | undefined>();

    // Create Scrape container
    const scrape: IMarkScrape = {
      id: nav.id,
      office_code: officeCode,
      url: url ?? request.url,
      webpage_title: title,
      name,
      fields_raw: rawFields,
    };
    // Create Mark object.
    const mark = new Mark(scrape);

    const event: MarkEvent = {};
    mark.events = [event];

    // "Application Number" - INID 210
    mark.application_number = normalizeText(
      await page
        .locator("span[id$=txtAppNr], span[name$=txtAppNr]")
        .textContent(),
    );

    log.debug("Parsing Mark elements.", {
      ...context,
      position: index + 1,
      applicationNumber: mark.application_number,
      currentUrl: page.url(),
    });

    // "Registration Number" - INID 111
    const registrationNumberLocator = page.locator(
      "span[id$=txtRegNr], span[name$='txtRegNr']",
    );
    if (await registrationNumberLocator.isVisible()) {
      mark.registration_number = normalizeText(
        await registrationNumberLocator.textContent(),
      );
    }

    // Status
    const statusCurrentLocator = page.locator("span[id$=lblCurrentStatus]");
    const statusLocator = page.locator(
      "//label[contains(@id, '_lblStatus')]/../following-sibling::div[1]",
    );
    if (await statusCurrentLocator.isVisible()) {
      scrape.status_raw = normalizeText(
        await statusCurrentLocator.textContent(),
      );
    } else if (await statusLocator.isVisible()) {
      scrape.status_raw = normalizeText(await statusLocator.textContent());
    }
    event.publication_status = scrape.status_raw;

    // "Application Type"
    const applicationTypeLocator = page.locator("span[name$=txtCaseType]");
    if (await applicationTypeLocator.isVisible()) {
      const applicationTypeRaw = normalizeText(
        await applicationTypeLocator.textContent(),
      );
      rawFields.set("application_type", applicationTypeRaw);
      event.industrial_property_type = applicationTypeRaw;
    }

    // "Journal Number"
    const journalNumberLocator = page.locator("span[name$=txtJournalNumber]");
    if (await journalNumberLocator.isVisible()) {
      const journalNumberRaw = normalizeText(
        await journalNumberLocator.textContent(),
      );
      rawFields.set("journal_number", journalNumberRaw);
      event.publication_identifier = journalNumberRaw;
    }

    // "PSA Reference Number"
    const psaReferenceLocator = page.locator("span[name$=txtPSARefNb]");
    if (await psaReferenceLocator.isVisible()) {
      rawFields.set(
        "psa_reference_number",
        normalizeText(await psaReferenceLocator.textContent()),
      );
    }

    // "Date of Legal Status"
    const statusDateLocator = page.locator("span[name$=txtDtLegalStatus]");
    if (await statusDateLocator.isVisible()) {
      const statusDateRaw = normalizeDateText(
        await statusDateLocator.textContent(),
      );
      mark.status_date = parseDate(statusDateRaw);
    }

    // "Submission Date" - INID 821
    const submissionDateLocator = page.locator(
      "span[name$=txtDtSubmittedDate]",
    );
    if (await submissionDateLocator.isVisible()) {
      const submissionDateRaw = normalizeDateText(
        await submissionDateLocator.textContent(),
      );
      mark.application_date = parseDate(submissionDateRaw);
    }
    const parsePublicationDate = (rawDate: string): Date => {
      const datePatterns: {
        regex: RegExp;
        parse: (m: RegExpMatchArray) => Date;
      }[] = [
        // Format: DD/MM/YYYY
        {
          regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
          parse: (m: RegExpMatchArray) =>
            new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
        },
        // Format: DD MMM YYYY (e.g., 21 Nov 2024)
        {
          regex: /(\d{1,2})\s([A-Za-z]{3})\s(\d{4})/,
          parse: (m: RegExpMatchArray) =>
            new Date(
              Number(m[3]),
              new Date(`${m[2]} 1, 2000`).getMonth(),
              Number(m[1]),
            ),
        },
        // Format: YYYY-MM-DD (ISO format)
        {
          regex: /(\d{4})-(\d{2})-(\d{2})/,
          parse: (m: RegExpMatchArray) =>
            new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
        },
      ];

      for (const { regex, parse } of datePatterns) {
        const match = rawDate.match(regex);
        if (match) return parse(match);
      }

      throw new Error(`Unrecognized date format: ${rawDate}`);
    };

    // "Publication Date" - INID 450
    const publicationDateLocator = page.locator("span[name$=txtDtPublication]");
    if (await publicationDateLocator.isVisible()) {
      const publicationDateRaw = normalizeDateText(
        await publicationDateLocator.textContent(),
      );
      try {
        mark.publication_date = parsePublicationDate(publicationDateRaw);
      } catch (error) {
        console.error("Error in publicarion Date:");
      }
    }

    // "Registered/Protected on" - INID 151
    const registrationDateLocator = page.locator(
      "span[name$=txtDtRegistration]",
    );
    if (await registrationDateLocator.isVisible()) {
      const registrationDateRaw = normalizeDateText(
        await registrationDateLocator.textContent(),
      );
      mark.registration_date = parseDate(registrationDateRaw);
    }

    // "Issue of Certificate Date"
    const certificateDateLocator = page.locator("span[name$=txtDtCertificate]");
    if (await certificateDateLocator.isVisible()) {
      const certificateDateRaw = normalizeDateText(
        await certificateDateLocator.textContent(),
      );
      mark.issue_date = parseDate(certificateDateRaw);
    }

    // "Renewal Due Date" - INID 180
    const renewalDateLocator = page.locator("span[name$=txtDtExpiration]");
    if (await renewalDateLocator.isVisible()) {
      const renewalDateRaw = normalizeDateText(
        await renewalDateLocator.textContent(),
      );
      mark.expiry_date = parseDate(renewalDateRaw);
    }

    // "Applicant" - INID 730-733
    const applicantRowsLocator = page.locator(
      "table[id*=_ctrlApplicant_ctrlApplicant_] tr:not(.gridview_pager)",
      { hasNot: page.locator("th") },
    );
    if (await applicantRowsLocator.first().isVisible()) {
      const applicants = [];
      for (const applicantRow of await applicantRowsLocator.all()) {
        const applicantName = await applicantRow
          .locator("td:nth-child(1)")
          .textContent();
        const applicantAddr = await applicantRow
          .locator("td:nth-child(3)")
          .textContent();
        const countryCode = applicantAddr?.match(
          _COUNTRY_CODE_PARENTHETICAL_REGEX,
        );
        const applicantCountry = countryCode ? countryCode[1] : undefined;
        applicants.push({
          name: normalizeText(applicantName),
          address: normalizeText(
            applicantAddr?.replace(_COUNTRY_CODE_PARENTHETICAL_REGEX, ""),
          ),
          country: applicantCountry,
        });
      }
      mark.applicants = applicants;
    }

    // "Agent" - INID 740
    const agentRowsLocator = page.locator(
      "table[id*=_ctrlApplicant_ctrlAgent_] tr:not(.gridview_pager)",
      { hasNot: page.locator("th") },
    );
    if (await agentRowsLocator.first().isVisible()) {
      const representatives = [];
      for (const agentRow of await agentRowsLocator.all()) {
        const agentName = await agentRow
          .locator("td:nth-child(1)")
          .textContent();
        const agentId = await agentRow.locator("td:nth-child(2)").textContent();
        const agentAddr = await agentRow
          .locator("td:nth-child(3)")
          .textContent();
        const countryCode = agentAddr?.match(_COUNTRY_CODE_PARENTHETICAL_REGEX);
        const agentCountry = countryCode ? countryCode[1] : undefined;
        representatives.push({
          name: normalizeText(agentName),
          address: normalizeText(
            agentAddr?.replace(_COUNTRY_CODE_PARENTHETICAL_REGEX, ""),
          ),
          identifier: normalizeText(agentId),
          country: agentCountry,
        });
      }
      mark.representatives = representatives;
    }

    // "Correspondent" - INID 750
    const correspondentRowsLocator = page.locator(
      "table[id*=_ctrlApplicant_ctrlAddressForService] tr:not(.gridview_pager)",
      { hasNot: page.locator("th") },
    );
    if (await correspondentRowsLocator.first().isVisible()) {
      const correspondents = [];
      for (const correspondentRow of await correspondentRowsLocator.all()) {
        const correspondentName = await correspondentRow
          .locator("td:nth-child(1)")
          .textContent();
        const correspondentAddr = await correspondentRow
          .locator("td:nth-child(2)")
          .textContent();
        const correspondentCity = await correspondentRow
          .locator("td:nth-child(3)")
          .textContent();
        const correspondentZip = await correspondentRow
          .locator("td:nth-child(4)")
          .textContent();
        const correspondentState = await correspondentRow
          .locator("td:nth-child(5)")
          .textContent();
        const correspondentCountry = await correspondentRow
          .locator("td:nth-child(6)")
          .textContent();

        correspondents.push({
          name: normalizeText(correspondentName),
          address: normalizeText(
            [
              correspondentAddr,
              correspondentCity,
              correspondentZip,
              correspondentState,
            ].join("\n"),
          ),
          country: normalizeText(correspondentCountry),
        });
      }
      mark.correspondents = correspondents;
    }

    // "Owner" - INID 770
    const ownerRowsLocator = page.locator(
      "table[id*=_ctrlApplicant_ctrlOwner_] tr:not(.gridview_pager)",
      { hasNot: page.locator("th") },
    );
    if (await ownerRowsLocator.first().isVisible()) {
      const owners = [];
      for (const ownerRow of await ownerRowsLocator.all()) {
        const ownerName = await ownerRow
          .locator("td:nth-child(1)")
          .textContent();
        const ownerAddr = await ownerRow
          .locator("td:nth-child(3)")
          .textContent();
        const countryCode = ownerAddr?.match(_COUNTRY_CODE_PARENTHETICAL_REGEX);
        const ownerCountry = countryCode ? countryCode[1] : undefined;
        owners.push({
          name: normalizeText(ownerName),
          address: normalizeText(
            ownerAddr?.replace(_COUNTRY_CODE_PARENTHETICAL_REGEX, ""),
          ),
          country: ownerCountry,
        });
      }
      mark.owners = owners;
    }

    // "Colour Condition" - INID 591
    const colorLocator = page.locator("[id$='_txtColorclaim']");
    if (await colorLocator.isVisible()) {
      mark.colors_claimed = normalizeText(await colorLocator.textContent());
    }

    // "Goods and Services" - INID 511
    const classes: Classification[] = [];
    const classesTableLocator = page.locator(
      "table[id$='_ctrlClassif_gvClassifications']",
    );

    if (await classesTableLocator.locator("tr.gridview_pager").isVisible()) {
      const pagePromise = page
        .waitForResponse(_TM_MARK_PATH_REGEX)
        .catch(() => undefined);

      await classesTableLocator
        .locator("tr.gridview_pager select")
        .selectOption("200");

      const pageResponse = await pagePromise;
      if (!pageResponse) {
        throw new ResponseTimeoutError("Failed to page in search results.");
      }
    }

    const classesLocator = classesTableLocator.locator(
      "tr:not(.gridview_pager)",
      { hasNot: page.locator("th") },
    );

    // Loop over classification table rows
    for (const classRow of await classesLocator.all()) {
      // Get classification data from row
      const classif = await classRow.locator("td:nth-child(1)").textContent();
      const desc = await classRow.locator("td:nth-child(2)").textContent();
      // Add classification to classes array
      classes.push({
        nice_class: normalizeText(classif),
        description: normalizeText(desc),
      });
    }
    mark.classifications = classes;

    // "Disclaimer" - INID 526
    const disclaimerLocator = page.locator(
      "span[name$=txtDisclaimer], span[name$=txtVoluntaryDisclaimer]",
    );
    if (await disclaimerLocator.isVisible()) {
      mark.disclaimer = normalizeText(await disclaimerLocator.textContent());
    }

    // "Picture" - INID 540
    const imageTmLocators = page.locator(
      "table#MainContent_ctrlDocumentList_gvDocuments > tbody > tr:not(.gridview_pager)",
      { hasNot: page.locator("th.headersorteddown") },
    );

    // Loop over history table rows
    for (const imgelement of await imageTmLocators.all()) {
      // Get history data from row
      const imageRefRaw = await imgelement
        .locator(":scope > td > a")
        .getAttribute("href");
      const elementName = await imgelement
        .locator(":scope > td:nth-child(2) span")
        .textContent();

      if (elementName?.includes("TM Image")) {
        scrape.image_raw = imageRefRaw ?? undefined;

        // Concat with expected format parameter
        const imageRef = `${imageRefRaw}&fmt=jpeg_lres`;

        let reproduction = "";
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          const imageResponse = await page.request.get(imageRef);
          if (!imageResponse.ok()) {
            throw new Error(`Failed to fetch image: ${imageResponse.status()}`);
          }
          mark.reproduction_content_type =
            imageResponse.headers()["content-type"];
          const imageBuffers = await imageResponse.body();
          reproduction = imageBuffers.toString("base64");
          // Check if the decoded string is valid
          try {
            const decodedsrting = atob(reproduction);
            if (decodedsrting.includes("Error while retrieving this file")) {
              attempts++;
              if (attempts >= maxAttempts) break;
              continue;
            }
            break;
          } catch (e) {
            log.error("Invalid Base64 string:");
          }
        }
        mark.reproduction = reproduction;
      }
    }

    // "Denomination" - INID 541
    const charLocator = page.locator("[id$='_divTMName'] > div.data");
    if (await charLocator.isVisible()) {
      mark.characters = normalizeText(await charLocator.textContent());
    }

    // "Nature" - INID 550
    const featureLocator = page.locator(
      "div[id$='ctrlTM_divTMType'] > div.data, div[id$='ctrlIRD_divTMNature'] > div.data",
    );
    if (await featureLocator.isVisible()) {
      scrape.feature_raw = normalizeText(await featureLocator.textContent());
      if (scrape.feature_raw === "Word & Figurative") {
        mark.feature = MarkFeature.Combined;
      } else if (scrape.feature_raw === "Stylized Word Mark") {
        mark.feature = MarkFeature.StylizedCharacters;
      } else if (scrape.feature_raw?.includes("Word")) {
        mark.feature = MarkFeature.Word;
      } else if (scrape.feature_raw?.includes("Figurative")) {
        mark.feature = MarkFeature.Figurative;
      } else if (scrape.feature_raw?.includes("Combined")) {
        mark.feature = MarkFeature.Combined;
      }
    }

    // "Transliteration" - INID 561
    const transliterationLocator = page.locator(
      "[id$='_divTransliteration'] > div.data",
    );
    if (await transliterationLocator.isVisible()) {
      mark.transliteration = normalizeText(
        await transliterationLocator.textContent(),
      );
    }

    // "Translation" - INID 566
    const translationLocator = page.locator(
      "[id$='_divTMNameTranslation'] > div.data",
    );
    if (await translationLocator.isVisible()) {
      mark.translation = normalizeText(await translationLocator.textContent());
    }

    // "History"
    const histories: History[] = [];
    const historyLocator = page.locator(
      "table#MainContent_ctrlHistoryList_gvHistory > tbody > tr:not(.gridview_pager)",
      { hasNot: page.locator("th.headersorteddown") },
    );
    // Loop over history table rows
    for (const historyRow of await historyLocator.all()) {
      // Get history data from row
      const creation_date = await historyRow
        .locator(":scope > td:nth-child(1)")
        .textContent();
      const history_type = await historyRow
        .locator(":scope > td:nth-child(2)")
        .textContent();
      const description = await historyRow
        .locator(":scope > td:nth-child(3)")
        .textContent();
      const publication_id = await historyRow
        .locator(":scope > td:nth-child(4)")
        .textContent();
      const publication_date = await historyRow
        .locator(":scope > td:nth-child(5)")
        .textContent();

      // Add history to collection
      histories.push({
        type: normalizeText(history_type),
        timestamp: parseDate(creation_date),
        description: normalizeText(description),
        publication_id: normalizeText(publication_id),
        publication_date: parseDate(publication_date),
      });
    }
    mark.histories = histories;

    // Attach context to Mark
    mark.tags = {
      ...markTags,
      position: index + 1,
    };

    // Capture HTML content
    mark.content_location = await putContentHtml(mark.id, await page.content());

    // Capture screenshot
    mark.screenshot_location = await putScreenshotPng(
      mark.id,
      await page.screenshot({ fullPage: true }),
    );

    // Persist parsed Mark
    await saveMark(mark);

    // Go back to search results
    await page.goBack();
  }

  await endNavigationAsSuccess(nav, page);
});

function normalizeDateText(dateText: string | null | undefined) {
  if (dateText === "N/A") {
    return;
  }

  return normalizeText(dateText);
}

function getFilterKeyElementSelectors(filterKey: MyFilterKey) {
  switch (filterKey) {
    case MyFilterKey.ApplicationDate:
      return [
        "#MainContent_ctrlTMSearch_txtApplicationDateStart",
        "#MainContent_ctrlTMSearch_txtApplicationDateEnd",
      ];
    case MyFilterKey.AcceptanceDate:
      return [
        "#MainContent_ctrlTMSearch_txtAcceptanceDateStart",
        "#MainContent_ctrlTMSearch_txtAcceptanceDateEnd",
      ];
    case MyFilterKey.PriorityDate:
      return [
        "#MainContent_ctrlTMSearch_txtPriorityDateStart",
        "#MainContent_ctrlTMSearch_txtPriorityDateEnd",
      ];
    case MyFilterKey.PublicationDate:
      return [
        "#MainContent_ctrlTMSearch_txtPubDTStart",
        "#MainContent_ctrlTMSearch_txtPubDTEnd",
      ];
    case MyFilterKey.RegistrationDate:
      return [
        "#MainContent_ctrlTMSearch_txtRegistrationDateStart",
        "#MainContent_ctrlTMSearch_txtRegistrationDateEnd",
      ];
    case MyFilterKey.RenewalDueDate:
      return [
        "#MainContent_ctrlTMSearch_txtExpirationDateStart",
        "#MainContent_ctrlTMSearch_txtExpirationDateEnd",
      ];
    case MyFilterKey.CertificateIssueDate:
      return [
        "#MainContent_ctrlTMSearch_txtCertificatedDTStart",
        "#MainContent_ctrlTMSearch_txtCertificatedDTEnd",
      ];
    case MyFilterKey.CaseNumber:
      return ["#MainContent_ctrlTMSearch_txtCaseNumber"];
  }
}
