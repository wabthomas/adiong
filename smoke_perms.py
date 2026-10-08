# -*- coding: utf-8 -*-
# Smoke : permissions stats du tableau de bord + rattachement employé.
import json
import os
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



_SUPER_GATE = os.environ.get("E2E_GATE", "")
_ADMIN_TOKEN = {"t": ""}

def _admin_token():
    if not _ADMIN_TOKEN["t"]:
        s, ad = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!", "gate": _SUPER_GATE})
        if s == 200:
            _ADMIN_TOKEN["t"] = ad.get("token", "")
    return _ADMIN_TOKEN["t"]

def _gate_for(email):
    import re as _re
    if email == "admin@adiong.org" and _SUPER_GATE:
        return _SUPER_GATE
    tok = _admin_token()
    if not tok:
        return ""
    s2, users = req("/api/admin/users", token=tok)
    if s2 != 200 or not isinstance(users, list):
        return ""
    u = next((x for x in users if x.get("email") == email), None)
    if not u:
        return ""
    s3, lk = req("/api/admin/users/%s/login-link" % u["id"], body={"rotate": True}, token=tok)
    if s3 != 200:
        return ""
    m = _re.search(r"/e/([A-Za-z0-9_-]+)$", str(lk.get("url", "")))
    return m.group(1) if m else ""

s, d = req("/api/auth/login", body={"email": "admin@adiong.org", "password": "AdiOng2026!", "gate": _gate_for("admin@adiong.org")})
admin = d.get("token", "")
check("login super admin", s == 200 and bool(admin))

print("== Dashboard super admin (tout visible) ==")
s, d = req("/api/admin/dashboard", token=admin)
check("sections tous true", s == 200 and d.get("sections") == {"content": True, "donations": True, "inbox": True}, d.get("sections"))
check("données dons présentes", "donations_series" in d and "donations_total" in d)
check("données contenu présentes", "campaigns_progress" in d and "articles_by_category" in d)
check("données messages présentes", "messages_series" in d and "latest_messages" in d)

print("== Rôle viewer : aucune stat ==")
s, d = req("/api/admin/users", token=admin, body={"email": "viewer.e2e@adiong.org", "password": "E2ePassw0rd!", "full_name": "E2E Viewer", "role": "viewer"})
check("compte viewer créé", s in (200, 201), (s, d))
s, d = req("/api/auth/login", body={"email": "viewer.e2e@adiong.org", "password": "E2ePassw0rd!", "gate": _gate_for("viewer.e2e@adiong.org")})
check("login viewer", s == 200 and "token" in d, d)
viewer = d.get("token", "")
s, d = req("/api/admin/dashboard", token=viewer)
sec = d.get("sections", {})
def has_don(x): return "donations_series" in x or "donations_total" in x or "latest_donations" in x
def has_con(x): return "campaigns_progress" in x or "articles_by_category" in x or "articles" in x
def has_msg(x): return "messages_series" in x or "latest_messages" in x
check("viewer : sections cohérentes avec les données", s == 200
      and sec.get("donations") == has_don(d) and sec.get("content") == has_con(d) and sec.get("inbox") == has_msg(d),
      {"sections": sec, "don": has_don(d), "con": has_con(d), "msg": has_msg(d)})

print("== Ouverture fine : stats.donations au viewer ==")
s, d = req("/api/admin/permissions", token=admin, body={"matrix": {"viewer": {"stats.donations": True}}}, method="PUT")
check("matrice mise à jour", s == 200 and d.get("changed", 0) >= 1, (s, d))
s, d = req("/api/admin/dashboard", token=viewer)
sec2 = d.get("sections", {})
check("viewer : sections.donations true", sec2.get("donations") is True, sec2)
check("viewer : données dons maintenant présentes", "donations_series" in d and "donations_total" in d)
check("viewer : contenu toujours absent (pas de stats.content)", "campaigns_progress" not in d and "articles_by_category" not in d)
check("viewer : cohérence sections/données toujours respectée",
      sec2.get("donations") == has_don(d) and sec2.get("content") == has_con(d) and sec2.get("inbox") == has_msg(d))

print("== Rattachement employé ==")
s, d = req("/api/admin/grh/employees", token=admin, body={"full_name": "E2E Viewer", "email": "viewer.e2e@adiong.org", "phone": "+243 900 000 001", "position": "Comptable", "status": "actif"})
check("employé créé (même email que le compte)", s in (200, 201), (s, d))
s, d = req("/api/admin/users", token=admin)
me = next((u for u in d if u.get("email") == "viewer.e2e@adiong.org"), {})
check("liste users : employee_position renseigné", s == 200 and me.get("employee_position") == "Comptable", me)
s, d = req("/api/admin/employees-for-account?q=e2e", token=admin)
check("suggestions : employé actif trouvé", s == 200 and any(e.get("full_name") == "E2E Viewer" for e in d), d)
s, d = req("/api/admin/employees-for-account?q=inexistantxyz", token=admin)
check("suggestions : recherche sans résultat", s == 200 and d == [], d)
s, d = req("/api/admin/employees-for-account", token=viewer)
check("suggestions : refusée sans users.create", s == 403, (s, d))

print("== Nettoyage ==")
s, d = req("/api/admin/permissions", token=admin, body={"matrix": {"viewer": {"stats.donations": False}}}, method="PUT")
check("permission retirée", s == 200, (s, d))
s, d = req("/api/admin/dashboard", token=viewer)
check("viewer de nouveau sans stats dons", d.get("sections", {}).get("donations") is False)
s, d = req("/api/admin/grh/employees", token=admin)
rows = d if isinstance(d, list) else []
emp = next((e for e in rows if e.get("email") == "viewer.e2e@adiong.org"), None)
if emp:
    s, d = req("/api/admin/grh/employees/%d" % emp["id"], token=admin, method="DELETE")
    check("employé supprimé", s == 200, (s, d))
else:
    check("employé supprimé", False, "introuvable")
s, d = req("/api/admin/users", token=admin)
u = next((x for x in d if x.get("email") == "viewer.e2e@adiong.org"), None)
if u:
    s, d = req("/api/admin/users/%d" % u["id"], token=admin, method="DELETE")
    check("compte viewer supprimé", s == 200, (s, d))
else:
    check("compte viewer supprimé", False, "introuvable")

print()
print("==== RÉSULTAT : %d OK / %d KO ====" % (ok, ko))
raise SystemExit(1 if ko else 0)
