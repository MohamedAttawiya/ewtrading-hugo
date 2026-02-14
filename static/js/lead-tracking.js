(function () {
  function hasGtag() {
    return typeof window.gtag === "function";
  }

  function trackGenerateLead(params) {
    if (!hasGtag()) return;
    window.gtag("event", "generate_lead", params || {});
  }

  function inferCtaText(el) {
    return (el && (el.getAttribute("data-track-label") || el.textContent || "") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 120);
  }

  function trackForLink(link) {
    if (!link) return;
    var href = (link.getAttribute("href") || "").trim();
    if (!href) return;

    var label = inferCtaText(link);
    var lowerHref = href.toLowerCase();
    var leadSource = link.getAttribute("data-track-source") || "site";

    if (lowerHref.indexOf("https://wa.me/") === 0) {
      trackGenerateLead({
        lead_source: leadSource,
        lead_method: "whatsapp",
        cta_text: label,
        destination: href
      });
      return;
    }

    if (lowerHref.indexOf("mailto:rfq@") === 0 || lowerHref.indexOf("mailto:sales@") === 0) {
      trackGenerateLead({
        lead_source: leadSource,
        lead_method: "email",
        cta_text: label,
        destination: href
      });
      return;
    }

    if (lowerHref.indexOf("/contact/") === 0 || lowerHref.indexOf("/contact.html") === 0 || lowerHref.indexOf("/contact?") === 0) {
      trackGenerateLead({
        lead_source: leadSource,
        lead_method: "contact_page",
        cta_text: label,
        destination: href
      });
      return;
    }

    if (link.hasAttribute("data-track-lead")) {
      trackGenerateLead({
        lead_source: leadSource,
        lead_method: "cta",
        cta_text: label,
        destination: href
      });
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var link = target.closest("a[href]");
    if (!link) return;
    trackForLink(link);
  }, { capture: true });
})();
