/* ★一時的なもの（2026-11-01）。iPhone で、バグる Owner から開くと画面が上に寄るわけを、ko-dai さんの iPhone で測るための小さな窓。
 *  ・バグる Owner から開いたタブだけに出す（お店のタブレット・社員のスマホには出ない）
 *  ・出すのは画面の大きさの数字だけ。予約・お客さま・合言葉には触らない。どこにも送らない
 *  ・下のボタンは、そのタブの見え方を試しに変えるだけ（閉じて開き直すと元に戻る）
 *  ★わけが分かったら、このファイルと index.html の <script src="checkview.js"> の1行を消す */
(function () {
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  if (!/[?&]from=owner(&|$)/.test(location.search) && sget('baguru.yoyaku.owner') !== '1') return;

  /* ④を押したあと：時計の帯の設定を外してページを読む（この <script> は <head> の中なので、読み終わる前に外せる） */
  var meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  var noMeta = sget('baguru.yoyaku.check.nometa') === '1';
  if (noMeta && meta) meta.remove();

  var viewport = document.querySelector('meta[name="viewport"]');
  var fixedOn = false;
  var closed = false;

  function n(v) { return Math.round(v * 10) / 10; }

  function start() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;height:env(safe-area-inset-top)';
    var probeB = document.createElement('div');
    probeB.style.cssText = 'position:fixed;bottom:0;left:0;width:0;visibility:hidden;height:env(safe-area-inset-bottom)';
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:6px;right:6px;bottom:130px;z-index:99999;padding:7px 8px;border-radius:8px;'
      + 'background:rgba(0,0,0,.84);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all';
    var text = document.createElement('div');
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:6px';
    function btn(label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'flex:1 1 44%;min-height:34px;padding:2px 4px;font:700 12px/1.2 sans-serif;color:#111;background:#ffd966;border:0;border-radius:6px';
      b.addEventListener('click', function () { fn(); paint(); });
      row.appendChild(b);
    }
    btn('① 上へ戻す', function () { window.scrollTo(0, 0); });
    btn('② cover を外す', function () {
      viewport.setAttribute('content', viewport.getAttribute('content').replace(/,\s*viewport-fit=cover/, ''));
    });
    btn('③ 全体を固定', function () {
      fixedOn = !fixedOn;
      [document.documentElement, document.body].forEach(function (el) {
        el.style.position = fixedOn ? 'fixed' : '';
        el.style.inset = fixedOn ? '0' : '';
        el.style.overflow = fixedOn ? 'hidden' : '';
        el.style.width = fixedOn ? '100%' : '';
      });
    });
    btn(noMeta ? '④ 時計の設定を戻す' : '④ 時計の設定を外す', function () {
      sset('baguru.yoyaku.check.nometa', noMeta ? '0' : '1');
      location.reload();
    });
    btn('閉じる', function () { closed = true; });
    box.appendChild(text);
    box.appendChild(row);
    document.body.appendChild(probe);
    document.body.appendChild(probeB);
    document.body.appendChild(box);

    function paint() {
      // 合言葉の画面では隠す（「始める」のボタンに重なるため）
      var login = document.getElementById('login');
      box.style.display = closed || (login && !login.hidden) ? 'none' : '';
      var vv = window.visualViewport;
      var de = document.documentElement;
      var top = document.getElementById('top');
      var nav = document.querySelector('.bnav');
      var css = document.querySelector('link[href*="daicho.css"]');
      var st = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      text.textContent = [
        '版 ' + (css ? css.getAttribute('href').split('v=')[1] : '?'),
        'standalone=' + navigator.standalone + ' 時計の設定=' + (st ? st.content : 'なし'),
        'viewport=' + (/viewport-fit=cover/.test(viewport.getAttribute('content')) ? 'cover' : 'coverなし') + ' 固定=' + fixedOn,
        'screen ' + screen.width + 'x' + screen.height + ' inner ' + innerWidth + 'x' + innerHeight + ' outerH ' + outerHeight,
        'vv h=' + (vv ? n(vv.height) : '-') + ' top=' + (vv ? n(vv.offsetTop) : '-') + ' page=' + (vv ? n(vv.pageTop) : '-') + ' zoom=' + (vv ? n(vv.scale) : '-'),
        'scrollY=' + n(window.scrollY) + ' doc=' + de.clientHeight + '/' + de.scrollHeight + ' body=' + document.body.scrollHeight,
        'safe 上=' + n(probe.getBoundingClientRect().height) + ' 下=' + n(probeB.getBoundingClientRect().height),
        '帯の上=' + (top ? n(top.getBoundingClientRect().top) : '-') + ' 下の帯の下=' + (nav ? n(nav.getBoundingClientRect().bottom) : '-')
      ].join('\n');
    }
    paint();
    setInterval(paint, 500);
    ['resize', 'scroll', 'orientationchange'].forEach(function (ev) { window.addEventListener(ev, paint); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', paint);
      window.visualViewport.addEventListener('scroll', paint);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
