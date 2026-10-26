import { database } from "./db";
export async function workspace(userId: string) {
  const db = database();
  const [mails, tasks, drafts, notes, log] = await Promise.all([
    db.query(
      "SELECT id,subject,sender,recipient,body,received_at,analysis FROM mail_cache WHERE user_id=$1 AND in_inbox=true ORDER BY received_at DESC LIMIT 20",
      [userId],
    ),
    db.query(
      "SELECT id,title,duration,priority,deadline::text,work_date::text,done,source_mail,source_note,proposal_index,calendar_event_id,calendar_status,scheduled_start,scheduled_end,version FROM tasks WHERE user_id=$1 ORDER BY done,deadline,created_at DESC LIMIT 500",
      [userId],
    ),
    db.query(
      "SELECT id,source_mail,recipient,subject,body,revision,status FROM drafts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
      [userId],
    ),
    db.query(
      "SELECT id,transcript,analysis,created_at FROM notes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10",
      [userId],
    ),
    db.query(
      "SELECT id,action,status,created_at FROM audit_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
      [userId],
    ),
  ]);
  return {
    mails: mails.rows,
    tasks: tasks.rows,
    drafts: drafts.rows,
    notes: notes.rows,
    log: log.rows,
  };
}
