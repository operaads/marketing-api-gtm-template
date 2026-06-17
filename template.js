/*
 * Copyright 2026 Opera Ads
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const getAllEventData = require("getAllEventData");
const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const parseUrl = require("parseUrl");
const decodeUriComponent = require("decodeUriComponent");
const getCookieValues = require("getCookieValues");
const setCookie = require("setCookie");
const makeNumber = require("makeNumber");
const getContainerVersion = require("getContainerVersion");
const getRequestHeader = require("getRequestHeader");
const getTimestampMillis = require("getTimestampMillis");
const generateRandom = require("generateRandom");

const ENDPOINT_URL = "https://px.oa.opera.com/s";

const CLICK_ID_COOKIE_NAME = "opcid";
const CLICK_ID_COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60;
const OAU_COOKIE_NAME = "OAU";

const URL_CLICK_ID_PARAMS = ["opcid", "opera_click_id"];

const INTEGRATION = "gtm_server";
const INTEGRATION_VERSION = "0.1.0";

const EVENT_TRIGGER_SOURCE = "GoogleTagManagerServer";

const EVENT_NAME_MAP = {
  "add_to_cart": "add_to_cart",
  "add_to_wishlist": "add_to_wishlist",
  "begin_checkout": "initiate_checkout",
  "page_view": "pageview",
  "purchase": "purchase",
  "search": "search",
  "sign_up": "registration",
  "view_item": "view_content",
  "app_open": "app_opened",
  "first_open": "app_opened",
};

const eventData = getAllEventData();
const isLoggingEnabled = resolveLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader("trace-id") : undefined;

function resolveLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }
  if (data.logType === "no") {
    return false;
  }
  if (data.logType === "debug") {
    return isDebug;
  }
  return data.logType === "always";
}

function inspectUrl(url) {
  const result = {};
  if (!url) {
    return result;
  }

  const parsed = parseUrl(url);
  if (!parsed) {
    return result;
  }

  if (parsed.searchParams) {
    for (let i = 0; i < URL_CLICK_ID_PARAMS.length; i++) {
      const value = parsed.searchParams[URL_CLICK_ID_PARAMS[i]];
      if (value) {
        result.clickId = value;
        break;
      }
    }
  }
  result.hostname = parsed.hostname;
  return result;
}

function resolveClickIdFromPageAndReferrer() {
  const pageInfo = inspectUrl(eventData.page_location);
  if (pageInfo.clickId) {
    return decodeUriComponent(pageInfo.clickId);
  }

  const referrerInfo = inspectUrl(eventData.page_referrer);
  if (referrerInfo.clickId && referrerInfo.hostname === pageInfo.hostname) {
    return decodeUriComponent(referrerInfo.clickId);
  }
  return null;
}

function readClickIdCookie() {
  return getCookieValues(CLICK_ID_COOKIE_NAME)[0];
}

function writeClickIdCookie(value) {
  if (!value) {
    return;
  }
  setCookie(CLICK_ID_COOKIE_NAME, value, {
    domain: "auto",
    httpOnly: false,
    "max-age": CLICK_ID_COOKIE_TTL_SECONDS,
    path: "/",
    secure: true,
    samesite: "none",
  });
}

function readOauCookie() {
  return getCookieValues(OAU_COOKIE_NAME)[0];
}

function resolveClickId() {
  return (
    resolveClickIdFromPageAndReferrer() ||
    readClickIdCookie() ||
    eventData.opera_click_id
  );
}

function resolveEventId() {
  return (
    data.event_id ||
    eventData.event_id ||
    ("gtm_" + getTimestampMillis() + "_" + generateRandom(0, 2147483647))
  );
}

function mapGaItemToContent(item) {
  const price = makeNumber(item.price);
  const quantity = makeNumber(item.quantity || 1);
  const category = item.item_category || item.item_category1 || item.item_category2;

  const content = {};
  content.content_type = eventData.op_content_type || "product";

  if (item.item_id) content.content_id = item.item_id;
  if (item.item_name) content.content_name = item.item_name;
  if (price) content.price = price;
  if (quantity) content.quantity = quantity;
  if (category) content.content_category = category;
  if (item.item_brand) content.brand = item.item_brand;

  return content;
}

function mapGaItemsToContents(items) {
  if (!items) {
    return undefined;
  }
  const contents = [];
  for (const item of items) {
    const content = mapGaItemToContent(item);
    if (content) {
      contents.push(content);
    }
  }
  return contents;
}

function buildContentFromTemplateData(templateData) {
  const price = makeNumber(templateData.price);
  const quantity = makeNumber(templateData.quantity || 1);

  const content = {};
  content.content_type = eventData.op_content_type || templateData.content_type || "product";

  if (templateData.content_id) content.content_id = templateData.content_id;
  if (templateData.content_name) content.content_name = templateData.content_name;
  if (price) content.price = price;
  if (quantity) content.quantity = quantity;
  if (templateData.content_category) content.content_category = templateData.content_category;
  if (templateData.brand) content.brand = templateData.brand;

  return content;
}

function resolveItems() {
  if (eventData.items) {
    return eventData.items;
  }
  if (eventData.op_contents) {
    const parsed = JSON.parse(eventData.op_contents);
    if (parsed) {
      return parsed;
    }
  }
  return undefined;
}

function resolveContents(items) {
  const gaContents = mapGaItemsToContents(items);

  if (data.object_property_source === "ga") {
    return gaContents;
  }

  if (data.single_multi_product === "multiple") {
    const parsed = JSON.parse(data.contents);
    if (parsed) {
      for (const c of parsed) {
        if (!c.content_type) c.content_type = eventData.op_content_type || "product";
      }
      return parsed;
    }
    return undefined;
  }

  if (data.single_multi_product === "single") {
    return [buildContentFromTemplateData(data)];
  }

  if (gaContents && gaContents.length > 0) {
    return gaContents;
  }
  return undefined;
}

function resolveValue(contents) {
  const explicit = makeNumber(data.value) || makeNumber(eventData.value);
  if (explicit) {
    return explicit;
  }

  if (contents && contents.length > 0) {
    let total = 0;
    for (const content of contents) {
      if (content.price !== undefined && content.quantity !== undefined) {
        total += content.price * content.quantity;
      }
    }
    return total;
  }
  return undefined;
}

function resolveCurrency(items) {
  if (data.currency || eventData.currency) {
    return data.currency || eventData.currency;
  }
  if (items) {
    for (const item of items) {
      if (item && item.currency !== undefined) {
        return item.currency;
      }
    }
  }
  return undefined;
}

function resolveUtmParams() {
  let urlParams = {};
  if (eventData.page_location) {
    const parsed = parseUrl(eventData.page_location);
    if (parsed && parsed.searchParams) {
      urlParams = parsed.searchParams;
    }
  }
  return {
    source: eventData.campaign_source || urlParams.utm_source,
    medium: eventData.campaign_medium || urlParams.utm_medium,
    campaign: eventData.campaign || eventData.campaign_name || urlParams.utm_campaign,
    term: eventData.campaign_term || urlParams.utm_term,
    content: eventData.campaign_content || urlParams.utm_content,
  };
}

function buildEventDataPayload(contents, currency, brand, orderId, description, query, customProps) {
  const payload = {};
  if (contents) payload.contents = contents;
  if (currency) payload.currency = currency;
  if (orderId) payload.order_id = orderId;
  if (description) payload.description = description;
  if (query) payload.query = query;
  if (brand) payload.brand = brand;
  if (customProps && customProps.length > 0) {
    for (let i = 0; i < customProps.length; i++) {
      const entry = customProps[i];
      payload[entry.key] = entry.value;
    }
  }
  payload.integration = INTEGRATION;
  payload.integration_version = INTEGRATION_VERSION;
  payload.event_trigger_source = EVENT_TRIGGER_SOURCE;
  return payload;
}

function buildRequestBody(clickId, oau) {
  const clientIp = eventData.ip_override || eventData.ip;
  const eventName = data.event || eventData.event_name;

  const items = resolveItems();
  const contents = resolveContents(items);
  const currency = resolveCurrency(items);
  const value = resolveValue(contents);
  const description = data.description;
  const query = data.query || eventData.query || eventData.search_term;
  const orderId = eventData.transaction_id || eventData.order_id;
  const brand = data.brand;

  const eventDataPayload = buildEventDataPayload(
    contents, currency, brand, orderId, description, query, data.custom_properties
  );

  const body = {};

  if (data.pixel_id) body.trackerId = data.pixel_id;
  if (clickId) body.clickId = clickId;
  body.eventId = resolveEventId();
  if (eventName) body.eventName = EVENT_NAME_MAP[eventName] || eventName;

  body.eventData = JSON.stringify(eventDataPayload);

  if (value) body.payout = "" + value;

  if (clientIp) body.ip = clientIp;
  if (eventData.user_agent) body.ua = eventData.user_agent;
  if (oau) body.advertiserUserId = oau;
  if (eventData.page_location) body.url = eventData.page_location;
  if (eventData.page_referrer) body.refU = eventData.page_referrer;

  const utm = resolveUtmParams();
  if (utm.source) body.utmSource = utm.source;
  if (utm.medium) body.utmMedium = utm.medium;
  if (utm.campaign) body.utmCampaign = utm.campaign;
  if (utm.term) body.utmTerm = utm.term;
  if (utm.content) body.utmContent = utm.content;

  return body;
}

function postRequest(requestBody, onSuccess, onFailure) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (isLoggingEnabled) {
    logToConsole(JSON.stringify({
      Name: "OperaAds",
      Type: "Request",
      TraceId: traceId,
      EventName: requestBody.eventName,
      RequestMethod: "POST",
      RequestUrl: ENDPOINT_URL,
      RequestBody: requestBody,
    }));
  }

  sendHttpRequest(
    ENDPOINT_URL,
    (respStatus, respHeaders, respBody) => {
      if (isLoggingEnabled) {
        logToConsole(JSON.stringify({
          Name: "OperaAds",
          Type: "Response",
          TraceId: traceId,
          EventName: requestBody.eventName,
          ResponseStatusCode: respStatus,
          ResponseHeaders: respHeaders,
          ResponseBody: respBody,
        }));
      }
      if (respStatus >= 200 && respStatus < 400) {
        onSuccess();
      } else {
        onFailure();
      }
    },
    {
      headers: headers,
      method: "POST",
    },
    JSON.stringify(requestBody)
  );
}

function main() {
  const clickId = resolveClickId();
  const oau = readOauCookie();
  writeClickIdCookie(clickId);

  const body = buildRequestBody(clickId, oau);
  postRequest(body, data.gtmOnSuccess, data.gtmOnFailure);
}

main();
