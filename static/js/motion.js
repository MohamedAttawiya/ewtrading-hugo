(() => {
  if (!document.body?.classList.contains("home")) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // iOS/iPadOS often reports low CPU core counts that don't correlate with
  // actual ability to run lightweight CSS animations smoothly.
  const ua = navigator.userAgent || "";
  const isAppleMobile =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Performance guardrails for low-power / data-saver devices.
  // (Used by CSS to disable heavy, always-on hero animations.)
  try {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(connection && connection.saveData);
    const effectiveType = connection && typeof connection.effectiveType === "string" ? connection.effectiveType : "";
    const slowConnection = effectiveType === "2g" || effectiveType === "slow-2g";

    const deviceMemory =
      typeof navigator.deviceMemory === "number" && Number.isFinite(navigator.deviceMemory)
        ? navigator.deviceMemory
        : 0;
    const lowMemory = deviceMemory > 0 && deviceMemory <= 4;

    const hardwareConcurrency =
      typeof navigator.hardwareConcurrency === "number" && Number.isFinite(navigator.hardwareConcurrency)
        ? navigator.hardwareConcurrency
        : 0;
    const lowCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 2;

    const lowPowerByCpu = lowCpu && !isAppleMobile;

    if (saveData || slowConnection || lowMemory || lowPowerByCpu) {
      document.documentElement.classList.add("low-power");
    }
  } catch {
    // Best-effort only.
  }

  if (!reduceMotion && !document.documentElement.classList.contains("low-power")) {
    document.documentElement.classList.add("motion-ok");
  }

  const sections = Array.from(document.querySelectorAll("section.section"));
  if (sections.length === 0) return;

  const reveal = (el) => el.classList.add("is-revealed");

  for (const section of sections) section.classList.add("reveal");

  // Pause expensive, continuous hero animations once the hero is off-screen.
  const hero = document.querySelector("section.hero");
  if (hero && "IntersectionObserver" in window && !reduceMotion) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        hero.classList.toggle("hero-paused", !entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: "0px 0px 0px 0px" },
    );
    heroObserver.observe(hero);
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    for (const section of sections) reveal(section);
    return;
  }

  const viewH = () => window.innerHeight || document.documentElement.clientHeight || 0;
  const isNearViewport = (el) => {
    const rect = el.getBoundingClientRect();
    const h = viewH();
    return rect.top < h * 0.92 && rect.bottom > 0;
  };

  for (const section of sections) {
    if (isNearViewport(section)) reveal(section);
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        obs.unobserve(entry.target);
      }
    },
    { root: null, threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
  );

  for (const section of sections) {
    if (!section.classList.contains("is-revealed")) observer.observe(section);
  }
})();
