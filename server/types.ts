export type ConnectedMail = {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  body: string;
  received_at: string;
  analysis: {
    summary: string;
    tasks: Suggestion[];
    reply: string;
    source?: "rules" | "ai";
  } | null;
};
export type Suggestion = {
  title: string;
  duration: number;
  priority: "Hoog" | "Normaal" | "Laag";
  deadline: string | null;
  reason: string;
};
export type ConnectedTask = {
  id: string;
  title: string;
  duration: number;
  priority: "Hoog" | "Normaal" | "Laag";
  deadline: string;
  work_date: string;
  done: boolean;
  source_mail: string | null;
  source_note: string | null;
  proposal_index: number | null;
  calendar_event_id: string | null;
  calendar_status: "none" | "pending" | "planned" | "uncertain";
  scheduled_start: string | null;
  scheduled_end: string | null;
  version: number;
};
export type ConnectedDraft = {
  id: string;
  source_mail: string;
  recipient: string;
  subject: string;
  body: string;
  revision: number;
  status: "draft" | "sending" | "sent" | "uncertain" | "failed";
};
export type ConnectedNote = {
  id: string;
  transcript: string;
  analysis: {
    summary: string;
    tasks: Suggestion[];
    reply: string;
    source?: "rules" | "ai";
  };
  created_at: string;
};
export type ConnectedEvent = {
  id: string;
  transparency?: string;
  status?: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
};
export type Workspace = {
  mails: ConnectedMail[];
  tasks: ConnectedTask[];
  drafts: ConnectedDraft[];
  notes: ConnectedNote[];
  log: { id: string; action: string; status: string; created_at: string }[];
};
