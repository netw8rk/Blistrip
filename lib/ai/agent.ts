import type { TripPlannerInput, TripPlan } from "@/types/trip";
import { AGENT_SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { getOpenAiTools, executeToolCall } from "./tools";
import type { ToolCall } from "./tools";
import type { PlanningPipelineResult } from "@/lib/planning/types";
import type { RetrievedContext } from "@/lib/knowledge/types";
import type { VerifiedTripPlaces } from "@/lib/travel/fetch-trip-places";
import type { PlaceRetrievalResult } from "@/lib/travel/retrieve-places";
import type { UserTripPreferences } from "@/lib/planning/preferences";

const MAX_TOOL_ROUNDS = 5;
const TOOL_CALL_TIMEOUT_MS = 15_000;

interface AgentResult {
  plan: Omit<TripPlan, "id" | "createdAt"> | null;
  toolCallsMade: number;
  error?: string;
}

export async function runTravelAgent(
  input: TripPlannerInput,
  pipeline: PlanningPipelineResult,
  retrievalOrVerified?: PlaceRetrievalResult | VerifiedTripPlaces | null,
  preferences?: UserTripPreferences
): Promise<AgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { plan: null, toolCallsMade: 0, error: "No API key" };
  }

  // Ensure providers are initialized
  await initProviders();

  const retrieval = isRetrievalResult(retrievalOrVerified) ? retrievalOrVerified : null;
  const verifiedPlaces = isRetrievalResult(retrievalOrVerified) ? null : retrievalOrVerified ?? null;
  const hasPool = (retrieval?.selected.length ?? 0) >= 4;

  const userPrompt = buildUserPrompt({
    input: input as unknown as Record<string, unknown>,
    retrievedContext: pipeline.retrieved,
    pipeline: {
      context: pipeline.context,
      draftItinerary: pipeline.draftItinerary,
      discoveryMatches: pipeline.discoveryMatches,
      budgetEstimate: pipeline.budgetEstimate,
      clarifyingQuestions: pipeline.clarifyingQuestions,
      rankedTop: pipeline.rankedAttractions.slice(0, 15),
      verifiedPlaces,
      preferences,
      retrieval,
    },
  });

  if (hasPool) {
    return runSingleShot(apiKey, AGENT_SYSTEM_PROMPT, userPrompt);
  }

  const tools = getOpenAiTools();
  if (tools && tools.length > 0) {
    return runAgentLoop(apiKey, AGENT_SYSTEM_PROMPT, userPrompt + buildCapabilitiesNote(), tools, pipeline.retrieved);
  }

  return runSingleShot(apiKey, AGENT_SYSTEM_PROMPT, userPrompt);
}

function isRetrievalResult(
  value: PlaceRetrievalResult | VerifiedTripPlaces | null | undefined
): value is PlaceRetrievalResult {
  return !!value && "selected" in value && "ranked" in value;
}

async function runAgentLoop(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  tools: ReturnType<typeof getOpenAiTools>,
  _retrieved: RetrievedContext | null
): Promise<AgentResult> {
  const messages: Array<{ role: string; content?: string; tool_calls?: unknown[]; tool_call_id?: string; name?: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let totalToolCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callOpenAI(apiKey, messages, tools);
    if (!response) {
      return { plan: null, toolCallsMade: totalToolCalls, error: "OpenAI request failed" };
    }

    const choice = response.choices?.[0];
    if (!choice) {
      return { plan: null, toolCallsMade: totalToolCalls, error: "No response from OpenAI" };
    }

    const message = choice.message;

    if (choice.finish_reason === "tool_calls" && message.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: message.content ?? undefined,
        tool_calls: message.tool_calls,
      });

      const toolResults = await Promise.all(
        message.tool_calls.map(async (tc: { id: string; function: { name: string; arguments: string } }) => {
          totalToolCalls++;
          const call: ToolCall = {
            name: tc.function.name,
            arguments: safeParseJson(tc.function.arguments) ?? {},
          };
          console.log(`[Agent] Tool call: ${call.name}`, call.arguments);
          const result = await withTimeout(executeToolCall(call), TOOL_CALL_TIMEOUT_MS);
          return { id: tc.id, result };
        })
      );

      for (const { id, result } of toolResults) {
        messages.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify(result.result ?? result.error ?? "No result"),
        } as unknown as (typeof messages)[number]);
      }

      continue;
    }

    if (message.content) {
      const parsed = safeParseJson(message.content);
      if (parsed && typeof parsed === "object" && "destination" in parsed) {
        return {
          plan: parsed as Omit<TripPlan, "id" | "createdAt">,
          toolCallsMade: totalToolCalls,
        };
      }
      return { plan: null, toolCallsMade: totalToolCalls, error: "Invalid JSON response from agent" };
    }

    break;
  }

  return { plan: null, toolCallsMade: totalToolCalls, error: "Agent exceeded max tool rounds" };
}

async function runSingleShot(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AgentResult> {
  const response = await callOpenAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  if (!response) {
    return { plan: null, toolCallsMade: 0, error: "OpenAI request failed" };
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    return { plan: null, toolCallsMade: 0, error: "No content in response" };
  }

  const parsed = safeParseJson(content);
  if (parsed && typeof parsed === "object" && "destination" in parsed) {
    return { plan: parsed as Omit<TripPlan, "id" | "createdAt">, toolCallsMade: 0 };
  }

  return { plan: null, toolCallsMade: 0, error: "Invalid JSON response" };
}

async function callOpenAI(
  apiKey: string,
  messages: unknown[],
  tools?: ReturnType<typeof getOpenAiTools>
) {
  try {
    const body: Record<string, unknown> = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.5,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    } else {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("OpenAI API call failed:", error);
    return null;
  }
}

function safeParseJson(text: string): Record<string, unknown> | null {
  try {
    const trimmed = text.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function buildCapabilitiesNote(): string {
  let note = "\n\n--- AVAILABLE DATA SOURCES ---\n";
  note += "You have access to real-time travel data tools. Use them to find verified places.\n";
  note += "Strategy:\n";
  note += "1. Search for restaurants matching the user's food interests (2-3 searches)\n";
  note += "2. Search for attractions/activities matching their interests (1-2 searches)\n";
  note += "3. Search for nightlife/bars if relevant (1 search)\n";
  note += "4. Use tool results as the source for all real-world place recommendations\n";
  note += "5. Combine tool results with Blistrip knowledge base data\n";
  note += "6. Do NOT invent places — only use what the tools return\n";
  note += "--- END AVAILABLE DATA SOURCES ---\n";
  return note;
}

let providersInitialized = false;

async function initProviders() {
  if (providersInitialized) return;
  providersInitialized = true;
  try {
    await import("@/lib/travel/providers");
  } catch {
    console.warn("Travel providers not available");
  }
}
