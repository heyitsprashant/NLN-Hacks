"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2, Plus, Download, AlertTriangle } from "lucide-react";
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
  privacy: {
    dataCollectionEnabled: true,
  },
};

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
    mutationFn: async (nextContacts: TrustedContact[]) => {
      await api.put("/api/settings/contacts", { contacts: nextContacts });
    },
    onSuccess: () => toast.success("Trusted contacts updated"),
    onError: (error) => toast.error(handleApiError(error)),
  });

  const alertsMutation = useMutation({
    mutationFn: async (payload: AlertSettings) => {
      await api.put("/api/settings/alerts", payload);
    },
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
    mutationFn: async () => {
      await api.delete("/api/settings/delete-data");
    },
    onSuccess: () => toast.success("All data deleted"),
    onError: (error) => toast.error(handleApiError(error)),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/api/settings/delete-account");
    },
    onSuccess: () => {
      toast.success("Account deletion request submitted");
      window.location.href = "/dashboard";
    },
    onError: () => {
      toast.error("Account deletion endpoint is not available yet.");
    },
  });

  const saveContacts = (nextContacts: TrustedContact[]) => {
    setContacts(nextContacts);
    contactsMutation.mutate(nextContacts);
  };

  const saveAlerts = () => {
    alertsMutation.mutate({
      burnoutRisk,
      anxietyPattern,
      sensitivity,
      quietHoursEnabled,
      quietHoursStart: quietStart,
      quietHoursEnd: quietEnd,
    });
  };

  const savePrivacyAndProfile = () => {
    privacyMutation.mutate({
      privacy: { dataCollectionEnabled },
      email: profileEmail,
      timezone,
      notifications: {
        email: emailNotifications,
        push: pushNotifications,
      },
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-2 text-base text-[var(--text-secondary)]">Manage your preferences and privacy</p>
      </header>

      {settingsQuery.isError ? (
        <p className="surface-card p-4 text-sm text-[#8a5a52]">{handleApiError(settingsQuery.error)}</p>
      ) : null}

      <section className="surface-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">Profile Settings</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Your account information</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Email Address</span>
            <input
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
              className="field w-full px-3.5 py-2.5 text-sm outline-none"
              type="email"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Timezone</span>
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="field w-full px-3.5 py-2.5 text-sm outline-none"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm transition-all duration-200 hover:bg-[var(--surface-muted)]">
            <span>Email Notifications</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm transition-all duration-200 hover:bg-[var(--surface-muted)]">
            <span>Push Notifications</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={pushNotifications} onChange={(event) => setPushNotifications(event.target.checked)} />
          </label>
        </div>

        <button type="button" className="mt-6 rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--primary-dark)] hover:shadow-md" onClick={savePrivacyAndProfile}>
          Save Profile
        </button>
      </section>

      <section className="surface-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">Trusted Contacts</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">People notified when concerning patterns are detected (max 4)</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder="email@example.com"
            className="field min-w-[220px] flex-1 px-3.5 py-2.5 text-sm outline-none"
            type="email"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--primary-dark)] hover:shadow-md disabled:opacity-50"
            disabled={!canAddContact}
            onClick={() => {
              const email = emailInput.trim().toLowerCase();
              if (!isValidEmail(email)) {
                toast.error("Please enter a valid email address");
                return;
              }
              if (contacts.some((contact) => contact.email.toLowerCase() === email)) {
                toast.error("This contact is already added");
                return;
              }
              saveContacts([...contacts, { email, verified: false, alertsEnabled: true }]);
              setEmailInput("");
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {contacts.map((contact) => (
            <article key={contact.email} className="rounded-2xl border border-[var(--border)] p-4 transition-all duration-200 hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{contact.email}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${contact.verified ? "bg-[#e8f5ee] text-[#3d7a5a]" : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
                    {contact.verified ? "verified" : "pending"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                    Alerts
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={Boolean(contact.alertsEnabled)}
                      onChange={(event) => {
                        const next = contacts.map((item) =>
                          item.email === contact.email ? { ...item, alertsEnabled: event.target.checked } : item
                        );
                        saveContacts(next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-xl p-2 text-[#c07068] transition-all duration-200 hover:bg-[#faf0ee]"
                    onClick={() => {
                      saveContacts(contacts.filter((item) => item.email !== contact.email));
                    }}
                    aria-label="Remove contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">Alert Preferences</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Configure when and how you receive alerts</p>

        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm transition-all duration-200 hover:bg-[var(--surface-muted)]">
            <span>Burnout Risk Alerts</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={burnoutRisk} onChange={(event) => setBurnoutRisk(event.target.checked)} />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm transition-all duration-200 hover:bg-[var(--surface-muted)]">
            <span>Anxiety Pattern Alerts</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={anxietyPattern} onChange={(event) => setAnxietyPattern(event.target.checked)} />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Alert Sensitivity</span>
            <select value={sensitivity} onChange={(event) => setSensitivity(event.target.value as "low" | "medium" | "high")} className="field w-full px-3.5 py-2.5 outline-none">
              <option value="low">Low - Minimal alerts</option>
              <option value="medium">Medium - Moderate concerns</option>
              <option value="high">High - Early warning</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm transition-all duration-200 hover:bg-[var(--surface-muted)]">
            <span>Quiet Hours</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={quietHoursEnabled} onChange={(event) => setQuietHoursEnabled(event.target.checked)} />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Start Time</span>
              <input type="time" value={quietStart} disabled={!quietHoursEnabled} onChange={(event) => setQuietStart(event.target.value)} className="field w-full px-3.5 py-2.5 outline-none disabled:opacity-50" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">End Time</span>
              <input type="time" value={quietEnd} disabled={!quietHoursEnabled} onChange={(event) => setQuietEnd(event.target.value)} className="field w-full px-3.5 py-2.5 outline-none disabled:opacity-50" />
            </label>
          </div>
        </div>

        <button type="button" className="mt-6 rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--primary-dark)] hover:shadow-md" onClick={saveAlerts}>
          Save Alert Preferences
        </button>
      </section>

      <section className="surface-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">Privacy Controls</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage your data and privacy settings</p>

        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm transition-all duration-200 hover:bg-[var(--surface-muted)]">
            <span>Data Collection</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={dataCollectionEnabled} onChange={(event) => setDataCollectionEnabled(event.target.checked)} />
          </label>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold transition-all duration-200 hover:bg-[var(--surface-muted)] hover:shadow-sm"
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
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "mindcare-export.json";
              anchor.click();
              URL.revokeObjectURL(url);
              toast.success("Export downloaded");
            }}
          >
            <Download className="h-4 w-4" /> Export All Data
          </button>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e0c4c0] bg-[#faf0ee] px-5 py-3 text-sm font-semibold text-[#8a5a52] transition-all duration-200 hover:bg-[#f5e8e6]"
            onClick={() => {
              const confirmed = window.confirm("Delete all your app data? This action cannot be undone.");
              if (!confirmed) return;
              deleteDataMutation.mutate();
            }}
          >
            <AlertTriangle className="h-4 w-4" /> Delete All Data
          </button>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#c07068] bg-[#c07068] px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#a85c55]"
            onClick={() => {
              const confirmed = window.confirm("Delete your account permanently? This action cannot be undone.");
              if (!confirmed) return;
              deleteAccountMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete Account
          </button>
        </div>
      </section>
    </div>
  );
}
