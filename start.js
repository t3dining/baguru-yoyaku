/* 予約ボードを動かしはじめる：合言葉・メニュー・日付の切りかえ・音・ログアウト（いちばん最後に読む） */
(function () {
  'use strict';
  var D = window.D, esc = D.esc, st = D.st, $ = D.$;

  /* スマホの「その他」 */
  D.views.more = {
    render: function () {
      $('v-more').innerHTML = '<div class="more">'
        + '<button type="button" class="more-i" data-go="customers"><svg class="i"><use href="#i-user"/></svg>顧客台帳</button>'
        + '<button type="button" class="more-i" data-go="settings"><svg class="i"><use href="#i-gear"/></svg>設定</button>'
        + '<button type="button" class="more-i" data-go="sound"><svg class="i"><use href="#i-bell"/></svg>' + (st.sound ? '音 オン（押すと消す）' : '音 オフ（押すと鳴らす）') + '</button>'
        + '<button type="button" class="more-i" data-go="logout"><svg class="i"><use href="#i-out"/></svg>ログアウト</button>'
        + '<p class="muted">' + esc($('sync').textContent) + '</p></div>';
    }
  };
  var more = document.createElement('section');
  more.className = 'view'; more.id = 'v-more'; more.dataset.view = 'more'; more.hidden = true;
  document.querySelector('.main').appendChild(more);
  more.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    if (b.dataset.go === 'sound') { $('b-sound').click(); return D.views.more.render(); }
    if (b.dataset.go === 'logout') return $('b-logout').click();
    D.show(b.dataset.go);
  });

  /* メニュー */
  document.querySelectorAll('.nav[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { D.closeNumpad(); D.show(b.dataset.view); });
  });

  /* 日付 */
  $('d-prev').addEventListener('click', function () { D.goDate(D.addDays(st.date, -1)); });
  $('d-next').addEventListener('click', function () { D.goDate(D.addDays(st.date, 1)); });
  $('d-today').addEventListener('click', function () { D.goDate(st.today); });
  $('d-input').addEventListener('change', function () { if (this.value) D.goDate(this.value); });
  $('b-add').addEventListener('click', function () { D.closeNumpad(); D.openRegister({ date: st.view === 'schedule' ? st.date : st.today }); });
  $('newbar-go').addEventListener('click', function () { D.show('requests'); });

  /* 音（ブラウザの決まりで、一度押さないと鳴らない） */
  function paintSound() {
    var b = $('b-sound');
    b.querySelector('span').textContent = st.sound ? '音 オン' : '音 オフ';
    b.setAttribute('aria-pressed', st.sound ? 'true' : 'false');
    b.classList.toggle('on', st.sound);
  }
  $('b-sound').addEventListener('click', function () {
    st.sound = !st.sound; D.set(D.KEY.sound, st.sound ? '1' : '0'); paintSound();
    if (st.sound) D.beep();
  });
  /* 更新（上の帯の右）：ページごと読み直す（公開し直した新しい画面も、いまの予約も入る。合言葉はそのまま）。
     ホーム画面に置いたときは、ブラウザの読み直しのボタンが無いので */
  $('b-reload').addEventListener('click', function () {
    if ($('sheet').hidden) return location.reload();
    D.ask({ title: '画面を更新します', text: '入れている途中の予約登録は消えます。', ok: '更新する' })
      .then(function (y) { if (y) location.reload(); });
  });
  $('b-logout').addEventListener('click', function () {
    D.ask({ title: 'ログアウトします', text: 'この端末から合言葉を消します。もう一度使うときは、合言葉を入れ直します。', ok: 'ログアウト', danger: true })
      .then(function (y) { if (y) D.logout(''); });
  });

  /* 合言葉 */
  function showApp() {
    $('login').hidden = true; $('app').hidden = false; $('bnav').hidden = false;
    paintSound();
    $('sync').textContent = '読み込んでいます…';
    D.load().then(D.startPolling);
  }
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var pin = $('pin').value.trim(), m = $('login-err');
    if (!pin) return;
    m.hidden = true;
    D.A.post({ action: 'ping', pin: pin }).then(function () {
      st.pin = pin; D.set(D.KEY.pin, pin); $('pin').value = '';
      showApp();
    }).catch(function (e2) { m.textContent = D.errText(e2); m.hidden = false; });
  });

  if (!D.A.ready()) { $('login').hidden = false; var m0 = $('login-err'); m0.textContent = D.ERR.not_ready; m0.hidden = false; return; }
  if (st.pin) showApp(); else $('login').hidden = false;
})();
