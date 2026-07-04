/**
 * Serveert het embed-snippet als JavaScript. Een klant plakt op zijn site:
 *
 *   <div data-sircle-tenant="sircle" data-sircle-event="intake"></div>
 *   <script src="https://planner.jouwdomein.nl/api/embed-script" async></script>
 *
 * Het script zoekt alle placeholders en vervangt ze door een responsive iframe
 * naar de embed-weergave. Zo staat de planner white-label op elke site (§7/§8).
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const js = `(function () {
  var nodes = document.querySelectorAll('[data-sircle-tenant]');
  nodes.forEach(function (el) {
    if (el.getAttribute('data-sircle-mounted')) return;
    el.setAttribute('data-sircle-mounted', '1');
    var tenant = el.getAttribute('data-sircle-tenant');
    var event = el.getAttribute('data-sircle-event');
    var iframe = document.createElement('iframe');
    iframe.src = ${JSON.stringify(origin)} + '/' + tenant + '/' + event + '?embed=1';
    iframe.style.width = '100%';
    iframe.style.minHeight = '640px';
    iframe.style.border = '0';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Afspraak plannen');
    el.appendChild(iframe);
  });
})();`;

  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
