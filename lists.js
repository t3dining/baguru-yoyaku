/* 予約リスト・予約受付（ホームページからのリクエスト）・顧客台帳 */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, ST = D.ST, $ = D.$;

  function rowLine(r, withDate) {
    return '<button type="button" class="lr" data-id="' + esc(r.id) + '">'
      + '<span class="lr-st">' + D.statusBadge(r.status) + '<small>' + esc(r.route || '') + '</small></span>'
      + '<span class="lr-time">' + (withDate ? '<small>' + esc(D.md(r.date) + '（' + D.wd(r.date) + '）') + '</small>' : '') + '<b>' + esc(r.start) + '</b>〜' + esc(D.hm(D.span(r)[1])) + '</span>'
      + '<span class="lr-who"><b>' + esc(D.name(r)) + (r.name ? ' 様' : '') + '</b>　' + r.people + '名 ' + D.icons(r) + '<small>' + esc(r.tel || '') + '</small></span>'
      + '<span class="lr-tb">' + esc(r.tables.length ? D.tableNames(r.tables) : '未割り当て') + '</span></button>';
  }

  /* ---------- 予約リスト ---------- */
  var L = { preset: 'today', from: '', to: '', noCxl: true, status: '' };
  function presetRange(p) {
    var t = st.today, w = D.A.weekday(t);
    switch (p) {
      case 'tomorrow': return [D.addDays(t, 1), D.addDays(t, 1)];
      case 'week': return [t, D.addDays(t, 6 - w)];
      case 'next': return [D.addDays(t, 7 - w), D.addDays(t, 13 - w)];
      case 'month': return [t, D.addDays(t, 30)];
      case 'custom': return [L.from || t, L.to || L.from || t];
      default: return [t, t];
    }
  }
  function renderList() {
    var rg = presetRange(L.preset);
    st.listRange = { from: rg[0], to: rg[1] };
    var rows = D.rowsBetween(rg[0], rg[1]).filter(function (r) {
      if (L.noCxl && (r.status === ST.CXL || r.status === ST.NOSHOW || r.status === ST.NO)) return false;
      return !L.status || r.status === L.status;
    });
    var ppl = rows.reduce(function (n, r) { return n + (D.HIDDEN[r.status] ? 0 : r.people); }, 0);
    var btn = function (p, label) { return '<button type="button" class="seg' + (L.preset === p ? ' on' : '') + '" data-pre="' + p + '">' + label + '</button>'; };
    var h = '<div class="lst-tools"><div class="segs">' + btn('today', '今日') + btn('tomorrow', '明日') + btn('week', '今週') + btn('next', '来週') + btn('month', '30日') + btn('custom', '期間を選ぶ') + '</div>'
      + (L.preset === 'custom' ? '<div class="lst-range"><input type="date" id="l-from" value="' + rg[0] + '">〜<input type="date" id="l-to" value="' + rg[1] + '"></div>' : '')
      + '<label class="chk"><input type="checkbox" id="l-nocxl"' + (L.noCxl ? ' checked' : '') + '>キャンセルを除く</label>'
      + '<select id="l-status"><option value="">全ての状態</option>' + D.STATUS_LIST().map(function (s) { return '<option' + (L.status === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>'
      + '<span class="lst-count"><b>' + rows.length + '</b>件・<b>' + ppl + '</b>名</span></div>';
    var last = '';
    h += rows.length ? '<div class="lst">' + rows.map(function (r) {
      var head = r.date !== last ? '<h3 class="lst-day">' + esc(D.jp(r.date)) + '</h3>' : '';
      last = r.date;
      return head + rowLine(r, false);
    }).join('') + '</div>' : '<p class="empty">この期間の予約はありません。</p>';
    var lr = st.loadedRange;
    if (lr && (rg[0] < lr.from || rg[1] > lr.to)) h += '<p class="muted center">読み込んでいます…</p>';
    $('v-list').innerHTML = h;
  }
  $('v-list').addEventListener('click', function (e) {
    var p = e.target.closest('[data-pre]');
    if (p) { L.preset = p.dataset.pre; renderList(); return D.load(); }
    var r = e.target.closest('.lr');
    if (r) D.openBooking(r.dataset.id);
  });
  $('v-list').addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'l-nocxl') L.noCxl = e.target.checked;
    if (id === 'l-status') L.status = e.target.value;
    if (id === 'l-from' || id === 'l-to') {
      L.from = $('l-from').value; L.to = $('l-to').value;
      if (L.to < L.from) L.to = L.from;
      renderList(); return D.load();
    }
    renderList();
  });
  D.views.list = { render: renderList };

  /* ---------- 予約受付（ホームページから） ---------- */
  var R = { tab: 'todo' };
  function reqCard(r) {
    var c = r.cust;
    return '<article class="rq" data-id="' + esc(r.id) + '">'
      + '<div class="rq-when"><span>' + esc(D.jp(r.date)) + '</span><b>' + esc(r.start) + '</b></div>'
      + '<div class="rq-main"><p class="rq-top"><b>' + esc(r.name) + ' 様</b><span class="rq-ppl"><b>' + r.people + '</b>名</span>'
      + (r.createdAt > st.seen ? '<span class="new">NEW</span>' : '') + '</p>'
      + '<p class="rq-tags">' + (r.seat && r.seat !== 'どちらでも' ? '<span>' + esc(r.seat) + '希望</span>' : '') + (r.kids ? '<span>お子様連れ</span>' : '') + (r.dessert ? '<span class="cele">デザートプレート</span>' : '')
      + (c ? '<span>' + (c.visits ? '来店 ' + c.visits + '回' : '初めて') + '</span>' : '') + (c && c.caution ? '<span class="warn">！要確認</span>' : '')
      + '<span class="muted">No.' + esc(r.no) + '・' + esc(D.when(r.createdAt)) + 'に受付</span></p>'
      + (r.dessert ? '<p class="rq-note"><b>プレート</b>' + (r.plateMsg ? '「' + esc(r.plateMsg) + '」' : 'メッセージなし') + '</p>' : '')
      + (r.note ? '<p class="rq-note"><b>ご要望</b>' + esc(r.note) + '</p>' : '')
      + '<p class="rq-contact">' + D.telLink(r.tel) + '<span>' + esc(r.email) + '</span></p></div>'
      + '<div class="rq-acts"><button type="button" class="btn ok big" data-q="approve">承認する</button><button type="button" class="btn line-ember" data-q="decline">お断りする</button></div></article>';
  }
  function renderReq() {
    var todo = st.pending.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
    var hist = st.web.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var h = '<div class="tabs2 wide"><button type="button" data-rt="todo" class="' + (R.tab === 'todo' ? 'on' : '') + '">要対応（' + todo.length + '）</button>'
      + '<button type="button" data-rt="hist" class="' + (R.tab === 'hist' ? 'on' : '') + '">受付履歴（この2週間）</button></div>';
    if (R.tab === 'todo') {
      h += '<ol class="howto"><li>スケジュールで空きを見て、席を決める</li><li>入れるなら「承認する」、入れないなら「お断りする」</li><li>お客様に確定・お断りのメールが届く</li></ol>';
      h += todo.length ? todo.map(reqCard).join('') : '<p class="empty">承認待ちのリクエストはありません。</p>';
      if (!st.conf.accepting) h = '<p class="stopped">ネット予約（ホームページ・アプリ）は、今は止めています（スプレッドシートのタブ「設定」）。</p>' + h;
    } else {
      h += hist.length ? '<div class="lst">' + hist.map(function (r) { return rowLine(r, true); }).join('') + '</div>' : '<p class="empty">この2週間に、ホームページ・アプリからの予約はありません。</p>';
    }
    $('v-requests').innerHTML = h;
  }
  $('v-requests').addEventListener('click', function (e) {
    var t = e.target.closest('[data-rt]');
    if (t) { R.tab = t.dataset.rt; return renderReq(); }
    var q = e.target.closest('[data-q]');
    if (q) {
      var r = D.row(q.closest('.rq').dataset.id);
      if (!r) return;
      return D.ensureDate(r.date).then(function () { return q.dataset.q === 'approve' ? D.approve(D.row(r.id)) : D.decline(D.row(r.id)); });
    }
    var lr = e.target.closest('.lr');
    if (lr) D.openBooking(lr.dataset.id);
  });
  D.views.requests = { render: renderReq, enter: function () { D.markSeen(); } };

  /* ---------- 顧客台帳 ---------- */
  var C = { q: '', list: null, total: 0, timer: null };
  function renderCust() {
    var h = '<div class="lst-tools"><input type="search" id="c-q" placeholder="名前・かな・電話番号で探す" value="' + esc(C.q) + '">'
      + '<button type="button" class="btn dark" data-c="new">＋ お客様を登録</button>'
      + (C.list ? '<span class="lst-count"><b>' + C.total + '</b>人</span>' : '') + '</div>';
    if (!C.list) h += '<p class="muted center">読み込んでいます…</p>';
    else if (!C.list.length) h += '<p class="empty">見つかりません。</p>';
    else h += '<div class="ctable"><div class="ch"><span>顧客番号</span><span>お名前</span><span>電話番号</span><span>来店</span><span>前回</span></div>'
      + C.list.map(function (c) {
        return '<button type="button" class="cr" data-cid="' + esc(c.cid) + '"><span>' + esc(c.cid) + '</span><span><b>' + esc(c.name) + '</b>' + (c.caution ? '<i class="ic ic-warn">！</i>' : '') + (c.kana ? '<small>' + esc(c.kana) + '</small>' : '') + '</span>'
          + '<span>' + esc(c.tel) + '</span><span>' + c.visits + '回</span><span>' + esc(c.last ? D.md(c.last) : '－') + '</span></button>';
      }).join('') + '</div>';
    var had = document.activeElement && document.activeElement.id === 'c-q', pos = had ? document.activeElement.selectionStart : 0;
    $('v-customers').innerHTML = h;
    if (had) { var i = $('c-q'); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} }
  }
  function searchCust() {
    D.post({ action: 'customers', q: C.q }).then(function (res) { C.list = res.list; C.total = res.total; if (st.view === 'customers') renderCust(); })
      .catch(function (e) { D.toast('読めませんでした：' + esc(D.errText(e)), { warn: true }); });
  }
  $('v-customers').addEventListener('input', function (e) {
    if (e.target.id !== 'c-q') return;
    C.q = e.target.value.trim();
    clearTimeout(C.timer); C.timer = setTimeout(searchCust, 400);
  });
  $('v-customers').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cid]');
    if (b) return D.openCustomer(b.dataset.cid);
    if (e.target.closest('[data-c="new"]')) custForm({ cid: '', name: '', kana: '', tel: '', email: '', caution: false, cautionNote: '', allergy: '', anniv: '', memo: '', visits: 0 }, []);
  });
  D.views.customers = { render: renderCust, enter: function () { C.list = null; searchCust(); } };

  /** お客様の詳細（右）：直せる中身と、利用履歴 */
  D.openCustomer = function (cid) {
    D.openPanel('<p class="muted center">読み込んでいます…</p>', {});
    D.post({ action: 'customer', cid: cid }).then(function (res) { custForm(res.customer, res.history); })
      .catch(function (e) { D.closePanel(); D.toast('読めませんでした：' + esc(D.errText(e)), { warn: true }); });
  };
  var histMap = {};
  function custForm(c, hist) {
    histMap = {};
    hist.forEach(function (r) { histMap[r.id] = r; });
    var fld = function (id, label, v, type, max) { return '<div><label for="' + id + '">' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" maxlength="' + (max || 40) + '" value="' + esc(v || '') + '"></div>'; };
    var h = '<div class="cust" data-cid="' + esc(c.cid) + '"><div class="dt-head"><b>' + (c.cid ? '顧客 ' + esc(c.cid) : 'お客様を登録') + '</b>'
      + (c.cid ? '<span>来店 ' + c.visits + '回' + (c.last ? '・前回 ' + esc(D.md(c.last)) : '') + '</span>' : '')
      + '<button type="button" class="x" data-cu="close" aria-label="閉じる"><svg class="i"><use href="#i-x"/></svg></button></div>'
      + '<div class="fg">' + fld('cu-name', 'お名前', c.name) + fld('cu-kana', 'かな', c.kana) + fld('cu-tel', '電話番号', c.tel, 'tel', 20) + fld('cu-email', 'メール', c.email, 'email', 120)
      + '<div class="full chkline"><label><input type="checkbox" id="cu-caution"' + (c.caution ? ' checked' : '') + '>要確認のお客様（名前の横に「！」が出ます）</label></div>'
      + fld('cu-cnote', '要確認の説明（30文字）', c.cautionNote, 'text', 30) + fld('cu-allergy', '苦手・アレルギー（30文字）', c.allergy, 'text', 30)
      + fld('cu-anniv', '記念日（30文字）', c.anniv, 'text', 30)
      + '<div class="full"><label for="cu-memo">お客様のメモ</label><textarea id="cu-memo" maxlength="2000">' + esc(c.memo || '') + '</textarea></div></div>'
      + '<p class="err" id="cu-err" hidden></p><div class="dt-acts"><button type="button" class="btn ember big" data-cu="save">保存する</button></div>'
      + (hist.length ? '<p class="lbl">利用履歴（' + hist.length + '件）</p><div class="lst">' + hist.map(function (r) { return rowLine(r, true); }).join('') + '</div>' : '')
      + '<p class="muted small">お客様の情報を直しても、前の予約の名前・電話番号は変わりません。</p></div>';
    D.openPanel(h, {});
  }
  $('panel').addEventListener('click', function (e) {
    var box = e.target.closest('.cust');
    if (!box) return;
    var lr = e.target.closest('.lr');
    if (lr) {
      // 利用履歴の予約を開く（手元にない日の予約も、履歴で読んだ中身で開ける）
      var hit = D.row(lr.dataset.id) || histMap[lr.dataset.id];
      if (!hit) return;
      if (!D.row(hit.id)) st.rows[hit.id] = hit;
      return D.openBooking(hit.id);
    }
    var b = e.target.closest('[data-cu]');
    if (!b) return;
    if (b.dataset.cu === 'close') return D.closePanel();
    var p = { cid: box.dataset.cid, name: $('cu-name').value.trim(), kana: $('cu-kana').value.trim(), tel: $('cu-tel').value.trim(), email: $('cu-email').value.trim(),
      caution: $('cu-caution').checked, cautionNote: $('cu-cnote').value.trim(), allergy: $('cu-allergy').value.trim(), anniv: $('cu-anniv').value.trim(), memo: $('cu-memo').value.trim() };
    b.disabled = true; b.textContent = '保存しています…';
    D.post({ action: 'saveCustomer', customer: p }).then(function (res) {
      D.toast('保存しました（' + esc(res.customer.name) + ' 様）');
      D.openCustomer(res.customer.cid);
      if (st.view === 'customers') searchCust();
      D.load();
    }).catch(function (e2) {
      b.disabled = false; b.textContent = '保存する';
      var m = $('cu-err'); m.textContent = '保存できませんでした：' + D.errText(e2); m.hidden = false;
    });
  });
})();
