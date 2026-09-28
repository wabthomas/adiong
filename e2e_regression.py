#!/usr/bin/env python3
# Test E2E de régression générale : site public, auth, contenu, dons,
# boutique en ligne / POS, mode maintenance, modules et réglages.
import io
import json
import os
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


def check(name, cond, extra=""):
    global OK, KO
    if cond:
        OK += 1
        print(f"  OK   {name}")
    else:
        KO += 1
        FAILS.append(name + (f" — {extra}" if extra else ""))
        print(f"  KO   {name} {extra}")


def call(method, path, body=None, token=None, raw=False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            b = r.read()
            if raw:
                return r.status, b
            txt = b.decode("utf-8", errors="replace")
            return r.status, (json.loads(txt) if txt.lstrip()[:1] in "{[" else txt)
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            return e.code, json.loads(b.decode("utf-8", errors="replace"))
        except Exception:
            return e.code, {"raw": b[:200].decode("utf-8", errors="replace")}


def sqlite_exec(stmts):
    con = sqlite3.connect(DB_FILE, timeout=10)
    cur = con.cursor()
    cur.execute("BEGIN")
    for s in stmts:
        cur.execute(s)
    con.commit()
    con.close()


def main():
    global OK, KO
    stamp = str(int(time.time()))[-6:]
    orig = None

    print("== Setup ==")
    s, b = call("POST", "/api/auth/login", {"email": "admin@adiong.org", "password": "AdiOng2026!"})
    check("login super admin", s == 200 and b.get("token"), f"status={s}")
    T = b.get("token")
    me = b.get("user", {})
    s, mods = call("GET", "/api/admin/modules", token=T)
    check("état des modules lu", s == 200 and mods.get("is_super") is True, f"status={s}")
    orig = {
        "grh": mods.get("grh_enabled"), "pos": mods.get("pos_enabled"),
        "chat": mods.get("chat_enabled"), "maint": mods.get("maintenance_enabled"),
        "maint_msg": mods.get("maintenance_message", "")
    }
    try:
        order = {}
        print("== Site public ==")
        s, site = call("GET", "/api/public/site")
        check("site (réglages publics)", s == 200 and bool(site.get("site_name")), f"status={s}")
        s, arts = call("GET", "/api/public/articles")
        check("articles publics", s == 200 and isinstance(arts, list) and len(arts) >= 1, f"status={s} n={len(arts) if isinstance(arts, list) else '-'}")
        first = arts[0] if isinstance(arts, list) and arts else {}
        s, art = call("GET", f"/api/public/articles/{first.get('slug', 'x')}")
        check("article par slug", s == 200 and art.get("title") == first.get("title"), f"status={s}")
        s, _ = call("GET", "/api/public/articles/inexistant-xyz")
        check("article inconnu → 404", s == 404, f"status={s}")
        s, causes = call("GET", "/api/public/causes")
        check("causes publiques", s == 200 and isinstance(causes, list) and len(causes) >= 1, f"status={s}")
        s, cse = call("GET", f"/api/public/causes/{causes[0]['slug']}")
        check("cause par slug", s == 200 and cse.get("title") == causes[0].get("title"), f"status={s}")
        s, part = call("GET", "/api/public/partners")
        check("partenaires publics", s == 200 and isinstance(part, list), f"status={s}")
        s, camps = call("GET", "/api/public/campaigns")
        check("collectes publiques", s == 200 and isinstance(camps, list), f"status={s}")
        if isinstance(camps, list) and camps:
            s, cpa = call("GET", f"/api/public/campaigns/{camps[0]['slug']}")
            check("collecte par slug", s == 200 and cpa.get("title") == camps[0].get("title"), f"status={s}")
        else:
            check("collecte par slug", False, "aucune collecte")
        s, pmod = call("GET", "/api/public/modules")
        check("modules publics", s == 200 and "pos_enabled" in pmod and "maintenance_enabled" in pmod, f"status={s}")
        s, card = call("GET", f"/api/public/member/{me.get('unique_code', 'x')}")
        check("carte membre publique (code)", s == 200 and card.get("full_name") == me.get("full_name"), f"status={s}")
        s, _ = call("GET", "/api/public/member/ADI-XXXXX")
        check("carte membre inconnue → 404", s == 404, f"status={s}")

        print("== Authentification ==")
        s, _ = call("POST", "/api/auth/login", {"email": "admin@adiong.org", "password": "mauvais-mot-de-passe"})
        check("mot de passe incorrect → 401", s == 401, f"status={s}")
        s, m = call("GET", "/api/auth/me", token=T)
        check("profile connecté", s == 200 and m.get("email") == "admin@adiong.org", f"status={s}")
        s, _ = call("GET", "/api/auth/me")
        check("sans token → 401", s == 401, f"status={s}")
        s, _ = call("GET", "/api/admin/users")
        check("admin sans token → 401", s == 401, f"status={s}")
        s, _ = call("GET", "/api/admin/articles")
        check("admin articles sans token → 401", s == 401, f"status={s}")

        print("== Contenu (articles) ==")
        s, _ = call("POST", "/api/admin/articles", {"title": "", "content": "x"}, token=T)
        check("article sans titre → 400", s == 400, f"status={s}")
        s, na = call("POST", "/api/admin/articles", {
            "title": f"Article de test {stamp}", "excerpt": "extrait",
            "content": "contenu de test", "category": "actualites", "published": True
        }, token=T)
        check("article créé (publié)", s == 200 and na.get("id") and na.get("slug"), f"status={s} {na}")
        nid = na.get("id")
        s, pub = call("GET", f"/api/public/articles/{na.get('slug')}")
        check("article visible publiquement", s == 200 and "Article de test" in (pub.get("title") or ""), f"status={s}")
        s, up = call("PUT", f"/api/admin/articles/{nid}", {"title": f"Article de test {stamp} (modifié)"}, token=T)
        check("article modifié", s == 200 and "modifié" in (up.get("title") or ""), f"status={s}")
        s, _ = call("DELETE", f"/api/admin/articles/{nid}", token=T)
        check("article supprimé", s == 200, f"status={s}")
        s, _ = call("GET", f"/api/public/articles/{na.get('slug')}")
        check("article disparu publiquement", s == 404, f"status={s}")

        print("== Dons ==")
        s, _ = call("POST", "/api/donate", {"amount": 0})
        check("don sans montant → 400", s == 400, f"status={s}")
        s, don = call("POST", "/api/donate", {
            "name": f"Donateur E2E {stamp}", "email": f"don{stamp}@exemple.org",
            "amount": 25, "method": "mobile", "message": "don de test"
        })
        check("don public enregistré", s == 200, f"status={s} {don}")
        s, dons = call("GET", "/api/admin/donations", token=T)
        found = isinstance(dons, list) and any(d.get("donor_name") == f"Donateur E2E {stamp}" for d in dons)
        check("don visible dans l'admin", s == 200 and found, f"status={s}")
        dref = don.get("reference") if isinstance(don, dict) else ""
        s, qr = call("GET", f"/api/public/donations/qr?ref={dref}", raw=True)
        check("QR de paiement du don (image)", s == 200 and isinstance(qr, bytes) and len(qr) > 100, f"status={s}")
        s, _ = call("GET", "/api/public/donations/qr?ref=REF-0000", raw=True)
        check("QR avec référence inconnue → 404", s == 404, f"status={s}")

        print("== Boutique en ligne / POS ==")
        call("PUT", "/api/admin/modules", {"pos_enabled": True}, token=T)
        s, cat = call("POST", "/api/admin/pos/categories", {"name": f"Catégorie E2E {stamp}"}, token=T)
        check("catégorie POS créée", s == 200 and cat.get("id"), f"status={s} {cat}")
        cat_id = cat.get("id")
        s, prod = call("POST", "/api/admin/pos/products", {
            "name": f"Produit E2E {stamp}", "price": 10, "stock": 5, "barcode": "999001",
            "category_id": cat_id, "description": "produit de test"
        }, token=T)
        check("produit POS créé", s == 200 and prod.get("id"), f"status={s} {prod}")
        pid = prod.get("id")
        s, shop = call("GET", "/api/public/shop")
        check("boutique publique ouverte", s == 200 and any(p.get("id") == pid for p in shop.get("products", [])), f"status={s}")
        s, bad = call("POST", "/api/public/shop/orders", {"customer_name": "X", "phone": "12", "items": [{"product_id": pid, "qty": 6}]})
        check("stock insuffisant → 409", s == 409, f"status={s} {bad}")
        s, order = call("POST", "/api/public/shop/orders", {
            "customer_name": f"Client E2E {stamp}", "phone": "990011223",
            "items": [{"product_id": pid, "qty": 2}], "payment_method": "mobile"
        })
        check("commande créée (201)", s == 201 and order.get("reference"), f"status={s} {order}")
        oid = order.get("id")
        check("montant de la commande = 20", abs((order.get("total") or 0) - 20) < 0.005, f"total={order.get('total')}")
        s, prods = call("GET", "/api/admin/pos/products", token=T)
        p = next((x for x in prods if x.get("id") == pid), {}) if isinstance(prods, list) else {}
        check("stock décrémenté (5 → 3)", p.get("stock") == 3, f"stock={p.get('stock')}")
        s, orders = call("GET", "/api/admin/pos/orders", token=T)
        check("commande listée (admin)", s == 200 and any(o.get("id") == oid for o in orders), f"status={s}")
        s, st = call("PATCH", f"/api/admin/pos/orders/{oid}", {"status": "preparation"}, token=T)
        check("statut → préparation", s == 200 and st.get("status") == "preparation", f"status={s}")
        s, _ = call("PATCH", f"/api/admin/pos/orders/{oid}", {"status": "invalide"}, token=T)
        check("statut invalide → 400", s == 400, f"status={s}")
        s, bc = call("GET", "/api/admin/pos/products/by-barcode/999001", token=T)
        check("recherche par code-barres", s == 200 and bc.get("id") == pid, f"status={s}")

        print("== Fiche de stock ==")
        s, fc = call("GET", f"/api/admin/pos/products/{pid}/stock-card", token=T)
        fc_rows = fc.get("movements") if isinstance(fc, dict) else []
        check("fiche complète (solde 3, 2 lignes)", s == 200 and fc.get("opening") == 0 and fc.get("closing") == 3 and len(fc_rows) == 2, f"status={s} n={len(fc_rows)} closing={fc.get('closing') if isinstance(fc, dict) else '-'}")
        check("fiche : parcours 5 → 3", [r.get("balance") for r in fc_rows] == [5, 3], f"{[r.get('balance') for r in fc_rows]}")
        s, _ = call("POST", f"/api/admin/pos/products/{pid}/movements", {"type": "entree", "qty": 4, "reason": f"Réappro E2E {stamp}"}, token=T)
        check("entrée de réappro (200)", s == 200, f"status={s}")
        s, fc2 = call("GET", f"/api/admin/pos/products/{pid}/stock-card", token=T)
        fc2_rows = fc2.get("movements") if isinstance(fc2, dict) else []
        check("fiche après réappro (solde 7, 3 lignes)", s == 200 and fc2.get("closing") == 7 and len(fc2_rows) == 3 and fc2_rows[-1].get("balance") == 7, f"closing={fc2.get('closing') if isinstance(fc2, dict) else '-'}")
        s, csv = call("GET", f"/api/admin/pos/products/{pid}/stock-card?format=csv", token=T, raw=True)
        check("export CSV fiche de stock", s == 200 and isinstance(csv, bytes) and b"Date;Type;Motif" in csv, f"status={s}")
        s, pdf = call("GET", f"/api/admin/pos/products/{pid}/stock-card?format=pdf", token=T, raw=True)
        check("export PDF fiche de stock", s == 200 and isinstance(pdf, bytes) and pdf[:4] == b"%PDF", f"status={s}")
        s, _ = call("GET", "/api/admin/pos/products/999999/stock-card", token=T)
        check("fiche produit inconnu (404)", s == 404, f"status={s}")

        call("PUT", "/api/admin/modules", {"pos_enabled": False}, token=T)
        s, shop = call("GET", "/api/public/shop")
        check("boutique fermée → 403", s == 403, f"status={s} {shop}")

        print("== Sauvegarde / restauration ==")
        s, _ = call("POST", "/api/admin/articles", {"title": f"E2E BACKUP MARKER {stamp}", "content": "test", "published": 0}, token=T)
        check("article marqueur créé", s == 200 and _.get("id"), f"status={s}")
        mk_id = _.get("id")
        s, zbuf = call("GET", "/api/admin/backup", token=T, raw=True)
        check("sauvegarde ZIP téléchargée", s == 200 and isinstance(zbuf, bytes) and zbuf[:2] == b"PK", f"status={s}")
        s, _ = call("POST", "/api/admin/articles", {"title": f"E2E BACKUP LATER {stamp}", "content": "test", "published": 0}, token=T)
        check("article post-sauvegarde créé", s == 200, f"status={s}")

        def multipart_post(path, field, filename, content, ctype, tok):
            boundary = "----E2EBoundary" + stamp
            body = io.BytesIO()
            body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode())
            body.write(content)
            body.write(f'\r\n--{boundary}--\r\n'.encode())
            r = urllib.request.Request(BASE + path, data=body.getvalue(), method="POST")
            r.add_header("Authorization", "Bearer " + tok)
            r.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
            try:
                with urllib.request.urlopen(r) as resp:
                    return resp.status, json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                try:
                    return e.code, json.loads(e.read().decode())
                except Exception:
                    return e.code, {}

        s, rd = multipart_post("/api/admin/backup/restore", "file", "bk.zip", zbuf, "application/zip", T)
        check("restauration 200", s == 200 and rd.get("ok"), f"status={s} {rd}")
        check("compteurs restaurés", rd.get("restored", {}).get("users", 0) >= 1, f"{rd.get('restored')}")
        s, arts = call("GET", "/api/admin/articles?limit=200", token=T)
        titles = [a.get("title") for a in arts] if isinstance(arts, list) else []
        check("état restauré (marqueur oui / post-sauvegarde non)",
              f"E2E BACKUP MARKER {stamp}" in titles and f"E2E BACKUP LATER {stamp}" not in titles, f"n={len(titles)}")
        s, rd = multipart_post("/api/admin/backup/restore", "file", "x.txt", b"pas un zip", "text/plain", T)
        check("fichier non .zip rejeté (400)", s == 400, f"status={s} {rd}")
        s, _ = call("POST", "/api/admin/users", {"email": f"e2e-nonsup-{stamp}@exemple.org", "password": "E2E-backup-2026!", "full_name": "Non Sup", "role": "admin"}, token=T)
        nonsup_id = _.get("id") if isinstance(_, dict) else None
        if nonsup_id:
            t2 = call("POST", "/api/auth/login", {"email": f"e2e-nonsup-{stamp}@exemple.org", "password": "E2E-backup-2026!"})[1].get("token")
            s, _ = call("GET", "/api/admin/backup", token=t2, raw=True)
            check("backup refusé au non-super (403)", s == 403, f"status={s}")
            call("DELETE", f"/api/admin/users/{nonsup_id}", token=T)
        else:
            check("user non-super créé pour le test 403", s == 200, f"status={s}")
        call("DELETE", f"/api/admin/articles/{mk_id}", token=T)

        print("== Audit des actions (IP réelle) ==")
        s, au = call("GET", "/api/admin/audit", token=T)
        au_rows = au.get("rows") if isinstance(au, dict) else []
        check("journal d'audit lisible (super)", s == 200 and len(au_rows) >= 1, f"status={s} n={len(au_rows)}")
        check("IP enregistrée sur chaque ligne", all(r.get("ip") for r in au_rows), f"{[r.get('ip') for r in au_rows][:3]}")
        check("écriture admin tracée (PUT modules)", any(r.get("method") == "PUT" and r.get("path") == "/api/admin/modules" and r.get("email") for r in au_rows))
        check("login public tracé", any(r.get("path") == "/api/auth/login" for r in au_rows))
        check("top_ips et by_status fournis", isinstance(au.get("top_ips"), list) and isinstance(au.get("by_status"), list))
        s, au2 = call("GET", "/api/admin/audit?method=PUT", token=T)
        check("filtre méthode (PUT)", s == 200 and all(r.get("method") == "PUT" for r in au2.get("rows", [])) and len(au2.get("rows", [])) >= 1, f"n={len(au2.get('rows', []))}")

        print("== Protection : alertes & IP bloquées ==")
        s, _ = call("POST", "/api/admin/security/blocklist", {"ip": "203.0.113.77", "reason": f"Test E2E {stamp}"}, token=T)
        check("blocage d'IP (200)", s == 200 and _.get("ok"), f"status={s} {_}")
        s, _ = call("POST", "/api/admin/security/blocklist", {"ip": "203.0.113.77"}, token=T)
        check("doublon (409)", s == 409, f"status={s}")
        s, _ = call("POST", "/api/admin/security/blocklist", {"ip": "999.1.1.1"}, token=T)
        check("IP invalide (400)", s == 400, f"status={s}")
        s, bl = call("GET", "/api/admin/security/blocklist", token=T)
        check("IP listée comme bloquée", s == 200 and any(b.get("ip") == "203.0.113.77" for b in bl), f"n={len(bl) if isinstance(bl, list) else bl}")
        for i in range(5):
            s, _ = call("POST", "/api/auth/login", {"email": "e2e-bad@example.org", "password": f"Mauvais-{stamp}-{i}"})
            if s == 429:
                break
        time.sleep(1)
        s, al = call("GET", "/api/admin/security/alerts", token=T)
        check("alerte échecs de connexion (≥5/15 min)", s == 200 and any(a.get("n", 0) >= 5 for a in al), f"status={s} {al}")
        s, _ = call("DELETE", "/api/admin/security/blocklist/203.0.113.77", token=T)
        check("déblocage (200)", s == 200, f"status={s}")
        s, _ = call("DELETE", "/api/admin/security/blocklist/203.0.113.77", token=T)
        check("déblocage inconnu (404)", s == 404, f"status={s}")

        print("== Maintenance ==")
        os.makedirs("server/data/donation-proofs", exist_ok=True)
        os.makedirs("server/data/cvs", exist_ok=True)
        open("server/data/donation-proofs/e2e-orpheline-" + stamp + ".pdf", "w").write("x")
        open("server/data/cvs/e2e-orpheline-" + stamp + ".pdf", "w").write("x")
        con2 = sqlite3.connect(DB_FILE, timeout=10)
        con2.execute("INSERT INTO security_events (type, ip, email, detail, created_at) VALUES ('login_fail', '1.2.3.4', 'vieux@ex.org', 'purge e2e', datetime('now', '-400 days'))")
        con2.commit()
        con2.close()
        s, mt = call("POST", "/api/admin/maintenance", token=T)
        check("maintenance 200", s == 200 and mt.get("ok"), f"status={s} {mt}")
        check("VACUUM/ANALYZE effectués", mt.get("vacuum") is True)
        check("journal vieux purgé", mt.get("logs_purged", 0) >= 1, f"purged={mt.get('logs_purged')}")
        mfiles = {o.get("file") for o in mt.get("orphan_files", [])}
        check("orphelins supprimés",
              f"data/donation-proofs/e2e-orpheline-{stamp}.pdf" in mfiles and f"data/cvs/e2e-orpheline-{stamp}.pdf" in mfiles, str(mfiles))
        check("fichiers orphelins absents",
              not os.path.exists(f"server/data/donation-proofs/e2e-orpheline-{stamp}.pdf")
              and not os.path.exists(f"server/data/cvs/e2e-orpheline-{stamp}.pdf"))
        check("images du site préservées", os.path.exists("server/uploads/seed/about.jpg"))
        s, mt2 = call("GET", "/api/admin/maintenance", token=T)
        check("horodatage de la dernière maintenance", s == 200 and bool(mt2.get("last")), f"{mt2}")

        print("== Mode maintenance ==")
        call("PUT", "/api/admin/modules", {"maintenance_enabled": True, "maintenance_message": "E2E maintenance"}, token=T)
        s, m503 = call("GET", "/api/public/articles")
        check("public bloqué (503)", s == 503 and m503.get("maintenance") is True, f"status={s} {m503}")
        s, _ = call("GET", "/api/public/site")
        check("site/modules toujours accessibles", s == 200, f"status={s}")
        s, _ = call("GET", "/api/admin/articles", token=T)
        check("admin accessible pendant maintenance", s == 200, f"status={s}")
        call("PUT", "/api/admin/modules", {"maintenance_enabled": False}, token=T)
        s, _ = call("GET", "/api/public/articles")
        check("maintenance levée → 200", s == 200, f"status={s}")

        print("== Chat (module) ==")
        s, convs = call("GET", "/api/chat/conversations", token=T)
        check("chat actif → 200", s == 200 and isinstance(convs, list), f"status={s}")
        call("PUT", "/api/admin/modules", {"chat_enabled": False}, token=T)
        s, _ = call("GET", "/api/chat/conversations", token=T)
        check("chat désactivé → 403", s == 403, f"status={s}")
        call("PUT", "/api/admin/modules", {"chat_enabled": True}, token=T)
        s, _ = call("GET", "/api/chat/conversations", token=T)
        check("chat réactivé → 200", s == 200, f"status={s}")

        print("== Réglages & permissions ==")
        s, st = call("GET", "/api/admin/settings", token=T)
        check("réglages lus", s == 200 and bool(st.get("site_name")), f"status={s}")
        s, st = call("PUT", "/api/admin/settings", {"site_name": st.get("site_name")}, token=T)
        check("réglages sauvegardés (sans changement)", s == 200, f"status={s}")
        s, perm = call("GET", "/api/admin/permissions", token=T)
        check("matrice des droits", s == 200 and isinstance(perm.get("areas"), list) and isinstance(perm.get("matrix"), list), f"status={s}")
    finally:
        print("== Nettoyage ==")
        try:
            if orig is not None:
                call("PUT", "/api/admin/modules", {
                    "grh_enabled": bool(orig["grh"]), "pos_enabled": bool(orig["pos"]),
                    "chat_enabled": bool(orig["chat"]), "maintenance_enabled": bool(orig["maint"]),
                    "maintenance_message": orig["maint_msg"] or ""
                }, token=T)
            con = sqlite3.connect(DB_FILE, timeout=10)
            cur = con.cursor()
            cur.execute("BEGIN")
            cur.execute("DELETE FROM donations WHERE donor_name LIKE ? AND donor_email LIKE ?",
                        (f"Donateur E2E {stamp}", f"don{stamp}@exemple.org"))
            order_ref = (order or {}).get("reference", "x")
            cur.execute("DELETE FROM stock_movements WHERE reason LIKE ?", (f"Commande en ligne {order_ref}%",))
            cur.execute("DELETE FROM stock_movements WHERE reason LIKE ?", (f"Réappro E2E {stamp}%",))
            cur.execute("DELETE FROM shop_orders WHERE customer_name LIKE ?", (f"Client E2E {stamp}",))
            cur.execute("DELETE FROM stock_products WHERE name LIKE ?", (f"Produit E2E {stamp}",))
            cur.execute("DELETE FROM stock_categories WHERE name LIKE ?", (f"Catégorie E2E {stamp}",))
            con.commit()
            con.close()
            print("  OK   résidus de test effacés (base)")
            OK += 1
        except Exception as e:
            KO += 1
            FAILS.append(f"nettoyage — {e}")
            print(f"  KO   nettoyage — {e}")

    print(f"\n==== RÉSULTAT : {OK} OK / {KO} KO ====")
    if FAILS:
        print("Échecs :")
        for f in FAILS:
            print("  -", f)
    return 1 if KO else 0


if __name__ == "__main__":
    sys.exit(main())
