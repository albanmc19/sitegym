/*
 * ios-compat.js — mode compatibilité iPhone / iPad pour index.html
 * ---------------------------------------------------------------
 * À placer À CÔTÉ de index.html (même dossier du repo GitHub).
 * index.html le charge avec : <script src="ios-compat.js"></script>
 * (après les scripts Firebase, avant le script principal).
 *
 * Sur iPhone/iPad uniquement, il :
 *  1. force Firestore en "long polling" (évite la page blanche après la connexion) ;
 *  2. remplace le bouton Google par le bouton officiel Google (sans redirection) ;
 *  3. détecte les navigateurs intégrés (Snapchat, Instagram…) et invite à ouvrir Safari ;
 *  4. affiche "Chargement…" puis un message + bouton "Recharger" si la page reste vide.
 * Sur Android / ordinateur, il ne fait rien.
 * Si ce fichier est absent, index.html fonctionne comme avant.
 */
(function () {
  'use strict';

  // ID client Web OAuth (Firebase → Authentication → Google → Configuration du SDK Web)
  var CLIENT_ID = '548938318019-p57tpgdvkhfag4nsnin20q70uqios83g.apps.googleusercontent.com';

  var ua = navigator.userAgent || '';
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile
  var isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Plus jamais de page blanche (tous appareils) ---------------------------------------------
  function appEl() { return document.getElementById('app'); }

  function placeholder() {
    var a = appEl();
    if (a && !a.innerHTML.trim()) {
      a.innerHTML = '<p class="mute" data-wait="1" style="padding-top:20vh;text-align:center">Chargement…</p>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeholder);
  else placeholder();

  function stillWaiting() {
    var a = appEl();
    return !!a && (!a.innerHTML.trim() || !!a.querySelector('[data-wait]'));
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function watchdog() {
    if (!stillWaiting()) return;
    var loggedOut = false;
    try { loggedOut = (typeof user !== 'undefined' && !user); } catch (e) {}
    // Firebase n'a pas répondu : on affiche quand même l'écran de connexion
    if (loggedOut && typeof route === 'function') { try { route(); return; } catch (e) {} }
    var fbLoaded = typeof window.firebase !== 'undefined';
    var who = '';
    try { who = (typeof user !== 'undefined' && user) ? user.email : 'non connecté'; } catch (e) {}
    var a = appEl();
    a.innerHTML = '<div class="card"><b>La page ne répond pas.</b>' +
      '<p class="mute" style="margin:6px 0 10px">Vérifie ta connexion internet, puis recharge. Si ça recommence, envoie une capture de ce message.</p>' +
      '<p class="mute" style="font-size:13px;margin:0 0 12px;overflow-wrap:anywhere">' +
      'Adresse : ' + esc(location.origin) + '<br>' +
      'Firebase chargé : ' + (fbLoaded ? 'oui' : 'NON (script bloqué)') + '<br>' +
      'Compte : ' + esc(who) + '<br>' +
      'Appareil : ' + (isIOS ? 'iPhone/iPad' : 'autre') + '</p>' +
      '<button id="compat-reload" style="width:100%">Recharger</button></div>';
    document.getElementById('compat-reload').onclick = function () { location.reload(); };
  }
  setTimeout(watchdog, 6000);
  setTimeout(watchdog, 14000);

  if (!isIOS) return;

  var inApp = /Snapchat|Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|musical_ly|BytedanceWebview|MicroMessenger|Line\/|Twitter|LinkedInApp|Pinterest|GSA\/[\d.]+/i.test(ua);
  window.IOS_COMPAT = true;

  // 1. Firestore en long polling (appliqué dès l'initialisation de Firebase) ---------------
  try {
    if (window.firebase && firebase.initializeApp) {
      var origInit = firebase.initializeApp;
      firebase.initializeApp = function () {
        var appInstance = origInit.apply(this, arguments);
        try { firebase.firestore().settings({ experimentalForceLongPolling: true }); } catch (e) {}
        return appInstance;
      };
    }
  } catch (e) {}

  // La redirection Google échoue sur iOS (stockage partitionné) : on l'évite
  try {
    if (window.firebase && firebase.auth && firebase.auth.Auth) {
      firebase.auth.Auth.prototype.signInWithRedirect = function () {
        alert('Connexion Google bloquée par le navigateur. Autorise les pop-ups pour ce site (Réglages → Safari) ou ouvre le lien dans Safari.');
        return Promise.resolve();
      };
    }
  } catch (e) {}

  // 2 & 3. Bouton Google officiel / bandeau navigateur intégré ------------------------------
  function copyLink() {
    var u = location.href.split('#')[0];
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(u).then(
        function () { alert('Lien copié. Ouvre Safari et colle-le dans la barre d’adresse.'); },
        function () { prompt('Copie ce lien puis ouvre-le dans Safari :', u); }
      );
    } else {
      prompt('Copie ce lien puis ouvre-le dans Safari :', u);
    }
  }

  function showInAppBanner(btn) {
    var box = document.createElement('div');
    box.className = 'card';
    box.style.borderLeft = '4px solid #d92d20';
    box.innerHTML = '<b>Ouvre ce site dans Safari</b>' +
      '<p class="mute" style="margin:6px 0 10px">La connexion Google ne fonctionne pas dans le navigateur intégré de cette application (Snapchat, Instagram…). Copie le lien, puis colle-le dans Safari.</p>' +
      '<button class="alt" style="width:100%">Copier le lien</button>';
    box.querySelector('button').onclick = copyLink;
    btn.parentNode.insertBefore(box, btn);
    btn.style.display = 'none';
  }

  function renderGoogleButton(btn) {
    var box = document.createElement('div');
    box.style.cssText = 'display:none;justify-content:center;min-height:56px';
    btn.parentNode.insertBefore(box, btn.nextSibling);

    function start() {
      try {
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: function (r) {
            firebase.auth()
              .signInWithCredential(firebase.auth.GoogleAuthProvider.credential(r.credential))
              .catch(function (e) { alert(e.message); });
          }
        });
        btn.style.display = 'none';
        box.style.display = 'flex';
        google.accounts.id.renderButton(box, {
          type: 'standard', theme: 'outline', size: 'large',
          text: 'continue_with', locale: 'fr',
          width: Math.min(box.clientWidth || 320, 400)
        });
      } catch (e) { /* on garde le bouton d'origine */ }
    }

    if (window.google && google.accounts) return start();
    var sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client';
    sc.async = true;
    sc.onload = start;
    document.head.appendChild(sc);
  }

  function enhance() {
    var btn = document.getElementById('g');
    if (!btn || btn.getAttribute('data-compat')) return;
    btn.setAttribute('data-compat', '1');
    if (inApp) showInAppBanner(btn);
    else if (CLIENT_ID) renderGoogleButton(btn);
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });

})();
