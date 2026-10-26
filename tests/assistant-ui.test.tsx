import { test, before, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { randomUUID } from "node:crypto";
import type { Workspace } from "../server/types";
let dom: JSDOM;
let testing: typeof import("@testing-library/react");
let Assistant: typeof import("../app/assistant/workspace").default;
let state: Workspace;
let sends: number;
let calls: { path: string; method: string; body: Record<string, unknown> }[];
const originalFetch = globalThis.fetch;
const mail = {
  id: "mail-ui",
  subject: "Offerte voor Sophie",
  sender: "Sophie <sophie@example.com>",
  recipient: "sophie@example.com",
  body: "Kun je vrijdag een offerte sturen?",
  received_at: "2026-10-26T08:00:00Z",
  analysis: null,
};
before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://planner-pal.vercel.app/assistant",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  testing = await import("@testing-library/react");
  Assistant = (await import("../app/assistant/workspace")).default;
});
beforeEach(() => {
  state = {
    mails: [structuredClone(mail)],
    tasks: [],
    drafts: [],
    notes: [],
    log: [],
  };
  sends = 0;
  calls = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input),
      method = init?.method || "GET",
      body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    calls.push({ path, method, body });
    const result = (value: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(value), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    if (path === "/api/sync") return result(state);
    if (path.startsWith("/api/calendar?")) return result({ events: [] });
    if (path === "/api/ai") {
      if (body.kind === "mail") {
        const analysis = {
          summary: "Sophie vraagt een offerte.",
          tasks: [
            {
              title: "Offerte maken",
              duration: 45,
              priority: "Hoog" as const,
              deadline: "2026-10-30",
              reason: "Sophie heeft een offerte nodig.",
            },
          ],
          reply: "Hoi Sophie, ik bekijk je verzoek.",
        };
        state.mails[0].analysis = analysis;
        state.drafts.push({
          id: randomUUID(),
          source_mail: "mail-ui",
          recipient: "sophie@example.com",
          subject: "Re: Offerte voor Sophie",
          body: analysis.reply,
          revision: 1,
          status: "draft",
        });
        return result({ analysis });
      }
      state.notes.push({
        id: randomUUID(),
        transcript: body.text,
        analysis: {
          summary: "Afspraak uit je notitie.",
          tasks: [
            {
              title: "Notitie opvolgen",
              duration: 15,
              priority: "Normaal",
              deadline: null,
              reason: "Afgesproken in gesprek.",
            },
          ],
          reply: "",
        },
        created_at: new Date().toISOString(),
      });
      return result({ ok: true });
    }
    if (path === "/api/tasks" && method === "POST") {
      const task = {
        ...body,
        id: randomUUID(),
        version: 1,
        done: false,
        source_mail: body.source_mail || null,
        source_note: body.source_note || null,
        calendar_event_id: null,
        calendar_status: "none",
        scheduled_start: null,
        scheduled_end: null,
      };
      state.tasks.push(task);
      return result(task);
    }
    if (path === "/api/drafts" && method === "PATCH") {
      const d = state.drafts.find((d) => d.id === body.id)!;
      d.body = body.body;
      d.revision++;
      return result(d);
    }
    if (path === "/api/drafts" && method === "POST") {
      assert.equal(body.confirmed, true);
      const d = state.drafts.find((d) => d.id === body.id)!;
      assert.equal(body.revision, d.revision);
      d.status = "sent";
      sends++;
      return result({ sent: true });
    }
    if (path === "/api/calendar" && method === "POST") {
      const t = state.tasks.find((t) => t.id === body.taskId)!;
      t.calendar_status = "planned";
      t.calendar_event_id = "event";
      t.version++;
      return result({ planned: true });
    }
    if (path === "/api/brief")
      return result({
        text: "Begin met de offerte en houd ruimte voor overleg.",
      });
    if (path === "/api/followups") return result({ followups: [] });
    throw new Error("Unexpected test API call: " + method + " " + path);
  };
});
afterEach(() => testing.cleanup());
after(() => {
  globalThis.fetch = originalFetch;
  dom.window.close();
});
const render = () =>
  testing.render(
    <Assistant
      account={{ name: "Test Owner", email: "owner@example.com" }}
      configured
      aiReady
      authFailed={false}
      revokeWarning={false}
    />,
  );
test("connected route analyzes mail, reviews a task and saves to the account", async () => {
  const { screen, fireEvent, waitFor } = testing;
  render();
  await screen.findByText("Offerte voor Sophie");
  fireEvent.click(screen.getByText("Offerte voor Sophie"));
  fireEvent.click(screen.getByRole("button", { name: "Mail analyseren" }));
  await screen.findByText("Offerte maken");
  fireEvent.click(screen.getByRole("button", { name: "Taak controleren" }));
  fireEvent.change(screen.getByLabelText("Titel"), {
    target: { value: "Offerte zorgvuldig maken" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Taak bewaren" }));
  await waitFor(() => assert.equal(state.tasks.length, 1));
  assert.equal(state.tasks[0].title, "Offerte zorgvuldig maken");
  assert.equal(state.tasks[0].source_mail, "mail-ui");
  assert.equal(state.tasks[0].proposal_index, 0);
});
test("editing a reply disables sending until saved, then two explicit steps send the exact revision", async () => {
  const { screen, fireEvent, waitFor } = testing;
  state.drafts = [
    {
      id: randomUUID(),
      source_mail: "mail-ui",
      recipient: "sophie@example.com",
      subject: "Re: Offerte voor Sophie",
      body: "Eerste concept",
      revision: 1,
      status: "draft",
    },
  ];
  render();
  await screen.findByText("Offerte voor Sophie");
  fireEvent.click(screen.getByRole("button", { name: "Antwoorden" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Controleren & bewerken" }),
  );
  fireEvent.change(screen.getByLabelText("Antwoord", { exact: true }), {
    target: { value: "Hoi Sophie, dit is mijn gecontroleerde antwoord." },
  });
  assert(
    (
      screen.getByRole("button", {
        name: "Verzenden controleren",
      }) as HTMLButtonElement
    ).disabled,
  );
  fireEvent.click(screen.getByRole("button", { name: "Wijzigingen bewaren" }));
  await waitFor(() => assert.equal(state.drafts[0].revision, 2));
  await waitFor(() =>
    assert.equal(
      (
        screen.getByRole("button", {
          name: "Verzenden controleren",
        }) as HTMLButtonElement
      ).disabled,
      false,
    ),
  );
  assert.equal(sends, 0);
  fireEvent.click(
    screen.getByRole("button", { name: "Verzenden controleren" }),
  );
  await screen.findByText("Dit antwoord versturen?");
  assert(screen.getByText("Aan: sophie@example.com"));
  assert.equal(sends, 0);
  fireEvent.click(
    screen.getByRole("button", { name: "Ja, verstuur dit antwoord" }),
  );
  await waitFor(() => assert.equal(sends, 1));
  assert.equal(
    state.drafts[0].body,
    "Hoi Sophie, dit is mijn gecontroleerde antwoord.",
  );
});
test("typed conversation notes are analyzed explicitly and proposed actions need acceptance", async () => {
  const { screen, fireEvent, waitFor } = testing;
  render();
  await screen.findByText("Offerte voor Sophie");
  fireEvent.click(screen.getByRole("button", { name: "Gespreksnotities" }));
  fireEvent.change(screen.getByLabelText("Jouw gespreksnotitie"), {
    target: {
      value: "Met Sophie afgesproken dat ik morgen een voorstel stuur.",
    },
  });
  assert.equal(state.notes.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Acties voorstellen" }));
  await screen.findByText("Notitie opvolgen");
  assert.equal(state.tasks.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Taak controleren" }));
  fireEvent.click(screen.getByRole("button", { name: "Taak bewaren" }));
  await waitFor(() => assert.equal(state.tasks.length, 1));
  assert.equal(state.tasks[0].source_note, state.notes[0].id);
});
test("day brief is requested only by a button, not by automatic inbox refresh", async () => {
  const { screen, fireEvent } = testing;
  render();
  await screen.findByText("Offerte voor Sophie");
  assert.equal(calls.filter((c) => c.path === "/api/brief").length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Maak dagoverzicht" }));
  await screen.findByText("Begin met de offerte en houd ruimte voor overleg.");
  assert.equal(calls.filter((c) => c.path === "/api/brief").length, 1);
});

test("microphone starts only after a click, resists a double click and stops when the app is hidden", async () => {
  const { screen, fireEvent, waitFor, act } = testing;
  let starts = 0,
    stops = 0,
    tracksStopped = 0;
  const originalRecorder = globalThis.MediaRecorder;
  const media = {
    getTracks: () => [
      {
        stop: () => {
          tracksStopped++;
        },
      },
    ],
  };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => {
        starts++;
        return media;
      },
    },
  });
  class FixtureRecorder {
    state = "inactive";
    mimeType = "audio/mp4";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    static isTypeSupported() {
      return true;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      stops++;
      this.state = "inactive";
      this.ondataavailable?.({
        data: new Blob(["fixture"], { type: "audio/mp4" }),
      });
      this.onstop?.();
    }
  }
  Object.assign(globalThis, { MediaRecorder: FixtureRecorder });
  try {
    render();
    await screen.findByText("Offerte voor Sophie");
    fireEvent.click(screen.getByRole("button", { name: "Gespreksnotities" }));
    assert.equal(starts, 0);
    const button = screen.getByRole("button", { name: "Notitie opnemen" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => assert.equal(starts, 1));
    await screen.findByRole("button", { name: /Stop opname/ });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new dom.window.Event("visibilitychange"));
    });
    await waitFor(() => assert.equal(stops, 1));
    assert(tracksStopped >= 1);
    assert.equal(calls.filter((call) => call.path === "/api/voice").length, 0);
  } finally {
    Object.assign(globalThis, { MediaRecorder: originalRecorder });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  }
});
