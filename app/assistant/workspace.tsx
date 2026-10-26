"use client";
import { fromZonedTime } from "date-fns-tz";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Mail,
  Mic,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { Dialog } from "../ui";
import type {
  ConnectedMail,
  ConnectedTask,
  ConnectedDraft,
  ConnectedEvent,
  ConnectedNote,
  Suggestion,
  Workspace,
} from "../../server/types";
import VoiceNote from "./voice";
import ProviderButtons from "./provider-buttons";
import type { Provider } from "../../server/provider-config";
const zone = "Europe/Amsterdam";
function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: zone }).format(
    new Date(),
  );
}
function clock(value: string) {
  return new Date(value).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  });
}
async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const result = await fetch(path, {
    method,
    cache: "no-store",
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal: AbortSignal.timeout(60000),
  });
  const data = await result.json();
  if (!result.ok)
    throw new Error(data.error || "De actie kon niet worden uitgevoerd.");
  return data;
}
type TaskForm = {
  id?: string;
  version?: number;
  title: string;
  duration: number;
  priority: "Hoog" | "Normaal" | "Laag";
  deadline: string;
  work_date: string;
  done: boolean;
  source_mail?: string;
  source_note?: string;
  proposal_index?: number;
};
const empty: Workspace = {
  mails: [],
  tasks: [],
  drafts: [],
  notes: [],
  log: [],
};
export default function Assistant({
  account,
  configured,
  providers = { google: false, microsoft: false },
  aiReady,
  authFailed,
  revokeWarning,
}: {
  account: {
    name: string;
    email: string;
    loginProvider?: Provider;
    provider?: Provider | null;
    connectedEmail?: string | null;
    capabilities?: {
      readMail: boolean;
      readCalendar: boolean;
      sendMail: boolean;
      writeCalendar: boolean;
    };
  } | null;
  providers?: { google: boolean; microsoft: boolean };
  configured: boolean;
  aiReady: boolean;
  authFailed: boolean;
  revokeWarning: boolean;
}) {
  const connected = Boolean(account?.provider);
  const permissions = account?.capabilities || {
    readMail: false,
    readCalendar: false,
    sendMail: false,
    writeCalendar: false,
  };
  const providerLabel =
    account?.provider === "microsoft" ? "Microsoft" : "Google";
  const mailboxEmail = account?.connectedEmail || account?.email || "";
  const grant = (intent: "send" | "calendar") =>
    `/api/auth/${account?.provider || "google"}?intent=${intent}`;
  const [disconnect, setDisconnect] = useState(false);
  const [data, setData] = useState<Workspace>(empty);
  const [brief, setBrief] = useState("");
  const [meetingBrief, setMeetingBrief] = useState("");
  const [followups, setFollowups] = useState<
    { id: string; subject: string; recipient: string; days: number }[] | null
  >(null);
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState("overzicht");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm | null>(null);
  const [plan, setPlan] = useState<{
    task: ConnectedTask;
    date: string;
    time: string;
  } | null>(null);
  const [draft, setDraft] = useState<ConnectedDraft | null>(null);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState(false);
  const [removeAccount, setRemoveAccount] = useState(false);
  const [events, setEvents] = useState<ConnectedEvent[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncedAt, setSyncedAt] = useState("");
  const refreshing = useRef(false);
  const lastSync = useRef(0);
  const calendarSequence = useRef(0);
  const selected = data.mails.find((m) => m.id === selectedId);
  const sourceLink = (id: string) =>
    "/api/mail/open?id=" + encodeURIComponent(id);
  const refresh = useCallback(
    async (sync = false) => {
      if (!account || refreshing.current || (sync && !connected)) return;
      refreshing.current = true;
      try {
        const next = await api<Workspace>("/api/sync", sync ? "POST" : "GET");
        setData(next);
        if (sync) {
          lastSync.current = Date.now();
          setSyncedAt(
            new Date().toLocaleTimeString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ophalen mislukt.");
      } finally {
        refreshing.current = false;
      }
    },
    [account, connected],
  );
  const loadCalendar = useCallback(async () => {
    if (!account || !permissions.readCalendar) {
      setEvents([]);
      setCalendarLoaded(false);
      return;
    }
    const sequence = ++calendarSequence.current;
    setEventsError("");
    setCalendarLoaded(false);
    try {
      const result = await api<{ events: ConnectedEvent[] }>(
        "/api/calendar?date=" + date,
      );
      if (sequence === calendarSequence.current) {
        setEvents(result.events);
        setCalendarLoaded(true);
      }
    } catch (e) {
      if (sequence === calendarSequence.current) {
        setEvents([]);
        setEventsError(
          e instanceof Error ? e.message : "Agenda ophalen mislukt.",
        );
      }
    }
  }, [account, date, permissions.readCalendar]);
  useEffect(() => {
    if (!account) return;
    let active = true;
    void (async () => {
      await refresh(false);
      if (active && connected) await refresh(true);
    })();
    const update = () => {
      if (
        connected &&
        document.visibilityState === "visible" &&
        Date.now() - lastSync.current > 60000
      )
        void refresh(true);
    };
    const interval = setInterval(() => {
      if (connected && document.visibilityState === "visible")
        void refresh(true);
    }, 300000);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [account, refresh, connected]);
  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);
  async function run(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "De actie is mislukt.");
    } finally {
      setBusy("");
    }
  }
  function newTask() {
    setForm({
      title: "",
      duration: 30,
      priority: "Normaal",
      deadline: date,
      work_date: date,
      done: false,
    });
  }
  function accept(
    s: Suggestion,
    source: { mail?: string; note?: string; index: number },
  ) {
    setSelectedId(null);
    setForm({
      title: s.title,
      duration: s.duration,
      priority: s.priority,
      deadline: s.deadline || date,
      work_date: date,
      done: false,
      source_mail: source.mail,
      source_note: source.note,
      proposal_index: source.index,
    });
  }
  async function analyzeMail(mail: ConnectedMail) {
    await run(aiReady ? "Mail analyseren" : "Regelvoorstel maken", async () => {
      await api(aiReady ? "/api/ai" : "/api/suggestions", "POST", {
        kind: "mail",
        mailId: mail.id,
      });
      await refresh();
      setMessage(
        "Voorstellen en antwoordconcept staan klaar. Controleer de inhoud.",
      );
    });
  }
  async function saveTask() {
    if (!form) return;
    await run("Taak bewaren", async () => {
      await api("/api/tasks", form.id ? "PATCH" : "POST", form);
      setForm(null);
      await refresh();
      setMessage("Taak bewaard op je account.");
    });
  }
  async function toggle(task: ConnectedTask) {
    await run("Taak bijwerken", async () => {
      await api("/api/tasks", "PATCH", {
        id: task.id,
        version: task.version,
        title: task.title,
        duration: task.duration,
        priority: task.priority,
        deadline: task.deadline,
        work_date: task.work_date,
        done: !task.done,
      });
      await refresh();
      setMessage(
        task.done
          ? "Taak heropend."
          : "Taak afgerond. Een bestaand agendablok blijft staan.",
      );
    });
  }
  async function saveDraft() {
    if (!draft) return;
    await run("Concept bewaren", async () => {
      const saved = await api<ConnectedDraft>("/api/drafts", "PATCH", {
        id: draft.id,
        revision: draft.revision,
        body: draft.body,
      });
      setDraft(saved);
      await refresh();
      setMessage("Concept bewaard. Er is nog niets verstuurd.");
    });
  }
  async function send() {
    if (!draft) return;
    await run("Antwoord versturen", async () => {
      await api("/api/drafts", "POST", {
        id: draft.id,
        revision: draft.revision,
        confirmed: true,
      });
      setDraft(null);
      setSendConfirm(false);
      await refresh();
      setMessage("Antwoord geaccepteerd door je maildienst.");
    });
  }
  useEffect(() => {
    setDeleteTaskConfirm(false);
  }, [form?.id]);
  const editingPlanned = Boolean(
    form?.id && data.tasks.find((t) => t.id === form.id)?.calendar_event_id,
  );
  useEffect(() => {
    setBrief("");
  }, [date]);
  const savedDraft = draft ? data.drafts.find((d) => d.id === draft.id) : null;
  const draftChanged = Boolean(
    draft && savedDraft && draft.body !== savedDraft.body,
  );
  const dayTasks = data.tasks.filter((t) => t.work_date === date && !t.done);
  const openTasks = data.tasks.filter((t) => !t.done);
  const unplanned = dayTasks.filter((t) => t.calendar_status === "none");
  const wanted = unplanned.reduce((sum, t) => sum + t.duration, 0);
  const occupiedMinutes = (() => {
    const lower = fromZonedTime(date + "T09:00:00", zone).getTime(),
      upper = fromZonedTime(date + "T17:00:00", zone).getTime();
    const intervals = events
      .filter(
        (e) => e.status !== "cancelled" && e.transparency !== "transparent",
      )
      .map((e) => [
        Math.max(
          lower,
          e.start.dateTime
            ? Date.parse(e.start.dateTime)
            : fromZonedTime(e.start.date + "T00:00:00", zone).getTime(),
        ),
        Math.min(
          upper,
          e.end.dateTime
            ? Date.parse(e.end.dateTime)
            : fromZonedTime(e.end.date + "T00:00:00", zone).getTime(),
        ),
      ])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    let total = 0,
      right = lower;
    for (const [s, e] of intervals) {
      total += Math.max(0, e - Math.max(right, s));
      right = Math.max(right, e);
    }
    return Math.round(total / 60000);
  })();
  const free = Math.max(0, 480 - occupiedMinutes);
  return (
    <div className="app connected-app">
      <header className="top">
        <a className="wordmark" href="/assistant">
          planner<span>pal</span>
          <span className="brand-mark">/</span>
        </a>
        {account && (
          <nav aria-label="Assistentnavigatie">
            <button
              className={tab === "overzicht" ? "current" : ""}
              onClick={() => setTab("overzicht")}
            >
              Mijn werkdag
            </button>
            <button
              className={tab === "concepten" ? "current" : ""}
              onClick={() => setTab("concepten")}
            >
              Antwoorden
            </button>
            <button
              className={tab === "notities" ? "current" : ""}
              onClick={() => setTab("notities")}
            >
              Gespreksnotities
            </button>
            <button
              className={tab === "instellingen" ? "current" : ""}
              onClick={() => setTab("instellingen")}
            >
              Instellingen
            </button>
          </nav>
        )}
        <div className="top-actions">
          <a className="source" href="/">
            Demo
          </a>
          {account && (
            <span className="user-avatar" title={account.email}>
              {account.name[0]}
            </span>
          )}
        </div>
      </header>
      {!account ? (
        <main className="connect-landing">
          <span className="overline">JE WERKDAG, OP ÉÉN PLEK</span>
          <h1>
            Begin met je account.
            <br />
            De rest volgt vanzelf.
          </h1>
          <p>
            Meld je aan met Google of Microsoft. Verbind daarna je mail en
            agenda wanneer je daar klaar voor bent.
          </p>
          {authFailed && (
            <div className="alert" role="alert">
              Aanmelden of verbinden is niet gelukt. Probeer opnieuw en geef de
              gevraagde toestemming. Zakelijke accounts kunnen goedkeuring van
              hun beheerder nodig hebben.
            </div>
          )}
          {revokeWarning && (
            <div className="alert">
              Je gegevens zijn verwijderd. Controleer de app-toestemming ook in
              de instellingen van je Google- of Microsoft-account.
            </div>
          )}
          <ProviderButtons available={providers} disabled={!configured} />
          {(!configured || (!providers.google && !providers.microsoft)) && (
            <p className="form-hint">
              Aanmelden is tijdelijk niet beschikbaar. Je kunt ondertussen de
              demo proberen.
            </p>
          )}
          <div className="signup-explainer">
            <Check size={17} />
            <span>
              Inloggen geeft ons nog geen toegang tot je mail of agenda.
            </span>
          </div>
          <div className="signup-explainer">
            <ShieldCheck size={17} />
            <span>Je werkplek en gegevens zijn alleen voor jou.</span>
          </div>
          <div className="install-tip">
            <Smartphone size={22} />
            <div>
              <strong>Ook op je iPhone</strong>
              <p>Open in Safari → Deel → Zet op beginscherm.</p>
            </div>
          </div>
          <p className="privacy-link">
            <a href="/privacy">Privacy</a> · <a href="/">Demo proberen</a> ·{" "}
            <a href="/admin">Voor de beheerder</a>
          </p>
        </main>
      ) : (
        <main>
          <div className="heading">
            <div>
              <span className="overline">
                {account.name.split(" ")[0].toUpperCase()} · JOUW WERKPLEK
              </span>
              <h1>
                {tab === "overzicht"
                  ? "Wat vraagt je aandacht?"
                  : tab === "concepten"
                    ? "Jij hebt het laatste woord."
                    : tab === "notities"
                      ? "Van gesprek naar actie."
                      : "Jouw verbindingen."}
              </h1>
              <p>
                {tab === "overzicht"
                  ? "Je nieuwste mails, openstaande taken en afspraken bij elkaar."
                  : tab === "concepten"
                    ? "Lees, bewerk en verstuur een antwoord pas als het klopt."
                    : tab === "notities"
                      ? aiReady
                        ? "Spreek na je gesprek een notitie in, of voeg je eigen opname toe."
                        : "Noteer je afspraken en kies welke acties je wilt bewaren."
                      : "Beheer toegang, bekijk uitgevoerde acties en installeer de app."}
              </p>
            </div>
            <button
              className="primary"
              disabled={Boolean(busy)}
              onClick={newTask}
            >
              <Plus size={15} />
              Nieuwe taak
            </button>
          </div>
          {revokeWarning && (
            <div className="alert" role="status">
              Je lokale koppeling is verwijderd. Trek de resterende toestemming
              in via{" "}
              <a
                href="https://myaccount.google.com/connections"
                target="_blank"
                rel="noreferrer"
              >
                Google
              </a>
              ,{" "}
              <a
                href="https://account.live.com/consent/Manage"
                target="_blank"
                rel="noreferrer"
              >
                Microsoft persoonlijk
              </a>{" "}
              of{" "}
              <a
                href="https://myapplications.microsoft.com/"
                target="_blank"
                rel="noreferrer"
              >
                Microsoft zakelijk
              </a>
              .
            </div>
          )}
          {!connected && (
            <section className="connect-next">
              <span className="overline">AANGEMELD · VOLGENDE STAP</span>
              <h2>Verbind je mail en agenda</h2>
              <p>
                Kies je mailaccount. Je krijgt het officiële toestemmingsscherm
                van Google of Microsoft. Eerst vragen we alleen om te lezen;
                verzenden en afspraken toevoegen kun je later apart activeren.
              </p>
              <ProviderButtons available={providers} intent="connect" />
              <p className="form-hint">
                Liever later? Je kunt alvast eigen taken en notities toevoegen.
              </p>
            </section>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Melding sluiten"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {message && (
            <div className="toast" role="status">
              {message}
              <button
                className="icon-button"
                aria-label="Melding sluiten"
                onClick={() => setMessage("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {busy && (
            <p className="action-progress" role="status">
              {busy}…
            </p>
          )}
          {!aiReady && (
            <div className="setup-callout compact">
              Betaalde AI staat uit. Gebruik gratis regelvoorstellen,
              standaardantwoorden en eigen taken.
            </div>
          )}
          {tab === "overzicht" && (
            <>
              <div className="day-toolbar">
                <label className="connected-date">
                  Werkdag
                  <input
                    aria-label="Werkdag"
                    type="date"
                    min="2000-01-01"
                    max="2100-12-31"
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                  />
                </label>
                <div className="sync-controls">
                  <span>
                    {syncedAt
                      ? `Mail bijgewerkt om ${syncedAt}`
                      : connected
                        ? "Mail wordt opgehaald…"
                        : "Nog geen mailaccount verbonden"}
                  </span>
                  <button
                    className="secondary"
                    disabled={Boolean(busy) || !connected}
                    onClick={() =>
                      void run("Ophalen", async () => {
                        await refresh(true);
                        await loadCalendar();
                      })
                    }
                  >
                    <RefreshCw size={13} />
                    Vernieuwen
                  </button>
                </div>
              </div>
              <p className="capacity-note">
                {calendarLoaded ? (
                  <>
                    <strong>{free} minuten vrij in je primaire agenda.</strong>{" "}
                    {wanted} minuten aan taken nog niet ingepland.
                    {wanted > free && " Niet alles past op deze dag."}
                  </>
                ) : (
                  "Verbind je agenda om de beschikbare tijd voor deze dag te zien."
                )}
              </p>
              <div className="assistant-actions">
                <button
                  className="secondary"
                  disabled={!permissions.readCalendar || Boolean(busy)}
                  onClick={() =>
                    void run("Dagoverzicht maken", async () => {
                      const result = await api<{ text: string }>(
                        "/api/brief",
                        "POST",
                        { date },
                      );
                      setBrief(result.text);
                    })
                  }
                >
                  Maak dagoverzicht
                </button>
                <button
                  className="secondary"
                  disabled={Boolean(busy) || !permissions.readMail}
                  onClick={() =>
                    void run("Wachtende gesprekken bekijken", async () => {
                      const result = await api<{
                        followups: NonNullable<typeof followups>;
                      }>("/api/followups", "POST");
                      setFollowups(result.followups);
                    })
                  }
                >
                  Waar wacht ik op?
                </button>
              </div>
              {brief && (
                <section className="brief-panel">
                  <span className="overline">JOUW DAG · OVERZICHT</span>
                  <p>{brief}</p>
                  <small>
                    Gebaseerd op je primaire agenda, maximaal 30 openstaande
                    taken en 10 recente inboxmails. Controleer de inhoud.
                  </small>
                </section>
              )}
              {followups && (
                <section className="brief-panel">
                  <h2>Mogelijk wachten op een reactie</h2>
                  <p className="form-hint">
                    Gesprekken waarin jouw mail de laatste is en minimaal drie
                    dagen oud. Dit is een aanwijzing, geen bewijs dat iemand
                    moet antwoorden.
                  </p>
                  {followups.map((f) => (
                    <a
                      className="followup-row"
                      key={f.id}
                      href={sourceLink(f.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>
                        {f.subject}
                        <small>{f.recipient}</small>
                      </span>
                      <b>{f.days} dagen</b>
                    </a>
                  ))}
                  {!followups.length && (
                    <p>
                      Geen wachtende gesprekken gevonden in de gecontroleerde
                      selectie.
                    </p>
                  )}
                </section>
              )}
              <div className="connected-grid">
                <section className="column connected-column">
                  <div className="column-head">
                    <h2>
                      Inbox <span>{data.mails.length}</span>
                    </h2>
                    <span className="column-meta">20 nieuwste inboxmails</span>
                  </div>
                  <div className="mail-list">
                    {data.mails.map((m) => (
                      <button
                        className="mail-row"
                        key={m.id}
                        onClick={() => setSelectedId(m.id)}
                      >
                        <div className="mail-from">
                          <span>{m.sender}</span>
                          <time>
                            {new Date(m.received_at).toLocaleDateString(
                              "nl-NL",
                              { day: "numeric", month: "short" },
                            )}
                          </time>
                        </div>
                        <h3>{m.subject}</h3>
                        <p>{m.analysis?.summary || m.body}</p>
                        <div className="mail-bottom">
                          <span>
                            {m.analysis
                              ? "Geanalyseerd"
                              : "Nog niet geanalyseerd"}
                          </span>
                          <ChevronRight size={13} />
                        </div>
                      </button>
                    ))}
                    {!data.mails.length && (
                      <p className="empty">
                        Nog geen mails opgehaald. Tik op Vernieuwen. Alleen de
                        20 nieuwste berichten in je inbox worden getoond.
                      </p>
                    )}
                  </div>
                </section>
                <section className="column connected-column">
                  <div className="column-head">
                    <h2>
                      Taken <span>{openTasks.length}</span>
                    </h2>
                    <button
                      className="icon-button"
                      aria-label="Taak toevoegen"
                      onClick={newTask}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                  <div className="task-list">
                    {[...openTasks, ...data.tasks.filter((t) => t.done)].map(
                      (t) => (
                        <article
                          className={`task-card ${t.done ? "done" : ""}`}
                          key={t.id}
                        >
                          <div className="task-title">
                            <button
                              className="checkbox"
                              aria-label={`${t.done ? "Heropen" : "Voltooi"} ${t.title}`}
                              disabled={Boolean(busy)}
                              onClick={() => void toggle(t)}
                            >
                              {t.done && <Check size={13} />}
                            </button>
                            <button
                              className="task-name"
                              onClick={() =>
                                setForm({
                                  ...t,
                                  source_mail: undefined,
                                  source_note: undefined,
                                  proposal_index: undefined,
                                })
                              }
                            >
                              {t.title}
                            </button>
                          </div>
                          <div className="task-content">
                            <div className="task-details">
                              <span
                                className={`priority ${t.priority.toLowerCase()}`}
                              >
                                {t.priority}
                              </span>
                              <span>{t.duration} min</span>
                              <span>Voor {t.deadline}</span>
                            </div>
                            <span className="other-day">
                              Werkdag {t.work_date}
                              {t.scheduled_start
                                ? " · " + clock(t.scheduled_start)
                                : ""}
                            </span>
                            {t.calendar_status === "uncertain" ||
                            t.calendar_status === "pending" ? (
                              <div>
                                <p className="form-error">
                                  De agenda-actie is onzeker. Controleer je
                                  agenda voordat je opnieuw plant.
                                </p>
                                <button
                                  className="secondary"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void run(
                                      "Agendastatus controleren",
                                      async () => {
                                        const result = await api<{
                                          found: boolean;
                                        }>("/api/calendar", "PATCH", {
                                          taskId: t.id,
                                        });
                                        await refresh();
                                        await loadCalendar();
                                        setMessage(
                                          result.found
                                            ? "Agendablok teruggevonden."
                                            : "Je agenda bevat geen actief blok met deze koppeling. Je kunt de taak opnieuw inplannen.",
                                        );
                                      },
                                    )
                                  }
                                >
                                  Agendastatus controleren
                                </button>
                              </div>
                            ) : (
                              <div className="task-actions">
                                {t.source_mail ? (
                                  <a
                                    className="source"
                                    href={sourceLink(t.source_mail)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Bronmail openen
                                  </a>
                                ) : (
                                  <span className="manual-label">
                                    {t.source_note
                                      ? "Uit gespreksnotitie"
                                      : "Zelf toegevoegd"}
                                  </span>
                                )}
                                {t.calendar_event_id && (
                                  <button
                                    className="source"
                                    disabled={Boolean(busy)}
                                    onClick={() =>
                                      void run(
                                        "Agendastatus controleren",
                                        async () => {
                                          await api("/api/calendar", "PATCH", {
                                            taskId: t.id,
                                          });
                                          await refresh();
                                          await loadCalendar();
                                          setMessage(
                                            "De agendastatus is bijgewerkt.",
                                          );
                                        },
                                      )
                                    }
                                  >
                                    Agenda controleren
                                  </button>
                                )}
                                {!t.done &&
                                  !permissions.writeCalendar &&
                                  connected && (
                                    <a
                                      className="plan-button"
                                      href={grant("calendar")}
                                    >
                                      Plannen activeren →
                                    </a>
                                  )}
                                {!t.done && permissions.writeCalendar && (
                                  <button
                                    className="plan-button"
                                    onClick={() =>
                                      setPlan({
                                        task: t,
                                        date: t.work_date,
                                        time: "09:00",
                                      })
                                    }
                                  >
                                    {t.calendar_event_id
                                      ? "Verplaatsen"
                                      : "Inplannen"}
                                    <ArrowRight size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </article>
                      ),
                    )}
                    {!data.tasks.length && (
                      <p className="empty">
                        Maak een eigen taak aan of laat een mail analyseren.
                      </p>
                    )}
                  </div>
                </section>
                <section className="column connected-column">
                  <div className="column-head">
                    <h2>{connected ? providerLabel + " Agenda" : "Agenda"}</h2>
                    <span className="column-meta">Primaire agenda</span>
                  </div>
                  <div className="real-agenda">
                    {eventsError ? (
                      <p className="form-error">{eventsError}</p>
                    ) : !calendarLoaded ? (
                      <p className="empty">
                        {connected
                          ? "Agenda ophalen…"
                          : "Verbind je mail en agenda om afspraken te zien."}
                      </p>
                    ) : events.length === 0 ? (
                      <p className="empty">Geen afspraken op deze dag.</p>
                    ) : (
                      events.map((e) => (
                        <article className="real-event" key={e.id}>
                          <time>
                            {e.start.dateTime
                              ? clock(e.start.dateTime)
                              : "Hele dag"}
                            {e.end.dateTime
                              ? " – " + clock(e.end.dateTime)
                              : ""}
                          </time>
                          <h3>{e.summary || "Afspraak"}</h3>
                          <button
                            className="source"
                            disabled={
                              !permissions.readCalendar || Boolean(busy)
                            }
                            onClick={() =>
                              void run("Afspraak voorbereiden", async () => {
                                const result = await api<{ text: string }>(
                                  "/api/brief",
                                  "POST",
                                  { date, eventId: e.id },
                                );
                                setMeetingBrief(result.text);
                              })
                            }
                          >
                            Afspraak voorbereiden
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                  <a
                    className="column-foot"
                    href={
                      account.provider === "microsoft"
                        ? "https://outlook.office.com/calendar/"
                        : `https://calendar.google.com/calendar/?authuser=${encodeURIComponent(mailboxEmail)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open je agenda →
                  </a>
                </section>
              </div>
            </>
          )}
          {tab === "concepten" && (
            <div className="draft-grid">
              {data.drafts.map((d) => (
                <article className="draft-card" key={d.id}>
                  <header>
                    <div>
                      <span className="overline">AAN {d.recipient}</span>
                      <h3>{d.subject}</h3>
                    </div>
                    <span
                      className={`draft-status ${d.status === "sent" ? "approved" : ""}`}
                    >
                      {
                        {
                          draft: "Concept",
                          sending: "Bezig met verzenden",
                          sent: "Verstuurd",
                          uncertain: "Controleer Verzonden",
                          failed: "Niet verstuurd",
                        }[d.status]
                      }
                    </span>
                  </header>
                  <p className="draft-preview">{d.body}</p>
                  {["draft", "failed"].includes(d.status) ? (
                    <button
                      className="primary"
                      onClick={() => {
                        setDraft({ ...d });
                        setSendConfirm(false);
                      }}
                    >
                      Controleren & bewerken
                      <ArrowRight size={14} />
                    </button>
                  ) : d.status === "uncertain" || d.status === "sending" ? (
                    <div>
                      <p className="form-hint">
                        Controleer je map Verzonden. We versturen dit antwoord
                        niet opnieuw zonder een bevestigde status.
                      </p>
                      <button
                        className="secondary"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run("Verzendstatus controleren", async () => {
                            const result = await api<{ resolved: boolean }>(
                              "/api/drafts",
                              "PUT",
                              { id: d.id },
                            );
                            await refresh();
                            setMessage(
                              result.resolved
                                ? "Het antwoord staat in Verzonden."
                                : "Nog geen bevestiging gevonden. Controleer je map Verzonden; verstuur niet opnieuw zolang dit onzeker is.",
                            );
                          })
                        }
                      >
                        Verzendstatus controleren
                      </button>
                    </div>
                  ) : (
                    <p className="form-hint">
                      Dit antwoord is via je mailaccount verstuurd.
                    </p>
                  )}
                </article>
              ))}
              {!data.drafts.length && (
                <p className="empty">
                  Laat eerst een mail analyseren om een antwoordconcept te
                  maken.
                </p>
              )}
            </div>
          )}
          {tab === "notities" && (
            <>
              <VoiceNote
                disabled={Boolean(busy)}
                canTranscribe={aiReady}
                onTranscript={async (text) => {
                  await run("Acties uit notitie halen", async () => {
                    await api(
                      aiReady ? "/api/ai" : "/api/suggestions",
                      "POST",
                      { kind: "note", text },
                    );
                    await refresh();
                    setMessage(
                      "Notitie verwerkt. Kies welke voorgestelde acties je wilt bewaren.",
                    );
                  });
                }}
                onError={setError}
              />
              <div className="note-list">
                {data.notes.map((note) => (
                  <section className="draft-card" key={note.id}>
                    <span className="overline">
                      {new Date(note.created_at).toLocaleString("nl-NL")}
                    </span>
                    <h3>{note.analysis.summary}</h3>
                    <details>
                      <summary>Gespreksnotitie bekijken</summary>
                      <p className="mail-body">{note.transcript}</p>
                    </details>
                    {note.analysis.tasks.map((s, index) => (
                      <div className="note-suggestion" key={index}>
                        <div>
                          <strong>{s.title}</strong>
                          <p>
                            {s.duration} minuten · {s.reason}
                          </p>
                        </div>
                        <button
                          className="secondary"
                          disabled={data.tasks.some(
                            (t) =>
                              t.source_note === note.id &&
                              t.proposal_index === index,
                          )}
                          onClick={() => accept(s, { note: note.id, index })}
                        >
                          Taak controleren
                        </button>
                      </div>
                    ))}
                    {!note.analysis.tasks.length && (
                      <p className="form-hint">
                        Geen concrete acties gevonden.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {tab === "instellingen" && (
            <div className="settings-grid">
              <section className="draft-card">
                <ShieldCheck size={23} />
                <h2>Je account</h2>
                <p>Aangemeld als {account.email}</p>
                <p>
                  {connected
                    ? `Mail en agenda verbonden met ${providerLabel}: ${mailboxEmail}`
                    : "Nog geen mailaccount verbonden. Je eigen taken blijven beschikbaar."}
                </p>
                {connected && (
                  <div className="permission-list">
                    <span>
                      <Check size={13} />
                      Mail en agenda lezen
                    </span>
                    {permissions.sendMail ? (
                      <span>
                        <Check size={13} />
                        Antwoorden versturen na bevestiging
                      </span>
                    ) : (
                      <a className="secondary" href={grant("send")}>
                        Verzenden activeren
                      </a>
                    )}
                    {permissions.writeCalendar ? (
                      <span>
                        <Check size={13} />
                        Agendablokken maken na bevestiging
                      </span>
                    ) : (
                      <a className="secondary" href={grant("calendar")}>
                        Plannen activeren
                      </a>
                    )}
                    <button
                      className="secondary"
                      onClick={() => setDisconnect(true)}
                    >
                      Mail en agenda loskoppelen
                    </button>
                  </div>
                )}
                <button
                  className="secondary"
                  onClick={() =>
                    void run("Uitloggen", async () => {
                      await api("/api/auth/logout", "POST");
                      location.assign("/assistant");
                    })
                  }
                >
                  Uitloggen
                </button>
                <button
                  className="danger"
                  onClick={() => setRemoveAccount(true)}
                >
                  Accountgegevens verwijderen
                </button>
              </section>
              <section className="draft-card">
                <Smartphone size={23} />
                <h2>Op je iPhone</h2>
                <p>
                  Open in Safari → Deel → Zet op beginscherm. Log daarna in de
                  geïnstalleerde app in met Google of Microsoft.
                </p>
                <p>
                  Opnames beginnen alleen na jouw actie. Er wordt niet op de
                  achtergrond naar telefoongesprekken geluisterd.
                </p>
                <a className="source" href="/privacy">
                  Privacy & gegevens bekijken
                </a>
              </section>
              <section className="draft-card activity-log">
                <h2>Uitgevoerde acties</h2>
                {data.log.map((entry) => (
                  <div key={entry.id}>
                    <time>
                      {new Date(entry.created_at).toLocaleString("nl-NL")}
                    </time>
                    <span>
                      {entry.action} · {entry.status}
                    </span>
                  </div>
                ))}
                {!data.log.length && <p>Nog geen acties uitgevoerd.</p>}
              </section>
            </div>
          )}
          <footer>
            <span>Aangemeld als {account.email}</span>
            <span>Alleen jouw goedgekeurde acties worden uitgevoerd.</span>
          </footer>
        </main>
      )}
      {meetingBrief && (
        <Dialog
          title="Voorbereiding op je afspraak"
          label="OVERZICHT OP BASIS VAN JE TAKEN"
          onClose={() => setMeetingBrief("")}
        >
          <p className="mail-body preserved">{meetingBrief}</p>
          <p className="form-hint">
            Controleer de inhoud aan de hand van je mails en afspraken. Dit is
            een voorstel op basis van een beperkte selectie.
          </p>
        </Dialog>
      )}
      {selected && (
        <Dialog
          title={selected.subject}
          label="BRONMAIL"
          side
          onClose={() => setSelectedId(null)}
        >
          <div className="mail-person">
            <div>
              <strong>{selected.sender}</strong>
              <span>Antwoord gaat naar {selected.recipient}</span>
            </div>
          </div>
          <p className="mail-body preserved">{selected.body}</p>
          {selected.analysis ? (
            <>
              <p className="analysis-summary">{selected.analysis.summary}</p>
              {selected.analysis.tasks.map((s, index) => (
                <section className="proposal" key={index}>
                  <h3>{s.title}</h3>
                  <p>
                    {s.reason} · {s.duration} min
                    {s.deadline
                      ? " · Deadline " + s.deadline
                      : " · Geen deadline gevonden"}
                  </p>
                  <button
                    className="primary"
                    disabled={data.tasks.some(
                      (t) =>
                        t.source_mail === selected.id &&
                        t.proposal_index === index,
                    )}
                    onClick={() => accept(s, { mail: selected.id, index })}
                  >
                    Taak controleren
                    <ArrowRight size={14} />
                  </button>
                </section>
              ))}
              {!selected.analysis.tasks.length && (
                <p className="form-hint">
                  Geen concrete taak gevonden in deze mail.
                </p>
              )}
              <button
                className="secondary wide"
                onClick={() => {
                  setSelectedId(null);
                  setTab("concepten");
                }}
              >
                Antwoordconcept bekijken
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <div className="proposal">
              <h3>Wat moet hiermee gebeuren?</h3>
              <p>
                {aiReady
                  ? "Bij analyseren gaat de mailtekst naar de ingestelde AI-dienst."
                  : "We maken een regelvoorstel en een standaardantwoord. De inhoud wordt niet naar een AI-dienst gestuurd."}{" "}
                Er wordt niets automatisch verstuurd.
              </p>
              <button
                className="primary"
                disabled={Boolean(busy)}
                onClick={() => void analyzeMail(selected)}
              >
                {aiReady ? "Mail analyseren" : "Regelvoorstel maken"}
              </button>
            </div>
          )}
          <button
            className="source"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Concept maken", async () => {
                const created = await api<ConnectedDraft>(
                  "/api/drafts",
                  "POST",
                  { action: "create", mailId: selected.id },
                );
                setSelectedId(null);
                await refresh();
                setDraft(created);
                setSendConfirm(false);
              })
            }
          >
            Zelf een antwoord schrijven
          </button>
        </Dialog>
      )}
      {form && (
        <Dialog
          title={form.id ? "Taak aanpassen" : "Taak controleren"}
          label="MIJN TAKEN"
          onClose={() => setForm(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveTask();
            }}
          >
            {editingPlanned && (
              <p className="form-hint">
                Titel en duur van een gekoppeld agendablok staan vast.
                Verplaatsen kan via Inplannen. Je kunt prioriteit en deadline
                hier aanpassen.
              </p>
            )}
            <label>
              Titel
              <input
                disabled={editingPlanned}
                autoFocus
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Duur (minuten)
                <input
                  disabled={editingPlanned}
                  type="number"
                  required
                  min={5}
                  max={480}
                  value={form.duration || ""}
                  onChange={(e) =>
                    setForm({ ...form, duration: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Prioriteit
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value as TaskForm["priority"],
                    })
                  }
                >
                  {["Hoog", "Normaal", "Laag"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Werkdag
                <input
                  disabled={editingPlanned}
                  type="date"
                  required
                  value={form.work_date}
                  onChange={(e) =>
                    setForm({ ...form, work_date: e.target.value })
                  }
                />
              </label>
              <label>
                Deadline
                <input
                  type="date"
                  required
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              {form.id && !editingPlanned && (
                <button
                  className="danger"
                  type="button"
                  onClick={() => setDeleteTaskConfirm(true)}
                >
                  Verwijderen
                </button>
              )}
              <button
                className="secondary"
                type="button"
                onClick={() => setForm(null)}
              >
                Annuleren
              </button>
              <button disabled={Boolean(busy)} className="primary">
                Taak bewaren
              </button>
            </div>
            {deleteTaskConfirm && (
              <div className="setup-callout">
                <p>Deze taak definitief verwijderen?</p>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setDeleteTaskConfirm(false)}
                >
                  Annuleren
                </button>
                <button
                  className="danger"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("Taak verwijderen", async () => {
                      await api("/api/tasks", "DELETE", {
                        id: form.id,
                        version: form.version,
                        confirmed: true,
                      });
                      setForm(null);
                      await refresh();
                      setMessage("Taak verwijderd.");
                    })
                  }
                >
                  Ja, verwijder taak
                </button>
              </div>
            )}
          </form>
        </Dialog>
      )}
      {plan && (
        <Dialog
          title="In je agenda zetten"
          label="BEVESTIG DE AFSPRAAK"
          onClose={() => setPlan(null)}
        >
          <h3 className="plan-task-title">{plan.task.title}</h3>
          <p className="form-hint">
            {plan.task.duration} minuten. We controleren je primaire agenda
            opnieuw voordat het blok wordt toegevoegd. Dit maakt of verplaatst
            een echte afspraak.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("Agenda bijwerken", async () => {
                const result = await api<{
                  planned: boolean;
                  uncertain?: boolean;
                }>("/api/calendar", "POST", {
                  taskId: plan.task.id,
                  version: plan.task.version,
                  date: plan.date,
                  time: plan.time,
                  confirmed: true,
                });
                setDate(plan.date);
                setPlan(null);
                await refresh();
                if (plan.date === date) await loadCalendar();
                setMessage(
                  result.uncertain
                    ? "Geen bevestiging van je agenda ontvangen. Controleer je agenda voordat je opnieuw plant."
                    : "Taak staat in je agenda.",
                );
              });
            }}
          >
            <div className="form-grid">
              <label>
                Dag
                <input
                  type="date"
                  required
                  value={plan.date}
                  onChange={(e) => setPlan({ ...plan, date: e.target.value })}
                />
              </label>
              <label>
                Starttijd
                <input
                  type="time"
                  min="09:00"
                  max="16:55"
                  required
                  value={plan.time}
                  onChange={(e) => setPlan({ ...plan, time: e.target.value })}
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button className="primary" disabled={Boolean(busy)}>
                Goedkeuren & inplannen
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {draft && (
        <Dialog
          title={
            sendConfirm ? "Dit antwoord versturen?" : "Antwoord controleren"
          }
          label="ANTWOORDCONTROLLE"
          onClose={() => {
            setDraft(null);
            setSendConfirm(false);
          }}
        >
          <div className="recipient-box">
            <strong>Aan: {draft.recipient}</strong>
            <span>{draft.subject}</span>
          </div>
          {sendConfirm ? (
            <>
              <p className="draft-preview send-preview">{draft.body}</p>
              <p className="form-hint">
                Dit verstuurt onderstaande tekst nu vanuit {mailboxEmail}. Een
                verzonden mail kun je hier niet terughalen.
              </p>
              <div className="dialog-actions">
                <button
                  className="secondary"
                  onClick={() => setSendConfirm(false)}
                >
                  Terug
                </button>
                <button
                  disabled={Boolean(busy)}
                  className="primary"
                  onClick={() => void send()}
                >
                  Ja, verstuur dit antwoord
                </button>
              </div>
            </>
          ) : (
            <>
              <label>
                Antwoord
                <textarea
                  className="reply-editor"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
              <p className="form-hint">
                Controleer feiten, bedragen en toezeggingen. De ontvanger komt
                uit de bronmail en kan niet door de AI worden gewijzigd.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="secondary"
                  disabled={Boolean(busy) || !draft.body.trim()}
                  onClick={() => void saveDraft()}
                >
                  Wijzigingen bewaren
                </button>
                {!permissions.sendMail &&
                  connected &&
                  (draftChanged ? (
                    <button className="primary" disabled>
                      Bewaar eerst je wijzigingen
                    </button>
                  ) : (
                    <a className="primary" href={grant("send")}>
                      Verzenden activeren
                    </a>
                  ))}
                <button
                  className="primary"
                  disabled={
                    Boolean(busy) ||
                    draftChanged ||
                    draft.status !== "draft" ||
                    !permissions.sendMail
                  }
                  onClick={() => setSendConfirm(true)}
                >
                  Verzenden controleren
                </button>
              </div>
              {draftChanged && (
                <p className="form-hint">
                  Bewaar je wijzigingen voordat je verzendt.
                </p>
              )}
            </>
          )}
          {sendConfirm && error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {disconnect && (
        <Dialog
          title="Mail en agenda loskoppelen?"
          label="JE VERBINDING"
          onClose={() => setDisconnect(false)}
        >
          <p className="reset-description">
            Je blijft aangemeld. Je taken en notities blijven bewaard.
            Opgehaalde mail en concepten worden verwijderd. Bestaande afspraken
            en verstuurde mails blijven bij je aanbieder staan.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDisconnect(false)}>
              Annuleren
            </button>
            <button
              className="primary"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Loskoppelen", async () => {
                  const result = await api<{
                    revoked: boolean;
                    provider: string;
                  }>("/api/connections", "DELETE", { confirmed: true });
                  if (!result.revoked) {
                    setMessage(
                      "Losgekoppeld. Verwijder de app-toestemming ook bij je mailaanbieder.",
                    );
                  }
                  location.assign(
                    "/assistant" + (!result.revoked ? "?revoke=manual" : ""),
                  );
                })
              }
            >
              Loskoppelen
            </button>
          </div>
        </Dialog>
      )}
      {removeAccount && (
        <Dialog
          title="Verbinding en gegevens verwijderen?"
          label="JE ACCOUNT"
          onClose={() => setRemoveAccount(false)}
        >
          <p className="reset-description">
            We verwijderen jouw taken, opgeslagen mailteksten, notities,
            concepten en actielog uit PlannerPal. Mails en afspraken bij je
            mailaanbieder blijven bestaan.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary"
              onClick={() => setRemoveAccount(false)}
            >
              Annuleren
            </button>
            <button
              className="primary"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Account verwijderen", async () => {
                  const result = await api<{ revoked: boolean }>(
                    "/api/account",
                    "DELETE",
                    { confirmed: true },
                  );
                  location.assign(
                    result.revoked ? "/assistant" : "/assistant?revoke=manual",
                  );
                })
              }
            >
              Gegevens verwijderen
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
