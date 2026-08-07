/* スクリプトのブロック検証用。
   このファイルが実行できた＝ JavaScript はブロックされていない。
   文言は言語ごとに #js-test の data 属性で渡す（日英で 1 ファイルを共用するため）。 */
(function () {
  var box = document.getElementById("js-test");
  if (!box) return;
  var title = box.getAttribute("data-ok-title") || "OK";
  var note = box.getAttribute("data-ok-note") || "";
  box.className = "test-box ok";
  box.innerHTML =
    '<strong>✅ ' + title + '</strong>' +
    '<span class="note">' + note + '</span>';
})();
