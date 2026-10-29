/* 予約の詳細（右から出る）
   ・状態に合わせたボタンを出す：来店待ち→「来店」、来店済み→「退店」「来店取消」、退店→「退店取消」、リクエスト→「承認」「お断り」
   ・「変更する」で予約登録と同じ画面（register.js）を開く
   ・テーブル管理の「席情報」でも、同じ中身を使う（D.detailHtml） */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, ST = D.ST;

  function actions(r) {
    var b = function (act, label, cls) { return '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>'; };
    switch (r.status) {
      case ST.REQ: return b('approve', '承認する', 'ok big') + b('decline', 'お断りする', 'line-ember');
      case ST.WAIT: return b('in', '来店', 'ok big') + b('edit', '変更する') + b('cancel', 'キャンセル', 'line-ember');
      case ST.IN: return b('out', '退店', 'dark big') + b('unin', '来店取消') + b('edit', '変更する');
      case ST.OUT: return b('unout', '退店取消') + b('edit', '変更する');
      case ST.CXL: case ST.NOSHOW: return b('back', '来店待ちに戻す');
      default: return '';
    }
  }

  D.detailHtml = function (r, inline) {
    var sp = D.span(r), c = r.cust;
    var custLine = c ? '<p class="dt-cust">' + (c.visits ? '<b>来店 ' + c.visits + '回</b>' + (c.last ? '（前回 ' + esc(D.md(c.last)) + '）' : '') : '<b>初めて</b>')
      + (c.caution ? '<span class="warn">！要確認' + (c.cautionNote ? '：' + esc(c.cautionNote) : '') + '</span>' : '')
      + (c.allergy ? '<span class="warn">苦手・アレルギー：' + esc(c.allergy) + '</span>' : '')
      + (c.anniv ? '<span>記念日：' + esc(c.anniv) + '</span>' : '') + '</p>' : '';
    var elapsed = r.status === ST.IN && r.inAt ? '<span class="dt-elapsed">着席 ' + Math.max(0, Math.round((Date.now() - r.inAt) / 60000)) + '分</span>' : '';
    return '<div class="dt" data-id="' + esc(r.id) + '">'
      + '<div class="dt-head">' + D.statusBadge(r.status) + '<span class="dt-route">' + esc(r.route || '') + '</span>' + elapsed
      + (inline ? '' : '<button type="button" class="x" data-act="close" aria-label="閉じる"><svg class="i"><use href="#i-x"/></svg></button>') + '</div>'
      + '<p class="dt-when">' + esc(D.jp(r.date)) + '　<b>' + esc(r.start) + '</b>〜' + esc(D.hm(sp[1])) + '</p>'
      + '<p class="dt-big"><b>' + r.people + '</b>名<span class="dt-tables">' + (r.tables.length ? esc(D.tableNames(r.tables)) : '<em>席が未割り当て</em>') + '</span></p>'
      + '<h2 class="dt-name">' + esc(D.name(r)) + (r.name ? ' 様' : '') + (r.kana ? '<small>' + esc(r.kana) + '</small>' : '') + '</h2>'
      + custLine
      + '<p class="dt-contact">' + D.telLink(r.tel) + (r.email ? '<span class="mail">' + esc(r.email) + '</span>' : '') + '</p>'
      + (r.keywords.length ? '<p class="dt-kw">' + r.keywords.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('') + '</p>' : '')
      + (r.note ? '<p class="dt-note"><b>ご要望（ホームページ）</b>' + esc(r.note) + '</p>' : '')
      + (r.seat && r.seat !== 'どちらでも' ? '<p class="dt-note"><b>席の希望</b>' + esc(r.seat) + '</p>' : '')
      + (r.dessert ? '<p class="dt-note dt-dessert"><b>デザートプレート（税込1,100円）</b>' + (r.plateMsg ? 'メッセージ「' + esc(r.plateMsg) + '」' : 'メッセージなし') + '</p>' : '')
      + (r.memo ? '<p class="dt-memo"><b>メモ</b>' + esc(r.memo) + '</p>' : '')
      + '<div class="dt-acts">' + actions(r) + '</div>'
      + '<dl class="dt-meta"><div><dt>予約番号</dt><dd>' + esc(r.no) + '</dd></div>'
      + '<div><dt>受けた日時</dt><dd>' + esc(D.when(r.createdAt)) + '</dd></div>'
      + (r.inAt ? '<div><dt>来店</dt><dd>' + esc(D.clock(r.inAt)) + '</dd></div>' : '')
      + (r.outAt ? '<div><dt>退店</dt><dd>' + esc(D.clock(r.outAt)) + '</dd></div>' : '')
      + '<div><dt>確保時間</dt><dd>' + r.keep + '分</dd></div></dl>'
      + (r.cid ? '<button type="button" class="linkbtn" data-act="cust">顧客台帳を見る</button>' : '')
      + '</div>';
  };

  D.openBooking = function (id) {
    var r = D.row(id);
    if (!r) return;
    D.openPanel(D.detailHtml(r), {
      id: id,
      refresh: function () { var x = D.row(id); if (x) { var sc = D.$('panel-in').scrollTop; D.$('panel-in').innerHTML = D.detailHtml(x); D.$('panel-in').scrollTop = sc; } }
    });
  };

  /** 詳細のボタン（右の詳細とテーブル管理の席情報で共通） */
  D.bookingAct = function (act, r) {
    switch (act) {
      case 'close': return D.closePanel();
      case 'in': return D.setStatus(r, ST.IN);
      case 'unin': return D.setStatus(r, ST.WAIT);
      case 'out': return D.setStatus(r, ST.OUT);
      case 'unout': return D.setStatus(r, ST.IN);
      case 'back': return D.setStatus(r, ST.WAIT);
      case 'cancel': return D.cancel(r);
      case 'edit': D.closePanel(); return D.openRegister({ row: r });
      case 'approve': return D.approve(r);
      case 'decline': return D.decline(r);
      case 'cust': D.closePanel(); D.show('customers'); return D.openCustomer(r.cid);
    }
  };
  function onAct(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var box = b.closest('.dt');
    if (b.dataset.act === 'close') return D.closePanel();
    var r = box && D.row(box.dataset.id);
    if (r) D.bookingAct(b.dataset.act, r);
  }
  D.$('panel').addEventListener('click', function (e) {
    if (e.target.closest('.dt')) return onAct(e);
  });
  D.onBookingClick = onAct;

  /* ---------- ホームページからのリクエスト：承認（席を決める）・お断り ---------- */
  D.approve = function (r) {
    var sel = suggest(r), keep = r.keep;
    var m = D.modal('<h2>承認して、確定のメールを送ります</h2>'
      + '<p class="m-text">' + esc(D.jp(r.date) + ' ' + r.start + '　' + r.people + '名　' + r.name + ' 様') + '</p>'
      + '<p class="m-sub">席を選んでください（後から動かせます）</p><div id="ap-tables"></div>'
      + '<p class="m-note">★送ったメールは取り消せません。</p>'
      + '<p class="err" id="ap-err" hidden></p>'
      + '<div class="m-acts"><button type="button" class="btn" data-a="no">やめる</button>'
      + '<button type="button" class="btn" data-a="none">席を決めずに承認</button>'
      + '<button type="button" class="btn ok" data-a="yes">承認して送る</button></div>');
    var chooser = D.tableChooser(m.querySelector('#ap-tables'), { date: r.date, start: r.start, keep: keep, people: r.people, selected: sel, except: r.id });
    m.onclick = function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'no') return D.closeModal();
      var tables = b.dataset.a === 'none' ? [] : chooser.value();
      if (b.dataset.a === 'yes' && !tables.length) { var er = m.querySelector('#ap-err'); er.textContent = '席を選ぶか、「席を決めずに承認」を押してください。'; er.hidden = false; return; }
      b.disabled = true; b.textContent = '送っています…';
      decide(r, '承認', tables, chooser.keep());
    };
    $modalLock(true);
  };
  D.decline = function (r) {
    D.ask({ title: 'お断りのメールを送ります', text: r.name + ' 様（' + D.md(r.date) + ' ' + r.start + '・' + r.people + '名）に「ご希望の日時は席をご用意できないため、お受けできませんでした」と届きます。送ったメールは取り消せません。', ok: 'お断りを送る', danger: true })
      .then(function (yes) { if (yes) decide(r, 'お断り'); });
  };
  function $modalLock(on) { if (on) D.$('modal').dataset.lock = '1'; else delete D.$('modal').dataset.lock; }
  function decide(r, decision, tables, keep) {
    D.post({ action: 'decide', id: r.id, decision: decision, tables: tables, keep: keep }).then(function (res) {
      $modalLock(false); D.closeModal();
      D.put(res.row);
      var who = esc(r.name) + ' 様（' + esc(D.md(r.date)) + ' ' + esc(r.start) + '）';
      if (res.mailed === false) D.toast('★' + who + 'を「' + decision + '」にしましたが、メールを送れませんでした。お電話でお知らせください：' + D.telLink(r.tel), { warn: true });
      else D.toast(who + 'を「' + decision + '」にしました。' + (decision === '承認' ? '確定' : 'お断り') + 'のメールを送りました');
    }).catch(function (e) {
      $modalLock(false); D.closeModal();
      var row = e.data && e.data.row;
      if (e.code === 'already' && row) {
        D.put(row);
        // 送り直しで2回届いたときは、1回目で済んでいる
        if ((decision === '承認' && row.status !== ST.NO) || (decision === 'お断り' && row.status === ST.NO)) D.toast(esc(r.name) + ' 様を「' + decision + '」にしました');
        else D.toast('ほかの端末で、先に「' + esc(row.status) + '」になっていました', { warn: true });
        return;
      }
      D.toast('送れませんでした：' + esc(D.errText(e)), { warn: true });
    });
  }
  /** 承認するときに、はじめから選んでおく席（入れるいちばん小さい空き席） */
  function suggest(r) {
    var a = D.toMin(r.start), b = a + r.keep;
    var free = D.shownTables().filter(function (t) { return !D.clashes(r.date, [t.id], a, b, r.id).length; });
    var pref = r.seat === 'カウンター' ? 'カウンター' : r.seat === 'テーブル' ? 'テーブル' : '';
    var fit = free.filter(function (t) { return t.cap >= r.people && (!pref || t.kind === pref); }).sort(function (x, y) { return x.cap - y.cap; })[0]
      || free.filter(function (t) { return t.cap >= r.people; }).sort(function (x, y) { return x.cap - y.cap; })[0];
    return fit ? [fit.id] : [];
  }
})();
