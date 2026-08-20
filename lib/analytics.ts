type AnalyticsEvent =
  | "planner_started"
  | "planner_completed"
  | "trip_generated"
  | "hotel_clicked"
  | "activity_clicked"
  | "restaurant_clicked"
  | "product_clicked"
  | "save_trip"
  | "delete_trip"
  | "destination_clicked"
  | "planner_step_completed";

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
  provider("planner_started", { page, type: "page_view" });
}
