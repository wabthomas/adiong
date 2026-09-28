# -*- coding: utf-8 -*-
# Smoke test 2FA : armement TOTP, login à 2 étapes, codes de secours, bascule globale.
import base64
import hashlib
import hmac
import json
import struct
import time
import urllib.request

BASE = "http://localhost:4000"
ok = 0
ko = 0


def check(label, cond, extra=""):
    global ok, ko
    if cond:
        ok += 1
        print("  OK  " + label)
    else:
        ko += 1
        print("  KO  " + label + ("   [" + str(extra) + "]" if extra else ""))


def req(path, token=None, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method or ("POST" if data else "GET"))
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


# --- TOTP côté test (RFC 6238, SHA1, 6 chiffres) ---
def b32decode(s):
    alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    bits = 0
    value = 0
    out = bytearray()
    for ch in s.upper().replace("=", ""):
        value = (value << 5) | alpha.index(ch)
        bits += 5
        if bits >= 8:
            out.append((value >> (bits - 8)) & 255)
            bits -= 8
    return bytes(out)


def totp(secret, offset=0):
    counter = int(time.time() // 30) + offset
    h = hmac.new(b32decode(secret), struct.pack(">Q", counter), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    code = ((h[o] & 0x7F) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
    return str(code % 1000000).zfill(6)


# Remise à zéro (ré-exécutions) : état 2FA admin + comptes résidus.
import sqlite3, glob
_dbfile = glob.glob("server/data/*.db")
if _dbfile:
    _c = sqlite3.connect(_dbfile[0])
    _c.execute("UPDATE users SET totp_enabled = 0, totp_secret = '', totp_backup_codes = '' WHERE email = 'admin@adiong.org'")
    _c.execute("DELETE FROM settings WHERE key = 'two_fa_required'")
    _c.execute("DELETE FROM email_2fa_codes")
    _c.execute("DELETE FROM users WHERE email = 'redactrice.e2e@adiong.org'")
    _c.commit()
    _c.close()

print("== 2FA hors service : connexion directe ==")
s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!"})
if s == 429:
    print("  ! rate-limit de connexion actif — redémarrez l'API puis relancez le test")
    raise SystemExit(2)
check("login simple OK", s == 200 and "token" in d and not d.get("requires_2fa"), d)
admin = d.get("token", "")

s, d = req("/api/auth/totp/status", token=admin)
check("statut initial : inactive, non exigée", s == 200 and d["totp_enrolled"] is False and d["two_fa_required"] is False, d)

print("== Armement TOTP (session normale) ==")
s, d = req("/api/auth/totp/setup", token=admin, body={})
check("setup : secret + QR", s == 200 and len(d.get("secret", "")) >= 16 and d.get("qr", "").startswith("data:image/png"), d.get("qr", "")[:30])
secret = d.get("secret", "")

s, d = req("/api/auth/totp/confirm", token=admin, body={"secret": secret, "code": "000000"})
check("confirm code faux : 400", s == 400, d)

s, d = req("/api/auth/totp/confirm", token=admin, body={"secret": secret, "code": totp(secret)})
check("confirm code valide : 10 codes de secours", s == 200 and len(d.get("backup_codes", [])) == 10, d)
backup_codes = d.get("backup_codes", [])

s, d = req("/api/auth/totp/status", token=admin)
check("statut : active, 10 restants", s == 200 and d["totp_enrolled"] is True and d["backup_remaining"] == 10, d)

print("== Login à 2 étapes ==")
s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!"})
check("login : requires_2fa + jeton temporaire", s == 200 and d.get("requires_2fa") and d.get("pending_token") and d.get("totp_enrolled") is True, d)
pending = d.get("pending_token", "")

s, d = req("/api/admin/articles", token=pending)
check("jeton en attente refusé sur route admin", s == 401, d)

s, d = req("/api/auth/me", token=pending)
check("jeton en attente accepté sur /me", s == 200, d)

s, d = req("/api/auth/2fa/verify", body={"pending_token": pending, "code": "000000"})
check("verify code faux : 400", s == 400, d)

s, d = req("/api/auth/2fa/verify", body={"pending_token": pending, "code": totp(secret)})
check("verify code TOTP : vrai jeton", s == 200 and "token" in d, d)
admin2 = d.get("token", "")
s, d = req("/api/admin/articles", token=admin2)
check("vrai jeton : accès admin OK", s == 200, d)

print("== Code de secours ==")
s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!"})
pending = d.get("pending_token", "")
s, d = req("/api/auth/2fa/verify", body={"pending_token": pending, "code": backup_codes[0]})
check("verify code de secours : OK", s == 200 and "token" in d, d)
admin3 = d.get("token", "")

s, d = req("/api/auth/totp/status", token=admin3)
check("reste 9 codes de secours", s == 200 and d["backup_remaining"] == 9, d)

s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!"})
pending = d.get("pending_token", "")
s, d = req("/api/auth/2fa/verify", body={"pending_token": pending, "code": backup_codes[0]})
check("code de secours déjà utilisé : refusé", s == 400, d)

print("== Bascule globale (super admin) ==")
s, d = req("/api/admin/security/two-fa", token=admin3)
check("état global : optionnelle, 1 armé", s == 200 and d["two_fa_required"] is False and d["enrolled"] == 1, d)

s, d = req("/api/admin/security/two-fa", token=admin3, body={"required": True}, method="PUT")
check("activation globale", s == 200 and d["two_fa_required"] is True, d)

# 2ᵉ compte sans 2FA → armement forcé à la connexion
s, d = req("/api/admin/users", token=admin3, body={"email": "redactrice.e2e@adiong.org", "password": "E2ePassw0rd!", "full_name": "E2E Rédactrice", "role": "editor"})
if s in (200, 201):
    check("compte test créé", True)
    s, d = req("/api/auth/login", body={"email": "redactrice.e2e@adiong.org", "password": "E2ePassw0rd!"})
    check("2ᵉ compte : 2FA exigée, non armé", s == 200 and d.get("requires_2fa") and d.get("totp_enrolled") is False and d.get("email_2fa_available") is False, d)
    pending2 = d.get("pending_token", "")

    s, d = req("/api/auth/2fa/email", token=pending2, body={})
    check("code email sans SMTP : 503 explicite", s == 503, d)

    s, d = req("/api/auth/totp/setup", token=pending2, body={})
    check("armement depuis l'écran de login (setup)", s == 200 and d.get("secret"), d.get("qr", "")[:30])
    secret2 = d.get("secret", "")
    s, d = req("/api/auth/totp/confirm", token=pending2, body={"secret": secret2, "code": totp(secret2)})
    check("armement depuis l'écran de login (confirm)", s == 200 and len(d.get("backup_codes", [])) == 10, d)
    s, d = req("/api/auth/2fa/verify", body={"pending_token": pending2, "code": totp(secret2)})
    check("2ᵉ compte connecté après armement", s == 200 and "token" in d, d)
    editor = d.get("token", "")

    s, d = req("/api/auth/me", token=editor)
    check("jeton 2FA du 2ᵉ compte : /me OK", s == 200 and d.get("email") == "redactrice.e2e@adiong.org", d)

    s, d = req("/api/admin/users", token=editor, body={})
    check("2ᵉ compte (editor) : route super refusée", s == 403, d)
else:
    check("compte test créé", False, (s, d))

print("== Régénération + désactivation ==")
s, d = req("/api/auth/totp/backup-codes/regenerate", token=admin3, body={})
check("régénération : 10 nouveaux codes", s == 200 and len(d.get("backup_codes", [])) == 10, d)
new_codes = d.get("backup_codes", [])

s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!"})
pending = d.get("pending_token", "")
s, d = req("/api/auth/2fa/verify", body={"pending_token": pending, "code": new_codes[3]})
check("nouveau code de secours accepté", s == 200 and "token" in d, d)
admin4 = d.get("token", "")

s, d = req("/api/auth/totp", token=admin4, method="DELETE")
check("désactivation 2FA admin", s == 200, d)
s, d = req("/api/auth/totp/status", token=admin4)
check("statut : de nouveau inactive", s == 200 and d["totp_enrolled"] is False, d)

print("== Retirer l'obligation ==")
s, d = req("/api/admin/security/two-fa", token=admin4, body={"required": False}, method="PUT")
check("désactivation globale", s == 200 and d["two_fa_required"] is False, d)
s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!"})
check("login admin de nouveau direct", s == 200 and "token" in d and not d.get("requires_2fa"), d)

print("== Journal de sécurité ==")
s, d = req("/api/admin/security", token=admin4)
events = [e.get("type") for e in (d if isinstance(d, list) else d.get("events", []))]
for wanted in ("login_2fa", "2fa_ok", "2fa_fail", "totp_enrolled", "totp_disabled", "two_fa_required_on", "two_fa_required_off"):
    check("événement " + wanted, wanted in events)

print("== Nettoyage ==")
s, d = req("/api/admin/users", token=admin4)
users = d if isinstance(d, list) else d.get("users", [])
target = next((u for u in users if u.get("email") == "redactrice.e2e@adiong.org"), None)
if target:
    s, d = req("/api/admin/users/%d" % target["id"], token=admin4, method="DELETE")
    check("compte test supprimé", s == 200, d)
else:
    check("compte test supprimé", False, "introuvable")

print()
print("==== RÉSULTAT : %d OK / %d KO ====" % (ok, ko))
raise SystemExit(1 if ko else 0)
