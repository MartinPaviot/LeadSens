"use client";

import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface AccountData {
  email: string;
  first_name?: string;
  last_name?: string;
  status?: string;
}

interface AccountPickerCardProps {
  accounts: AccountData[];
  totalLeads: number;
  recommendedCount: number;
}

export function AccountPickerCard({
  accounts,
  totalLeads,
  recommendedCount,
}: AccountPickerCardProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        (a.first_name ?? "").toLowerCase().includes(q) ||
        (a.last_name ?? "").toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const toggle = useCallback((email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected.size === 0 || confirmed) return;
    setConfirmed(true);
    window.dispatchEvent(
      new CustomEvent("leadsens:accounts-selected", {
        detail: { accounts: Array.from(selected) },
      }),
    );
  }, [selected, confirmed]);

  return (
    <Card className="overflow-hidden my-2">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Select sending accounts</h3>
          <p className="text-xs text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} available
          </p>
        </div>
        {totalLeads > 0 && (
          <Badge variant="outline" className="text-xs shrink-0">
            {recommendedCount} recommended for {totalLeads} leads
          </Badge>
        )}
      </div>

      {/* Search */}
      {accounts.length > 3 && (
        <div className="px-4 py-2 border-b">
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={confirmed}
            className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Recommendation */}
      {totalLeads > 30 && !confirmed && (
        <div className="px-4 py-2 border-b bg-muted/20">
          <p className="text-xs text-muted-foreground">
            We recommend <strong>{recommendedCount} accounts</strong> for optimal deliverability (30 emails/account/day)
          </p>
        </div>
      )}

      {/* Account list */}
      <div className="max-h-[240px] overflow-y-auto">
        {filtered.map((account) => {
          const isSelected = selected.has(account.email);
          const name = [account.first_name, account.last_name]
            .filter(Boolean)
            .join(" ");
          const isActive =
            !account.status || account.status.toLowerCase() === "active" || account.status === "1";

          return (
            <button
              key={account.email}
              type="button"
              disabled={confirmed}
              onClick={() => toggle(account.email)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b last:border-0 transition-colors ${
                confirmed
                  ? "cursor-default"
                  : "hover:bg-muted/20 cursor-pointer"
              } ${isSelected ? "bg-primary/5" : ""}`}
            >
              {/* Checkbox */}
              <div
                className={`size-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/40"
                }`}
              >
                {isSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className="text-primary-foreground"
                  >
                    <path
                      d="M8.5 2.5L3.75 7.5L1.5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{account.email}</p>
                {name && (
                  <p className="text-xs text-muted-foreground truncate">
                    {name}
                  </p>
                )}
              </div>

              {/* Status */}
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${
                  isActive
                    ? "bg-green-600/10 text-green-500 border-green-600/20"
                    : "bg-yellow-600/10 text-yellow-500 border-yellow-600/20"
                }`}
              >
                {isActive ? "active" : "paused"}
              </Badge>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No accounts match your search
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {confirmed
            ? `${selected.size} account${selected.size !== 1 ? "s" : ""} confirmed`
            : `${selected.size} selected`}
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size === 0 || confirmed}
          className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            selected.size === 0 || confirmed
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {confirmed ? "Confirmed" : "Confirm selection"}
        </button>
      </div>
    </Card>
  );
}
