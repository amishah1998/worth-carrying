(async function () {
  const $ = (s) => document.querySelector(s);
  const form = $('#f'), go = $('#go'), out = $('#out'), status = $('#status');
  const apiBase = (window.WORTH_CARRYING?.apiBase || '').replace(/\/$/, '');
  const REPO = 'https://github.com/amishah1998/worth-carrying';
  const money = (n) => Number.isFinite(n) ? '₹' + Math.round(n).toLocaleString('en-IN') : 'Not found';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const date = (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  function link(url, text) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return esc(text);
      return '<a href="' + esc(parsed.href) + '" target="_blank" rel="noopener noreferrer">' + esc(text) + '</a>';
    } catch { return esc(text); }
  }
  async function api(path, options = {}) {
    const response = await fetch(apiBase + path, { ...options, signal: options.signal || AbortSignal.timeout(20000) });
    let data;
    try { data = await response.json(); } catch { throw new Error('The price service is unavailable. Try again shortly.'); }
    if (!response.ok) {
      if (response.status === 429) throw new Error('Too many checks right now. Please try again later.');
      throw new Error('We could not check prices. Try again or use a more specific product name.');
    }
    return data;
  }
  function error(message, field) {
    $('#error').textContent = message;
    $('#error').hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function clearError() {
    $('#error').hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }
  function remember() {
    try { localStorage.setItem('wc-location', JSON.stringify({ country: $('#country').value, currency: $('#currency').value })); } catch {}
  }
  let cfg = null, photo = null, preparingPhoto = false, pending = null;
  let fxRevision = 0, guideRevision = 0, photoRevision = 0;
  const rates = new Map(), guides = new Map();
  async function showFx() {
    const revision = ++fxRevision, value = Number($('#price').value), currency = $('#currency').value;
    if (!(value > 0)) { $('#fx').textContent = 'We will show the price in rupees.'; return; }
    if (currency === 'INR') { $('#fx').innerHTML = '<strong>' + money(value) + '</strong>'; return; }
    $('#fx').textContent = 'Converting to rupees…';
    try {
      const rate = rates.get(currency) || await api('/api/fx?from=' + encodeURIComponent(currency));
      rates.set(currency, rate);
      if (revision !== fxRevision) return;
      $('#fx').innerHTML = '<strong>About ' + money(value * rate.rate) + '</strong> · ' + esc(currency) + ' to INR' +
        (rate.date ? '<br>Rate dated ' + esc(date(rate.date)) + '. Card fees are extra.' : '');
    } catch {
      if (revision === fxRevision) $('#fx').textContent = 'Conversion unavailable. You can still try a price check.';
    }
  }
  async function showGuide() {
    const revision = ++guideRevision, code = $('#country').value;
    $('#guide').hidden = true;
    $('#guide').open = false;
    if (!code || !cfg?.countries.find((c) => c.code === code)?.guide) return;
    try {
      const guide = guides.get(code) || await api('/api/guide?country=' + encodeURIComponent(code));
      guides.set(code, guide);
      if (revision !== guideRevision) return;
      $('#guide-title').textContent = 'Shopping ideas in ' + guide.name;
      const ideas = [...guide.knownFor, ...guide.usuallyBuy].filter((item, index, list) => list.findIndex((other) => other.item === item.item) === index);
      $('#guide-content').innerHTML = ideas.map((item, index) => '<div><button type="button" class="idea" data-idea="' + index + '"><strong>' + esc(item.item) + '</strong><span>' + esc(item.why) + '</span></button><div class="guide-source">' + (item.source ? link(item.source, 'Source') : '') + '</div></div>').join('') +
        (guide.watchOuts.length ? '<h3>Before you buy</h3><ul>' + guide.watchOuts.map((item) => '<li>' + esc(item.text) + ' ' + link(item.source, 'Source') + '</li>').join('') + '</ul>' : '');
      $('#guide-content').querySelectorAll('[data-idea]').forEach((button) => button.addEventListener('click', () => {
        const item = ideas[Number(button.dataset.idea)];
        $('#q').value = item.search || item.item;
        $('#q').focus();
        clearError();
        form.scrollIntoView({ behavior: motion(), block: 'start' });
      }));
      $('#guide').hidden = false;
    } catch {}
  }
  async function init() {
    go.disabled = true;
    status.textContent = 'Getting ready…';
    try {
      cfg = await api('/api/config');
      if (!Array.isArray(cfg.countries) || !Array.isArray(cfg.currencies)) throw new Error('Invalid configuration');
      $('#country').innerHTML = '<option value="">Choose a country</option>' + cfg.countries.map((c) => '<option value="' + esc(c.code) + '" data-currency="' + esc(c.currency) + '">' + esc(c.name) + '</option>').join('');
      $('#currency').innerHTML = cfg.currencies.map((c) => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('wc-location') || '{}'); } catch {}
      if (cfg.countries.some((c) => c.code === saved.country)) {
        $('#country').value = saved.country;
        $('#currency').value = cfg.currencies.includes(saved.currency) ? saved.currency : $('#country').selectedOptions[0].dataset.currency;
      }
      $('#country').disabled = false;
      $('#currency').disabled = false;
      $('#photo-row').hidden = !cfg.photo;
      go.innerHTML = 'Compare prices <span aria-hidden="true">↗</span>';
      status.textContent = '';
      clearError();
      showGuide();
      showFx();
    } catch {
      cfg = null;
      error('Price checks are unavailable right now. Tap Try again to reconnect.');
      go.textContent = 'Try again';
      status.textContent = '';
    } finally { go.disabled = false; }
  }
  $('#country').addEventListener('change', () => {
    const currency = $('#country').selectedOptions[0]?.dataset.currency;
    if (currency) $('#currency').value = currency;
    remember(); showFx(); showGuide(); clearError();
  });
  $('#currency').addEventListener('change', () => { remember(); showFx(); });
  $('#price').addEventListener('input', showFx);
  form.addEventListener('input', clearError);
  function clearPhoto() {
    photoRevision++;
    preparingPhoto = false;
    $('#clear-photo').disabled = false;
    photo = null;
    $('#photo').value = '';
    $('#clear-photo').hidden = true;
    $('#photo-note').hidden = true;
    $('#q').placeholder = 'Dior Sauvage EDP 100ml';
  }
  $('#clear-photo').addEventListener('click', clearPhoto);
  $('#photo').addEventListener('change', async () => {
    const file = $('#photo').files[0];
    if (!file) return;
    clearPhoto();
    const revision = photoRevision;
    preparingPhoto = true;
    $('#photo-note').hidden = false;
    $('#photo-note').textContent = 'Preparing photo…';
    $('#clear-photo').disabled = true;
    try {
      const prepared = await shrink(file);
      if (revision !== photoRevision) return;
      photo = prepared;
      $('#clear-photo').hidden = false;
      $('#q').placeholder = 'Product name (optional with photo)';
      $('#photo-note').textContent = 'Photo ready. Leave the name blank to read the photo when you compare.';
      clearError();
    } catch {
      if (revision !== photoRevision) return;
      clearPhoto();
      error('We could not read that image. Try another photo or type the product name.', $('#q'));
    } finally {
      if (revision === photoRevision) {
        preparingPhoto = false;
        $('#clear-photo').disabled = false;
      }
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) { pending.abort(); return; }
    if (!cfg) { await init(); return; }
    clearError();
    if (preparingPhoto) { error('Wait for the photo to finish loading.'); return; }
    if (!$('#country').value) { error('Choose the country you are shopping in.', $('#country')); return; }
    const query = $('#q').value.trim(), price = Number($('#price').value), trip = Number($('#trip').value);
    if (!query && !photo) { error('Type a product name or use a photo.', $('#q')); return; }
    if (!Number.isFinite(price) || price <= 0 || !$('#price').validity.valid) { error('Enter a shelf price greater than zero.', $('#price')); return; }
    if (!Number.isFinite(trip) || trip < 0 || !$('#trip').validity.valid) { $('.more').open = true; error('Enter zero or more for other purchases.', $('#trip')); return; }
    const body = { query, price, currency: $('#currency').value, country: $('#country').value, tripTotalInr: trip };
    if (!query && photo) { body.image = photo.data; body.mediaType = photo.type; }
    const controller = new AbortController();
    pending = controller;
    go.textContent = 'Cancel check';
    out.hidden = true;
    out.setAttribute('aria-busy', 'true');
    status.textContent = body.image ? 'Reading your photo and checking prices in India…' : 'Checking the same product in India…';
    try {
      const result = await api('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
      render(result, body);
      if (result.photo?.query && !$('#q').value.trim()) $('#q').value = result.photo.query;
      status.textContent = 'Comparison ready.';
      out.hidden = false;
      out.scrollIntoView({ behavior: motion(), block: 'start' });
      const heading = out.querySelector('h2');
      heading.focus({ preventScroll: true });
      askForStar();
    } catch (err) {
      if (controller.signal.aborted) status.textContent = 'Check cancelled. You can edit and try again.';
      else {
        status.textContent = '';
        error(err.name === 'TimeoutError' ? 'This check took too long. Please try again.' : navigator.onLine ? err.message : 'You are offline. Reconnect, then try again.');
      }
    } finally {
      pending = null;
      out.setAttribute('aria-busy', 'false');
      go.innerHTML = 'Compare prices <span aria-hidden="true">↗</span>';
    }
  });
  // The one star ask: once per browser, after the third finished comparison. The flag is written
  // before the note shows, and a browser that cannot store it never sees the note.
  function askForStar() {
    try {
      const checks = Number(localStorage.getItem('wc-checks') || 0) + 1;
      localStorage.setItem('wc-checks', String(checks));
      if (checks < 3 || localStorage.getItem('wc-star-asked')) return;
      localStorage.setItem('wc-star-asked', new Date().toISOString().slice(0, 10));
    } catch { return; }
    const note = document.createElement('div');
    note.className = 'star-note';
    note.innerHTML = '<p>If it helped you decide, a star on GitHub helps the next traveller find it.</p><a href="' + REPO + '" target="_blank" rel="noopener">Star on GitHub</a><button type="button" aria-label="Dismiss">×</button>';
    note.querySelector('button').addEventListener('click', () => note.remove());
    out.querySelector('.result')?.append(note);
  }
  function render(d, input) {
    const india = d.india, abroad = d.abroad, verdict = d.verdict;
    const saving = verdict.saving;
    const headline = saving == null ? verdict.label : saving > 0 ? 'Save ' + money(saving) : saving < 0 ? 'India is ' + money(-saving) + ' cheaper' : 'The same price';
    const unit = india.per100 && !india.queryGrams;
    const indiaPrice = unit ? money(india.per100.low) + ' / 100 g' : money(india.now);
    const rows = (items) => items.map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('');
    const listing = (item, rejected = false) => '<div class="listing"><div class="listing-head"><span>' + esc(item.seller || 'Seller not listed') + '</span><strong>' + money(item.price) + '</strong></div>' + link(item.url, item.title) +
      (rejected ? '<p>' + esc(item.reason) + '</p>' : item.per100 ? '<p>' + money(item.per100) + ' per 100 g</p>' : '') + '</div>';
    const breakdown = abroad ? [
      ['Shelf price (' + input.currency + ')', input.price.toLocaleString('en-IN')],
      ['Converted to rupees', money(abroad.shelfInr)],
      ['Estimated customs duty', money(abroad.dutyInr)],
      ['Total to bring home', money(abroad.landedInr)],
      ['Other purchases entered', money(input.tripTotalInr)],
    ] : [];
    const history = [];
    if (india.low != null) history.push(['Lowest recorded' + (india.lowDate ? ' · ' + date(india.lowDate) : ''), money(india.low)]);
    if (india.high != null) history.push(['Highest recorded' + (india.highDate ? ' · ' + date(india.highDate) : ''), money(india.high)]);
    if (india.typical != null) history.push(['Typical price', money(india.typical)]);
    const warranty = d.warranty;
    out.innerHTML = '<div class="result"><p class="product-name">' + esc(d.query) + '</p><p class="verdict ' + esc(verdict.verdict) + '">' + esc(verdict.label) + '</p><h2 class="saving" tabindex="-1">' + esc(headline) + '</h2><p class="reason">' + esc(verdict.reason) + '</p>' +
      '<dl class="comparison"><div><dt>' + (unit ? 'India per 100 g' : 'India today') + '</dt><dd>' + esc(indiaPrice) + '</dd><small>' + esc(india.nowSeller || india.per100?.lowSeller || 'No matching price') + (india.nowTrusted === false ? ' · unverified seller' : '') + '</small></div><div><dt>Total to bring home</dt><dd>' + (abroad ? money(abroad.landedInr) : 'Not available') + '</dd><small>With estimated customs duty</small></div></dl>' +
      '<div class="warranty ' + esc(warranty.status) + '"><strong>Warranty in India</strong>' + esc(warranty.text) + '</div>' +
      (d.notes.length ? '<p class="help">' + d.notes.map(esc).join('<br>') + '</p>' : '') +
      '<details><summary>How we calculated it</summary><dl class="breakdown">' + rows(breakdown) + '</dl><p class="help">' + esc(abroad?.dutyNote) + '</p><p class="help">' + (d.fx ? 'Exchange rate' + (d.fx.date ? ' dated ' + esc(date(d.fx.date)) : '') + '. ' : '') + 'Card fees and tourist tax refunds are excluded. Customs can use a different exchange rate and valuation.</p></details>' +
      '<details><summary>Matching India prices (' + d.listings.kept.length + ')</summary>' + (d.listings.kept.map((item) => listing(item)).join('') || '<p class="help">No matching listings. Include the exact model and size, then try again.</p>') +
      (india.cheapestAny ? '<p class="help">A lower price of ' + money(india.cheapestAny.price) + ' at ' + esc(india.cheapestAny.seller) + ' comes from an unverified seller.</p>' : '') +
      (d.listings.rejected.length ? '<details><summary>Excluded listings (' + d.listings.rejected.length + ')</summary>' + d.listings.rejected.map((item) => listing(item, true)).join('') + '</details>' : '') + '</details>' +
      '<details><summary>Price history in India</summary>' + (history.length ? '<dl class="breakdown">' + rows(history) + '</dl>' : '') + '<p class="help">' + esc(india.historyNote || (india.historySource === 'keepa' ? 'Amazon price history.' : 'Recorded history starts with the first check.')) + '</p>' +
      (cfg.sales?.length ? '<ul class="help">' + cfg.sales.map((sale) => '<li>' + esc(sale.name) + (sale.start ? ' · ' + esc(date(sale.start)) : ' · dates unconfirmed') + (sale.sources?.[0] ? ' ' + link(sale.sources[0], 'Source') : '') + '</li>').join('') + '</ul>' : '') +
      '<p class="help">' + link('https://www.google.com/search?q=' + encodeURIComponent('site:pricehistory.app ' + d.query), 'Find more price history') + '</p></details><button type="button" class="share" id="share">Share comparison</button><p id="share-status" class="help" role="status"></p></div>';
    $('#share').addEventListener('click', async () => {
      const text = d.query + '\n' + headline + '\nIndia today: ' + indiaPrice + '\nTotal to bring home: ' + (abroad ? money(abroad.landedInr) : 'Not available') + '\n' + warranty.text + '\nEstimate checked ' + new Date().toLocaleDateString('en-IN') + '. Prices can change.\n' + location.href.split(/[?#]/)[0];
      try {
        if (navigator.share) { await navigator.share({ title: 'Worth Carrying', text }); $('#share-status').textContent = 'Comparison shared.'; }
        else { await navigator.clipboard.writeText(text); $('#share-status').textContent = 'Copied. Paste it into your message.'; }
      } catch (err) {
        if (err.name !== 'AbortError') $('#share-status').textContent = 'Sharing is unavailable. You can share the page link from your browser.';
      }
    });
  }
  async function shrink(file) {
    if (file.size > 25 * 1024 * 1024) throw new Error('Image too large');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL('image/jpeg', .85).split(',')[1], type: 'image/jpeg' };
    } finally { URL.revokeObjectURL(url); }
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  await init();
})();
