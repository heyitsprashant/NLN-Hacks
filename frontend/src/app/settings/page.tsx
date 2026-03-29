"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2, Plus, Download, AlertTriangle, User, Users, Bell, Shield } from "lucide-react";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";

type TrustedContact = {
  email: string;
  verified?: boolean;
  alertsEnabled?: boolean;
};

type AlertSettings = {
  burnoutRisk: boolean;
  anxietyPattern: boolean;
  sensitivity: "low" | "medium" | "high";
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

type PrivacySettings = {
  dataCollectionEnabled: boolean;
};

type UserSettingsPayload = {
  email: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
  };
  contacts: TrustedContact[];
  alerts: AlertSettings;
  privacy: PrivacySettings;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const FALLBACK_SETTINGS: UserSettingsPayload = {
  email: "user@example.com",
  timezone: "America/New_York",
  notifications: { email: true, push: false },
  contacts: [
    { email: "friend@example.com", verified: true, alertsEnabled: true },
    { email: "family@example.com", verified: true, alertsEnabled: true },
  ],
  alerts: {
    burnoutRisk: true,
    anxietyPattern: true,
    sensitivity: "medium",
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  },
  privacy: { dataCollectionEnabled: true },
};

// ── Reusable toggle switch ───────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        checked ? "bg-(--primary-blue)" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: typeof User;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-(--text-secondary)">{subtitle}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [emailInput, setEmailInput] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [timezone, setTimezone] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [burnoutRisk, setBurnoutRisk] = useState(true);
  const [anxietyPattern, setAnxietyPattern] = useState(true);
  const [sensitivity, setSensitivity] = useState<"low" | "medium" | "high">("medium");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(true);

  // ── API calls (unchanged) ──────────────────────────────────────────────
  const settingsQuery = useQuery<UserSettingsPayload>({
    queryKey: ["settings-user"],
    queryFn: async () => {
      const response = await api.get("/api/settings/user");
      const data = response.data;
      return {
        ...FALLBACK_SETTINGS,
        ...data,
        contacts: Array.isArray(data?.contacts) ? data.contacts : FALLBACK_SETTINGS.contacts,
        alerts: { ...FALLBACK_SETTINGS.alerts, ...(data?.alerts ?? {}) },
        privacy: { ...FALLBACK_SETTINGS.privacy, ...(data?.privacy ?? {}) },
        notifications: { ...FALLBACK_SETTINGS.notifications, ...(data?.notifications ?? data?.privacy?.notifications ?? {}) },
      };
    },
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setProfileEmail(data.email);
    setTimezone(data.timezone);
    setEmailNotifications(Boolean(data.notifications?.email));
    setPushNotifications(Boolean(data.notifications?.push));
    setContacts(data.contacts);
    setBurnoutRisk(Boolean(data.alerts.burnoutRisk));
    setAnxietyPattern(Boolean(data.alerts.anxietyPattern));
    setSensitivity(data.alerts.sensitivity);
    setQuietHoursEnabled(Boolean(data.alerts.quietHoursEnabled));
    setQuietStart(data.alerts.quietHoursStart);
    setQuietEnd(data.alerts.quietHoursEnd);
    setDataCollectionEnabled(Boolean(data.privacy.dataCollectionEnabled));
  }, [settingsQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canAddContact = useMemo(() => contacts.length < 4 && isValidEmail(emailInput), [contacts.length, emailInput]);

  const contactsMutation = useMutation({
    mutationFn: async (nextContacts: TrustedContact[]) => { await api.put("/api/settings/contacts", { contacts: nextContacts }); },
    onSuccess: () => toast.success("Trusted contacts updated"),
    onError: (error) => toast.error(handleApiError(error)),
  });

  const alertsMutation = useMutation({
    mutationFn: async (payload: AlertSettings) => { await api.put("/api/settings/alerts", payload); },
    onSuccess: () => toast.success("Alert preferences saved"),
    onError: (error) => toast.error(handleApiError(error)),
  });

  const privacyMutation = useMutation({
    mutationFn: async (payload: { privacy: PrivacySettings; email: string; timezone: string; notifications: { email: boolean; push: boolean } }) => {
      await api.put("/api/settings/privacy", payload);
    },
    onSuccess: () => toast.success("Privacy/profile settings saved"),
    onError: (error) => toast.error(handleApiError(error)),
  });

  const deleteDataMutation = useMutation({
    mutationFn: async () => { await api.delete("/api/settings/delete-data"); },
    onSuccess: () => toast.success("All data deleted"),
    onError: (error) => toast.error(handleApiError(error)),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => { await api.delete("/api/settings/delete-account"); },
    onSuccess: () => { toast.success("Account deletion request submitted"); window.location.href = "/dashboard"; },
    onError: () => { toast.error("Account deletion endpoint is not available yet."); },
  });
  // ────────────────────────────────────────────────────────────────────────

  const saveContacts = (nextContacts: TrustedContact[]) => {
    setContacts(nextContacts);
    contactsMutation.mutate(nextContacts);
  };

  const saveAlerts = () => {
    alertsMutation.mutate({ burnoutRisk, anxietyPattern, sensitivity, quietHoursEnabled, quietHoursStart: quietStart, quietHoursEnd: quietEnd });
  };

  const savePrivacyAndProfile = () => {
    privacyMutation.mutate({ privacy: { dataCollectionEnabled }, email: profileEmail, timezone, notifications: { email: emailNotifications, push: pushNotifications } });
  };

  return (
    <div className="space-y-6">

      {settingsQuery.isError ? (
        <p className="surface-card p-3 text-sm text-red-700">{handleApiError(settingsQuery.error)}</p>
      ) : null}

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <section className="surface-card p-5 sm:p-6">
        <SectionHeader icon={User} iconColor="bg-violet-100 text-(--primary-blue)" title="Profile Settings" subtitle="Your account information and notification preferences" />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Email Address</span>
            <input
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className="field w-full px-3 py-2.5 text-sm outline-none"
              type="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Timezone</span>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="field w-full px-3 py-2.5 text-sm outline-none"
              placeholder="America/New_York"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--surface-muted)/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Email Notifications</p>
              <p className="text-xs text-(--text-secondary)">Receive insights by email</p>
            </div>
            <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--surface-muted)/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Push Notifications</p>
              <p className="text-xs text-(--text-secondary)">In-app push alerts</p>
            </div>
            <Toggle checked={pushNotifications} onChange={setPushNotifications} />
          </div>
        </div>

        <button
          type="button"
          className="mt-5 rounded-lg bg-(--primary-blue) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--primary-dark) disabled:opacity-50"
          onClick={savePrivacyAndProfile}
          disabled={privacyMutation.isPending}
        >
          {privacyMutation.isPending ? "Saving…" : "Save Profile"}
        </button>
      </section>

      {/* ── Trusted Contacts ─────────────────────────────────────────────── */}
      <section className="surface-card p-5 sm:p-6">
        <SectionHeader icon={Users} iconColor="bg-sky-100 text-sky-600" title="Trusted Contacts" subtitle="Emergency contacts notified when concerning patterns are detected (max 4)" />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="email@example.com"
            className="field min-w-[200px] flex-1 px-3 py-2.5 text-sm outline-none"
            type="email"
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.nextElementSibling && (e.currentTarget.nextElementSibling as HTMLButtonElement).click(); }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--primary-blue) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--primary-dark) disabled:opacity-40"
            disabled={!canAddContact}
            onClick={() => {
              const email = emailInput.trim().toLowerCase();
              if (!isValidEmail(email)) { toast.error("Please enter a valid email address"); return; }
              if (contacts.some((c) => c.email.toLowerCase() === email)) { toast.error("This contact is already added"); return; }
              saveContacts([...contacts, { email, verified: false, alertsEnabled: true }]);
              setEmailInput("");
            }}
          >
            <Plus className="h-4 w-4" /> Add Contact
          </button>
        </div>

        {contacts.length === 0 ? (
          <p className="mt-4 text-sm text-(--text-secondary)">No contacts added yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {contacts.map((contact) => (
              <article key={contact.email} className="flex items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--surface-muted)/40 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--primary-soft) text-xs font-bold text-(--primary-blue) uppercase">
                    {contact.email[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{contact.email}</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${contact.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {contact.verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                    <span className="hidden sm:inline">Alerts</span>
                    <Toggle checked={Boolean(contact.alertsEnabled)} onChange={(v) => {
                      saveContacts(contacts.map((item) => item.email === contact.email ? { ...item, alertsEnabled: v } : item));
                    }} />
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                    onClick={() => saveContacts(contacts.filter((item) => item.email !== contact.email))}
                    aria-label="Remove contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Alert Preferences ────────────────────────────────────────────── */}
      <section className="surface-card p-5 sm:p-6">
        <SectionHeader icon={Bell} iconColor="bg-amber-100 text-amber-600" title="Alert Preferences" subtitle="Configure when and how you receive alerts" />

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--surface-muted)/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Burnout Risk Alerts</p>
              <p className="text-xs text-(--text-secondary)">Get notified when burnout patterns emerge</p>
            </div>
            <Toggle checked={burnoutRisk} onChange={setBurnoutRisk} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--surface-muted)/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Anxiety Pattern Alerts</p>
              <p className="text-xs text-(--text-secondary)">Detect recurring anxiety triggers</p>
            </div>
            <Toggle checked={anxietyPattern} onChange={setAnxietyPattern} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--surface-muted)/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Quiet Hours</p>
              <p className="text-xs text-(--text-secondary)">Silence notifications during set hours</p>
            </div>
            <Toggle checked={quietHoursEnabled} onChange={setQuietHoursEnabled} />
          </div>

          {quietHoursEnabled && (
            <div className="grid gap-3 md:grid-cols-2 pl-1">
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold">Start Time</span>
                <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="field w-full px-3 py-2 outline-none" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold">End Time</span>
                <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="field w-full px-3 py-2 outline-none" />
              </label>
            </div>
          )}

          <label className="space-y-1.5 text-sm">
            <span className="font-semibold">Alert Sensitivity</span>
            <select
              value={sensitivity}
              onChange={(e) => setSensitivity(e.target.value as "low" | "medium" | "high")}
              className="field w-full px-3 py-2.5 outline-none"
            >
              <option value="low">Low — minimal interruptions</option>
              <option value="medium">Medium — moderate concerns</option>
              <option value="high">High — early warning system</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className="mt-5 rounded-lg bg-(--primary-blue) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--primary-dark) disabled:opacity-50"
          onClick={saveAlerts}
          disabled={alertsMutation.isPending}
        >
          {alertsMutation.isPending ? "Saving…" : "Save Alert Preferences"}
        </button>
      </section>

      {/* ── Privacy & Data ───────────────────────────────────────────────── */}
      <section className="surface-card p-5 sm:p-6">
        <SectionHeader icon={Shield} iconColor="bg-emerald-100 text-emerald-600" title="Privacy & Data" subtitle="Manage your data collection, export, and account" />

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--surface-muted)/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Data Collection</p>
              <p className="text-xs text-(--text-secondary)">Allow anonymised usage data to improve the app</p>
            </div>
            <Toggle checked={dataCollectionEnabled} onChange={setDataCollectionEnabled} />
          </div>
        </div>

        <button
          type="button"
          className="mt-4 rounded-lg bg-(--primary-blue) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--primary-dark) disabled:opacity-50"
          onClick={savePrivacyAndProfile}
          disabled={privacyMutation.isPending}
        >
          {privacyMutation.isPending ? "Saving…" : "Save Privacy Settings"}
        </button>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--border) bg-white px-4 py-3 text-sm font-semibold transition hover:bg-(--surface-muted)"
            onClick={() => {
              const payload = {
                exportedAt: new Date().toISOString(),
                profile: { email: profileEmail, timezone, emailNotifications, pushNotifications },
                contacts,
                alerts: { burnoutRisk, anxietyPattern, sensitivity, quietHoursEnabled, quietStart, quietEnd },
                privacy: { dataCollectionEnabled },
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "antara-export.json"; a.click();
              URL.revokeObjectURL(url);
              toast.success("Export downloaded");
            }}
          >
            <Download className="h-4 w-4 text-(--accent-dashboard)" />
            Export All Data
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            onClick={() => {
              if (!window.confirm("Delete all your app data? This cannot be undone.")) return;
              deleteDataMutation.mutate();
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            Delete All Data
          </button>
        </div>

        <button
          type="button"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          onClick={() => {
            if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
            deleteAccountMutation.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete Account Permanently
        </button>
      </section>
    </div>
  );
}
