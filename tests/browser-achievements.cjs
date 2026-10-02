// Run against a local static server. Uses an isolated browser and mocked account
// endpoints: this never signs in to or changes a real player's account.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8765';
const authKey = 'sb-vmglldxyaolhecraghel-auth-token';
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'player@example.test', user_metadata: { nickname: 'Test Player' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-01-01T00:00:00Z' };
const token = [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' } ].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.test-signature';
const session = () => ({ access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user });

(async () => {
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  async function context(loggedIn, viewport = { width: 1280, height: 900 }) {
    const c = await browser.newContext({ viewport });
    await c.route('**/auth/v1/**', async route => {
      const req = route.request(), url = req.url();
      if (url.includes('/token')) return route.fulfill({ json: session() });
      if (url.endsWith('/user')) {
        if (req.method() === 'PUT') Object.assign(user.user_metadata, req.postDataJSON().data);
        return route.fulfill({ json: user });
      }
      return route.fulfill({ json: {} });
    });
    await c.route('**/rest/v1/**', route => route.fulfill({ json: [], headers: { 'content-range': '0-0/0' } }));
    if (loggedIn) await c.addInitScript(({ authKey, saved, origin }) => {
      if (location.origin === origin) localStorage.setItem(authKey, JSON.stringify(saved));
    }, { authKey, saved: session(), origin: new URL(base).origin });
    c.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    return c;
  }
  async function winRunner(page, collected = 3) {
    await page.evaluate(collected => {
      start(); G.nextItem = Infinity; G.nextObs = Infinity;
      for (let i=0; i<3; i++) {
        G.dist = 3000 + i*5500;
        const random = Math.random; Math.random = () => 0.1;
        let item;
        try { item = mkItem(PX, -30); } finally { Math.random = random; }
        if (i < collected) { G.items.push(item); update(0); }
      }
      G.dist = GOAL; update(0); winScreen();
    }, collected);
  }
  try {
    const stalledContext = await browser.newContext(), stalledPage = await stalledContext.newPage();
    await stalledPage.route('**/test-shell', route => route.fulfill({ contentType: 'text/html', body: '<button data-achievements>成就</button>' }));
    await stalledPage.goto(base + '/test-shell');
    await stalledPage.addScriptTag({ path: require('node:path').join(__dirname, '../achievements.js') });
    await stalledPage.evaluate(() => {
      const account = { id: 'offline-player', user_metadata: {} };
      const client = { auth: {
        getSession: async () => ({ data: { session: { user: account, access_token: 'test' } } }),
        getUser: () => new Promise(() => {}),
        onAuthStateChange() {}
      } };
      const ui = LHRAchievements.mount({ client, url: 'https://example.test', key: 'test', onLogin() {} });
      ui.complete('zrh-run', { won: true, z9Collected: 3, z9Total: 3 });
    });
    await stalledPage.waitForFunction(() => JSON.parse(sessionStorage.getItem('lhr_achievement_pending_v1') || '{}')['offline-player']?.['z9-collector'], null, { timeout: 1500 });
    await stalledContext.close();
    console.log('PASS completed run is persisted while initial cloud read is stalled');
    const guest = await context(false), page = await guest.newPage();
    await page.goto(base); await page.waitForFunction(() => !!window.LHRAchievements && document.querySelector('.achievement-dialog'));
    await winRunner(page, 2);
    await page.locator('#sWin [data-achievements]').click();
    assert.equal(await page.locator('.achievement-card.pending').count(), 0, 'missing a Z9 must not unlock');
    await page.getByRole('button', { name: '关闭成就' }).click();
    await winRunner(page);
    await page.locator('#sWin [data-achievements]').click();
    await page.waitForFunction(() => document.querySelector('.achievement-card.pending'));
    assert.match(await page.locator('.achievement-list').innerText(), /已达成 · 登录后领取/);
    await page.locator('.achievement-login').click();
    await page.locator('#inMail').fill('player@example.test');
    await page.locator('#inPass').fill('test-password');
    await page.locator('#bSend').click();
    await page.waitForFunction(() => document.querySelector('[data-achievements]').textContent.includes('1/2'));
    assert.ok(user.user_metadata.lhr_achievement_z9_collector, 'guest achievement must reach account storage');
    assert.equal(user.user_metadata.nickname, 'Test Player');
    console.log('PASS runner miss/full collection, guest login claim, profile preserved');

    // New context has no local achievement cache: account data is the source.
    const device = await context(true), second = await device.newPage();
    await second.goto(base + '/lhr302.html');
    await second.waitForFunction(() => window.__lhr302?.state === 'title', null, { timeout: 60000 });
    assert.match(await second.locator('#sTitle [data-achievements]').innerText(), /1\/2/);
    const capturedAtExit = await second.evaluate(() => {
      const game = window.__lhr302; game.startPlay();
      game.G.t=60; game.G.hasBag=true; game.G.tagN=3;
      game.player.x=4; game.player.z=-1;
      const guard = game.guards[0]; guard.x=4; guard.z=-1; guard.state='chase';
      game.step(1,0);
      return { over: game.G.over, won: Number.isFinite(game.G.winTime) };
    });
    assert.deepEqual(capturedAtExit, { over: true, won: false }, 'being caught on the exit must not unlock a win achievement');
    await second.locator('#sVN').waitFor({ state: 'visible' });
    await second.locator('#vSkip').click();
    await second.locator('#sOver').waitFor({ state: 'visible' });
    console.log('PASS capture on exit does not count as successful completion');
    await second.evaluate(() => {
      const game = window.__lhr302; game.startPlay(); game.G.noAI = true;
      const spots = [[9.6,24],[2.2,31],[22.9,16.5],[36.6,26],[49.6,35.2],[69.8,25],[26,2.2],[56.5,26.2],[14.5,9.7],[45.5,37.9],[31.5,37.9],[69.5,31.2]];
      for (const [x,z] of spots) { game.player.x=x; game.player.z=z; game.step(1,0); }
      if (game.G.tagN !== 3) throw new Error('Actual tag pickup failed: ' + game.G.tagN);
      game.G.t=60; game.G.hasBag=true; game.player.x=4; game.player.z=-1; game.step(1,0);
    });
    await second.waitForFunction(() => document.querySelector('[data-achievements]').textContent.includes('2/2'));
    assert.ok(user.user_metadata.lhr_achievement_tag_collector, 'actual tag collection and exit must save achievement');
    console.log('PASS second device cloud read, 3D tag pickup, successful exit, second achievement saved');

    await second.goto(base); await second.locator('#sMenu [data-achievements]').click();
    await second.waitForFunction(() => document.querySelectorAll('.achievement-card.unlocked').length === 2);
    await second.screenshot({ path: '/tmp/lhr-achievements-desktop.png' });
    await second.setViewportSize({ width: 390, height: 844 });
    await second.screenshot({ path: '/tmp/lhr-achievements-mobile.png' });
    const fit = await second.locator('.achievement-dialog').evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth, client: el.clientWidth }));
    assert.ok(fit.width <= 390 && fit.scroll <= fit.client + 1, 'mobile dialog must not overflow horizontally');
    await second.keyboard.press('Escape');
    assert.equal(await second.locator('.achievement-dialog').evaluate(el => el.open), false);
    assert.deepEqual(errors, [], 'no browser script errors');
    console.log('PASS shared achievement gallery, mobile layout, keyboard close; no browser script errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
