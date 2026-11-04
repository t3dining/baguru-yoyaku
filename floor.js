/* テーブル管理（今日だけ）
   ・席の配置図に、いまの様子を出す：空き＝白、着席中＝緑（確保時間の残り15分でオレンジ、過ぎたら赤）、次の予約の時刻を吹き出しで
   ・空いている席を押す → 人数の窓 →「直接来店」か「予約登録」。座っている席を押す → 右の「席情報」（退店・来店取消）
   ・右の「今日の予約」は、直接来店・来店済みを除いて見られる。テイクアウトの今日の注文（時間指定と「できしだい」）も、時刻の順に一緒に出す。押すとテイクアウトの画面へ（見るだけ）
   ・「臨時（席なしで直接来店）」のボタンは、2026-10-30 に外した（ユーザーの指示） */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, ST = D.ST, $ = D.$;
  var box = $('v-floor');
  var side = { tab: 'today', sel: '', noWalk: true, noCame: false };

  box.innerHTML = '<div class="floor-wrap"><div class="floor-main"><div class="floor-tools" id="floor-tools"></div><div class="floor" id="floor"></div></div>'
    + '<aside class="floor-side"><div class="tabs2" id="floor-tabs"></div><div class="floor-side-body" id="floor-side"></div></aside></div>';

  /** 今日、その席でいま座っている予約と、次の予約 */
  function stateOf(t, rows, now) {
    var mine = rows.filter(function (r) { return r.tables.indexOf(t.id) >= 0 && !D.HIDDEN[r.status]; });
    var seated = mine.filter(function (r) { return r.status === ST.IN; })[0] || null;
    var next = mine.filter(function (r) { return (r.status === ST.WAIT || r.status === ST.REQ) && D.toMin(r.start) + 15 >= now; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); })[0] || null;
    return { seated: seated, next: next };
  }

  function render() {
    var today = st.today, now = D.nowMin(), rows = D.rowsOn(today), pk = D.picking();
    var tables = D.shownTables();
    $('floor-tools').innerHTML = '<b>' + esc(D.ymdJp(today)) + '</b><span class="muted">今日の席の様子</span>'
      + '<span class="legend"><i class="lg free"></i>空き<i class="lg s-in"></i>着席中<i class="lg soon"></i>残りわずか<i class="lg over"></i>確保時間を過ぎた</span>';
    var maxX = 0, maxY = 0;
    tables.forEach(function (t) { maxX = Math.max(maxX, t.x + t.w); maxY = Math.max(maxY, t.y + t.h); });
    var cw = maxX + 40, ch = maxY + 60;
    var area = $('floor'), aw = area.clientWidth || 900;
    var scale = Math.min(1.3, aw / cw);
    var tiles = tables.map(function (t) {
      var s = stateOf(t, rows, now), cls = 'ft k-' + (t.kind === 'カウンター' ? 'counter' : 'table'), inner = '', bubble = '';
      if (s.seated) {
        var r = s.seated, since = r.inAt ? Math.round((Date.now() - r.inAt) / 60000) : now - D.toMin(r.start);
        var left = D.toMin(r.start) + r.keep - now;
        cls += left < 0 ? ' over' : left <= 15 ? ' soon' : ' seated';
        // 着席中の字は、席の大きさに合わせて入るかぎり大きくする（fitSeated。2026-11-04 ko-dai さんの指示「緑の中の文字を最大限大きく」）。
        // 1行目＝お名前（直接来店は「直接来店」）と座ってからの分、2行目＝人数だけ（2026-11-04 ko-dai さんの指示）。残り・超過（残り15分から）は、卓番の右に出す
        inner = '<span class="ft-who"><span class="nm">' + esc(D.name(r)) + '</span><i></i><b>' + since + '</b><small>分</small></span><span class="ft-ppl"><b>' + r.people + '</b><small>名</small></span>';
        if (left <= 15) bubble += '<span class="ft-left">' + (left < 0 ? (-left) + '分超過' : '残り' + left + '分') + '</span>';
      } else {
        inner = '<span class="ft-cap">' + t.cap + '名</span>';
      }
      if (s.next) {
        var soon = D.toMin(s.next.start) - now <= st.conf.keep + 30;
        bubble += '<span class="ft-next' + (soon ? ' near' : '') + '">次 ' + esc(s.next.start) + '</span>';
      }
      var chairs = Math.max(1, Math.ceil(t.cap / 2)), ch1 = '';
      for (var i = 0; i < chairs; i++) ch1 += '<i></i>';
      return '<button type="button" class="' + cls + (side.sel === t.id ? ' sel' : '') + (pk && pk.o.date === st.today && pk.tables.indexOf(t.id) >= 0 ? ' picked' : '') + '" data-t="' + esc(t.id) + '" style="left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + t.h + 'px">'
        + '<span class="chairs ch-top">' + ch1 + '</span><span class="ft-box">' + inner + '</span><span class="chairs ch-bottom">' + ch1 + '</span>'
        + bubble + '<span class="ft-name">' + esc(t.name) + '</span></button>';
    }).join('');
    area.innerHTML = '<div class="floor-scale" style="width:' + (cw * scale) + 'px;height:' + (ch * scale) + 'px"><div class="floor-canvas" style="width:' + cw + 'px;height:' + ch + 'px;transform:scale(' + scale + ')">' + tiles + '</div></div>';
    fitSeated(area);
    fitLeft(area);
    renderSide(rows);
  }

  /** 着席中の席の字を、枠に入るかぎり大きくする。行ごとの大きさの釣り合い（W）を保ったまま、
   *  幅は行ごとに、高さは全部の行で収まる一番大きい大きさにする（長いお名前は、その行だけ小さくなる）。
   *  ★幅と高さは字の大きさに比例するので、100px で1回測れば計算で決まる（配置図の拡大・縮小は測る値に効かない） */
  var FIT_W = { 'ft-who': 1, 'ft-ppl': 1.3 }, FIT_PROBE = 100, FIT_MAX = 64;
  function fitSeated(area) {
    var jobs = [].slice.call(area.querySelectorAll('.ft.seated .ft-box,.ft.soon .ft-box,.ft.over .ft-box')).map(function (b) {
      var lines = [].slice.call(b.children), k = lines.map(function (l) { return FIT_W[l.classList[0]] || 1; });
      lines.forEach(function (l, i) { l.style.fontSize = FIT_PROBE * k[i] + 'px'; l.classList.add('fit-probe'); });
      var nm = b.querySelector('.ft-who .nm'), txt = nm ? nm.textContent : '', sp = txt.search(/[ 　]/);
      return { b: b, lines: lines, k: k, nm: nm, one: esc(txt), two: sp > 0 ? esc(txt.slice(0, sp)) + '<br>' + esc(txt.slice(sp + 1).trim()) : '' };
    });
    var measure = function (j) { return j.lines.map(function (l, i) { var p = FIT_PROBE * j.k[i]; return { w: l.offsetWidth / p, h: l.offsetHeight / p, k: j.k[i] }; }); };
    jobs.forEach(function (j) {   // 先に全部を書き、まとめて測る（読み書きを交互にしない）
      var cs = getComputedStyle(j.b);
      j.w = j.b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      j.h = j.b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (parseFloat(cs.rowGap) || 0) * (j.lines.length - 1);
      j.m = measure(j);
    });
    // 姓と名のあいだに空きがあるお名前は、2行に分けた形も測る（長いお名前は、分けたほうが大きくなることがある）
    jobs.forEach(function (j) { if (j.two) j.nm.innerHTML = j.two; });
    jobs.forEach(function (j) { if (j.two) j.m2 = measure(j); });
    jobs.forEach(function (j) {
      j.lines.forEach(function (l) { l.classList.remove('fit-probe'); });
      var ok = function (m) { return m && m.every(function (x) { return x.w > 0 && x.h > 0; }); };
      if (!(j.w > 0 && j.h > 0) || !ok(j.m)) { if (j.two) j.nm.innerHTML = j.one; j.lines.forEach(function (l) { l.style.fontSize = ''; }); return; }   // 見えていない（測れない）ときは、ふだんの大きさ
      var a = fit(j, j.m), b = ok(j.m2) ? fit(j, j.m2) : null;
      var use2 = b && b[0] > a[0] * 1.15;   // お名前の行が、はっきり大きくなるときだけ2行にする
      if (j.two && !use2) j.nm.innerHTML = j.one;
      (use2 ? b : a).forEach(function (px, i) { j.lines[i].style.fontSize = px + 'px'; });
    });
  }
  /** 測った形 m で、高さに収まる一番大きい大きさ（行ごとの px） */
  function fit(j, m) {
    var size = function (k) { return m.map(function (x) { return Math.min(k * x.k, j.w * 0.97 / x.w, FIT_MAX); }); };   // 幅は少しだけ余白を残す
    var tall = function (s) { return s.reduce(function (a, px, i) { return a + px * m[i].h; }, 0); };
    var lo = 6, hi = FIT_MAX;
    for (var n = 0; n < 14; n++) { var mid = (lo + hi) / 2; if (tall(size(mid)) <= j.h - 2) lo = mid; else hi = mid; }   // 高さも 2px だけ残す（字の高さの端数）
    var s = size(lo), top = Math.min.apply(null, s) * 2;   // 長いお名前で1行だけ小さくなっても、ほかの行は2倍までにする（つり合いが崩れすぎないように）
    return s.map(function (px) { return Math.floor(Math.min(px, top) * 2) / 2; });
  }
  function fitLeft(area) {
    // 卓番の右の「残り○分」「○分超過」は、卓番と重ならない幅に収める
    [].slice.call(area.querySelectorAll('.ft-left')).forEach(function (el) {
      var tile = el.parentNode, nm = tile.querySelector('.ft-name');
      if (!nm || !el.offsetWidth) return;
      var room = tile.clientWidth - (nm.offsetLeft + nm.offsetWidth) - 6 - (tile.clientWidth - el.offsetLeft - el.offsetWidth);
      if (el.offsetWidth > room && room > 0) el.style.fontSize = Math.floor(parseFloat(getComputedStyle(el).fontSize) * room / el.offsetWidth * 2) / 2 + 'px';
    });
  }

  function renderSide(rows) {
    var list = rows.filter(function (r) { return !D.HIDDEN[r.status] && r.status !== ST.REQ; });
    var shown = list.filter(function (r) { return !(side.noWalk && r.route === '直接来店') && !(side.noCame && (r.status === ST.IN || r.status === ST.OUT)); });
    var orders = D.todayOrders ? D.todayOrders() : [];   // テイクアウトの予約注文（takeout.js）
    $('floor-tabs').innerHTML = '<button type="button" data-tab="seat" class="' + (side.tab === 'seat' ? 'on' : '') + '">席情報</button>'
      + '<button type="button" data-tab="today" class="' + (side.tab === 'today' ? 'on' : '') + '">今日の予約（' + (list.filter(function (r) { return r.route !== '直接来店'; }).length + orders.length) + '）</button>';
    var h = '';
    if (side.tab === 'today') {
      h = '<div class="side-filter"><label><input type="checkbox" data-flt="noWalk"' + (side.noWalk ? ' checked' : '') + '>直接来店を除く</label>'
        + '<label><input type="checkbox" data-flt="noCame"' + (side.noCame ? ' checked' : '') + '>来店済みを除く</label></div>';
      var last = '';
      var items = shown.map(function (r) {
        return { t: r.start, html: '<button type="button" class="tl" data-id="' + esc(r.id) + '">' + D.statusBadge(r.status)
          + '<span class="tl-name">' + esc(D.name(r)) + (r.name ? ' 様' : '') + '　' + r.people + '名 ' + D.icons(r) + '</span>'
          + '<span class="tl-sub">' + esc(r.start + '〜' + D.hm(D.span(r)[1])) + '　' + esc(r.tables.length ? D.tableNames(r.tables) : '未割り当て') + '</span></button>' };
      }).concat(orders.filter(function (o) { return !(side.noCame && o.status === 'done'); }).map(function (o) { return { t: D.orderTime(o), html: D.orderLine(o) }; }));
      items.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
      h += items.length ? items.map(function (x) {
        var head = x.t !== last ? '<p class="tl-time">' + esc(x.t) + '</p>' : '';
        last = x.t;
        return head + x.html;
      }).join('') : '<p class="empty">今日の予約はありません。</p>';
    } else {
      var t = side.sel && D.table(side.sel);
      if (!t) h = '<p class="empty">配置図の席を押すと、ここに出ます。</p>';
      else {
        var s = stateOf(t, rows, D.nowMin());
        var later = rows.filter(function (r) { return r.tables.indexOf(t.id) >= 0 && !D.HIDDEN[r.status] && r !== s.seated; });
        h = '<h3 class="seat-h">' + esc(t.name) + '<small>' + t.cap + '名・' + esc(t.kind) + '</small></h3>'
          + (s.seated ? D.detailHtml(s.seated, true) : '<p class="seat-free">今は空いています</p><div class="dt-acts"><button type="button" class="btn ok big" data-f="walk">直接来店</button><button type="button" class="btn dark" data-f="book">予約登録</button></div>')
          + (later.length ? '<p class="lbl">今日のこの席</p>' + later.map(function (r) {
            return '<button type="button" class="tl" data-id="' + esc(r.id) + '">' + D.statusBadge(r.status) + '<span class="tl-name">' + esc(r.start) + '　' + esc(D.name(r)) + '　' + r.people + '名</span></button>';
          }).join('') : '');
      }
    }
    $('floor-side').innerHTML = h;
  }

  box.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) { side.tab = tab.dataset.tab; return render(); }
    var dt = e.target.closest('.dt');
    if (dt) return D.onBookingClick(e);
    var tl = e.target.closest('.tl');
    if (tl) return tl.dataset.order ? D.openOrder(tl.dataset.order) : D.openBooking(tl.dataset.id);
    var fb = e.target.closest('[data-f]');
    if (fb) {
      var now = D.nowMin();
      if (fb.dataset.f === 'walk' || fb.dataset.f === 'book') {
        var t0 = D.table(side.sel);
        return D.numpad({ x: e.clientX, y: e.clientY, date: st.today, start: D.hm(D.nextStep(now)), tables: [side.sel], label: t0.name + '（' + t0.cap + '名）' });
      }
    }
    var tile = e.target.closest('.ft');
    if (!tile) return;
    if (D.picking()) return D.pickToggle(tile.dataset.t);   // 席を足している途中
    var t = D.table(tile.dataset.t), s = stateOf(t, D.rowsOn(st.today), D.nowMin());
    side.sel = t.id; side.tab = 'seat';
    render();
    if (!s.seated) {
      var n = D.nowMin();
      D.numpad({ x: e.clientX, y: e.clientY, date: st.today, start: D.hm(D.nextStep(n)), tables: [t.id], label: t.name + '（' + t.cap + '名）' });
    }
  });
  box.addEventListener('change', function (e) {
    var k = e.target.dataset.flt;
    if (k) { side[k] = e.target.checked; render(); }
  });

  setInterval(function () { if (st.view === 'floor' && st.today && !document.hidden) render(); }, 60000);
  window.addEventListener('resize', function () { if (st.view === 'floor' && st.today) render(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (st.view === 'floor' && st.today) render(); });   // 数字の字（Oswald）が届いたら測り直す

  D.views.floor = { render: render };
})();
