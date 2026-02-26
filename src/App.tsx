import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import type { CalendarCategory, CalendarDocument, CalendarEvent } from "../shared/types";

type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
};

type GoogleAuthStatus = {
  configured: boolean;
  authenticated: boolean;
  user?: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };
  calendars?: GoogleCalendarSummary[];
  selectedCalendarId?: string;
  error?: string;
};

type EditableCalendarEventArg = {
  event: {
    id: string;
    start: Date | null;
    end: Date | null;
    allDay: boolean;
  };
  revert: () => void;
};

async function fetchCalendar(): Promise<CalendarDocument> {
  const response = await fetch("/api/calendar");
  if (!response.ok) {
    throw new Error("Unable to load calendar data");
  }
  return response.json();
}

async function fetchGoogleStatus(): Promise<GoogleAuthStatus> {
  const response = await fetch("/api/google/auth/status");
  if (!response.ok) {
    throw new Error("Unable to load Google auth status");
  }
  return response.json();
}

function formatDateRange(event: CalendarEvent): string {
  if (event.allDay) {
    return `${event.start.slice(0, 10)} (all day)`;
  }
  const start = event.start.replace("T", " ").slice(0, 16);
  const end = event.end.replace("T", " ").slice(0, 16);
  return `${start} -> ${end}`;
}

function App() {
  const [document, setDocument] = useState<CalendarDocument | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Loading calendar...");
  const [google, setGoogle] = useState<GoogleAuthStatus>({ configured: false, authenticated: false });
  const [syncing, setSyncing] = useState(false);
  const [authWorking, setAuthWorking] = useState(false);

  const categories = document?.frontmatter.categories || [];

  async function refreshCalendar(message?: string) {
    const loaded = await fetchCalendar();
    setDocument(loaded);
    if (message) {
      setStatus(message);
    }
  }

  async function refreshGoogle() {
    const loaded = await fetchGoogleStatus();
    setGoogle(loaded);
  }

  useEffect(() => {
    Promise.all([refreshCalendar(), refreshGoogle()])
      .then(() => {
        const params = new URLSearchParams(window.location.search);
        const googleAuth = params.get("google_auth");
        const reason = params.get("reason");

        if (googleAuth === "success") {
          setStatus("Google account connected. Choose a calendar and sync.");
          window.history.replaceState({}, "", window.location.pathname);
        }

        if (googleAuth === "error") {
          setStatus(`Google auth failed${reason ? `: ${reason}` : ""}`);
          window.history.replaceState({}, "", window.location.pathname);
        }

        if (googleAuth !== "success" && googleAuth !== "error") {
          setStatus("Synced with calendar.md");
        }
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Load failed");
      });
  }, []);

  const selectedEvent = useMemo(
    () => document?.events.find((event) => event.id === selectedEventId) || null,
    [document, selectedEventId]
  );

  const events: EventInput[] = useMemo(() => {
    if (!document) return [];

    return document.events.map((event) => {
      const category = categories.find((item) => item.id === event.category);
      const color = category?.color || "#64748b";

      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          completed: event.completed,
          category: event.category
        }
      };
    });
  }, [categories, document]);

  async function patchEvent(id: string, updates: Partial<CalendarEvent>, message: string) {
    const response = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Unable to update event");
    }

    await refreshCalendar(message);
  }

  async function handleDragOrResize(arg: EditableCalendarEventArg) {
    const id = arg.event.id;
    const updates: Partial<CalendarEvent> = {
      start: arg.event.start?.toISOString(),
      end: arg.event.end?.toISOString() || arg.event.start?.toISOString(),
      allDay: arg.event.allDay
    };

    try {
      await patchEvent(id, updates, "Event moved in calendar.md");
    } catch (error) {
      arg.revert();
      setStatus(error instanceof Error ? error.message : "Could not move event");
    }
  }

  async function toggleCompleted(eventId: string, completed: boolean) {
    try {
      await patchEvent(eventId, { completed }, completed ? "Marked complete" : "Marked incomplete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Toggle failed");
    }
  }

  async function deleteSelected() {
    if (!selectedEvent) return;

    const response = await fetch(`/api/events/${selectedEvent.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus(body.error || "Delete failed");
      return;
    }

    setSelectedEventId(null);
    await refreshCalendar("Event removed");
  }

  async function selectGoogleCalendar(calendarId: string) {
    try {
      const response = await fetch("/api/google/calendars/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not select calendar");
      }

      await refreshGoogle();
      setStatus("Google Calendar selected. Click Sync Now to merge updates.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Calendar selection failed");
    }
  }

  async function syncGoogleCalendar() {
    if (!google.authenticated || !google.selectedCalendarId) {
      setStatus("Sign in and choose a Google Calendar first.");
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch("/api/google/sync", {
        method: "POST"
      });

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Sync failed");
      }

      await Promise.all([refreshCalendar(), refreshGoogle()]);
      setStatus(body.message || "Two-way sync completed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function signOutGoogle() {
    setAuthWorking(true);
    try {
      await fetch("/api/google/auth/logout", { method: "POST" });
      await refreshGoogle();
      setStatus("Signed out from Google");
    } finally {
      setAuthWorking(false);
    }
  }

  function renderEventContent(arg: EventContentArg) {
    const completed = Boolean(arg.event.extendedProps.completed);
    const category = String(arg.event.extendedProps.category || "life");

    return (
      <div className="event-card">
        <button
          className={`event-check ${completed ? "is-complete" : ""}`}
          onClick={(clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            void toggleCompleted(arg.event.id, !completed);
          }}
          title={completed ? "Mark incomplete" : "Mark complete"}
          aria-label={completed ? "Mark incomplete" : "Mark complete"}
        >
          {completed ? "x" : ""}
        </button>
        <div className="event-copy">
          <div className={`event-title ${completed ? "done" : ""}`}>{arg.event.title}</div>
          <div className="event-category">{category}</div>
        </div>
      </div>
    );
  }

  const selectedGoogleCalendar = google.calendars?.find((item) => item.id === google.selectedCalendarId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Human-Friendly Calendar</h1>
          <p>Drag, resize, and check off task-style events. New events are created by CLI agents only.</p>
        </div>
        <div className="status-pill">{status}</div>
      </header>

      <section className="google-panel">
        {!google.configured ? (
          <p className="google-help">
            Google OAuth is not configured. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in
            your server environment.
          </p>
        ) : null}

        {google.configured && !google.authenticated ? (
          <a className="auth-link" href="/api/google/auth/start">
            Sign in with Google
          </a>
        ) : null}

        {google.configured && google.authenticated ? (
          <div className="google-controls">
            <div className="google-user-row">
              <div>
                Connected as <strong>{google.user?.email}</strong>
              </div>
              <button type="button" onClick={() => void signOutGoogle()} disabled={authWorking} className="ghost-btn">
                {authWorking ? "Signing out..." : "Sign out"}
              </button>
            </div>

            <div className="calendar-buttons">
              {(google.calendars || []).map((calendar) => {
                const selected = google.selectedCalendarId === calendar.id;
                return (
                  <button
                    key={calendar.id}
                    type="button"
                    onClick={() => void selectGoogleCalendar(calendar.id)}
                    className={`calendar-button ${selected ? "selected" : ""}`}
                  >
                    {calendar.summary}
                    {calendar.primary ? " (Primary)" : ""}
                  </button>
                );
              })}
            </div>

            <div className="sync-row">
              <button
                type="button"
                onClick={() => void syncGoogleCalendar()}
                disabled={syncing || !google.selectedCalendarId}
                className="sync-button"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
              <span className="sync-hint">
                {selectedGoogleCalendar
                  ? `Selected calendar: ${selectedGoogleCalendar.summary}`
                  : "Select a Google Calendar to start two-way sync"}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <main className="workspace">
        <section className="calendar-panel">
          <div className="category-row">
            {categories.map((category: CalendarCategory) => (
              <span key={category.id} className="category-chip" style={{ backgroundColor: category.color }}>
                {category.label}
              </span>
            ))}
          </div>

          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay"
            }}
            editable
            events={events}
            eventDrop={handleDragOrResize}
            eventResize={handleDragOrResize}
            eventClick={(arg) => setSelectedEventId(arg.event.id)}
            eventContent={renderEventContent}
            height="auto"
          />
        </section>

        <aside className="editor-panel">
          <h2>Event Details</h2>

          {selectedEvent ? (
            <div className="event-details">
              <p className="event-details-title">{selectedEvent.title}</p>
              <p>{formatDateRange(selectedEvent)}</p>
              <p>Category: {selectedEvent.category}</p>
              <p>Completed: {selectedEvent.completed ? "Yes" : "No"}</p>
              {selectedEvent.location ? <p>Location: {selectedEvent.location}</p> : null}
              {selectedEvent.notes ? <p>Notes: {selectedEvent.notes}</p> : null}
              <div className="details-actions">
                <button type="button" onClick={() => void deleteSelected()} className="danger-btn">
                  Delete Event
                </button>
              </div>
            </div>
          ) : (
            <div className="event-details">
              <p>Select any event to inspect details.</p>
              <p>
                To add events, use CLI from repo root:
                <br />
                <code>npm run cli -- add --title "..." --start "..." --end "..." --category life</code>
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
