#!/usr/bin/env python3
# Test E2E « contenu + comptes » : causes, collectes, partenaires, dons (preuve,
# confirmation, intégration comptable SYCEBNL), invitations + inscription,
# mot de passe, déconnexion, cartes membres, gestion des utilisateurs.
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.request

BASE = "http://localhost:4000"
DB_FILE = "/home/user/adiong/server/data/adiong.db"
OK = 0
KO = 0
FAILS = []

PDF_BYTES = (
    b"%PDF-1.7\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)


def check(name, cond, extra=""):
    global OK, KO
    if cond:
        OK += 1
        print(f"  OK   {name}")
    else:
        KO += 1
        FAILS.append(name + (f" — {extra}" if extra else ""))
        print(f"  KO   {name} {extra}")


def call(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            ctype = r.headers.get("Content-Type", "")
            raw = r.read()
            if "pdf" in ctype:
                return r.status, {"raw": f"pdf {len(raw)} bytes"}
            raw = raw.decode("utf-8-sig", errors="replace")
            if "json" in ctype or raw.lstrip()[:1] in "{[":
                return r.status, (json.loads(raw) if raw else {})
            return r.status, {"raw": raw[:300]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8-sig", errors="replace")
        try:
            return e.code, (json.loads(raw) if raw else {"raw": raw[:200]})
        except Exception:
            return e.code, {"raw": raw[:200]}


def call_multipart(method, path, fields, file_field, filename, content, mime, token=None):
    boundary = "----e2e" + str(int(time.time() * 1000))
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    if file_field:
        parts.append(
            (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\n"
             f"Content-Type: {mime}\r\n\r\n").encode() + content + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(BASE + path, data=b"".join(parts), method=method)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8-sig", errors="replace")
            return r.status, (json.loads(raw) if raw.lstrip()[:1] in "{[" else {"raw": raw[:300]})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8-sig", errors="replace")
        try:
            return e.code, (json.loads(raw) if raw else {"raw": raw[:200]})
        except Exception:
            return e.code, {"raw": raw[:200]}


def main():
    global OK, KO
    stamp = str(int(time.time()))[-6:]
    PASS = "E2Ecompte123!"
    emailR = f"e2e.redac.{stamp}@adiong.org"
    emailA = f"e2e.adm.{stamp}@adiong.org"
    emailReg = f"e2e.reg.{stamp}@adiong.org"

    print("== Setup ==")
    s, b = call("POST", "/api/auth/login", {"email": "admin@adiong.org", "password": "AdiOng2026!"})
    check("login super admin", s == 200 and b.get("token"), f"status={s}")
    T = b.get("token")
    s, uR = call("POST", "/api/admin/users", {"email": emailR, "password": PASS, "full_name": "Rédacteur E2E", "role": "editor"}, token=T)
    check("utilisateur R (editor)", s in (200, 201) and uR.get("id"), f"status={s} {uR}")
    idR = uR.get("id")
    s, uA = call("POST", "/api/admin/users", {"email": emailA, "password": PASS, "full_name": "Adjoint E2E", "role": "admin"}, token=T)
    check("utilisateur A (admin)", s in (200, 201) and uA.get("id"), f"status={s} {uA}")
    idA = uA.get("id")
    s, b = call("POST", "/api/auth/login", {"email": emailR, "password": PASS})
    TR = b.get("token")
    s, b = call("POST", "/api/auth/login", {"email": emailA, "password": PASS})
    TA = b.get("token")
    check("logins R et A", bool(TR and TA))

    cause_id = camp_id = partner_id = None
    don_camp_id = don_gen_id = invite_id = idReg = None
    reg_token = None
    reg_new_pass = "E2Ecompte456!"
    reg_limited = False

    try:
        print("== Contenu : causes ==")
        s, cause = call("POST", "/api/admin/causes", {"title": f"Cause E2E {stamp}", "tagline": "cause de test", "description": "Description"}, token=T)
        check("cause créée (slug auto)", s in (200, 201) and cause.get("id") and bool(cause.get("slug")), f"status={s} {cause}")
        cause_id = cause.get("id")
        s, _ = call("POST", "/api/admin/causes", {"title": ""}, token=T)
        check("cause sans titre (400)", s == 400, f"status={s}")
        s, pubs = call("GET", "/api/public/causes")
        check("cause visible publiquement", s == 200 and any(c.get("id") == cause_id for c in pubs), f"status={s}")
        s, adm = call("GET", "/api/admin/causes", token=T)
        check("cause listée côté admin", s == 200 and any(c.get("id") == cause_id for c in adm), f"status={s}")
        s, _ = call("PUT", f"/api/admin/causes/{cause_id}", {"title": f"Cause E2E {stamp} (modif)", "tagline": "cause de test", "description": "Description", "published": True}, token=T)
        check("cause modifiée", s == 200, f"status={s}")
        s, _ = call("PUT", f"/api/admin/causes/{cause_id}", {"title": f"Cause E2E {stamp} (modif)", "published": False}, token=T)
        s, pubs2 = call("GET", "/api/public/causes")
        check("cause non publiée masquée publiquement", s == 200 and not any(c.get("id") == cause_id for c in pubs2), f"status={s}")
        s, _ = call("DELETE", f"/api/admin/causes/{cause_id}", token=T)
        check("cause supprimée", s == 200, f"status={s}")

        print("== Contenu : collectes ==")
        s, camp = call("POST", "/api/admin/campaigns", {"title": f"Collecte E2E {stamp}", "description": "collecte de test", "goal_amount": 1000, "deadline": "2026-12-31"}, token=T)
        check("collecte créée", s in (200, 201) and camp.get("id") and camp.get("collected_amount") == 0, f"status={s} {camp}")
        camp_id = camp.get("id")
        camp_slug = camp.get("slug")
        s, _ = call("POST", "/api/admin/campaigns", {"title": ""}, token=T)
        check("collecte sans titre (400)", s == 400, f"status={s}")
        s, pcamps = call("GET", "/api/public/campaigns")
        pcamp = next((c for c in pcamps if c.get("slug") == camp_slug), None) if isinstance(pcamps, list) else None
        check("collecte visible publiquement (slug)", bool(pcamp) and pcamp.get("goal_amount") == 1000, f"status={s}")
        s, _ = call("GET", f"/api/public/campaigns/{camp_slug}")
        check("collecte par slug", s == 200, f"status={s}")
        s, camp2 = call("PUT", f"/api/admin/campaigns/{camp_id}", {"title": f"Collecte E2E {stamp}", "goal_amount": 2000, "deadline": "2026-12-31", "published": True}, token=T)
        check("objectif modifié", s == 200 and camp2.get("goal_amount") == 2000, f"status={s}")
        camp_slug = camp2.get("slug") or camp_slug

        print("== Contenu : partenaires ==")
        s, part = call("POST", "/api/admin/partners", {"name": f"Partenaire E2E {stamp}", "logo": "/uploads/logos/partenaire-e2e.png", "link": "https://exemple.org"}, token=T)
        check("partenaire créé", s in (200, 201) and part.get("id"), f"status={s} {part}")
        partner_id = part.get("id")
        s, _ = call("POST", "/api/admin/partners", {"name": "Sans logo"}, token=T)
        check("partenaire sans logo (400)", s == 400, f"status={s}")
        s, pparts = call("GET", "/api/public/partners")
        check("partenaire visible publiquement", s == 200 and any(p.get("id") == partner_id for p in pparts), f"status={s}")
        s, _ = call("PUT", f"/api/admin/partners/{partner_id}", {"name": f"Partenaire E2E {stamp} (modif)"}, token=T)
        check("partenaire modifié", s == 200, f"status={s}")
        s, _ = call("PUT", "/api/admin/partners/999999", {"name": "X"}, token=T)
        check("partenaire inconnu (404)", s == 404, f"status={s}")

        print("== Dons (preuve + confirmation) ==")
        s, don = call("POST", "/api/donate", {"name": f"Donateur E2E {stamp}", "email": f"don{stamp}@exemple.org", "amount": 25, "method": "mobile", "campaignId": camp_id})
        check("don public à la collecte", s == 200 and bool(don.get("reference")), f"status={s} {don}")
        dref = don.get("reference", "")
        don_camp_id = don.get("id")
        s, _ = call_multipart("POST", "/api/donations/proof", {"reference": "REF-0000"}, "file", "preuve.pdf", PDF_BYTES, "application/pdf")
        check("preuve référence inconnue (404)", s == 404, f"status={s}")
        s, _ = call_multipart("POST", "/api/donations/proof", {"reference": dref}, None, None, None, None)
        check("preuve sans fichier (400)", s == 400, f"status={s}")
        s, _ = call_multipart("POST", "/api/donations/proof", {"reference": dref, "tx_ref": f"TX-E2E-{stamp}"}, "file", "preuve.pdf", PDF_BYTES, "application/pdf")
        check("preuve de paiement jointe", s == 200, f"status={s}")
        s, dons = call("GET", "/api/admin/donations", token=T)
        dcamp = next((d for d in dons if d.get("reference") == dref), {}) if isinstance(dons, list) else {}
        check("preuve visible côté admin", s == 200 and dcamp.get("status") == "preuve" and dcamp.get("tx_ref") == f"TX-E2E-{stamp}", f"status={s} {dcamp.get('status')}")
        s, _ = call("GET", f"/api/admin/donations/{dcamp.get('id')}/proof", token=T)
        check("preuve téléchargeable (admin)", s == 200, f"status={s}")
        s, _ = call("PUT", f"/api/admin/donations/{dcamp.get('id')}", {"status": "confirmee"}, token=T)
        check("don confirmé", s == 200, f"status={s}")
        s, pcamps2 = call("GET", "/api/public/campaigns")
        pcamp2 = next((c for c in pcamps2 if c.get("slug") == camp_slug), {}) if isinstance(pcamps2, list) else {}
        check("montant collecté mis à jour (25)", pcamp2.get("collected_amount") == 25, f"collected={pcamp2.get('collected_amount')}")
        s, entries = call("GET", "/api/admin/compta/entries?q=Don", token=T)
        pe = next((x for x in entries if isinstance(x, dict) and x.get("source_id") == dcamp.get("id")), None) if isinstance(entries, list) else None
        check("don confirmé → écriture SYCEBNL (BQ, 2 lignes)", bool(pe) and pe.get("journal_code") == "BQ" and pe.get("line_count") == 2, f"status={s} {pe and pe.get('label')}")
        s, _ = call("PUT", f"/api/admin/donations/{dcamp.get('id')}", {"status": "nouvelle"}, token=T)
        check("don re-passé en nouvelle", s == 200, f"status={s}")
        s, pcamps3 = call("GET", "/api/public/campaigns")
        pcamp3 = next((c for c in pcamps3 if c.get("slug") == camp_slug), {}) if isinstance(pcamps3, list) else {}
        check("montant collecté remis à 0", pcamp3.get("collected_amount") == 0, f"collected={pcamp3.get('collected_amount')}")
        s, entries2 = call("GET", "/api/admin/compta/entries?q=Don", token=T)
        pe2 = next((x for x in entries2 if isinstance(x, dict) and x.get("source_id") == dcamp.get("id")), None) if isinstance(entries2, list) else None
        check("écriture SYCEBNL supprimée", pe2 is None, f"trouvé={bool(pe2)}")
        s, don2 = call("POST", "/api/donate", {"name": f"Donateur E2E {stamp}", "amount": 15, "method": "carte", "anonymous": False})
        check("don public fonds général", s == 200 and bool(don2.get("reference")), f"status={s}")
        s, dons2 = call("GET", "/api/admin/donations", token=T)
        dgen = next((d for d in dons2 if d.get("reference") == don2.get("reference")), {}) if isinstance(dons2, list) else {}
        don_gen_id = dgen.get("id")
        s, _ = call("DELETE", f"/api/admin/donations/{don_gen_id}", token=T)
        check("don fonds général supprimé", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/donations/{dcamp.get('id')}", token=T)
        check("don collecte supprimé (preuve déliée)", s == 200, f"status={s}")

        print("== Invitations & inscription ==")
        s, inv = call("POST", "/api/admin/invites", {"email": emailReg, "role": "editor", "label": f"Invitation E2E {stamp}"}, token=T)
        check("invitation créée (token)", s in (200, 201) and bool(inv.get("token")) and inv.get("state") == "available", f"status={s} {inv}")
        invite_id = inv.get("id")
        reg_token = inv.get("token")
        s, _ = call("POST", "/api/admin/invites", {"role": "super_admin"}, token=T)
        check("invitation super_admin refusée (400)", s == 400, f"status={s}")
        s, _ = call("POST", "/api/admin/invites", {"email": emailR, "role": "editor"}, token=T)
        check("invitation email existant (409)", s == 409, f"status={s}")
        s, val = call("GET", f"/api/register/validate?token={reg_token}")
        check("lien de validation (rôle + expiration)", s == 200 and val.get("valid") is True and val.get("role") == "editor", f"status={s} {val}")
        s, val2 = call("GET", "/api/register/validate?token=token-inconnu")
        check("lien inconnu invalide", s == 200 and val2.get("valid") is False, f"status={s}")
        REG_NOTE = "limiteur d'inscription (10/h/IP) atteint — relancer après un redémarrage de l'API"

        def reg_check(name, body, expect):
            nonlocal reg_limited
            if reg_limited:
                print(f"  SKIP {name} — {REG_NOTE}")
                return
            s, _ = call("POST", "/api/register", body)
            if s == 429:
                reg_limited = True
                print(f"  SKIP {name} — {REG_NOTE}")
                return
            check(name, s == expect, f"status={s}")
        reg_check("inscription token invalide (400)", {"token": "token-inconnu", "full_name": "X", "email": emailReg, "password": PASS}, 400)
        reg_check("inscription mot de passe court (400)", {"token": reg_token, "full_name": "X", "email": emailReg, "password": "court"}, 400)
        reg_check("inscription email réservé (409)", {"token": reg_token, "full_name": "X", "email": "autre@exemple.org", "password": PASS}, 409)
        if reg_limited:
            print(f"  SKIP inscription réussie — {REG_NOTE}")
            reg = {}
        else:
            s, reg = call("POST", "/api/register", {"token": reg_token, "full_name": f"Inscrit E2E {stamp}", "email": emailReg, "password": PASS})
            if s == 429:
                reg_limited = True
                print(f"  SKIP inscription réussie — {REG_NOTE}")
                reg = {}
            else:
                check("inscription réussie (rôle hérité)", s in (200, 201) and reg.get("user", {}).get("role") == "editor" and bool(reg.get("token")), f"status={s}")
        idReg = reg.get("user", {}).get("id")
        TRg = reg.get("token")
        if not reg_limited:
            s, _ = call("POST", "/api/register", {"token": reg_token, "full_name": "X", "email": emailReg, "password": PASS})
            if s == 429:
                reg_limited = True
                print(f"  SKIP lien déjà utilisé — {REG_NOTE}")
            else:
                check("lien déjà utilisé (409)", s == 409, f"status={s}")
        s, inls = call("GET", "/api/admin/invites", token=T)
        state_inv = next((i.get("state") for i in inls if i.get("id") == invite_id), None)
        if TRg:
            check("invitation marquée utilisée", s == 200 and state_inv == "used", f"state={state_inv}")
        else:
            check("invitation restée disponible (pas d'inscription)", s == 200 and state_inv == "available", f"state={state_inv}")

        print("== Compte & sécurité ==")
        if not TRg:
            print(f"  SKIP section entière — {REG_NOTE}")
        else:
            s, me = call("GET", "/api/auth/me", token=TRg)
            check("profil connecté (me)", s == 200 and me.get("email") == emailReg, f"status={s}")
            s, _ = call("POST", "/api/auth/password", {"current": "mauvaise-passe", "next": reg_new_pass}, token=TRg)
            check("mot de passe actuel incorrect (401)", s == 401, f"status={s}")
            s, _ = call("POST", "/api/auth/password", {"current": PASS, "next": reg_new_pass}, token=TRg)
            check("mot de passe changé", s == 200, f"status={s}")
            s, _ = call("POST", "/api/auth/login", {"email": emailReg, "password": PASS})
            check("ancien mot de passe rejeté (401)", s == 401, f"status={s}")
            s, b = call("POST", "/api/auth/login", {"email": emailReg, "password": reg_new_pass})
            check("nouveau mot de passe accepté", s == 200 and b.get("token"), f"status={s}")
            TRg2 = b.get("token")
            code = me.get("unique_code", "")
            s, card = call("GET", f"/api/public/member/{code}")
            check("carte membre publique (code)", s == 200 and card.get("full_name") == f"Inscrit E2E {stamp}", f"status={s}")
            s, _ = call("POST", f"/api/admin/users/{idReg}/code", {}, token=T)
            check("code membre régénéré", s == 200, f"status={s}")
            s, _ = call("GET", f"/api/public/member/{code}")
            check("ancien code invalide (404)", s == 404, f"status={s}")
            s, users2 = call("GET", "/api/admin/users", token=T)
            newcode = next((u.get("unique_code") for u in users2 if u.get("id") == idReg), "")
            s, _ = call("GET", f"/api/public/member/{newcode}")
            check("nouveau code actif (200)", s == 200, f"status={s}")
            s, _ = call("POST", "/api/auth/logout", {}, token=TRg2)
            check("déconnexion", s == 200, f"status={s}")
            s, _ = call("GET", "/api/auth/me", token=TRg2)
            check("jeton révoqué après logout (401)", s == 401, f"status={s}")

        print("== Gestion des utilisateurs ==")
        s, _ = call("POST", "/api/admin/users", {"email": f"e2e.super.{stamp}@adiong.org", "password": PASS, "role": "super_admin"}, token=TA)
        check("un admin ne crée pas de super admin (403)", s == 403, f"status={s}")
        s, _ = call("POST", "/api/admin/users", {"email": f"e2e.x.{stamp}@adiong.org", "password": "court", "role": "editor"}, token=T)
        check("mot de passe court (400)", s == 400, f"status={s}")
        s, _ = call("POST", "/api/admin/users", {"email": f"e2e.x.{stamp}@adiong.org", "password": PASS, "role": "inconnu"}, token=T)
        check("rôle inconnu (400)", s == 400, f"status={s}")
        s, _ = call("GET", "/api/admin/users", token=TR)
        check("editor bloqué sur la liste des comptes (403)", s == 403, f"status={s}")
        s, _ = call("PUT", f"/api/admin/users/{idR}", {"role": "viewer"}, token=T)
        check("rôle modifié (editor → viewer)", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/users/{idR}", token=T)
        check("utilisateur supprimé", s == 200, f"status={s}")

        print("== Nettoyage contenu ==")
        s, _ = call("DELETE", f"/api/admin/campaigns/{camp_id}", token=T)
        check("collecte supprimée", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/partners/{partner_id}", token=T)
        check("partenaire supprimé", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/invites/{invite_id}", token=T)
        check("invitation supprimée", s == 200, f"status={s}")
    finally:
        print("== Nettoyage ==")
        for did in (don_camp_id, don_gen_id):
            if did:
                try:
                    call("DELETE", f"/api/admin/donations/{did}", token=T)
                except Exception:
                    pass
        for rid, route in ((camp_id, "campaigns"), (cause_id, "causes"), (partner_id, "partners"), (invite_id, "invites")):
            if rid:
                try:
                    call("DELETE", f"/api/admin/{route}/{rid}", token=T)
                except Exception:
                    pass
        for uid in (idReg, idR, idA):
            if uid:
                try:
                    s, _ = call("DELETE", f"/api/admin/users/{uid}", token=T)
                    # idR est supprimé plus tôt par le test : 404 = déjà nettoyé
                    check(f"utilisateur {uid} supprimé", s in (200, 404), f"status={s}")
                except Exception as e:
                    KO += 1
                    FAILS.append(f"nettoyage utilisateur {uid} — {e}")
        try:
            con = sqlite3.connect(DB_FILE, timeout=10)
            cur = con.cursor()
            cur.execute("BEGIN")
            for (proof,) in cur.execute("SELECT proof FROM donations WHERE donor_name LIKE ? OR donor_email LIKE ?", (f"Donateur E2E {stamp}", f"don{stamp}@exemple.org")).fetchall():
                if proof:
                    try:
                        __import__("os").unlink(proof)
                    except Exception:
                        pass
            cur.execute("DELETE FROM donations WHERE donor_name LIKE ? OR donor_email LIKE ?", (f"Donateur E2E {stamp}", f"don{stamp}@exemple.org"))
            cur.execute("DELETE FROM invites WHERE label LIKE ?", (f"Invitation E2E {stamp}%",))
            cur.execute("DELETE FROM acc_entries WHERE source = 'donation'")
            cur.execute("DELETE FROM acc_entry_lines WHERE entry_id NOT IN (SELECT id FROM acc_entries)")
            con.commit()
            con.close()
            print("  OK   résidus de test effacés (base)")
            OK += 1
        except Exception as e:
            KO += 1
            FAILS.append(f"nettoyage base — {e}")
            print(f"  KO   nettoyage base — {e}")

    print(f"\n==== RÉSULTAT : {OK} OK / {KO} KO ====")
    if FAILS:
        print("Échecs :")
        for f in FAILS:
            print("  -", f)
    return 1 if KO else 0


if __name__ == "__main__":
    sys.exit(main())
