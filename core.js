/* 予約ボード（お店のタブレット・社員のスマホ）の土台
   ・受け口（コード.gs）から予約・席・設定を読み、15秒ごとに読み直す（画面が隠れているあいだは止める）
   ・直すときは、先に画面を変えてから受け口へ送る。だめだったら元に戻して知らせる
   ・ほかの端末で先に変わっていたら（更新日時がちがう）、読み直して知らせる
   ・合言葉はこの端末の localStorage にだけ覚える。お客様の情報は端末に残さない
   ・開いてすぐ席を出せるように、席の並び・設定（担当者の名前を除く）・今日の営業時間だけは覚えておき、
     受け口の返事を待つあいだ、予約の無い形で先に出す（上に「予約を読み込んでいます」）。予約が届いたら入れかえる
   画面ごとの中身は schedule.js・floor.js・lists.js・settings.js、予約の詳細は detail.js、登録は register.js */
(function () {
  'use strict';
  var A = window.BaguruApi;
  var D = window.D = { A: A, esc: A.esc, views: {} };
  var esc = A.esc;
  var $ = D.$ = function (id) { return document.getElementById(id); };
  // ★pin のキーは、バグるOrder受付も読み書きする（同じ t3dining.github.io なので、どちらかで1回入れれば両方で使える）。名前を変えるときは Order受付にも知らせる
  var KEY = D.KEY = { pin: 'baguru.daicho.pin', seen: 'baguru.daicho.seen', sound: 'baguru.daicho.sound', view: 'baguru.daicho.view', shell: 'baguru.daicho.shell' };
  var POLL_MS = 15000;

  var ST = D.ST = { REQ: 'リクエスト', WAIT: '来店待ち', IN: '来店済み', OUT: '退店', NO: 'お断り', CXL: 'キャンセル', NOSHOW: '無断キャンセル' };
  D.HOLDS = { 'リクエスト': true, '来店待ち': true, '来店済み': true, '退店': true };      // 席を使う
  D.HIDDEN = { 'お断り': true, 'キャンセル': true, '無断キャンセル': true };              // スケジュールに出さない
  D.STATUS_CLS = { 'リクエスト': 's-req', '来店待ち': 's-wait', '来店済み': 's-in', '退店': 's-out', 'お断り': 's-no', 'キャンセル': 's-cxl', '無断キャンセル': 's-noshow' };

  var st = D.st = {
    pin: get(KEY.pin), today: '', date: '', view: get(KEY.view) || 'schedule',
    rows: {}, pending: [], web: [], tables: [], conf: {}, days: {},
    seen: Number(get(KEY.seen) || 0), sound: get(KEY.sound) === '1',
    timer: null, busy: false, again: false, panel: null, listRange: null
  };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  D.get = get; D.set = set;

  /* ---------- 日付と時刻 ---------- */
  D.toMin = function (t) { var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  D.hm = function (m) { m = Math.max(0, Math.round(m)); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); };
  D.addDays = function (ymd, n) { var p = ymd.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10); };
  D.ymdOf = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  D.minOf = function (ms) { var d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
  D.nowMin = function () { return D.minOf(Date.now()); };
  D.STEP = 10;   // 時刻のきざみ（分）：予約登録の時刻・直接来店の時刻・スケジュールで動かすきざみ。ネット予約の「枠の間隔」とそろえる
  D.nextStep = function (m) { return m + D.STEP - m % D.STEP; };   // 次のきざみ（11:03 → 11:10、11:10 → 11:20）
  D.jp = A.jp; D.md = A.md; D.wd = A.wd;
  D.ymdJp = function (ymd) { var p = ymd.split('-'); return p[0] + '/' + Number(p[1]) + '/' + Number(p[2]) + '（' + A.wd(ymd) + '）'; };
  D.clock = function (ms) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  D.when = function (ms) { return ms ? A.md(D.ymdOf(ms)) + ' ' + D.clock(ms) : ''; };
  D.minMax = function (a, b) { return a < b ? [a, b] : [b, a]; };

  /** 予約が席を使う時間 [始まり, 終わり)（分）。受け口の span_ と同じ考え方 */
  D.span = function (r) {
    var a = D.toMin(r.start), b = a + r.keep;
    if (r.status === ST.OUT && r.outAt && D.ymdOf(r.outAt) === r.date) b = Math.max(a + 5, D.minOf(r.outAt));
    else if (r.status === ST.IN && r.date === st.today && D.nowMin() >= b) b = D.nowMin() + 1;
    return [a, b];
  };
  D.overlaps = function (r, a, b) { var s = D.span(r); return s[0] < b && s[1] > a; };

  /* ---------- 予約の集まり ---------- */
  D.row = function (id) { return st.rows[id] || st.pending.filter(function (r) { return r.id === id; })[0] || st.web.filter(function (r) { return r.id === id; })[0] || null; };
  D.rowsOn = function (date) {
    return Object.keys(st.rows).map(function (k) { return st.rows[k]; }).filter(function (r) { return r.date === date; })
      .sort(function (a, b) { return a.start.localeCompare(b.start) || a.createdAt - b.createdAt; });
  };
  D.rowsBetween = function (from, to) {
    return Object.keys(st.rows).map(function (k) { return st.rows[k]; }).filter(function (r) { return r.date >= from && r.date <= to; })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start) || a.createdAt - b.createdAt; });
  };
  D.table = function (id) { return st.tables.filter(function (t) { return t.id === id; })[0] || null; };
  D.shownTables = function () { return st.tables.filter(function (t) { return t.show; }); };
  D.tableNames = function (ids) { return ids.map(function (id) { var t = D.table(id); return t ? t.name : id; }).join('・'); };
  /** ひらがな → カタカナ */
  D.kata = function (s) { return String(s || '').replace(/[\u3041-\u3096]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 96); }); };
  /** 画面に出す名前：カタカナのフルネームがあれば、それを出す（ネット予約は kana にカタカナ、name に漢字が入る） */
  D.name = function (r) { return D.kata(r.kana).trim() || r.name || (r.route === '直接来店' ? '直接来店' : '（お名前なし）'); };
  D.isPhone = function () { return window.matchMedia('(max-width: 760px)').matches; };
  /** その席・その時間にかかる、ほかの予約 */
  D.clashes = function (date, tables, a, b, exceptId) {
    return D.rowsOn(date).filter(function (r) {
      return r.id !== exceptId && D.HOLDS[r.status] && r.tables.some(function (t) { return tables.indexOf(t) >= 0; }) && D.overlaps(r, a, b);
    });
  };

  /* ---------- 受け口とのやりとり ---------- */
  var ERR = D.ERR = {
    bad_pin: '合言葉が違います。', locked: '合言葉を何度も間違えたので、10分止まっています。',
    not_ready: '受け口がまだつながっていません（js/config.js）。', not_setup: '受け口の用意（setup）がまだです。',
    not_found: 'その予約が見つかりません。読み直してください。', conflict: '他の端末で先に変わっていました。読み直しました。',
    already: '他の端末で、先に対応されていました。', bad_date: '日にちと時刻を確かめてください。', bad_people: '人数を確かめてください。',
    bad_keep: '確保時間を確かめてください。', need_name: 'お名前を入れてください。', bad_tel: '電話番号の形が違います。',
    bad_email: 'メールアドレスの形が違います。', same_tel: '同じ電話番号のお客様が、もう顧客台帳にいます。',
    need_table: '席が1つもありません。', same_id: '同じ席が2つあります。', unknown_action: '受け口の版が古いようです。デプロイし直してください。',
    offline: 'つながりません。電波・Wi-Fi を確かめてください。', no_answer: 'つながりません。少し待ってからもう一度。'
  };
  D.errText = function (e) { return ERR[e.code] || ERR.no_answer; };
  D.post = function (payload) { payload.pin = st.pin; return A.post(payload).then(fixWords); };
  // 前に「お子さま連れ」と書いていたキーワードを「お子様連れ」にそろえる（受け口・設定のタブに古い書き方が残っていても同じものとして扱う）
  var OLD_WORDS = { 'お子さま連れ': 'お子様連れ' };
  function fixWords(o) {
    if (Array.isArray(o)) { o.forEach(fixWords); return o; }
    if (!o || typeof o !== 'object') return o;
    if (Array.isArray(o.keywords)) o.keywords = o.keywords.map(function (k) { return OLD_WORDS[k] || k; })
      .filter(function (k, i, a) { return a.indexOf(k) === i; });
    Object.keys(o).forEach(function (k) { if (k !== 'keywords' && o[k] && typeof o[k] === 'object') fixWords(o[k]); });
    return o;
  }

  function syncText(text, bad) { var s = $('sync'); s.textContent = text; s.classList.toggle('is-bad', !!bad); }

  /** いまの画面に要る日にち */
  D.range = function () {
    var t = st.today || D.ymdOf(Date.now()), d = st.date || t;
    var from = d < t ? d : t, to = d > t ? d : t;
    if (st.view === 'list' && st.listRange) {
      if (st.listRange.from < from) from = st.listRange.from;
      if (st.listRange.to > to) to = st.listRange.to;
    }
    if (st.extra) { if (st.extra < from) from = st.extra; if (st.extra > to) to = st.extra; }
    return { from: from, to: to };
  };

  D.load = function () {
    // 読んでいる途中なら、終わってからもう一度読む（読み終わるまで待てるように、約束を返す）
    if (st.loading) {
      if (!st.queued) st.queued = st.loading.then(function () { st.queued = null; return D.load(); });
      return st.queued;
    }
    var rg = D.range();
    st.loading = D.post({ action: 'load', from: rg.from, to: rg.to }).then(function (r) {
      var firstTime = !st.today;
      st.today = r.today;
      if (!st.date) st.date = r.today;
      // 読んだ日にちの分は入れかえる（消された・ほかの日に移った予約を残さない）
      Object.keys(st.rows).forEach(function (id) { var x = st.rows[id]; if (x.date >= r.from && x.date <= r.to) delete st.rows[id]; });
      r.rows.forEach(function (x) { st.rows[x.id] = x; });
      st.pending = r.pending; st.web = r.web; st.tables = r.tables; st.conf = r.conf;
      st.orders = r.orders || [];   // テイクアウトの注文（takeout.js）
      Object.keys(r.days).forEach(function (k) { st.days[k] = r.days[k]; });
      st.loadedAt = r.now;
      st.loadedRange = { from: r.from, to: r.to };
      st.version = r.version;
      if (!st.seen) { st.seen = Date.now(); set(KEY.seen, String(st.seen)); }
      saveShell(r);
      var wasWarm = endWarm();
      if (st.locked) { st.locked = false; $('loadbar').hidden = true; }
      syncText('最終更新 ' + D.clock(r.now), false);
      D.refresh();
      checkNew();
      if (D.checkOrders) D.checkOrders();
      if (firstTime) D.show(st.view);
      // 先に出していたあいだに、ほかの日にち・予約リストへ移っていたら、その分も読む
      if (wasWarm) { var rg2 = D.range(); if (rg2.from < r.from || rg2.to > r.to) D.load(); }
    }).catch(function (e) {
      if (e.code === 'bad_pin') { D.logout(D.errText(e)); return; }
      // 受け口が止まっている（だれかが合言葉を何度も間違えた）だけなら、この端末の合言葉は消さない。止まっている間も読み直しつづけ、戻ったら元の画面になる
      if (e.code === 'locked') { st.locked = true; $('loadbar').textContent = '受け口が止まっています（合言葉を何度も間違えた呼び出しがありました）。10分ほどで自動で戻ります。この端末の合言葉はそのままです'; $('loadbar').hidden = false; }
      syncText(D.errText(e), true);
      if (st.warm && e.code !== 'locked') $('loadbar').textContent = '予約を読み込めませんでした（' + D.errText(e) + '）。少しすると読み直します';
    }).then(function () { st.loading = null; });
    return st.loading;
  };

  /* ---------- 開いてすぐ、前に読んだ席の並びで画面を出す ---------- */
  function saveShell(r) {
    var days = {};
    if (r.days[r.today]) days[r.today] = r.days[r.today];
    var conf = Object.assign({}, r.conf);
    ['staff', 'parttime'].forEach(function (k) { delete conf[k]; });   // ★担当者の名前（従業員の名前）は端末に残さない
    set(KEY.shell, JSON.stringify({ today: r.today, tables: r.tables, conf: conf, days: days }));
  }
  /** 覚えている席の並びで、予約の無い画面を先に出す。出せたら true（初めての端末や、ログアウトのあとは出せない） */
  D.warmStart = function () {
    var s = null;
    try { s = JSON.parse(get(KEY.shell) || 'null'); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.tables) || !s.tables.length || !s.conf) return false;
    var t = D.ymdOf(Date.now());   // 覚えたのが前の日でも、席の並びは同じ。営業時間は、その日の分があるときだけ
    st.today = t; st.date = t; st.tables = s.tables; st.conf = s.conf; st.orders = [];
    if (s.today === t && s.days) Object.keys(s.days).forEach(function (k) { st.days[k] = s.days[k]; });
    st.warm = true;
    document.body.classList.add('warming');
    $('loadbar').textContent = '予約を読み込んでいます…';
    $('loadbar').hidden = false;
    D.show(st.view);
    return true;
  };
  function endWarm() {
    if (!st.warm) return false;
    st.warm = false;
    document.body.classList.remove('warming');
    $('loadbar').hidden = true;
    return true;
  }

  D.startPolling = function () {
    D.stopPolling();
    st.timer = setInterval(function () { if (!document.hidden) D.load(); }, POLL_MS);
  };
  D.stopPolling = function () { if (st.timer) clearInterval(st.timer); st.timer = null; };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.pin && st.today) D.load(); });
  window.addEventListener('online', function () { if (st.pin && st.today) D.load(); });

  /** 予約を直す。先に画面を変えてから送る。返すのは新しい予約（だめなら null） */
  D.save = function (r, patch, okText) {
    var old = JSON.parse(JSON.stringify(r));
    var live = st.rows[r.id];
    if (live) { Object.keys(patch).forEach(function (k) { live[k] = patch[k]; }); D.refresh(); }
    return D.post({ action: 'save', row: Object.assign({ id: r.id }, patch), expect: r.updatedAt }).then(function (res) {
      D.put(res.row);
      if (okText) D.toast(esc(okText));
      return res.row;
    }).catch(function (e) {
      if (live) st.rows[r.id] = old;
      if (e.code === 'conflict' && e.data && e.data.row) D.put(e.data.row);
      D.refresh();
      D.toast(esc((e.code === 'conflict' ? '' : '変えられませんでした：') + D.errText(e)), { warn: true });
      if (e.code === 'conflict') D.load();
      return null;
    });
  };
  /** 予約を足す。rid は送り直しで2つにならないための印 */
  D.create = function (data, rid) {
    return D.post({ action: 'save', row: data, rid: rid }).then(function (res) { D.put(res.row); return res.row; });
  };
  /** 受け口から返ってきた予約を、手元の集まりに入れる */
  D.put = function (row) {
    st.rows[row.id] = row;
    st.pending = st.pending.filter(function (x) { return x.id !== row.id; });
    if (row.status === ST.REQ && row.date >= st.today) st.pending.push(row);
    st.web = st.web.map(function (x) { return x.id === row.id ? row : x; });
    D.refresh();
    checkNew();
  };

  /* ---------- 状態を変える（レストランボードと同じく、1回押すと変わる。戻すときだけ確かめる） ---------- */
  D.setStatus = function (r, status) {
    var undo = { '来店待ち→来店済み': false, '来店済み→来店待ち': '来店を取り消します', '来店済み→退店': '退店にします',
      '退店→来店済み': '退店を取り消します', 'キャンセル→来店待ち': '来店待ちに戻します', '無断キャンセル→来店待ち': '来店待ちに戻します' };
    var q = undo[r.status + '→' + status];
    var go = function () {
      return D.save(r, { status: status }, D.name(r) + ' 様を「' + status + '」にしました');
    };
    if (!q) return go();
    return D.ask({ title: q, text: D.name(r) + ' 様（' + r.start + '・' + r.people + '名）', ok: 'OK' }).then(function (yes) { return yes ? go() : null; });
  };
  D.cancel = function (r) {
    return D.modalChoose({
      title: '予約をキャンセルします', text: D.name(r) + ' 様（' + D.md(r.date) + ' ' + r.start + '・' + r.people + '名）',
      choices: [{ v: ST.CXL, label: 'キャンセル（ご連絡あり）' }, { v: ST.NOSHOW, label: '無断キャンセル', danger: true }]
    }).then(function (v) { return v ? D.save(r, { status: v }, D.name(r) + ' 様を「' + v + '」にしました') : null; });
  };

  /* ---------- 新しいリクエストの知らせ（赤い帯・音） ---------- */
  var audio = null, told = 0;
  D.beep = function () {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.28].forEach(function (t) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.22);
        o.connect(g); g.connect(audio.destination);
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.24);
      });
    } catch (e) {}
  };
  function checkNew() {
    var n = st.pending.filter(function (r) { return r.createdAt > st.seen; });
    ['badge-req', 'badge-req2'].forEach(function (id) { var b = $(id); b.textContent = st.pending.length; b.hidden = !st.pending.length; });
    if (!n.length) { $('newbar').hidden = true; told = 0; return; }
    var latest = n[n.length - 1];
    $('newbar-text').textContent = 'ホームページ・アプリから新しいリクエストが ' + n.length + '件（' + A.md(latest.date) + ' ' + latest.start + ' ' + latest.people + '名' + (n.length > 1 ? ' 他' : '') + '）';
    $('newbar').hidden = false;
    if (n.length > told && st.sound) D.beep();
    told = n.length;
  }
  D.checkNew = checkNew;
  D.markSeen = function () {
    st.pending.forEach(function (r) { if (r.createdAt > st.seen) st.seen = r.createdAt; });
    set(KEY.seen, String(st.seen)); told = 0; checkNew();
  };

  /* ---------- 画面の切りかえ ---------- */
  var TITLES = { schedule: 'スケジュール', floor: 'テーブル管理', list: '予約リスト', requests: '予約受付', takeout: 'テイクアウト', customers: '顧客台帳', settings: '設定', more: 'その他' };
  D.show = function (view) {
    if (!D.views[view]) view = 'schedule';
    if (view !== 'more') { st.view = view; set(KEY.view, view); }
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.dataset.view !== view; });
    document.querySelectorAll('.nav[data-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.view === view); });
    $('view-title').textContent = TITLES[view];
    $('top-date').hidden = view !== 'schedule';
    D.closePanel();
    var v = D.views[view];
    if (v.enter) v.enter();
    D.renderView(view);
    var rg = D.range();
    if (st.today && !st.warm && (!st.loadedRange || rg.from < st.loadedRange.from || rg.to > st.loadedRange.to)) D.load();   // 先に出しているあいだは、読み込みの途中
  };
  D.renderView = function (view) {
    var v = D.views[view || st.view];
    if (v && st.today) v.render();
  };
  /** 読み直したあと・直したあとに、いまの画面と開いている詳細を描き直す */
  D.refresh = function () {
    if (!st.today) return;
    D.renderView();
    if (st.panel && st.panel.refresh) st.panel.refresh();
    $('d-label').textContent = D.ymdJp(st.date);
    $('d-input').value = st.date;
  };
  D.goDate = function (date) {
    st.date = date;
    D.refresh();
    D.load();
  };

  /* ---------- 右の詳細 ---------- */
  D.openPanel = function (html, opts) {
    var p = $('panel');
    $('panel-in').innerHTML = html;
    p.hidden = false;
    st.panel = opts || {};
    $('panel-in').scrollTop = 0;
  };
  D.closePanel = function () { $('panel').hidden = true; st.panel = null; };

  /* ---------- 知らせ・確かめの窓 ---------- */
  var toastTimer = null;
  D.toast = function (html, o) {
    o = o || {};
    var t = $('toast');
    t.innerHTML = '<span>' + html + '</span>' + (o.undo ? '<button type="button" data-t="undo">戻す</button>' : '') + (o.warn ? '<button type="button" data-t="close">閉じる</button>' : '');
    t.classList.toggle('is-warn', !!o.warn);
    t.hidden = false;
    t.onclick = function (e) {
      var b = e.target.closest('[data-t]');
      if (!b) return;
      t.hidden = true;
      if (b.dataset.t === 'undo' && o.undo) o.undo();
    };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, o.warn ? 12000 : 5000);
  };
  D.modal = function (html) {
    $('modal-in').innerHTML = html;
    $('modal').hidden = false;
    return $('modal-in');
  };
  D.closeModal = function () { var m = $('modal'); m.hidden = true; m.onclick = null; delete m.dataset.lock; $('modal-in').innerHTML = ''; };
  /** その日の予約が手元になければ読む（承認・登録の画面で、席の重なりを正しく出すため） */
  D.ensureDate = function (date) {
    var lr = st.loadedRange;
    if (lr && date >= lr.from && date <= lr.to) return Promise.resolve();
    st.extra = date;
    return D.load();
  };
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal') && !$('modal').dataset.lock) D.closeModal(); });
  /** はい／いいえ（窓の外を押すと「いいえ」） */
  D.ask = function (o) {
    return new Promise(function (ok) {
      var m = D.modal('<h2>' + esc(o.title) + '</h2>' + (o.text ? '<p class="m-text">' + esc(o.text) + '</p>' : '')
        + '<div class="m-acts"><button type="button" class="btn" data-a="no">' + esc(o.cancel || 'やめる') + '</button>'
        + '<button type="button" class="btn ' + (o.danger ? 'ember' : 'dark') + '" data-a="yes">' + esc(o.ok || 'OK') + '</button></div>');
      var done = function (v) { D.closeModal(); ok(v); };
      m.onclick = function (e) { var b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === 'yes'); };
      $('modal').onclick = function (e) { if (e.target === $('modal')) done(false); };
    });
  };
  /** いくつかから1つ選ぶ（やめると null） */
  D.modalChoose = function (o) {
    return new Promise(function (ok) {
      var m = D.modal('<h2>' + esc(o.title) + '</h2>' + (o.text ? '<p class="m-text">' + esc(o.text) + '</p>' : '')
        + '<div class="m-choices">' + o.choices.map(function (c) { return '<button type="button" class="btn ' + (c.danger ? 'ember' : 'dark') + '" data-v="' + esc(c.v) + '">' + esc(c.label) + '</button>'; }).join('') + '</div>'
        + '<div class="m-acts"><button type="button" class="btn" data-v="">やめる</button></div>');
      var done = function (v) { D.closeModal(); ok(v || null); };
      m.onclick = function (e) { var b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); };
      $('modal').onclick = function (e) { if (e.target === $('modal')) done(null); };
    });
  };

  /* ---------- 共通の小さな部品 ---------- */
  D.statusBadge = function (s) { return '<span class="stb ' + (D.STATUS_CLS[s] || '') + '">' + esc(s) + '</span>'; };
  D.icons = function (r) {
    var h = '';
    if (r.cust && r.cust.caution) h += '<i class="ic ic-warn" title="要確認">！</i>';
    if (r.route === 'ホームページ') h += '<i class="ic ic-web" title="ホームページから">HP</i>';
    else if (r.route === 'アプリ') h += '<i class="ic ic-web" title="お客さまのアプリから">アプリ</i>';
    if (r.kids || r.keywords.indexOf('お子様連れ') >= 0) h += '<i class="ic" title="お子様連れ">子</i>';
    if (r.keywords.indexOf('誕生日') >= 0 || r.keywords.indexOf('記念日') >= 0) h += '<i class="ic ic-cele" title="お祝い">祝</i>';
    if (r.dessert) h += '<i class="ic ic-cele" title="デザートプレート">デ</i>';
    if (r.memo || r.note) h += '<i class="ic" title="メモ">メ</i>';
    if (r.cust && r.cust.allergy) h += '<i class="ic ic-warn" title="苦手・アレルギー">苦</i>';
    return h;
  };
  D.telLink = function (tel) { return tel ? '<a class="tel" href="tel:' + esc(tel.replace(/[^\d]/g, '')) + '">' + esc(tel) + '</a>' : ''; };

  /* ---------- ログイン・ログアウト ---------- */
  D.logout = function (msg) {
    D.stopPolling();
    st.pin = null; set(KEY.pin, null); set(KEY.shell, null); endWarm();
    st.rows = {}; st.pending = []; st.web = []; st.today = ''; st.date = '';
    $('app').hidden = true; $('bnav').hidden = true; $('login').hidden = false;
    D.closePanel(); D.closeModal();
    var m = $('login-err'); m.textContent = msg || ''; m.hidden = !msg;
  };
})();
