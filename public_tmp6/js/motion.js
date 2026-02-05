(() => {
  if (!document.body?.classList.contains("home")) return;

  const sections = Array.from(document.querySelectorAll("section.section"));
  if (sections.length === 0) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const reveal = (el) => el.classList.add("is-revealed");

  for (const section of sections) section.classList.add("reveal");

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

