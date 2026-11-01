/* テイクアウト（お客さまのアプリの注文・申請と、電話・店頭の注文）を見るだけの画面
   ・★予約ボードでは見るだけ。受け付ける・できあがり・お渡し・取り消し・申請の承認・電話の注文・注文の受付を止めるは、
     すべてバグるOrder受付で行う（2026-10-30 ユーザーが決めた）。予約ボードからは saveOrder・setTakeout を送らない
   ・受け口のタブ「テイクアウト」を、予約と一緒に15秒ごとに読む（load の答えの orders）
   ・様子は店舗アプリと同じ：request（申請中）→ new（受付待ち）→ accepted（受付済み・調理中）→ ready（できあがり）→ done（お渡し済み）
     ／ canceled（取り消し）／ declined（お断り）。受け付けた注文は、受け取りの30分前までは「受付済み」、過ぎたら「調理中」に並ぶ
   ・その30分などの決めは、店舗アプリの js/data.js の TAKEOUT を読む。★名前や形が変わったら、ここも直す */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, $ = D.$;
  var box = $('v-takeout');
  var KIND = { pickup: 'テイクアウト', bulk: '大量注文', delivery: '配達' };
  var LABEL = { request: '申請中', new: '受付待ち', accepted: '調理中', ready: 'できあがり', done: 'お渡し済み', canceled: '取り消し', declined: 'お断り' };
  var LIVE = { request: true, new: true, accepted: true, ready: true };
  // 操作する画面（バグるOrder受付）。この Mac の確認用の画面では、同じフォルダの Order受付
  var ORDER_APP = location.hostname === 't3dining.github.io' ? 'https://t3dining.github.io/baguru-app/order.html' : '../../バグるOrder受付/order.html';
  /** フォルダーアプリから開いたときは、アプリの外へ出ないよう同じ窓で開き、戻り先の印を渡す。お店のタブレットは今までどおり別の窓 */
  function orderLink() {
    var inApp = false;
    try { inApp = sessionStorage.getItem('baguru.yoyaku.owner') === '1'; } catch (e) {}
    if (!inApp) return '<a class="btn dark" href="' + esc(ORDER_APP) + '" target="_blank" rel="noopener">Order受付を開く</a>';
    return '<a class="btn dark" href="' + esc(ORDER_APP + '?from=owner' + (/[?&]hub=staff(&|$)/.test(location.search) ? '&hub=staff' : '')) + '">Order受付を開く</a>';
  }
  st.orders = [];

  // 店舗アプリの決め（js/data.js の TAKEOUT）。読めないときはこの値
  function rule(k, def) { try { return TAKEOUT[k] != null ? TAKEOUT[k] : def; } catch (e) { return def; } }   // eslint-disable-line no-undef
  var cookBefore = function () { return rule('cookBefore', 30); };
  var freeMin = function () { return rule('deliveryFreeMin', 10); };
  (function () {
    var s = document.createElement('script');
    // 公開先では店舗アプリの公開先から、この Mac の確認用の画面では、同じフォルダの店舗アプリから
    s.src = location.hostname === 't3dining.github.io' ? 'https://t3dining.github.io/baguru-app/js/data.js?t=' + Math.floor(Date.now() / 3600000) : '../../js/data.js';
    s.onload = function () { render(); };
    document.head.appendChild(s);
  })();

  /* ---------- 小さな道具 ---------- */
  var yen = function (n) { return '¥' + Number(n || 0).toLocaleString('ja-JP'); };
  var msOf = function (o) { return Date.parse(o.pickupAt) || 0; };
  var isReq = function (o) { return o.kind === 'bulk' || o.kind === 'delivery'; };
  /** 受け付けたが、まだ調理を始める前（受け取りの cookBefore 分前より前）。「できしだい」はいつも調理中 */
  var booked = function (o, now) { return o.status === 'accepted' && !o.asap && msOf(o) - now > cookBefore() * 60000; };
  function whenText(o) {
    var ms = msOf(o), d = D.ymdOf(ms), t = D.clock(ms);
    return (d === st.today ? '' : D.md(d) + ' ') + (o.asap ? 'できしだい（' + t + '頃）' : t);
  }
  function untilText(o, now) {
    var min = Math.round((msOf(o) - now) / 60000);
    if (min >= 60 * 24 || o.status === 'done' || !LIVE[o.status]) return '';
    if (min >= 60) return 'あと' + Math.floor(min / 60) + '時間' + (min % 60 ? (min % 60) + '分' : '');
    if (min >= 0) return 'あと' + min + '分';
    return '<em class="late">' + (-min) + '分過ぎ</em>';
  }
  function statusLabel(o, now) {
    if (o.status === 'accepted' && booked(o, now)) return isReq(o) ? '承認済み' : '受付済み';
    if (o.kind === 'delivery' && o.status === 'done') return 'お届け済み';
    return LABEL[o.status];
  }
  var mealsOf = function (o) { return o.meals ? o.meals + '食' : ''; };
  /** 注文番号は3桁（受け口の前の版では、シートで数になった行が 1 のように届く） */
  var noOf = function (o) { var s = String(o.no == null ? '' : o.no); return /^\d{1,2}$/.test(s) ? ('00' + s).slice(-3) : s; };

  /* ---------- 画面 ---------- */
  function lineHtml(l) {
    return '<li><span>' + esc(l.name) + ' <b>×' + esc(l.qty) + '</b>' + (l.opts && l.opts.length ? '<small>' + esc(l.opts.join(' / ')) + '</small>' : '') + '</span><i>' + yen(l.unit * l.qty) + '</i></li>';
  }
  function card(o, now) {
    var fee = o.kind === 'delivery' ? (o.fee != null ? '　配達料 ' + yen(o.fee) : (o.meals < freeMin() ? '　配達料は要相談' : '　配達無料')) : '';
    return '<article class="to-card k-' + o.kind + ' s-' + o.status + (o.status === 'new' || o.status === 'request' ? ' is-new' : '') + '" data-order="' + esc(o.id) + '">'
      + '<div class="to-head"><b class="to-no">' + (isReq(o) ? '申請 ' : 'No.') + esc(noOf(o)) + '</b>'
      + '<span class="to-kind">' + esc(KIND[o.kind] || '') + '</span><span class="to-route">' + esc(o.route || 'アプリ') + '</span>'
      + '<span class="to-st">' + esc(statusLabel(o, now)) + '</span></div>'
      + '<p class="to-when"><b>' + esc(whenText(o)) + '</b> ' + (o.kind === 'delivery' ? 'お届け' : '受け取り') + (o.status === 'request' ? '（ご希望）' : '') + ' <span>' + untilText(o, now) + '</span></p>'
      + '<p class="to-who"><b>' + esc(o.name || '（お名前なし）') + ' 様</b>' + D.telLink(o.tel) + '</p>'
      + (o.kind === 'delivery' && o.address ? '<p class="to-addr">' + esc(o.address + (o.address2 ? ' ' + o.address2 : '')) + '</p>' : '')
      + '<ul class="to-lines">' + (o.lines || []).map(lineHtml).join('') + '</ul>'
      + '<p class="to-sum"><span>' + esc(mealsOf(o)) + fee + '</span><b>' + yen(o.total + (o.fee || 0)) + '</b></p>'
      + (o.note ? '<p class="to-note"><b>ご要望</b>' + esc(o.note) + '</p>' : '')
      + (o.shopMsg ? '<p class="to-note shop"><b>お店から</b>' + esc(o.shopMsg) + '</p>' : '')
      + (o.status === 'canceled' && o.canceledBy ? '<p class="muted">' + esc(o.canceledBy) + 'が取り消し</p>' : '')
      + '</article>';
  }
  function col(title, list, now, cls) {
    return '<section class="to-col ' + (cls || '') + '"><h3>' + title + '<em>' + list.length + '</em></h3>'
      + (list.length ? list.map(function (o) { return card(o, now); }).join('') : '<p class="empty">ありません</p>') + '</section>';
  }
  function render() {
    if (!box || box.hidden) return;
    var now = Date.now(), list = st.orders.slice().sort(function (a, b) { return msOf(a) - msOf(b); });
    var req = list.filter(function (o) { return o.status === 'request'; });
    var fresh = list.filter(function (o) { return o.status === 'new'; });
    var cook = list.filter(function (o) { return o.status === 'accepted' && !booked(o, now); });
    var ready = list.filter(function (o) { return o.status === 'ready'; });
    var later = list.filter(function (o) { return booked(o, now); });
    var ended = list.filter(function (o) { return !LIVE[o.status] && D.ymdOf(o.updatedAt) === st.today; }).reverse();
    var on = st.conf.takeout !== false;
    box.innerHTML = '<div class="to-tools"><span class="to-state ' + (on ? 'on' : 'off') + '"><i></i>' + (on ? 'お客さまのアプリの注文を受け付けています' : 'お客さまのアプリの注文を止めています') + '</span>'
      + '<span class="to-only">見るだけの画面です。受け付ける・できあがり・お渡し・取り消し・申請の承認・電話の注文は、<b>Order受付</b>で行います</span>'
      + orderLink() + '</div>'
      + (req.length ? '<div class="to-req">' + col('配達・大量注文の申請（Order受付で承認すると確定）', req, now, 'wide') + '</div>' : '')
      + '<div class="to-cols">' + col('受付待ち', fresh, now, 'c-new') + col('調理中', cook, now, 'c-cook') + col('できあがり', ready, now, 'c-ready') + '</div>'
      + '<div class="to-more">' + col('受付済み（受け取りの' + cookBefore() + '分前に「調理中」へ）', later, now, 'wide')
      + col('今日のお渡し済み・取り消し', ended, now, 'wide ended') + '</div>';
  }

  /* ---------- 新しい注文の知らせ（帯と数だけ。音は Order受付で鳴る） ---------- */
  D.checkOrders = function () {
    var todo = st.orders.filter(function (o) { return o.status === 'new' || o.status === 'request'; });
    ['badge-to', 'badge-to2'].forEach(function (id) { var b = $(id); if (b) { b.textContent = todo.length; b.hidden = !todo.length; } });
    var bar = $('orderbar');
    if (!todo.length || st.view === 'takeout') bar.hidden = true;
    else {
      var f = todo[0];
      $('orderbar-text').textContent = 'テイクアウトの注文・申請が ' + todo.length + '件 Order受付で待っています（' + (isReq(f) ? '申請 ' : 'No.') + noOf(f) + '・' + whenText(f) + (todo.length > 1 ? ' 他' : '') + '）';
      bar.hidden = false;
    }
  };
  setInterval(function () { if (st.today && !document.hidden) { D.checkOrders(); if (st.view === 'takeout') render(); } }, 30000);   // 「あと○分」を進める
  $('orderbar-go').addEventListener('click', function () { D.show('takeout'); });

  /* ---------- テーブル管理の「今日の予約」に出す分（floor.js） ----------
     今日受け取る、時間を指定した注文（予約注文）。「できしだい」は予約ではないので出さない。申請中は、予約のリクエストと同じく出さない。取り消し・お断りも出さない */
  var TODAY = { new: true, accepted: true, ready: true, done: true };
  D.todayOrders = function () {
    return st.orders.filter(function (o) { return TODAY[o.status] && !o.asap && msOf(o) && D.ymdOf(msOf(o)) === st.today; });
  };
  D.orderTime = function (o) { return D.clock(msOf(o)); };
  D.orderLine = function (o) {
    return '<button type="button" class="tl tl-order k-' + esc(o.kind) + '" data-order="' + esc(o.id) + '"><span class="tl-head"><span class="to-kind">' + esc(KIND[o.kind] || 'テイクアウト') + '</span><span class="to-st">' + esc(statusLabel(o, Date.now())) + '</span></span>'
      + '<span class="tl-name">' + esc(o.name || '（お名前なし）') + ' 様' + (o.meals ? '　' + esc(mealsOf(o)) : '') + '</span>'
      + '<span class="tl-sub">' + esc(D.orderTime(o)) + ' ' + (o.kind === 'delivery' ? 'お届け' : '受け取り') + '　No.' + esc(noOf(o)) + '</span></button>';
  };
  /** 注文のところを開く（予約ボードでは見るだけ） */
  D.openOrder = function (id) {
    D.show('takeout');
    var c = [].filter.call(box.querySelectorAll('[data-order]'), function (x) { return x.dataset.order === id; })[0];
    if (c) c.scrollIntoView({ block: 'center' });
  };

  D.views.takeout = { render: render, enter: function () { $('orderbar').hidden = true; } };
})();
