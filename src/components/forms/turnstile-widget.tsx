"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true });
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile script failed")));
    if (!existing) document.head.appendChild(script);
  });
}

/**
 * Cloudflare Turnstile. Puts the token in a hidden `turnstileToken` field and
 * reports readiness through `onReadyChange` so the form can disable Submit
 * until the check has finished. Tokens are single-use: change `resetKey`
 * after each submission to get a fresh one.
 */
export function TurnstileWidget({
  action,
  resetKey = 0,
  onReadyChange,
}: {
  action: string;
  resetKey?: number;
  onReadyChange?: (ready: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    onReadyChange?.(token !== "");
  }, [token, onReadyChange]);

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    const el = container.current;
    setToken("");
    setFailed(false);

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId = window.turnstile.render(el, {
          sitekey: siteKey,
          action,
          callback: (value) => setToken(value),
          "expired-callback": () => setToken(""),
          "error-callback": () => {
            setToken("");
            setFailed(true);
          },
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action, resetKey]);

  if (!siteKey) {
    return (
      <p role="alert" className="text-sm text-error">
        The security check isn&apos;t configured (missing site key).
      </p>
    );
  }

  return (
    <div>
      <div ref={container} />
      <input type="hidden" name="turnstileToken" value={token} />
      {failed && (
        <p role="alert" className="mt-1 text-sm text-error">
          The security check couldn&apos;t load. Check your connection and reload the page.
        </p>
      )}
    </div>
  );
}
