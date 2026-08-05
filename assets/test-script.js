/* スクリプトのブロック検証用。
   このファイルが実行できた＝ JavaScript はブロックされていない。 */
(function () {
  var box = document.getElementById("js-test");
  if (!box) return;
  box.className = "test-box ok";
  box.innerHTML =
    '<strong>✅ 外部スクリプトが実行されました</strong>' +
    '<span class="note">JavaScript のブロックは OFF です。</span>';
})();
