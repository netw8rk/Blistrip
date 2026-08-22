type AnalyticsEvent =
  | "landing_view"
  | "planner_started"
  | "planner_completed"
  | "planner_step_completed"
  | "planner_submitted"
  | "agent_started"
  | "agent_completed"
  | "agent_failed"
  | "trip_generated"
  | "trip_generation_failed"
  | "place_viewed"
  | "hotel_viewed"
  | "flight_viewed"
  | "activity_viewed"
  | "place_clicked"
  | "hotel_clicked"
  | "activity_clicked"
  | "restaurant_clicked"
  | "product_clicked"
  | "flight_clicked"
  | "trip_saved"
  | "trip_shared"
  | "save_trip"
  | "delete_trip"
  | "destination_clicked"
  | "affiliate_click";

interface AnalyticsProperties {
  [key: string]: string | number | boolean | undefined;
}

type AnalyticsProvider = (event: AnalyticsEvent, properties?: AnalyticsProperties) => void;

const consoleProvider: AnalyticsProvider = (event, properties) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${event}`, properties ?? {});
  }
};

let provider: AnalyticsProvider = consoleProvider;

export function setAnalyticsProvider(newProvider: AnalyticsProvider) {
  provider = newProvider;
}

export function track(event: AnalyticsEvent, properties?: AnalyticsProperties) {
  provider(event, properties);
}

export function trackPageView(page: string) {
  provider("landing_view", { page, type: "page_view" });
}

export function trackAgentEvent(
  status: "started" | "completed" | "failed",
  properties?: AnalyticsProperties
) {
  const event = `agent_${status}` as AnalyticsEvent;
  provider(event, properties);
}

export function trackTripGeneration(
  success: boolean,
  properties?: AnalyticsProperties
) {
  provider(success ? "trip_generated" : "trip_generation_failed", properties);
}

export function trackAffiliateClick(
  type: string,
  name: string,
  destination?: string
) {
  provider("affiliate_click", { type, name, destination });
}
