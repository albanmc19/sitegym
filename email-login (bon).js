/*
 * email-login.js — connexion par e-mail + mot de passe (alternative à Google)
 * ---------------------------------------------------------------------------
 * Fonctionne partout, y compris sur iPhone/iPad : aucune popup, aucune redirection.
 * À placer à côté de index.html, chargé avec : <script src="email-login.js"></script>
 *
 * Prérequis Firebase : Console → Authentication → Sign-in method →
 *   activer « E-mail/Mot de passe » (la case « Lien par e-mail » n'est pas nécessaire).
 * Si ce fichier est absent, index.html fonctionne comme avant (Google seul).
 */
(function () {
  'use strict';

  var MESSAGES = {
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/missing-email': 'Saisis ton adresse e-mail.',
    'auth/missing-password': 'Saisis ton mot de passe.',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'E-mail ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail. Connecte-toi (ou utilise « Mot de passe oublié »). Si tu t’es déjà connecté avec Google, utilise le bouton Google.',
    'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
    'auth/too-many-requests': 'Trop d’essais. Attends quelques minutes puis réessaie.',
    'auth/network-request-failed': 'Réseau indisponible. Réessaie.',
    'auth/operation-not-allowed': 'La connexion par e-mail n’est pas activée dans Firebase (Authentication → Sign-in method → E-mail/Mot de passe).'
  };
  function msg(e) { return MESSAGES[e && e.code] || ((e && e.code ? e.code + ' : ' : '') + (e && e.message || e)); }

  function build() {
    var box = document.createElement('div');
    box.id = 'emailbox';
    box.className = 'card';
    box.style.margin = '0 0 28px';
    box.innerHTML =
      '<div style="text-align:center" class="mute">ou avec une adresse e-mail</div>' +
      '<label for="em-mail">E-mail</label>' +
      '<input id="em-mail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="toi@exemple.com">' +
      '<label for="em-pass">Mot de passe</label>' +
      '<input id="em-pass" type="password" autocomplete="current-password" placeholder="6 caractères minimum">' +
      '<div id="em-name-wrap" hidden><label for="em-name">Prénom</label>' +
      '<input id="em-name" type="text" autocomplete="given-name" placeholder="Pour afficher ton nom"></div>' +
      '<p id="em-err" role="alert" style="color:#c0322b;font-weight:600;margin:10px 0 0" hidden></p>' +
      '<p id="em-ok" class="tag" style="margin:10px 0 0" hidden></p>' +
      '<p style="margin:14px 0 0"><button id="em-go" style="width:100%">Se connecter</button></p>' +
      '<p class="row" style="margin:6px 0 0">' +
      '<button class="link" id="em-mode" type="button">Créer un compte</button>' +
      '<button class="link" id="em-reset" type="button">Mot de passe oublié</button></p>';
    return box;
  }

  function wire(box) {
    var creating = false;
    var $ = function (s) { return box.querySelector(s); };
    var err = $('#em-err'), ok = $('#em-ok'), go = $('#em-go');

    function say(el, t) {
      err.hidden = true; ok.hidden = true;
      if (t) { el.textContent = t; el.hidden = false; }
    }
    function setMode(c) {
      creating = c;
      $('#em-name-wrap').hidden = !c;
      $('#em-pass').setAttribute('autocomplete', c ? 'new-password' : 'current-password');
      go.textContent = c ? 'Créer mon compte' : 'Se connecter';
      $('#em-mode').textContent = c ? 'J’ai déjà un compte' : 'Créer un compte';
      say(null, '');
    }
    $('#em-mode').onclick = function () { setMode(!creating); };

    $('#em-reset').onclick = function () {
      var mail = $('#em-mail').value.trim();
      if (!mail) return say(err, 'Saisis ton adresse e-mail ci-dessus, puis touche « Mot de passe oublié ».');
      firebase.auth().sendPasswordResetEmail(mail).then(
        function () { say(ok, 'E-mail envoyé. Vérifie ta boîte de réception (et les spams).'); },
        function (e) { say(err, msg(e)); }
      );
    };

    function submit() {
      var mail = $('#em-mail').value.trim(), pass = $('#em-pass').value;
      if (!mail) return say(err, MESSAGES['auth/missing-email']);
      if (!pass) return say(err, MESSAGES['auth/missing-password']);
      say(null, '');
      go.disabled = true;
      var auth = firebase.auth();
      var p;
      if (creating) {
        var name = $('#em-name').value.trim();
        p = auth.createUserWithEmailAndPassword(mail, pass).then(function (cred) {
          if (!name) return;
          // on enregistre le prénom puis on recharge pour l'afficher partout
          return cred.user.updateProfile({ displayName: name }).then(function () { location.reload(); });
        });
      } else {
        p = auth.signInWithEmailAndPassword(mail, pass);
      }
      p.then(null, function (e) { say(err, msg(e)); }).then(function () { go.disabled = false; });
    }
    go.onclick = submit;
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.target.id === 'em-mail' || e.target.id === 'em-pass' || e.target.id === 'em-name')) {
        e.preventDefault(); submit();
      }
    });
  }

  function enhance() {
    var anchor = document.querySelector('#app .fine');
    if (!anchor || document.getElementById('emailbox')) return;
    var box = build();
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    wire(box);
  }

  // Sécurité : un compte e-mail/mot de passe portant l'adresse admin mais non vérifié est refusé
  // (index.html reste inchangé ; la vraie protection est la règle Firestore email_verified).
  var ADMIN_EMAIL = 'albanmc573@gmail.com';
  try {
    firebase.auth().onAuthStateChanged(function (u) {
      if (u && !u.emailVerified && (u.email || '').toLowerCase() === ADMIN_EMAIL) {
        firebase.auth().signOut();
        alert('Cette adresse est réservée : connecte-toi avec le bouton Google.');
      }
    });
  } catch (e) {}

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
})();
