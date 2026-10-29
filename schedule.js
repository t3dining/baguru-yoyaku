/* スケジュール（縦に席、横に時刻）
   ・予約は、確保時間の長さの帯で出す（来店待ち＝薄い金、来店済み＝緑、退店＝灰、リクエスト＝赤い点線）。いまの時刻は赤い縦線
   ・空いているマスを押す → 人数の窓 →「予約登録」か「直接来店」
   ・帯を押す → 予約の詳細
   ・帯を長押し → 動かせるようになる（上下で席、左右で時間、右端のつまみで確保時間）→ 下の「変更する」で決める
     （スマホでは動かさない。レストランボードの iPhone 版と同じ） */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, ST = D.ST, $ = D.$;
  var box = $('v-schedule');
  var M = { slot: 15, px: 30, laneH: 40, nameW: 92 };
  var edit = null, drag = null, press = null, suppressClick = false, scrolledFor = '';
  var vf = 600, vt = 1410;

  box.innerHTML = '<div class="sch-bar" id="sch-bar"></div><div class="sch-scroll" id="sch-scroll"></div>';
  var scroller = $('sch-scroll');

  function metrics() {
    var ph = D.isPhone();
    M.px = ph ? 22 : 30; M.nameW = ph ? 58 : 92; M.laneH = ph ? 38 : 40;
    vf = D.toMin(st.conf.viewFrom || '10:00'); vt = D.toMin(st.conf.viewTo || '23:30');
  }
  function x(min) { return (min - vf) / M.slot * M.px; }

  /** 席ごとに、重なる予約を段に分ける */
  function lanesOf(list) {
    var ends = [];
    return list.sort(function (a, b) { return D.span(a)[0] - D.span(b)[0]; }).map(function (r) {
      var sp = D.span(r), i = 0;
      while (i < ends.length && ends[i] > sp[0]) i++;
      ends[i] = sp[1];
      return { r: r, lane: i };
    });
  }

  function barHtml(r, lane, tid) {
    var sp = D.span(r), w = Math.max(M.px, x(sp[1]) - x(sp[0]));
    var multi = r.tables.length > 1 ? '<i class="ic">' + r.tables.length + '卓</i>' : '';
    return '<div class="bar ' + (D.STATUS_CLS[r.status] || '') + (r.route === '直接来店' ? ' walkin' : '') + '" data-id="' + esc(r.id) + '" data-t="' + esc(tid) + '"'
      + ' style="left:' + x(sp[0]) + 'px;width:' + w + 'px;top:' + (lane * M.laneH + 3) + 'px;height:' + (M.laneH - 6) + 'px">'
      + '<span class="b-in"><b>' + r.people + '</b>名 ' + esc(D.name(r)) + ' ' + D.icons(r) + multi + '</span><i class="grip" aria-hidden="true"></i></div>';
  }

  function render() {
    if (edit) return;                       // 動かしている途中は描き直さない
    metrics();
    var date = st.date, info = st.days[date] || { open: [], type: '' };
    var rows = D.rowsOn(date).filter(function (r) { return !D.HIDDEN[r.status]; });
    var tables = D.shownTables(), byT = { '': [] };
    tables.forEach(function (t) { byT[t.id] = []; });
    rows.forEach(function (r) {
      var ids = r.tables.filter(function (id) { return byT[id]; });
      if (!ids.length) byT[''].push(r); else ids.forEach(function (id) { byT[id].push(r); });
    });
    var W = x(vt);

    // 上の帯：その日の組数・人数
    var act = rows.filter(function (r) { return r.status !== ST.REQ; });
    var ppl = act.reduce(function (n, r) { return n + r.people; }, 0);
    var came = rows.filter(function (r) { return r.status === ST.IN || r.status === ST.OUT; }).length;
    $('sch-bar').innerHTML = (info.type === 'closed' ? '<span class="closed">定休日・休み</span>' : '')
      + '<span>予約 <b>' + act.length + '</b>組・<b>' + ppl + '</b>名</span><span>来店 ' + came + '組</span>'
      + (byT[''].length ? '<span class="warn">未割り当て ' + byT[''].length + '件</span>' : '')
      + '<span class="legend"><i class="lg s-wait"></i>来店待ち<i class="lg s-in"></i>来店済み<i class="lg s-out"></i>退店<i class="lg s-req"></i>リクエスト</span>'
      + (D.isPhone() ? '' : '<span class="hint">帯を長押しすると動かせます</span>');

    var head = '';
    for (var h = Math.ceil(vf / 60); h * 60 < vt; h++) head += '<span class="hr" style="left:' + x(h * 60) + 'px">' + h + ':00</span>';
    var bg = '';
    var open = info.open || [];
    if (info.type === 'closed') bg = '<i class="off" style="left:0;width:' + W + 'px"></i>';
    else if (open.length) {
      var edges = [vf], sorted = open.slice().sort(function (a, b) { return a[0] - b[0]; });
      sorted.forEach(function (r) { edges.push(r[0], r[1]); });
      edges.push(vt);
      for (var i = 0; i < edges.length; i += 2) {
        var a = Math.max(vf, edges[i]), b = Math.min(vt, edges[i + 1]);
        if (b > a) bg += '<i class="off" style="left:' + x(a) + 'px;width:' + (x(b) - x(a)) + 'px"></i>';
      }
    }
    var gridStyle = 'width:' + W + 'px;background-size:' + (M.px * 4) + 'px 100%,' + M.px + 'px 100%;background-position:' + (-(vf % 60) / M.slot * M.px) + 'px 0,0 0';
    var body = '';
    [{ id: '', name: '未割り当て', cap: '' }].concat(tables).forEach(function (t) {
      var placed = lanesOf(byT[t.id] || []), n = placed.reduce(function (m, p) { return Math.max(m, p.lane + 1); }, 1);
      if (t.id === '' && !placed.length && !D.isPhone()) n = 1;
      var hh = n * M.laneH;
      body += '<div class="sch-row' + (t.id === '' ? ' loose' : '') + '" style="height:' + hh + 'px">'
        + '<div class="sch-name" style="width:' + M.nameW + 'px"><b>' + esc(t.name) + '</b>' + (t.cap ? '<small>' + t.cap + '名</small>' : '') + '</div>'
        + '<div class="sch-lane" data-t="' + esc(t.id) + '" style="' + gridStyle + ';height:' + hh + 'px">'
        + placed.map(function (p) { return barHtml(p.r, p.lane, t.id); }).join('') + '</div></div>';
    });
    var nowLine = date === st.today ? '<i class="sch-now" id="sch-now" style="left:' + (M.nameW + x(D.nowMin())) + 'px"></i>' : '';
    var sl = scroller.scrollLeft, stp = scroller.scrollTop;
    scroller.innerHTML = '<div class="sch-inner" style="width:' + (M.nameW + W) + 'px">'
      + '<div class="sch-head"><div class="sch-corner" style="width:' + M.nameW + 'px">席</div><div class="sch-times" style="width:' + W + 'px">' + head + '</div></div>'
      + '<div class="sch-body"><div class="sch-bg" style="left:' + M.nameW + 'px;width:' + W + 'px">' + bg + '</div>' + body + nowLine + '</div></div>';
    if (scrolledFor !== date) {
      scrolledFor = date;
      // 今日はいまの時刻、ほかの日はその日の最初の予約（なければ 11:00）が見えるところへ
      var first = rows.length ? D.toMin(rows[0].start) : 660;
      var target = date === st.today ? D.nowMin() - 60 : first - 30;
      scroller.scrollLeft = Math.max(0, x(target));
      scroller.scrollTop = 0;
    } else { scroller.scrollLeft = sl; scroller.scrollTop = stp; }
  }

  /* ---------- 押す ---------- */
  scroller.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; return; }
    if (edit) return;
    var bar = e.target.closest('.bar');
    if (bar) { D.openBooking(bar.dataset.id); return; }
    var lane = e.target.closest('.sch-lane');
    if (!lane) return;
    var rect = lane.getBoundingClientRect();
    var m = vf + Math.floor((e.clientX - rect.left) / M.px) * M.slot;
    if (m < vf || m >= vt) return;
    var t = lane.dataset.t, tb = t ? D.table(t) : null;
    D.numpad({ x: e.clientX, y: e.clientY, date: st.date, start: D.hm(m), tables: t ? [t] : [], label: (tb ? tb.name + '（' + tb.cap + '名）' : '未割り当て') + '　' + D.hm(m) });
  });
  scroller.addEventListener('contextmenu', function (e) { if (e.target.closest('.bar')) e.preventDefault(); });

  /* ---------- 長押しで動かす（タブレット・パソコン） ---------- */
  scroller.addEventListener('pointerdown', function (e) {
    var bar = e.target.closest('.bar');
    if (!bar || D.isPhone()) return;
    if (edit) {
      if (bar.dataset.id === edit.r.id && bar.dataset.t === edit.from) startDrag(e, bar, e.target.closest('.grip') ? 'resize' : 'move');
      return;
    }
    var r = D.row(bar.dataset.id);
    if (!r) return;
    press = { x: e.clientX, y: e.clientY, timer: setTimeout(function () {
      press = null;
      enterEdit(bar, r);
      suppressClick = true;
      startDrag(e, bar, 'move');
    }, 450) };
  });
  window.addEventListener('pointermove', function (e) {
    if (press && (Math.abs(e.clientX - press.x) > 8 || Math.abs(e.clientY - press.y) > 8)) { clearTimeout(press.timer); press = null; }
    if (drag) moveDrag(e);
  });
  window.addEventListener('pointerup', function () {
    if (press) { clearTimeout(press.timer); press = null; }
    if (drag) { drag = null; setTimeout(function () { suppressClick = false; }, 50); }
  });
  window.addEventListener('pointercancel', function () { if (press) { clearTimeout(press.timer); press = null; } drag = null; });
  // 動かしているあいだは、画面が一緒に動かないようにする
  scroller.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });

  function enterEdit(bar, r) {
    edit = { r: r, el: bar, from: bar.dataset.t, table: bar.dataset.t, start: D.toMin(r.start), keep: r.keep, lane: bar.closest('.sch-lane') };
    bar.classList.add('editing');
    if (navigator.vibrate) navigator.vibrate(20);
    paintEditbar();
  }
  function startDrag(e, bar, mode) {
    drag = { mode: mode, x: e.clientX, start: edit.start, keep: edit.keep };
    e.preventDefault();
  }
  function moveDrag(e) {
    var steps = Math.round((e.clientX - drag.x) / M.px);
    if (drag.mode === 'resize') {
      edit.keep = Math.max(30, drag.keep + steps * M.slot);
    } else {
      edit.start = Math.max(vf, Math.min(vt - M.slot, drag.start + steps * M.slot));
      // 指の高さにある席の行（帯が指の下にあるので、要素ではなく高さで探す）
      var lanes = scroller.querySelectorAll('.sch-lane');
      for (var i = 0; i < lanes.length; i++) {
        var rc = lanes[i].getBoundingClientRect();
        if (e.clientY >= rc.top && e.clientY < rc.bottom) { edit.table = lanes[i].dataset.t; break; }
      }
    }
    // 帯はその場に置いたまま、ずらして見せる
    var target = scroller.querySelector('.sch-lane[data-t="' + cssEsc(edit.table) + '"]') || edit.lane;
    var dy = target.getBoundingClientRect().top - edit.lane.getBoundingClientRect().top;
    var bx = x(edit.start) - parseFloat(edit.el.style.left);
    edit.el.style.transform = 'translate(' + bx + 'px,' + (dy - parseFloat(edit.el.style.top) + 3) + 'px)';
    edit.el.style.width = Math.max(M.px, x(edit.start + edit.keep) - x(edit.start)) + 'px';
    paintEditbar();
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function newTables() {
    var r = edit.r, from = edit.from, to = edit.table;
    if (from === to) return r.tables.slice();
    var list = r.tables.filter(function (t) { return t !== from; });
    if (to && list.indexOf(to) < 0) list.push(to);
    return from === '' ? (to ? [to] : []) : list;
  }
  function paintEditbar() {
    var eb = $('editbar'), r = edit.r, tb = newTables();
    eb.innerHTML = '<div class="eb-in"><p><b>' + esc(D.name(r)) + ' 様　' + r.people + '名</b>　'
      + esc(D.hm(edit.start) + '〜' + D.hm(edit.start + edit.keep)) + '（' + edit.keep + '分）　' + esc(tb.length ? D.tableNames(tb) : '未割り当て') + '</p>'
      + '<p class="eb-hint">上下に動かすと席、左右で時間、右端のつまみで確保時間が変わります</p>'
      + '<div class="eb-acts"><button type="button" class="btn" data-e="detail">詳細を変更</button><button type="button" class="btn" data-e="cancel">やめる</button>'
      + '<button type="button" class="btn ember big" data-e="ok">変更する</button></div></div>';
    eb.hidden = false;
  }
  $('editbar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-e]');
    if (!b || !edit) return;
    var r = edit.r;
    if (b.dataset.e === 'cancel') return endEdit();
    if (b.dataset.e === 'detail') { endEdit(); return D.openRegister({ row: r }); }
    var patch = { start: D.hm(edit.start), keep: edit.keep, tables: newTables() };
    var same = patch.start === r.start && patch.keep === r.keep && patch.tables.join() === r.tables.join();
    if (same) return endEdit();
    var cl = patch.tables.length ? D.clashes(r.date, patch.tables, edit.start, edit.start + edit.keep, r.id) : [];
    var go = function () { endEdit(); D.save(r, patch, '変更しました（' + D.name(r) + ' 様・' + patch.start + '・' + (patch.tables.length ? D.tableNames(patch.tables) : '未割り当て') + '）'); };
    if (!cl.length) return go();
    D.ask({ title: '他の予約と重なります', text: cl.map(function (x) { return D.tableNames(x.tables) + '　' + x.start + '〜 ' + D.name(x) + ' 様'; }).join('／') + '。このまま変更しますか？', ok: 'このまま変更する' })
      .then(function (y) { if (y) go(); });
  });
  function endEdit() { edit = null; drag = null; $('editbar').hidden = true; render(); }

  // いまの時刻の線と、座っている席の帯を1分ごとに動かす
  setInterval(function () { if (st.view === 'schedule' && st.today && !edit && !document.hidden) render(); }, 60000);
  window.addEventListener('resize', function () { if (st.view === 'schedule' && st.today && !edit) render(); });

  D.views.schedule = { render: render, enter: function () { scrolledFor = ''; } };
})();
