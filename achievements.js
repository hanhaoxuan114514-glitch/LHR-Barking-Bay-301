(function (root) {
  'use strict';
  const definitions = [
    { id: 'z9-collector', key: 'lhr_achievement_z9_collector', name: 'Z9 收藏家', icon: '📷', game: 'LHR301 · ZRH快跑', description: '单次通关，收齐本局出现的全部尼康 Z9。' },
    { id: 'tag-collector', key: 'lhr_achievement_tag_collector', name: '行李牌收藏家', icon: '🏷️', game: 'LHR302 · T2 夜行', description: '单次通关，收齐本局全部 3 张行李牌。' }
  ];
  const storageKey = 'lhr_achievement_pending_v1';
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

  function evaluate(game, stats) {
    if (!stats.won) return [];
    const all = (got, total) => Number.isInteger(total) && total > 0 && got === total;
    if (game === 'zrh-run' && all(stats.z9Collected, stats.z9Total)) return ['z9-collector'];
    if (game === 'lhr302-t3' && all(stats.tagsCollected, stats.tagsTotal)) return ['tag-collector'];
    return [];
  }

  function createStore({ client, url, key, storage, fetch: request = root.fetch?.bind(root), onChange = () => {}, onUnlock = () => {}, onPending = () => {} }) {
    let user = null, unlocked = {}, pending = {}, error = false, busy = false;
    let queue = Promise.resolve();
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) pending = saved;
    } catch (_) { /* A blocked or damaged cache must not stop the game. */ }
    const scope = () => user?.id || 'guest';
    function bucket(owner) {
      if (!pending[owner] || typeof pending[owner] !== 'object' || Array.isArray(pending[owner])) pending[owner] = {};
      return pending[owner];
    }
    function persist() {
      try { storage?.setItem(storageKey, JSON.stringify(pending)); } catch (_) {}
    }
    function readMetadata(account) {
      const result = {};
      for (const item of definitions) {
        const value = account?.user_metadata?.[item.key];
        if (validDate(value)) result[item.id] = value;
      }
      return result;
    }
    function snapshot() {
      return { loggedIn: !!user, busy, error, items: definitions.map(item => ({
        ...item, unlockedAt: unlocked[item.id] || null,
        status: unlocked[item.id] ? 'unlocked' : validDate(bucket(scope())[item.id]) ? 'pending' : 'locked'
      })) };
    }
    function emit() { onChange(snapshot()); }
    function setUser(next) {
      if ((next?.id || null) !== (user?.id || null)) { unlocked = {}; error = false; }
      user = next || null;
      unlocked = { ...unlocked, ...readMetadata(user) };
      if (user) {
        const guest = bucket('guest'), own = bucket(user.id);
        for (const item of definitions) {
          if (validDate(guest[item.id]) && !own[item.id] && !unlocked[item.id]) own[item.id] = guest[item.id];
          delete guest[item.id];
        }
        persist();
      }
      emit();
    }
    async function syncOnce() {
      if (!user || !client) { emit(); return; }
      const owner = user.id;
      busy = true; error = false; emit();
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        const session = sessionData?.session;
        if (sessionError || !session || session.user.id !== owner) throw new Error('Session changed');
        // Pin reads and writes to this token, even if another tab switches accounts.
        const token = session.access_token;
        const { data, error: readError } = await client.auth.getUser(token);
        if (readError || data?.user?.id !== owner) throw readError || new Error('Account unavailable');
        const remote = readMetadata(data.user), own = bucket(owner), patch = {}, saving = {};
        for (const item of definitions) {
          if (remote[item.id]) delete own[item.id];
          else if (validDate(own[item.id])) { patch[item.key] = own[item.id]; saving[item.id] = own[item.id]; }
        }
        persist();
        if (user?.id === owner) { unlocked = { ...unlocked, ...remote }; emit(); }
        if (!Object.keys(patch).length) return;
        const response = await request(url + '/auth/v1/user', {
          method: 'PUT', headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: patch }), signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error('Save failed');
        const saved = await response.json();
        if (saved.id !== owner) throw new Error('Account changed');
        const confirmed = readMetadata(saved);
        for (const item of definitions) {
          if (!saving[item.id] || !confirmed[item.id]) continue;
          if (own[item.id] === saving[item.id]) delete own[item.id];
          if (user?.id === owner) {
            const first = !unlocked[item.id];
            unlocked[item.id] = confirmed[item.id];
            if (first) onUnlock(item);
          }
        }
        persist();
      } catch (_) {
        if (user?.id === owner) error = true;
      } finally { busy = false; emit(); }
    }
    function sync() { queue = queue.then(syncOnce); return queue; }
    function award(id) {
      const item = definitions.find(item => item.id === id);
      if (!item || unlocked[id]) return Promise.resolve();
      const own = bucket(scope());
      if (!validDate(own[id])) {
        own[id] = new Date().toISOString(); persist(); emit();
        onPending(item, !!user);
      }
      return sync();
    }
    return { setUser, snapshot, sync, award };
  }

  function mount({ client, url, key, onLogin }) {
    const dialog = document.createElement('dialog');
    dialog.className = 'achievement-dialog';
    dialog.setAttribute('aria-labelledby', 'achievement-title');
    dialog.innerHTML = '<div class="achievement-heading"><div><div class="achievement-eyebrow">LHR · ACHIEVEMENTS</div><h2 id="achievement-title">我的成就</h2></div><button class="achievement-close" aria-label="关闭成就">×</button></div><p class="achievement-account"></p><div class="achievement-list"></div><div class="achievement-actions"><button class="achievement-login">登录账号</button><button class="achievement-retry">刷新成就</button></div>';
    document.body.append(dialog);
    const notice = document.createElement('div');
    notice.className = 'achievement-notice'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
    document.body.append(notice);
    let noticeTimer, opener;
    function notify(message) {
      notice.textContent = message; notice.classList.add('visible');
      clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.classList.remove('visible'), 4500);
    }
    function render(state) {
      const count = state.items.filter(item => item.status === 'unlocked').length;
      document.querySelectorAll('[data-achievements]').forEach(button => { button.textContent = `🏆 成就 ${count}/2`; });
      dialog.querySelector('.achievement-account').textContent = !client ? '账号服务暂时无法连接，请联网后刷新页面。' : !state.loggedIn
        ? '登录后，成就会保存到账号，换设备也能查看。'
        : state.error ? '暂时无法同步。已达成的成就会保留，联网后可重试。'
        : state.busy ? '正在同步账号成就…' : `已解锁 ${count}/2 · 成就已与账号同步`;
      const list = dialog.querySelector('.achievement-list'); list.replaceChildren();
      for (const item of state.items) {
        const card = document.createElement('article'); card.className = 'achievement-card ' + item.status;
        const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.textContent = item.icon;
        const body = document.createElement('div');
        const game = document.createElement('div'); game.className = 'achievement-game'; game.textContent = item.game;
        const title = document.createElement('h3'); title.textContent = item.name;
        const description = document.createElement('p'); description.textContent = item.description;
        const status = document.createElement('div'); status.className = 'achievement-status';
        status.textContent = item.status === 'unlocked' ? '✓ 已解锁 · ' + new Date(item.unlockedAt).toLocaleDateString('zh-CN')
          : item.status === 'pending' ? state.loggedIn ? '已达成 · 等待同步' : '已达成 · 登录后领取' : '未解锁';
        body.append(game, title, description, status); card.append(icon, body); list.append(card);
      }
      dialog.querySelector('.achievement-login').hidden = state.loggedIn;
      dialog.querySelector('.achievement-login').disabled = !client;
      dialog.querySelector('.achievement-retry').hidden = !state.loggedIn;
      dialog.querySelector('.achievement-retry').disabled = state.busy;
    }
    let storage;
    try { storage = sessionStorage; } catch (_) {}
    const store = createStore({ client, url, key, storage, onChange: render,
      onUnlock: item => notify('🏆 成就解锁：' + item.name + ' · 已保存到账号'),
      onPending: (item, loggedIn) => notify('🏆 ' + item.name + (loggedIn ? ' · 已达成，正在保存到账号' : ' · 登录后领取成就'))
    });
    render(store.snapshot());
    const ready = client ? client.auth.getSession().then(({ data }) => {
      store.setUser(data?.session?.user); store.sync();
    }).catch(() => {}) : Promise.resolve();
    // Do not call Supabase async methods inside its auth event callback.
    if (client) client.auth.onAuthStateChange((event, session) => {
      store.setUser(session?.user);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setTimeout(() => store.sync(), 0);
    });
    document.querySelectorAll('[data-achievements]').forEach(button => button.addEventListener('click', () => {
      opener = button; dialog.showModal(); store.sync();
    }));
    dialog.querySelector('.achievement-close').onclick = () => dialog.close();
    dialog.addEventListener('close', () => opener?.focus());
    dialog.querySelector('.achievement-login').onclick = () => { dialog.close(); onLogin(); };
    dialog.querySelector('.achievement-retry').onclick = () => store.sync();
    addEventListener('online', () => store.sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) store.sync(); });
    return { complete(game, stats) { return ready.then(() => Promise.all(evaluate(game, stats).map(id => store.award(id)))); } };
  }

  const api = { evaluate, createStore, mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LHRAchievements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
