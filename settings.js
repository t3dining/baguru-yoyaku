/* 設定：席（名前・人数・種類・グループ・並び・配置図）と、基本（確保時間・表示する時間・キーワード）と、担当者
   ・担当者：社員は1人ずつ「足す」「消す」で直す。押すとすぐ受け口へ保存する（★シートには書かず、受け口のプロパティに置く。予約の「担当」も、シートには番号で入る）。
     アルバイトは、受け口が T3Works のマネージの名簿から読む（ここでは見るだけ。名簿の順）
   ・席を直したら「席を保存する」で受け口へ。配置図の席はドラッグで動かせる
   ・ほかの受け方（ホームページの受付時間・組数・休みの日・知らせるメール）は、スプレッドシートのタブ「設定」で変える */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, $ = D.$;
  var box = $('v-settings');
  var T = { list: null, dirty: false, drag: null, scale: 1 };
  var KINDS = ['テーブル', 'カウンター', '座敷'];

  function init() { T.list = st.tables.map(function (t) { return Object.assign({}, t); }); T.dirty = false; }

  function tableRows() {
    return T.list.map(function (t, i) {
      return '<div class="trw" data-i="' + i + '">'
        + '<span class="mv"><button type="button" data-s="up" aria-label="上へ"' + (i ? '' : ' disabled') + '>↑</button><button type="button" data-s="down" aria-label="下へ"' + (i < T.list.length - 1 ? '' : ' disabled') + '>↓</button></span>'
        + '<input type="text" data-k="name" maxlength="20" value="' + esc(t.name) + '" aria-label="席の名前">'
        + '<label class="cap"><input type="number" data-k="cap" min="1" max="99" value="' + t.cap + '" aria-label="人数">名</label>'
        + '<select data-k="kind" aria-label="種類">' + KINDS.map(function (k) { return '<option' + (k === t.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>'
        + '<input type="text" data-k="group" maxlength="20" value="' + esc(t.group) + '" aria-label="グループ" class="grp">'
        + '<label class="chk"><input type="checkbox" data-k="show"' + (t.show ? ' checked' : '') + '>使う</label>'
        + '<button type="button" class="linkbtn" data-s="del">消す</button></div>';
    }).join('');
  }
  function floorHtml() {
    var maxX = 0, maxY = 0;
    T.list.forEach(function (t) { maxX = Math.max(maxX, t.x + t.w); maxY = Math.max(maxY, t.y + t.h); });
    var cw = maxX + 60, ch = maxY + 60, aw = Math.min(box.clientWidth - 40, 1100) || 800;
    T.scale = Math.min(1, aw / cw);
    return '<div class="floor-scale" style="width:' + (cw * T.scale) + 'px;height:' + (ch * T.scale) + 'px"><div class="floor-canvas edit" style="width:' + cw + 'px;height:' + ch + 'px;transform:scale(' + T.scale + ')">'
      + T.list.map(function (t, i) {
        return '<div class="ft k-' + (t.kind === 'カウンター' ? 'counter' : 'table') + (t.show ? '' : ' hide') + '" data-i="' + i + '" style="left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + t.h + 'px">'
          + '<span class="ft-box"><span class="ft-cap">' + t.cap + '名</span></span><span class="ft-name">' + esc(t.name) + '</span></div>';
      }).join('') + '</div></div>';
  }

  function render() {
    if (!T.list) init();
    var c = st.conf;
    box.innerHTML = '<section class="set-sec"><h2>席</h2>'
      + '<p class="muted">上から順に、スケジュールの縦に並びます。「グループ」が同じ席は、くっつけて大人数を受けられるものとして、ネット予約の空きを数えます。</p>'
      + '<div class="trw head"><span></span><span>名前</span><span>人数</span><span>種類</span><span>グループ</span><span>使う</span><span></span></div>'
      + '<div id="set-tables">' + tableRows() + '</div>'
      + '<button type="button" class="btn" data-s="add">＋ 席を足す</button>'
      + '<h3>配置図（テーブル管理）</h3><p class="muted">席をドラッグすると動かせます。</p><div class="set-floor" id="set-floor">' + floorHtml() + '</div>'
      + '<p class="err" id="set-err" hidden></p>'
      + '<div class="set-acts"><button type="button" class="btn" data-s="reset"' + (T.dirty ? '' : ' disabled') + '>直す前に戻す</button><button type="button" class="btn ember big" data-s="save"' + (T.dirty ? '' : ' disabled') + '>席を保存する</button></div></section>'
      + '<section class="set-sec"><h2>基本</h2><div class="fg">'
      + '<div><label for="s-keep">確保時間（分）</label><input type="number" id="s-keep" min="15" max="600" step="5" value="' + (c.keep || 90) + '"><small>1組の予約で席を押さえる長さ。ホームページのリクエストもこの長さ</small></div>'
      + '<div><label for="s-from">スケジュールに出す時間</label><span class="inl"><input type="time" id="s-from" step="900" value="' + esc(c.viewFrom || '10:00') + '">〜<input type="time" id="s-to" step="900" value="' + esc(c.viewTo || '23:30') + '"></span></div>'
      + '<div class="full"><label for="s-kw">キーワード（カンマで区切る）</label><input type="text" id="s-kw" value="' + esc((c.keywords || []).join(', ')) + '"></div>'
      + '</div>'
      + '<p class="err" id="conf-err" hidden></p><div class="set-acts"><button type="button" class="btn ember" data-s="conf">基本を保存する</button></div></section>'
      + '<section class="set-sec" id="set-staff">' + staffHtml() + '</section>'
      + '<section class="set-sec"><h2>その他の受け方</h2><p class="muted">次の項目は、会社の Google ドライブのスプレッドシート「※勝手にさわらない＿バグる ネット予約」のタブ「設定」で変えます（変えるとすぐ効きます）。</p>'
      + '<ul class="set-list"><li>ネット予約を受け付ける（する／しない）</li><li>ネット予約（ホームページ・アプリ）で受ける時刻（平日・土日祝）と、その間隔</li><li>ネット予約の1枠で受ける組数・1組の最大人数</li><li>何日先まで・何時間前まで</li><li>営業時間（スケジュールで灰色にする時間）</li><li>新しいリクエストを知らせるメール</li><li>予約経路の選び方</li></ul>'
        + '<p class="muted">★定休日と、臨時の営業・お休みは、T3Works のマネージ（⚙ 設定 → 定休日）で変えます。30分ほどで、予約ボード・ホームページ・お客さまのアプリに入ります。</p></section>'
      + '<section class="set-sec"><h2>この端末</h2><p class="muted">版 ' + esc(st.version || '') + '　最終更新 ' + esc(st.loadedAt ? D.clock(st.loadedAt) : '') + '</p>'
      + '<div class="set-acts left"><button type="button" class="btn" data-s="sound">' + (st.sound ? '音 オン（押すと消す）' : '音 オフ（押すと鳴らす）') + '</button><button type="button" class="btn" data-s="logout">ログアウト</button></div></section>';
  }

  function touch() {
    T.dirty = true;
    box.querySelectorAll('[data-s="save"],[data-s="reset"]').forEach(function (b) { b.disabled = false; });
  }
  function redrawTables() { $('set-tables').innerHTML = tableRows(); $('set-floor').innerHTML = floorHtml(); touch(); }

  box.addEventListener('input', function (e) {
    var row = e.target.closest('.trw'), k = e.target.dataset.k;
    if (!row || !k || row.classList.contains('head')) return;
    var t = T.list[Number(row.dataset.i)];
    if (k === 'cap') t.cap = Number(e.target.value) || 1;
    else if (k === 'show') t.show = e.target.checked;
    else t[k] = e.target.value;
    touch();
    if (k === 'name' || k === 'cap' || k === 'show') $('set-floor').innerHTML = floorHtml();
  });
  box.addEventListener('change', function (e) { if (e.target.dataset.k === 'kind' || e.target.dataset.k === 'show') { var t = T.list[Number(e.target.closest('.trw').dataset.i)]; t[e.target.dataset.k] = e.target.dataset.k === 'show' ? e.target.checked : e.target.value; redrawTables(); } });

  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-s]');
    if (!b) return;
    var row = b.closest('.trw'), i = row ? Number(row.dataset.i) : -1;
    switch (b.dataset.s) {
      case 'up': if (i > 0) { T.list.splice(i - 1, 0, T.list.splice(i, 1)[0]); redrawTables(); } return;
      case 'down': if (i < T.list.length - 1) { T.list.splice(i + 1, 0, T.list.splice(i, 1)[0]); redrawTables(); } return;
      case 'del':
        return D.ask({ title: T.list[i].name + ' を消します', text: 'この席に入っている予約は「未割り当て」として出ます。保存するまでは元に戻せます。', ok: '消す', danger: true })
          .then(function (y) { if (y) { T.list.splice(i, 1); redrawTables(); } });
      case 'add':
        var maxY = T.list.reduce(function (m, t) { return Math.max(m, t.y + t.h); }, 0);
        T.list.push({ id: '', name: '新しい席', cap: 4, kind: 'テーブル', group: '新しい席', x: 30, y: maxY + 50, w: 159, h: 132, show: true });
        return redrawTables();
      case 'reset': init(); return render();
      case 'save': return saveTables(b);
      case 'conf': return saveConf(b);
      case 'stf-add': return addStaff();
      case 'stf-del':
        var names = (st.conf.staff || []).slice(), who = names[Number(b.dataset.i)];
        return D.ask({ title: who + ' を担当者から外します', text: 'これまでの予約に入っている担当者の名前は、そのまま残ります。', ok: '外す', danger: true })
          .then(function (y) { if (y) { names.splice(Number(b.dataset.i), 1); saveStaff(names, who + ' を外しました'); } });
      case 'sound': D.$('b-sound').click(); return render();
      case 'logout': return D.$('b-logout').click();
    }
  });

  function saveTables(b) {
    var names = {};
    for (var i = 0; i < T.list.length; i++) {
      var t = T.list[i];
      if (!t.name.trim()) return err('set-err', i + 1 + '番目の席の名前を入れてください。');
      if (names[t.name.trim()]) return err('set-err', '「' + t.name + '」が2つあります。名前は別々にしてください。');
      names[t.name.trim()] = true;
    }
    b.disabled = true; b.textContent = '保存しています…';
    // 新しい席の ID は名前から付ける（予約には ID で入るので、あとで名前を変えても予約はそのまま）
    var used = {};
    T.list.forEach(function (t) { if (t.id) used[t.id] = true; });
    var out = T.list.map(function (t) {
      var id = t.id;
      if (!id) { id = t.name.trim(); while (used[id]) id += '_'; used[id] = true; }
      return { id: id, name: t.name.trim(), cap: t.cap, kind: t.kind, group: (t.group || '').trim() || t.name.trim(), x: t.x, y: t.y, w: t.w, h: t.h, show: t.show };
    });
    D.post({ action: 'saveTables', tables: out }).then(function (res) {
      st.tables = res.tables; init(); render(); D.toast('席を保存しました');
    }).catch(function (e) { b.disabled = false; b.textContent = '席を保存する'; err('set-err', '保存できませんでした：' + D.errText(e)); });
  }
  function saveConf(b) {
    var p = { keep: Number($('s-keep').value), viewFrom: $('s-from').value, viewTo: $('s-to').value, keywords: $('s-kw').value };
    if (!(p.keep >= 15)) return err('conf-err', '確保時間は15分より長くしてください。');
    if (!p.viewFrom || !p.viewTo || p.viewFrom >= p.viewTo) return err('conf-err', 'スケジュールに出す時間を確かめてください。');
    b.disabled = true; b.textContent = '保存しています…';
    D.post({ action: 'saveConf', conf: p }).then(function (res) {
      st.conf = res.conf; render(); D.toast('基本を保存しました');
    }).catch(function (e) { b.disabled = false; b.textContent = '基本を保存する'; err('conf-err', '保存できませんでした：' + D.errText(e)); });
  }
  function err(id, text) { var m = $(id); m.textContent = text; m.hidden = false; }

  /* ---------- 担当者（予約登録で選ぶ名前）。1人ずつ足す・消す。押すとすぐ保存 ---------- */
  function staffHtml() {
    var names = st.conf.staff || [];
    var pt = st.conf.parttime || [];
    return '<h2>担当者</h2><p class="muted">お店で予約を入れるとき（電話・店頭など）に選ぶ名前です。予約登録では、社員がいつも先に並び、そのあとにアルバイトが並びます。1人でもいると、予約登録で必ず選ぶようになります。</p>'
      + '<h3>社員</h3>'
      + (names.length ? '<ul class="stf-list">' + names.map(function (n, i) {
        return '<li><span>' + esc(n) + '</span><button type="button" class="btn small line-ember" data-s="stf-del" data-i="' + i + '">消す</button></li>';
      }).join('') + '</ul>' : '<p class="empty">まだ入っていません。</p>')
      + '<div class="stf-add"><input type="text" id="s-stf-new" maxlength="20" placeholder="名前を入れる" autocomplete="off" enterkeyhint="done">'
      + '<button type="button" class="btn dark" data-s="stf-add">＋ 足す</button></div><p class="err" id="stf-err" hidden></p>'
      + '<h3>アルバイト</h3><p class="muted">T3Works のマネージの名簿（バグる）から、名簿の順に自動で入ります（名簿を直すと、30分ほどで変わります）。ここでは直せません。</p>'
      + rosterNote()
      + (pt.length ? '<ul class="stf-list ro">' + pt.map(function (n) { return '<li><span>' + esc(n) + '</span></li>'; }).join('') + '</ul>'
        : '<p class="empty">' + (st.conf.roster ? '名簿から読めた人がいません。' : 'まだ名簿とつないでいません。') + '</p>');
  }
  /** 名簿を読めていないときは、わけを目立つように出す（受け口の roster_ の err）。読めていても、いつ読んだかを出す */
  var ROSTER_ERR = { bad_key: '鍵が合いません（受け口の鍵と、Cloudflare の STAFF_KEY が違います）', no_route: 'T3Works に名簿の口がまだありません',
    unreachable: 'T3Works につながりません', bad_reply: 'T3Works の答えの形が違います' };
  function rosterNote() {
    var r = st.conf.roster, when = function (ms) { return D.md(D.ymdOf(ms)) + ' ' + D.clock(ms); };
    if (!r) return '';
    if (!r.err) return r.okAt ? '<p class="muted">' + esc(when(r.okAt)) + ' に名簿を読みました。</p>' : '';
    return '<p class="stf-warn">★名簿を読めていません：' + esc(ROSTER_ERR[r.err] || '読めませんでした（' + r.err + '）') + '。社員の名前だけで予約は入れられます。'
      + (r.okAt ? '下は、前に読めた分（' + esc(when(r.okAt)) + '）です。' : '') + '</p>';
  }
  function saveStaff(names, okText) {
    var sec = $('set-staff');
    sec.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
    return D.post({ action: 'saveConf', conf: { staff: names } }).then(function (res) {
      st.conf = res.conf; sec.innerHTML = staffHtml(); D.toast(esc(okText));
      $('s-stf-new').focus({ preventScroll: true });
    }).catch(function (e) {
      sec.querySelectorAll('button').forEach(function (x) { x.disabled = false; });
      err('stf-err', '保存できませんでした：' + D.errText(e));
    });
  }
  function addStaff() {
    var inp = $('s-stf-new'), n = inp.value.replace(/[,、]/g, ' ').trim(), names = (st.conf.staff || []).slice();
    if (!n) return err('stf-err', '名前を入れてください。');
    if (names.indexOf(n) >= 0) return err('stf-err', '「' + n + '」はもう入っています。');
    names.push(n);
    saveStaff(names, n + ' を足しました');
  }
  box.addEventListener('keydown', function (e) {
    if (e.target.id === 's-stf-new' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addStaff(); }   // 日本語の変換を決めるときの Enter では足さない
  });

  /* 配置図の席をドラッグで動かす */
  box.addEventListener('pointerdown', function (e) {
    var tile = e.target.closest('.floor-canvas.edit .ft');
    if (!tile) return;
    var t = T.list[Number(tile.dataset.i)];
    T.drag = { t: t, el: tile, x: e.clientX, y: e.clientY, ox: t.x, oy: t.y };
    tile.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('pointermove', function (e) {
    var d = T.drag;
    if (!d) return;
    d.t.x = Math.max(0, Math.round((d.ox + (e.clientX - d.x) / T.scale) / 5) * 5);
    d.t.y = Math.max(0, Math.round((d.oy + (e.clientY - d.y) / T.scale) / 5) * 5);
    d.el.style.left = d.t.x + 'px'; d.el.style.top = d.t.y + 'px';
  });
  window.addEventListener('pointerup', function () {
    if (!T.drag) return;
    var moved = T.drag.t.x !== T.drag.ox || T.drag.t.y !== T.drag.oy;
    T.drag.el.classList.remove('dragging'); T.drag = null;
    if (moved) { touch(); $('set-floor').innerHTML = floorHtml(); }
  });
  box.addEventListener('touchmove', function (e) { if (T.drag) e.preventDefault(); }, { passive: false });

  // 読み直すたびに描き直すと、入れている途中の字が消えるので、この画面は開いたときだけ描く
  D.views.settings = { render: function () { if (!box.children.length) render(); }, enter: function () { if (!T.dirty) init(); box.innerHTML = ''; render(); } };
})();
