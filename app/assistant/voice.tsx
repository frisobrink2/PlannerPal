"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload } from "lucide-react";
export default function VoiceNote({
  disabled,
  canTranscribe = false,
  onTranscript,
  onError,
}: {
  disabled: boolean;
  canTranscribe?: boolean;
  onTranscript: (text: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [starting, setStarting] = useState(false);
  const acquiring = useRef(false);
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mounted = useRef(true);
  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    const stop = () => {
      if (
        document.visibilityState === "hidden" &&
        recorder.current?.state === "recording"
      ) {
        recorder.current.stop();
        cleanup();
      }
    };
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("pagehide", stop);
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
    };
  }, []);
  async function start() {
    if (acquiring.current) return;
    acquiring.current = true;
    setStarting(true);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Deze browser ondersteunt opnemen niet. Voeg een opname toe of typ je notitie.",
        );
      setBlob(null);
      setSeconds(0);
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        cleanup();
        return;
      }
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const rec = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const audio = new Blob(chunks.current, {
          type: rec.mimeType.split(";")[0] || "audio/mp4",
        });
        cleanup();
        if (mounted.current) {
          setBlob(audio);
          setRecording(false);
        }
      };
      rec.start(1000);
      setRecording(true);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 90 && rec.state === "recording") rec.stop();
      }, 1000);
    } catch (e) {
      cleanup();
      onError(e instanceof Error ? e.message : "Microfoon openen mislukt.");
    } finally {
      acquiring.current = false;
      if (mounted.current) setStarting(false);
    }
  }
  async function transcribe(audio: Blob) {
    setWorking(true);
    try {
      if (audio.size > 4000000)
        throw new Error("Kies een opname van maximaal 4 MB.");
      const data = new FormData();
      data.set("audio", audio, "notitie");
      const response = await fetch("/api/voice", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Transcriptie mislukt.");
      setText(result.text);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Transcriptie mislukt.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="voice-panel">
      <div>
        <span className="overline">
          {canTranscribe ? "SPRAAKNOTITIE OF EIGEN OPNAME" : "GESPREKSNOTITIE"}
        </span>
        <h2>Wat is er afgesproken?</h2>
        <p>
          {canTranscribe
            ? "Neem maximaal 90 seconden op, voeg audio toe of typ je notitie. Transcriptie gebruikt de ingestelde AI-dienst."
            : "Typ je notitie. Regelvoorstellen werken zonder AI-aanroepen. Audio-transcriptie staat uit om kosten te voorkomen."}
        </p>
      </div>
      {canTranscribe && (
        <div className="voice-controls">
          <button
            className={recording ? "recording-button" : "primary"}
            disabled={!recording && (disabled || working || starting)}
            onClick={() =>
              recording ? recorder.current?.stop() : void start()
            }
          >
            {recording ? (
              <>
                <Square size={15} />
                Stop opname · {seconds}s
              </>
            ) : (
              <>
                <Mic size={16} />
                Notitie opnemen
              </>
            )}
          </button>
          <label className="secondary upload-button">
            <Upload size={15} />
            Opname toevoegen
            <input
              type="file"
              accept="audio/*"
              disabled={disabled || working || recording}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setBlob(file);
                  setText("");
                }
                e.target.value = "";
              }}
            />
          </label>
          {blob && (
            <button
              className="secondary"
              disabled={disabled || working || recording}
              onClick={() => void transcribe(blob)}
            >
              {working ? "Uitschrijven…" : "Opname uitschrijven"}
            </button>
          )}
        </div>
      )}
      <label>
        Jouw gespreksnotitie
        <textarea
          value={text}
          maxLength={16000}
          placeholder="Bijvoorbeeld: Met Sophie besproken dat ik vrijdag een nieuwe offerte stuur. Daar heb ik ongeveer een uur voor nodig."
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <p className="form-hint">
        {canTranscribe
          ? "Controleer de transcriptie voordat je acties laat voorstellen. Gebruik alleen opnames die je mag delen. Dit neemt geen telefoongesprekken op."
          : "Zet iedere mogelijke actie op een eigen regel. Controleer titel, duur en deadline voordat je een taak bewaart."}
      </p>
      <button
        className="primary"
        disabled={disabled || working || recording || text.trim().length < 5}
        onClick={async () => {
          setWorking(true);
          try {
            await onTranscript(text);
          } finally {
            setWorking(false);
          }
        }}
      >
        Acties voorstellen
      </button>
    </section>
  );
}
