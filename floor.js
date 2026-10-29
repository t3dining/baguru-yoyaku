/* テーブル管理（今日だけ）
   ・席の配置図に、いまの様子を出す：空き＝白、着席中＝緑（確保時間の残り15分でオレンジ、過ぎたら赤）、次の予約の時刻を吹き出しで
   ・空いている席を押す → 人数の窓 →「直接来店」か「予約登録」。座っている席を押す → 右の「席情報」（退店・来店取消）
   ・右の「今日の予約」は、直接来店・来店済みを除いて見られる
   ・「臨時」は、席を決めずに直接来店を入れる */
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
      + '<span class="legend"><i class="lg free"></i>空き<i class="lg s-in"></i>着席中<i class="lg soon"></i>残りわずか<i class="lg over"></i>確保時間を過ぎた</span>'
      + '<button type="button" class="btn floor-tmp" data-f="tmp">臨時（席なしで直接来店）</button>';
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
        inner = '<span class="ft-who">' + esc(D.name(r)) + '</span><span class="ft-ppl"><b>' + r.people + '</b>名</span><span class="ft-time">' + since + '分' + (left < 0 ? '（' + (-left) + '分超過）' : left <= 15 ? '（残り' + left + '分）' : '') + '</span>';
      } else {
        inner = '<span class="ft-cap">' + t.cap + '名</span>';
      }
      if (s.next) {
        var soon = D.toMin(s.next.start) - now <= st.conf.keep + 30;
        bubble = '<span class="ft-next' + (soon ? ' near' : '') + '">次 ' + esc(s.next.start) + '</span>';
      }
      var chairs = Math.max(1, Math.ceil(t.cap / 2)), ch1 = '';
      for (var i = 0; i < chairs; i++) ch1 += '<i></i>';
      return '<button type="button" class="' + cls + (side.sel === t.id ? ' sel' : '') + (pk && pk.o.date === st.today && pk.tables.indexOf(t.id) >= 0 ? ' picked' : '') + '" data-t="' + esc(t.id) + '" style="left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + t.h + 'px">'
        + '<span class="chairs ch-top">' + ch1 + '</span><span class="ft-box">' + inner + '</span><span class="chairs ch-bottom">' + ch1 + '</span>'
        + bubble + '<span class="ft-name">' + esc(t.name) + '</span></button>';
    }).join('');
    area.innerHTML = '<div class="floor-scale" style="width:' + (cw * scale) + 'px;height:' + (ch * scale) + 'px"><div class="floor-canvas" style="width:' + cw + 'px;height:' + ch + 'px;transform:scale(' + scale + ')">' + tiles + '</div></div>';
    renderSide(rows);
  }

  function renderSide(rows) {
    var list = rows.filter(function (r) { return !D.HIDDEN[r.status] && r.status !== ST.REQ; });
    var shown = list.filter(function (r) { return !(side.noWalk && r.route === '直接来店') && !(side.noCame && (r.status === ST.IN || r.status === ST.OUT)); });
    $('floor-tabs').innerHTML = '<button type="button" data-tab="seat" class="' + (side.tab === 'seat' ? 'on' : '') + '">席情報</button>'
      + '<button type="button" data-tab="today" class="' + (side.tab === 'today' ? 'on' : '') + '">今日の予約（' + list.filter(function (r) { return r.route !== '直接来店'; }).length + '）</button>';
    var h = '';
    if (side.tab === 'today') {
      h = '<div class="side-filter"><label><input type="checkbox" data-flt="noWalk"' + (side.noWalk ? ' checked' : '') + '>直接来店を除く</label>'
        + '<label><input type="checkbox" data-flt="noCame"' + (side.noCame ? ' checked' : '') + '>来店済みを除く</label></div>';
      var last = '';
      h += shown.length ? shown.map(function (r) {
        var head = r.start !== last ? '<p class="tl-time">' + esc(r.start) + '</p>' : '';
        last = r.start;
        return head + '<button type="button" class="tl" data-id="' + esc(r.id) + '">' + D.statusBadge(r.status)
          + '<span class="tl-name">' + esc(D.name(r)) + (r.name ? ' 様' : '') + '　' + r.people + '名 ' + D.icons(r) + '</span>'
          + '<span class="tl-sub">' + esc(r.start + '〜' + D.hm(D.span(r)[1])) + '　' + esc(r.tables.length ? D.tableNames(r.tables) : '未割り当て') + '</span></button>';
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
    if (tl) return D.openBooking(tl.dataset.id);
    var fb = e.target.closest('[data-f]');
    if (fb) {
      var now = D.nowMin();
      if (fb.dataset.f === 'tmp') return D.numpad({ x: e.clientX, y: e.clientY, date: st.today, start: D.hm(now - now % 5), tables: [], label: '臨時（席なし）' });
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

  D.views.floor = { render: render };
})();
