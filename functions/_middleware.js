export async function onRequest(context) {
    const { request, env, next } = context;
  
    const url = new URL(request.url);
    const hostname = url.hostname;
  
    // Seuls ces domaines sont à protéger (accès direct interdit)
    const protectedDomains = ['genealogie.app', 'proxy.genealogie.app'];
  
    const referer = request.headers.get('referer') || '';
    const fetchDest = request.headers.get('sec-fetch-dest') || '';
    const isIframe = fetchDest === 'iframe';
  
    // Charger les partenaires autorisés depuis la KV
    let allowedOrigins = [];
    try {
      const raw = await env.ALLOWED_PARTNER_DOMAINS_KV.get('domains');
      if (raw) {
        allowedOrigins = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("⚠️ Erreur lecture KV:", e);
    }
  
    const isFromPartner = allowedOrigins.some(origin => referer.startsWith(origin));
    const isException = url.pathname.startsWith('/partner-access-only');
    const isProtected = protectedDomains.includes(hostname);
    const isAllowed = isIframe || isFromPartner;
  
    if (isProtected && !isAllowed && !isException) {
      return Response.redirect(`${url.origin}/partner-access-only`, 302);
    }
  
    return next();
  }
  