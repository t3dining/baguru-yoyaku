/* 予約登録・予約内容の変更（全画面）と、人数を入れる小さな窓
   ・レストランボードと同じく、電話で聞く順に3つの段で入れる：1 日時・人数 → 2 テーブル → 3 お客様 → 確認 → 登録
   ・上の段の名前を押すと、行ったり来たりできる。登録の前に、席の重なり・人数・定休日を確かめる画面を出す
   ・スケジュールやテーブル管理でマスを押したときは、人数の窓（D.numpad）から「予約登録」「直接来店」に分かれる */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, ST = D.ST, $ = D.$;

  /* ---------- 席を選ぶ部品（登録の2段目と、リクエストの承認で使う） ---------- */
  D.tableChooser = function (box, o) {
    var sel = (o.selected || []).slice(), keep = o.keep;
    function render() {
      var a = D.toMin(o.start), b = a + keep, groups = [], byG = {};
      D.shownTables().forEach(function (t) {
        if (!byG[t.group]) { byG[t.group] = []; groups.push(t.group); }
        byG[t.group].push(t);
      });
      var total = sel.reduce(function (n, id) { var t = D.table(id); return n + (t ? t.cap : 0); }, 0), lack = o.people - total;
      box.innerHTML = groups.map(function (g) {
        return '<div class="tc-g"><p class="tc-gn">' + esc(g) + '</p><div class="tc-row">' + byG[g].map(function (t) {
          var cl = D.clashes(o.date, [t.id], a, b, o.except), on = sel.indexOf(t.id) >= 0;
          return '<button type="button" class="tc' + (on ? ' on' : '') + (cl.length ? ' busy' : '') + '" data-t="' + esc(t.id) + '">'
            + '<b>' + esc(t.name) + '</b><small>' + t.cap + '名' + (t.kind !== 'テーブル' ? '・' + esc(t.kind) : '') + '</small>'
            + '<em>' + (cl.length ? esc(cl[0].start + ' ' + D.name(cl[0])) + (cl.length > 1 ? ' 他' : '') : '空き') + '</em></button>';
        }).join('') + '</div></div>';
      }).join('')
        + (sel.length && lack > 0 ? '<p class="tc-warn ' + (lack >= 3 ? 'red' : 'yellow') + '">席が ' + lack + '名分 足りません（選んだ席 ' + total + '名・' + o.people + '名様）</p>' : '')
        + (sel.some(function (id) { return D.clashes(o.date, [id], a, b, o.except).length; }) ? '<p class="tc-warn red">他の予約と重なる席を選んでいます（灰色の席）</p>' : '');
      if (o.onChange) o.onChange(sel, keep);
    }
    box.onclick = function (e) {
      var c = e.target.closest('[data-t]');
      if (!c) return;
      var id = c.dataset.t, i = sel.indexOf(id);
      if (i >= 0) sel.splice(i, 1); else sel.push(id);
      render();
    };
    render();
    return {
      value: function () { return sel.slice(); },
      keep: function () { return keep; },
      setKeep: function (k) { keep = k; render(); },
      set: function (patch) { Object.keys(patch).forEach(function (k) { o[k] = patch[k]; }); render(); }
    };
  };

  /* ---------- 人数の窓 ---------- */
  var pop = $('pop');
  /** 席の名前と人数（人数の窓の見出し） */
  D.seatLabel = function (tables) {
    if (!tables.length) return '席なし';
    var total = tables.reduce(function (n, id) { var t = D.table(id); return n + (t ? t.cap : 0); }, 0);
    return D.tableNames(tables) + '（' + total + '名）';
  };
  D.numpad = function (o) {
    var people = o.people || 0, isToday = o.date === st.today;
    function html() {
      var nums = '';
      for (var n = 1; n <= 12; n++) nums += '<button type="button" class="np' + (people === n ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>';
      return '<div class="pop-in"><div class="pop-head"><b>' + esc(o.label) + '</b><button type="button" class="x" data-p="close" aria-label="閉じる"><svg class="i"><use href="#i-x"/></svg></button></div>'
        + '<p class="pop-q">何名様ですか？</p><div class="np-grid">' + nums + '</div>'
        + '<label class="np-more">13名から<input type="number" min="1" max="200" inputmode="numeric" id="np-more" value="' + (people > 12 ? people : '') + '">名</label>'
        + '<button type="button" class="np-seat" data-p="seat"><svg class="i"><use href="#i-plus"/></svg>席を足す</button>'
        + '<div class="pop-acts"><button type="button" class="btn dark" data-p="book"' + (people ? '' : ' disabled') + '>予約登録</button>'
        + (isToday ? '<button type="button" class="btn ok" data-p="walk"' + (people ? '' : ' disabled') + '>直接来店</button>' : '') + '</div></div>';
    }
    function draw() { pop.innerHTML = html(); }
    draw();
    pop.hidden = false;
    // 押したところの近くに出す（スマホは下に）
    if (D.isPhone()) { pop.style.left = ''; pop.style.top = ''; pop.classList.add('is-sheet'); }
    else {
      pop.classList.remove('is-sheet');
      var w = 300, h = pop.offsetHeight || 380;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, (o.x || 200) - w / 2)) + 'px';
      pop.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, (o.y || 200) + 12)) + 'px';
    }
    pop.onclick = function (e) {
      var b = e.target.closest('[data-n],[data-p]');
      if (!b) return;
      if (b.dataset.n) { people = Number(b.dataset.n); draw(); return; }
      var more = Number(($('np-more') || {}).value || 0);
      if (more > 0) people = more;
      if (b.dataset.p === 'close') return D.closeNumpad();
      if (b.dataset.p === 'seat') { D.closeNumpad(); return D.startPick(o, people); }
      if (!people) return;
      D.closeNumpad();
      if (b.dataset.p === 'book') D.openRegister({ date: o.date, start: o.start, people: people, tables: o.tables || [], step: 3 });
      if (b.dataset.p === 'walk') D.walkIn(people, o.tables || []);
    };
    pop.oninput = function (e) { if (e.target.id === 'np-more') { people = Number(e.target.value) || 0; pop.querySelectorAll('[data-p="book"],[data-p="walk"]').forEach(function (x) { x.disabled = !people; }); } };
  };
  D.closeNumpad = function () { pop.hidden = true; pop.innerHTML = ''; };
  document.addEventListener('pointerdown', function (e) {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.sch-lane,.ft,.floor-tmp')) D.closeNumpad();
  });

  /* ---------- 席を足す（人数の窓の「席を足す」→ いまの画面の上で席を押して足す → 「決める」で人数の窓に戻る） ----------
     ・テーブル管理は配置図の席、スケジュールは席の段を押す。もう一度押すと外れる
     ・席と下の帯のほかを触ると、やめて元の画面に戻る（選び直すときは、もう一度はじめから） */
  var pick = null;   // { o: 人数の窓の中身, people, tables }
  D.picking = function () { return pick; };
  D.startPick = function (o, people) {
    pick = { o: o, people: people, tables: (o.tables || []).slice() };
    paintPick();
  };
  D.pickToggle = function (id) {
    var i = pick.tables.indexOf(id);
    if (i >= 0) pick.tables.splice(i, 1);
    else {
      pick.tables.push(id);
      var a = D.toMin(pick.o.start), cl = D.clashes(pick.o.date, [id], a, a + (st.conf.keep || 90), '');
      if (cl.length) D.toast(esc(D.tableNames([id]) + ' は ' + cl[0].start + ' ' + D.name(cl[0]) + ' 様の予約と重なります'), { warn: true });
    }
    paintPick();
  };
  D.endPick = function (go) {
    var p = pick;
    pick = null;
    paintPick();
    if (!go || !p) return;
    var next = {};
    Object.keys(p.o).forEach(function (k) { next[k] = p.o[k]; });
    next.people = p.people; next.tables = p.tables; next.label = D.seatLabel(p.tables) + (p.o.suffix || '');
    D.numpad(next);
  };
  function paintPick() {
    var bar = $('pickbar');
    document.body.classList.toggle('picking', !!pick);
    bar.hidden = !pick;
    bar.innerHTML = pick ? '<span class="pk-txt"><b>' + esc(D.seatLabel(pick.tables)) + '</b><small>足したい席を押してください（もう一度押すと外れます）。ほかを触ると元に戻ります</small></span>'
      + '<button type="button" class="btn ok" data-pk="ok">決める</button>' : '';
    D.refresh();   // 選んだ席に色を付ける
  }
  $('pickbar').addEventListener('click', function (e) { if (e.target.closest('[data-pk="ok"]')) D.endPick(true); });
  // 席（配置図の席・スケジュールの段）と下の帯のほかを触ったら、やめる。そのときの押した先は動かさない（元の画面に戻るだけ）
  var eat = false;
  document.addEventListener('pointerdown', function (e) {
    if (!pick || e.target.closest('#pickbar, .ft, .sch-lane')) return;
    eat = true;
    setTimeout(function () { eat = false; }, 700);
    D.endPick(false);
  }, true);
  document.addEventListener('click', function (e) { if (eat) { eat = false; e.stopPropagation(); e.preventDefault(); } }, true);

  /** 直接来店（予約なしのお客様）。いまの時刻で「来店済み」にする */
  D.walkIn = function (people, tables) {
    var now = D.nowMin(), start = D.hm(now - now % 5);
    var using = tables.length ? D.clashes(st.today, tables, now, now + 1, '').filter(function (r) { return r.status === ST.IN; }) : [];
    var go = function () {
      return D.create({ date: st.today, start: start, people: people, tables: tables, route: '直接来店', status: ST.IN, name: '', keep: st.conf.keep }, D.A.rid())
        .then(function (row) { D.toast('直接来店を入れました（' + esc(tables.length ? D.tableNames(tables) : '席なし') + '・' + people + '名）'); return row; })
        .catch(function (e) { D.toast('入れられませんでした：' + esc(D.errText(e)), { warn: true }); });
    };
    if (!using.length) return go();
    return D.ask({ title: 'この席は使用中です', text: D.tableNames(tables) + ' に ' + D.name(using[0]) + ' 様（' + using[0].people + '名）が座っています。先に退店にしてから入れるのがお勧めです。このまま入れますか？', ok: 'このまま入れる' })
      .then(function (yes) { return yes ? go() : null; });
  };

  /* ---------- 予約登録・変更の画面 ---------- */
  var sheet = $('sheet'), f = null, step = 1, chooser = null, rid = '', searchTimer = null, found = [];

  D.openRegister = function (o) {
    o = o || {};
    var r = o.row;
    var now = D.nowMin(), nextQ = D.hm(Math.min(23 * 60 + 50, D.nextStep(now)));
    f = r ? {
      id: r.id, expect: r.updatedAt, date: r.date, start: r.start, people: r.people, keep: r.keep, tables: r.tables.slice(),
      name: r.name, kana: r.kana, tel: r.tel, email: r.email, route: r.route, keywords: r.keywords.slice(), memo: r.memo,
      dessert: r.dessert === true, plateMsg: r.plateMsg || '', status: r.status, cid: r.cid, cust: r.cust, no: r.no, staff: r.staff || ''
    } : {
      date: o.date || st.date || st.today, start: o.start || (o.date && o.date !== st.today ? '18:00' : nextQ), people: o.people || 0,
      keep: st.conf.keep || 90, tables: o.tables || [], name: '', kana: '', tel: '', email: '', route: '電話', keywords: [], memo: '',
      dessert: false, plateMsg: '', status: ST.WAIT, cid: '', cust: null, staff: ''
    };
    rid = D.A.rid(); found = [];
    sheet.hidden = false;
    document.body.classList.add('no-scroll');
    D.ensureDate(f.date).then(function () { if (!sheet.hidden) draw(); });
    go(o.step || 1);
  };
  D.closeRegister = function () { sheet.hidden = true; sheet.innerHTML = ''; f = null; document.body.classList.remove('no-scroll'); st.extra = null; };

  function frame(body, foot) {
    var steps = [['1', '日時・人数'], ['2', 'テーブル'], ['3', 'お客様']];
    sheet.innerHTML = '<div class="sh-in"><header class="sh-top">'
      + '<button type="button" class="x" data-r="close" aria-label="閉じる"><svg class="i"><use href="#i-x"/></svg></button>'
      + '<h2 id="sh-title">' + (f.id ? '予約内容の変更' + (f.no ? '<small>No.' + esc(f.no) + '</small>' : '') : '予約登録') + '</h2>'
      + '<nav class="sh-steps">' + steps.map(function (s) { return '<button type="button" data-step="' + s[0] + '" class="' + (String(step) === s[0] ? 'on' : '') + '"><b>' + s[0] + '</b>' + s[1] + '</button>'; }).join('') + '</nav>'
      + '</header><div class="sh-sum">' + summary() + '</div><div class="sh-body" id="sh-body">' + body + '</div><footer class="sh-foot">' + foot + '</footer></div>';
  }
  function summary() {
    var e = D.toMin(f.start) + f.keep;
    return '<span>' + esc(D.jp(f.date)) + ' <b>' + esc(f.start) + '</b>〜' + D.hm(e) + '</span><span><b>' + (f.people || '－') + '</b>名</span>'
      + '<span>' + (f.tables.length ? esc(D.tableNames(f.tables)) : '席 未割り当て') + '</span>' + (f.name ? '<span>' + esc(f.name) + ' 様</span>' : '');
  }
  function go(n) { step = n; draw(); }
  function draw() {
    if (!f) return;
    if (step === 1) step1(); else if (step === 2) step2(); else if (step === 3) step3(); else confirmView();
    var body = $('sh-body');
    if (body) body.scrollTop = 0;
  }

  /* 1. 日時・人数 */
  function step1() {
    var days = '', base = st.today;
    for (var i = 0; i < 14; i++) {
      var d = D.addDays(base, i), n = D.rowsOn(d).filter(function (r) { return D.HOLDS[r.status]; });
      var w = D.A.weekday(d), info = st.days[d];
      days += '<button type="button" class="dchip' + (d === f.date ? ' on' : '') + (w === 0 || (info && info.holiday) ? ' sun' : w === 6 ? ' sat' : '') + (info && info.type === 'closed' ? ' closed' : '') + '" data-d="' + d + '">'
        + '<b>' + D.md(d) + '</b><small>' + D.wd(d) + (info && info.type === 'closed' ? '・休' : '') + '</small><em>' + (n.length ? n.length + '組' : '') + '</em></button>';
    }
    var vf = D.toMin(st.conf.viewFrom || '10:00'), vt = D.toMin(st.conf.viewTo || '23:30'), open = (st.days[f.date] || {}).open || [];
    var inOpen = function (m) { return open.some(function (r) { return m >= r[0] && m < r[1]; }); };
    var times = '';
    for (var h = Math.floor(vf / 60); h * 60 < vt; h++) {
      times += '<div class="trow"><span class="th">' + h + '時</span>';
      for (var q = 0; q < 60; q += D.STEP) {
        var m = h * 60 + q, t = D.hm(m);
        times += '<button type="button" class="tchip' + (t === f.start ? ' on' : '') + (open.length && !inOpen(m) ? ' off' : '') + '" data-tm="' + t + '">' + t + '</button>';
      }
      times += '</div>';
    }
    var ppl = '';
    for (var p = 1; p <= 12; p++) ppl += '<button type="button" class="pchip' + (f.people === p ? ' on' : '') + '" data-pp="' + p + '">' + p + '名</button>';
    frame('<h3 class="q">いつ、何名様ですか？</h3>'
      + '<p class="lbl">日にち</p><div class="dstrip">' + days + '<label class="dother">他の日<input type="date" id="r-date" value="' + f.date + '"></label></div>'
      + '<p class="lbl">時間<span class="adj"><button type="button" data-adj="-5">−5分</button><b>' + esc(f.start) + '</b><button type="button" data-adj="5">＋5分</button></span></p><div class="tgrid">' + times + '</div>'
      + '<p class="lbl">人数</p><div class="pgrid">' + ppl + '<label class="pmore"><input type="number" id="r-people" min="1" max="200" inputmode="numeric" value="' + (f.people > 12 ? f.people : '') + '">名</label></div>',
      '<button type="button" class="btn" data-r="skip"' + (f.people ? '' : ' disabled') + '>テーブル選択をスキップ</button>'
      + '<button type="button" class="btn dark big" data-r="to2"' + (f.people ? '' : ' disabled') + '>テーブルを選ぶ</button>');
  }

  /* 2. テーブル */
  function step2() {
    frame('<h3 class="q">お席はどちらにしますか？</h3>'
      + '<p class="lbl">確保時間<span class="adj"><button type="button" data-keep="-30">−30分</button><button type="button" data-keep="-5">−5分</button><b>' + f.keep + '分</b><button type="button" data-keep="5">＋5分</button><button type="button" data-keep="30">＋30分</button></span></p>'
      + '<div id="r-tables"></div>',
      '<button type="button" class="btn" data-r="to1">戻る</button><button type="button" class="btn dark big" data-r="to3">お客様の入力へ</button>');
    chooser = D.tableChooser($('r-tables'), { date: f.date, start: f.start, keep: f.keep, people: f.people || 1, selected: f.tables, except: f.id,
      onChange: function (sel) { f.tables = sel; var s = sheet.querySelector('.sh-sum'); if (s) s.innerHTML = summary(); } });
  }

  /* 担当者：お店で入れる予約（電話・店頭など）で選ぶ。ネット予約（ホームページ・アプリ）と直接来店は選ばない。
     新しく入れるときは必ず選ぶ（1人も入っていなければ選ばずに入れられる）。
     並びは、社員（いつも先）→ アルバイト。どちらも「設定」の「担当者」に並んでいる順 */
  var NO_STAFF = { 'ホームページ': true, 'アプリ': true, '直接来店': true };
  function staffGroups() {
    var emp = st.conf.staff || [], pt = (st.conf.parttime || []).filter(function (n) { return emp.indexOf(n) < 0; });
    return { emp: emp, pt: pt, gone: f.staff && emp.indexOf(f.staff) < 0 && pt.indexOf(f.staff) < 0 ? [f.staff] : [] };   // gone：前に選んだが、いまは一覧に無い人
  }
  function needStaff() { return !NO_STAFF[f.route]; }
  function staffBox() {
    if (!needStaff()) return '';
    var g = staffGroups(), must = !f.id && g.emp.length + g.pt.length > 0;
    var chips = function (list) { return list.map(function (n) { return '<button type="button" class="kchip' + (n === f.staff ? ' on' : '') + '" data-stf="' + esc(n) + '">' + esc(n) + '</button>'; }).join(''); };
    return '<p class="lbl">担当者' + (must ? '<span class="need">必須</span>' : '') + '</p>'
      + (g.emp.length + g.pt.length + g.gone.length ? '<div class="kgrid" id="r-staff">' + chips(g.emp) + chips(g.gone)
        + (g.pt.length ? '<span class="stf-sep">アルバイト</span>' + chips(g.pt) : '') + '</div>'
        : '<p class="muted">担当者の名前は、「設定」の「担当者」で入れられます。</p>');
  }

  /* 3. お客様 */
  function step3() {
    var kws = (st.conf.keywords || []).map(function (k) { return '<button type="button" class="kchip' + (f.keywords.indexOf(k) >= 0 ? ' on' : '') + '" data-kw="' + esc(k) + '">' + esc(k) + '</button>'; }).join('');
    var routes = (st.conf.routes || ['電話']).slice();
    if (f.route && routes.indexOf(f.route) < 0) routes.push(f.route);
    var stats = f.id ? D.STATUS_LIST() : [ST.WAIT, ST.IN];
    frame('<h3 class="q">お名前とお電話番号を教えてください</h3>'
      + '<div class="fg"><div><label for="r-name">お名前' + (f.route === '直接来店' ? '' : '<span class="need">必須</span>') + '</label><input type="text" id="r-name" maxlength="40" value="' + esc(f.name) + '" autocomplete="off"></div>'
      + '<div><label for="r-kana">かな</label><input type="text" id="r-kana" maxlength="40" value="' + esc(f.kana) + '" autocomplete="off"></div>'
      + '<div><label for="r-tel">電話番号</label><input type="tel" id="r-tel" maxlength="20" inputmode="tel" value="' + esc(f.tel) + '" autocomplete="off"></div>'
      + '<div><label for="r-email">メール</label><input type="email" id="r-email" maxlength="120" inputmode="email" value="' + esc(f.email) + '" autocomplete="off"></div></div>'
      + '<div id="r-cust">' + custBox() + '</div>'
      + '<p class="lbl">キーワード</p><div class="kgrid">' + kws + '</div>'
      + '<div class="dessert"><label class="chk"><input type="checkbox" id="r-dessert"' + (f.dessert ? ' checked' : '') + '>デザートプレート<small>要予約・税込1,100円</small></label>'
      + (f.dessert ? '<label for="r-plate">プレートに書くメッセージ<small>30文字まで</small></label><input type="text" id="r-plate" maxlength="30" value="' + esc(f.plateMsg) + '" placeholder="例：Happy Birthday たろう" autocomplete="off">' : '') + '</div>'
      + '<div class="fg"><div><label for="r-route">予約経路</label><select id="r-route">' + routes.map(function (x) { return '<option' + (x === f.route ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>'
      + '<div class="full" id="r-staffbox">' + staffBox() + '</div>'
      + '<div><label for="r-status">状態</label><select id="r-status">' + stats.map(function (x) { return '<option' + (x === f.status ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>'
      + '<div class="full"><label for="r-memo">メモ</label><textarea id="r-memo" maxlength="1000" placeholder="例：窓際の席を希望・ケーキの持ち込み">' + esc(f.memo) + '</textarea></div></div>'
      + '<p class="err" id="r-err" hidden></p>',
      '<button type="button" class="btn" data-r="to2">戻る</button><button type="button" class="btn dark big" data-r="confirm">登録内容を確認</button>');
  }
  D.STATUS_LIST = function () { return [ST.REQ, ST.WAIT, ST.IN, ST.OUT, ST.CXL, ST.NOSHOW, ST.NO]; };
  function custBox() {
    var h = '';
    if (f.cid) {
      var c = f.cust || {};
      h += '<div class="custsel"><span>顧客台帳：<b>' + esc(f.cid) + '</b>' + (c.visits != null ? '　来店 ' + c.visits + '回' : '') + (c.caution ? '　<em>！要確認</em>' : '') + (c.allergy ? '　<em>苦手：' + esc(c.allergy) + '</em>' : '') + '</span><button type="button" class="linkbtn" data-r="uncust">外す</button></div>';
    }
    if (found.length) {
      h += '<div class="custfound"><p>顧客台帳に ' + found.length + '件 あります</p>' + found.slice(0, 5).map(function (c, i) {
        return '<div class="cf"><span><b>' + esc(c.name) + '</b>' + (c.kana ? '（' + esc(c.kana) + '）' : '') + '　' + esc(c.tel) + '　来店 ' + c.visits + '回' + (c.last ? '・前回 ' + esc(D.md(c.last)) : '') + '</span>'
          + '<button type="button" class="btn small" data-pick="' + i + '">選ぶ</button></div>';
      }).join('') + '</div>';
    }
    return h;
  }
  function readStep3() {
    if (step !== 3) return;
    f.name = $('r-name').value.trim(); f.kana = $('r-kana').value.trim(); f.tel = $('r-tel').value.trim(); f.email = $('r-email').value.trim();
    f.route = $('r-route').value; f.status = $('r-status').value; f.memo = $('r-memo').value.trim();
    f.dessert = $('r-dessert').checked; f.plateMsg = f.dessert && $('r-plate') ? $('r-plate').value.trim() : f.dessert ? f.plateMsg : '';
  }
  function search() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (!f || step !== 3) return;
      var tel = $('r-tel').value.replace(/[^\d]/g, ''), name = $('r-name').value.trim();
      var q = tel.length >= 4 ? tel : name.length >= 2 ? name : '';
      if (!q) { found = []; $('r-cust').innerHTML = custBox(); return; }
      D.post({ action: 'customers', q: q }).then(function (res) {
        if (!f || step !== 3) return;
        found = res.list.filter(function (c) { return c.cid !== f.cid; });
        $('r-cust').innerHTML = custBox();
      }).catch(function () {});
    }, 500);
  }

  /* 確認 */
  function problems() {
    var a = D.toMin(f.start), b = a + f.keep, out = [];
    var cl = f.tables.length ? D.clashes(f.date, f.tables, a, b, f.id) : [];
    cl.forEach(function (r) { out.push('席が重なります：' + D.tableNames(r.tables.filter(function (t) { return f.tables.indexOf(t) >= 0; })) + '　' + r.start + '〜 ' + D.name(r) + ' 様（' + r.people + '名）'); });
    var cap = f.tables.reduce(function (n, id) { var t = D.table(id); return n + (t ? t.cap : 0); }, 0);
    if (f.tables.length && cap < f.people) out.push('席が ' + (f.people - cap) + '名分 足りません（選んだ席 ' + cap + '名）');
    var info = st.days[f.date];
    if (info && info.type === 'closed') out.push('この日は定休日・休みの日です');
    else if (info && info.open.length && !info.open.some(function (r) { return a >= r[0] && a < r[1]; })) out.push('営業時間の外です');
    if (!f.tables.length) out.push('席を決めていません（スケジュールの「未割り当て」に入ります）');
    return out;
  }
  function confirmView() {
    var warn = problems();
    var row = function (k, v) { return v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : ''; };
    frame('<h3 class="q">' + (f.id ? 'この内容に変更します' : 'この内容で登録します') + '</h3>'
      + (warn.length ? '<ul class="warns">' + warn.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '')
      + '<dl class="conf">' + row('日時', esc(D.jp(f.date) + ' ' + f.start + '〜' + D.hm(D.toMin(f.start) + f.keep)) + '（確保 ' + f.keep + '分）')
      + row('人数', f.people + '名') + row('テーブル', f.tables.length ? esc(D.tableNames(f.tables)) : '未割り当て')
      + row('お名前', esc(f.name || '（なし）') + (f.kana ? '（' + esc(f.kana) + '）' : '')) + row('電話番号', esc(f.tel)) + row('メール', esc(f.email))
      + row('キーワード', esc(f.keywords.join('・')))
      + row('デザートプレート', f.dessert ? '注文あり（税込1,100円）' + (f.plateMsg ? '<br>メッセージ「' + esc(f.plateMsg) + '」' : '<br>メッセージなし') : '') + row('予約経路', esc(f.route)) + row('担当者', needStaff() ? esc(f.staff) : '') + row('状態', esc(f.status)) + row('メモ', esc(f.memo)) + '</dl>'
      + '<p class="err" id="r-err" hidden></p>',
      '<button type="button" class="btn" data-r="to3">戻って直す</button><button type="button" class="btn ember big" data-r="save">' + (f.id ? 'この内容で変更する' : 'この内容で登録する') + '</button>');
  }
  function showErr(text) { var e = $('r-err'); if (e) { e.textContent = text; e.hidden = false; e.scrollIntoView({ block: 'center' }); } }

  function save(btn) {
    btn.disabled = true; btn.textContent = '送っています…';
    var data = { date: f.date, start: f.start, keep: f.keep, people: f.people, tables: f.tables, name: f.name, kana: f.kana, tel: f.tel,
      email: f.email, route: f.route, keywords: f.keywords, memo: f.memo, dessert: f.dessert, plateMsg: f.dessert ? f.plateMsg : '', status: f.status, cid: f.cid, staff: needStaff() ? f.staff : '' };
    var p = f.id
      ? D.post({ action: 'save', row: Object.assign({ id: f.id }, data), expect: f.expect })
      : D.post({ action: 'save', row: data, rid: rid });
    var isNew = !f.id;
    p.then(function (res) {
      D.put(res.row);
      D.closeRegister();
      if (st.view !== 'schedule' && st.view !== 'floor' && st.view !== 'list') D.show('schedule');
      if (st.date !== res.row.date) D.goDate(res.row.date);
      D.toast((isNew ? '登録しました' : '変更しました') + '（' + esc(D.md(res.row.date) + ' ' + res.row.start + '・' + D.name(res.row)) + '・No.' + esc(res.row.no) + '）');
      D.openBooking(res.row.id);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = f && f.id ? 'この内容で変更する' : 'この内容で登録する';
      if (e.code === 'conflict') { if (e.data && e.data.row) D.put(e.data.row); showErr('他の端末で先に変わっていました。いったん閉じて、もう一度「変更する」から開いてください。'); return; }
      showErr('登録できませんでした：' + D.errText(e));
    });
  }

  sheet.addEventListener('click', function (e) {
    if (!f) return;
    var t = e.target;
    var b = t.closest('[data-r],[data-step],[data-d],[data-tm],[data-pp],[data-adj],[data-keep],[data-kw],[data-stf],[data-pick]');
    if (!b) return;
    readStep3();
    var ds = b.dataset;
    if (ds.step) return go(Number(ds.step));
    if (ds.d) { f.date = ds.d; D.ensureDate(f.date).then(draw); return draw(); }
    if (ds.tm) { f.start = ds.tm; return draw(); }
    if (ds.pp) { f.people = Number(ds.pp); return draw(); }
    if (ds.adj) { f.start = D.hm(Math.max(0, D.toMin(f.start) + Number(ds.adj))); return draw(); }
    if (ds.keep) { f.keep = Math.max(30, Math.min(1410, f.keep + Number(ds.keep))); var sc = $('sh-body').scrollTop; step2(); $('sh-body').scrollTop = sc; return; }
    if (ds.kw) { var i = f.keywords.indexOf(ds.kw); if (i >= 0) f.keywords.splice(i, 1); else f.keywords.push(ds.kw); b.classList.toggle('on'); return; }
    if (ds.stf) { f.staff = f.staff === ds.stf ? '' : ds.stf; $('r-staffbox').innerHTML = staffBox(); return; }   // 1人だけ選ぶ（もう一度押すと外す）
    if (ds.pick) {
      var c = found[Number(ds.pick)];
      f.cid = c.cid; f.cust = c; found = [];
      if (!f.name) f.name = c.name; if (!f.kana) f.kana = c.kana; if (!f.tel) f.tel = c.tel; if (!f.email) f.email = c.email;
      return step3();
    }
    switch (ds.r) {
      case 'close':
        if (step > 1 || f.name) return D.ask({ title: '入れた内容を捨てて閉じますか？', ok: '閉じる', danger: true }).then(function (y) { if (y) D.closeRegister(); });
        return D.closeRegister();
      case 'skip': f.tables = []; return go(3);
      case 'to1': return go(1);
      case 'to2': return go(2);
      case 'to3': return go(3);
      case 'uncust': f.cid = ''; f.cust = null; return step3();
      case 'confirm':
        if (!f.people) { go(1); return; }
        if (!f.name && f.route !== '直接来店') return showErr('お名前を入れてください。');
        if (!f.id && needStaff() && (st.conf.staff || []).length + (st.conf.parttime || []).length && !f.staff) return showErr('担当者を選んでください。');
        if (f.tel && !/^0\d{9,10}$/.test(f.tel.replace(/[^\d]/g, ''))) return showErr('電話番号の形が違います（例：090-1234-5678）。');
        if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return showErr('メールアドレスの形が違います。');
        return go(4);
      case 'save': return save(b);
    }
  });
  sheet.addEventListener('input', function (e) {
    if (!f) return;
    var id = e.target.id;
    if (id === 'r-people') { f.people = Number(e.target.value) || 0; sheet.querySelectorAll('[data-r="skip"],[data-r="to2"]').forEach(function (x) { x.disabled = !f.people; }); }
    if (id === 'r-tel' || id === 'r-name') search();
  });
  sheet.addEventListener('change', function (e) {
    if (!f) return;
    if (e.target.id === 'r-date' && e.target.value) { f.date = e.target.value; D.ensureDate(f.date).then(draw); draw(); }
    if (e.target.id === 'r-people') draw();
    if (e.target.id === 'r-route' || e.target.id === 'r-dessert') {
      var sc = $('sh-body').scrollTop; readStep3(); step3(); $('sh-body').scrollTop = sc;
      if (e.target.id === 'r-dessert' && f.dessert && $('r-plate')) $('r-plate').focus({ preventScroll: true });
    }
  });
})();
