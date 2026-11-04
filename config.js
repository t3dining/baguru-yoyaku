/* 予約ボードの受け口の場所など。ホームページの 作る.py が書き出す js/config.js の写し
   ★公式アプリも https://t3dining.github.io/baguru-yoyaku/config.js を読む（js/data.js の SHOP.reserveBase）。予約ボードが t3dining-store に引っ越したあとも、
     前の場所にずっと置く（道具/公開する.py の OLD_KEEP）。消さない・名前と場所を変えない
   ★受け口のURLを変えたら、ここと ホームページの 作る.py の RESERVE_API の両方を直す */
window.BAGURU = {"reserveApi": "https://script.google.com/macros/s/AKfycbxhDQclu9UmX99MNbw0AqkvKgbHSshoReuPFzdCvo3fjWPHPdUzPxA-CAMQXVJm9qwZ/exec", "tel": "0565-85-7955"};
// この Mac の確認用の画面で、アドレスの最後に ?test を付けて開いたときは、にせの受け口（受け口/にせの受け口.py）につなぐ
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]test\b/.test(location.search)) window.BAGURU.reserveApi = '/api/reserve';
