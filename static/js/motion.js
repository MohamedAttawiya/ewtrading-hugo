(() => {
  const isHome = document.body?.classList.contains("home");
  const isPartners = Boolean(document.querySelector("main.partners-page"));
  const insightCards = Array.from(document.querySelectorAll(".insights-cards .card"));
  const hasInsightsCards = insightCards.length > 0;
  if (!isHome && !isPartners && !hasInsightsCards) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // iOS/iPadOS often reports low CPU core counts that don't correlate with
  // actual ability to run lightweight CSS animations smoothly.
  const ua = navigator.userAgent || "";
  const isAppleMobile =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobileLike =
    isAppleMobile || /Android|Mobile|Tablet/i.test(ua);

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
    const lowMemory = deviceMemory > 0 && deviceMemory <= 2;

    const hardwareConcurrency =
      typeof navigator.hardwareConcurrency === "number" && Number.isFinite(navigator.hardwareConcurrency)
        ? navigator.hardwareConcurrency
        : 0;
    const lowCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 2;

    // Hardware heuristics are only reliable for mobile-like devices.
    // Desktop browsers often under/over-report these values.
    const lowPowerByHardware = isMobileLike && (lowMemory || lowCpu);

    if (saveData || slowConnection || lowPowerByHardware) {
      document.documentElement.classList.add("low-power");
    }
  } catch {
    // Best-effort only.
  }

  if (!reduceMotion && !document.documentElement.classList.contains("low-power")) {
    document.documentElement.classList.add("motion-ok");
  }

  const sections = Array.from(document.querySelectorAll("section.section"));
  const hasSections = sections.length > 0;
  if (!hasSections && !hasInsightsCards) return;

  const reveal = (el) => el.classList.add("is-revealed");

  for (const section of sections) section.classList.add("reveal");
  for (const [index, card] of insightCards.entries()) {
    card.classList.add("swoosh-reveal");
    card.style.setProperty("--swoosh-delay", `${Math.min(index * 55, 280)}ms`);
  }

  // Pause expensive, continuous hero animations once the hero is off-screen.
  const hero = document.querySelector("section.hero");
  if (isHome && hero && "IntersectionObserver" in window && !reduceMotion) {
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
    for (const card of insightCards) reveal(card);
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
  for (const card of insightCards) {
    if (isNearViewport(card)) reveal(card);
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

  const cardsObserver = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        obs.unobserve(entry.target);
      }
    },
    { root: null, threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
  );

  for (const card of insightCards) {
    if (!card.classList.contains("is-revealed")) cardsObserver.observe(card);
  }
})();
