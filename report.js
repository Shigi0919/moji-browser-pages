/*
 * モジブラ「アプリの不具合を報告」の確認ページ（report.html / report-en.html 共通）。
 *
 * - アプリが URL の # 以降（r=<base64url の JSON>）に入れた報告データを、この端末の中だけで読む。
 *   # 以降はサーバーに送られないので、GitHub Pages には残らない。
 * - ページ内のホスト名は ⟦hN⟧ の記号になっている。「サイトのドメインを含める」が OFF なら
 *   「このサイト」「別サイトA」などに、ON なら実際の名前に置き換える。
 * - 利用者が「送信する」を押したときだけ、プレビューと同じ文字列を Google フォームへ送る。
 *
 * 送信先は下の FORM の 1 か所だけ（作り方: 本体リポジトリ docs/bug-report-google-form.md）。
 * いたずら送信が来たらフォームを作り直してここを差し替える（アプリの更新は不要）。
 */
(function () {
  'use strict';

  var FORM = {
    action: 'https://docs.google.com/forms/d/e/FORM_ID/formResponse',
    kind: 'entry.0',
    comment: 'entry.0',
    data: 'entry.0'
  };

  var LABELS = {
    ja: { thisSite: 'このサイト', thisSiteOther: 'このサイトの別ホスト', other: '別サイト' },
    en: { thisSite: 'this site', thisSiteOther: 'this site (other host)', other: 'other site ' }
  };
  var COMMENT_LIMIT = 1000;
  var TOKEN = /⟦h(\d+)⟧/g;

  /** URL の # 以降から報告データを読む。読めなければ null。 */
  function decodeFragment(hash) {
    if (typeof hash !== 'string') return null;
    var m = /^#?r=([A-Za-z0-9_-]+)$/.exec(hash);
    if (!m) return null;
    var b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var data;
    try {
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (e) {
      return null;
    }
    if (!data || typeof data !== 'object' || data.v !== 1) return null;
    if (data.entry !== 'menu' && data.entry !== 'settings') return null;
    if (data.hosts === undefined) data.hosts = [];
    if (!Array.isArray(data.hosts) || !data.hosts.every(function (h) { return typeof h === 'string'; })) return null;
    return data;
  }

  /** 主ドメイン（末尾 2 ラベル。co.jp のように末尾が 2 文字 + 2 文字以下なら 3 ラベル）。 */
  function baseDomain(host) {
    var h = String(host || '').toLowerCase();
    if (h.charAt(0) === '[') return h.replace(/:\d+$/, '');
    h = h.replace(/:\d+$/, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;
    var parts = h.split('.').filter(function (p) { return p; });
    if (parts.length <= 2) return parts.join('.');
    var last = parts[parts.length - 1], second = parts[parts.length - 2];
    var n = (last.length === 2 && second.length <= 2) ? 3 : 2;
    return parts.slice(-n).join('.');
  }

  function letter(n) {
    return n < 26 ? String.fromCharCode(65 + n) : String(n + 1);
  }

  /** hosts の各要素に対応する表示名。 */
  function hostLabels(hosts, includeDomains, lang) {
    if (includeDomains) return hosts.slice();
    var text = LABELS[lang] || LABELS.ja;
    var mine = baseDomain(hosts[0]);
    var letters = {}, count = 0;
    return hosts.map(function (host, i) {
      if (i === 0) return text.thisSite;
      var base = baseDomain(host);
      if (base === mine) return text.thisSiteOther;
      if (!(base in letters)) letters[base] = letter(count++);
      return text.other + letters[base];
    });
  }

  /** 送る文字列（プレビューにもこれをそのまま出す）。 */
  function render(payload, opts) {
    var hosts = Array.isArray(payload.hosts) ? payload.hosts : [];
    var labels = hostLabels(hosts, !!(opts && opts.includeDomains), (opts && opts.lang) || 'ja');
    function sub(s) {
      return s.replace(TOKEN, function (all, i) {
        i = Number(i);
        return i < labels.length ? labels[i] : '?';
      });
    }
    function walk(value) {
      if (typeof value === 'string') return sub(value);
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === 'object') {
        var out = {};
        Object.keys(value).forEach(function (k) { out[k] = walk(value[k]); });
        return out;
      }
      return value;
    }
    var copy = {};
    Object.keys(payload).forEach(function (k) {
      if (k !== 'hosts') copy[k] = walk(payload[k]);
    });
    return JSON.stringify(copy, null, 1);
  }

  window.MojibReport = { decodeFragment: decodeFragment, baseDomain: baseDomain, render: render };

  // ---- ここから画面 ----

  function $(id) { return document.getElementById(id); }

  function init() {
    var payload = decodeFragment(location.hash);
    if (!payload) {
      $('error').hidden = false;
      $('report').hidden = true;
      return;
    }
    $('error').hidden = true;
    $('report').hidden = false;

    var lang = document.documentElement.lang === 'en' ? 'en' : 'ja';
    var hasPage = !!payload.page && typeof payload.page === 'object';
    var form = window.MOJIB_FORM_OVERRIDE || FORM;
    var ready = form.action.indexOf('FORM_ID') < 0;
    var radios = document.querySelectorAll('input[name="kind"]');
    var initial = payload.entry === 'settings' ? 'other' : 'longpress';
    var current = '';

    Array.prototype.forEach.call(radios, function (r) {
      r.defaultChecked = (r.value === initial);
    });
    $('domains-row').hidden = !hasPage;
    $('note-nopage').hidden = !(payload.entry === 'menu' && !hasPage);
    $('note-partial').hidden = !(hasPage && payload.page.partial === true);
    $('note-trimmed').hidden = !(hasPage && payload.page.trimmed === true);
    $('comment').maxLength = COMMENT_LIMIT;
    $('send').disabled = !ready;
    $('status-notready').hidden = ready;

    function kind() {
      var checked = document.querySelector('input[name="kind"]:checked');
      return checked ? checked.value : initial;
    }
    function update() {
      current = render(payload, { includeDomains: hasPage && $('domains').checked, lang: lang });
      $('preview').textContent = current;
      $('hint-page').hidden = !(payload.entry === 'settings' && kind() !== 'other');
    }
    Array.prototype.forEach.call(radios, function (r) { r.addEventListener('change', update); });
    $('domains').addEventListener('change', update);
    update();

    $('send').addEventListener('click', function () {
      if (!ready) return;
      update();
      var post = document.createElement('form');
      post.method = 'POST';
      post.action = form.action;
      post.acceptCharset = 'UTF-8';
      post.hidden = true;
      [[form.kind, kind()], [form.comment, $('comment').value.slice(0, COMMENT_LIMIT)], [form.data, current]]
        .forEach(function (pair) {
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = pair[0];
          input.value = pair[1];
          post.appendChild(input);
        });
      document.body.appendChild(post);
      $('send').disabled = true;
      post.submit();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
