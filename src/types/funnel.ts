import type { FunnelConfig } from "../lib/config-schema";

export type AnswerValue = string | string[];

export interface GeoSnapshot {
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
}

export interface ConsentSnapshot {
  accepted: boolean;
  text: string;
  version: string;
  acceptedAt: string;
}

export interface ContactData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface FunnelSession {
  sessionId: string;
  tabId?: string;
  leadId?: string;
  createdAt: string;
  updatedAt: string;
  firstUrl: string;
  originalQueryString: string;
  fbc?: string;
  fbp?: string;
  zip?: string;
  geo: GeoSnapshot;
  answers: Record<string, AnswerValue>;
  contact?: ContactData;
  consent?: ConsentSnapshot;
  eventCounts: Record<string, number>;
  completedStep: number;
  conversionValue?: number;
  conversionEventId?: string;
  conversionFiredAt?: string;
  deliveredToGhlAt?: string;
  leadStatus?: "partial" | "qualified" | "duplicate" | "rejected" | "delivered";
}

export interface EventRecord {
  eventId: string;
  sessionId: string;
  leadId?: string;
  eventName: string;
  source: "browser" | "server" | "both";
  eventTime: number;
  eventSourceUrl: string;
  sequence: number;
  customData: Record<string, unknown>;
}

export interface MetaUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  zp?: string[];
  ct?: string[];
  st?: string[];
  country?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

export interface MetaServerEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website" | "phone_call" | "physical_store" | "system_generated";
  user_data: MetaUserData;
  custom_data?: Record<string, unknown>;
  original_event_data?: Record<string, unknown>;
}

export interface CapiPayload {
  data: MetaServerEvent[];
  test_event_code?: string;
}

export interface CapiRetryMessage {
  createdAt: string;
  eventId: string;
  payload: CapiPayload;
}

export interface BrowserEventEnvelope {
  eventId: string;
  eventName: string;
  eventTime: number;
  eventSourceUrl: string;
  customData: Record<string, unknown>;
}

export type ConfiguredQuestion = FunnelConfig["surveyQuestions"][number];
