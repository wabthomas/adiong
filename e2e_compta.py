#!/usr/bin/env python3
# Test E2E du module comptabilité SYCEBNL — API :4000 (DB fresh seedée).
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:4000"
OK = 0
KO = 0
FAILS = []


def call(method, path, body=None, token=None, expect=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            ctype = r.headers.get("Content-Type", "")
            raw = r.read()
            if "pdf" in ctype:
                return r.status, {"raw": f"pdf {len(raw)} bytes"}
            raw = raw.decode("utf-8-sig", errors="replace")
            if "json" in ctype or raw.lstrip()[:1] in "{[":
                return r.status, (json.loads(raw) if raw else {})
            return r.status, {"raw": raw[:300]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8-sig")
        try:
            return e.code, (json.loads(raw) if raw else {"raw": raw[:200]})
        except Exception:
            return e.code, {"raw": raw[:200]}


def check(name, cond, extra=""):
    global OK, KO
    if cond:
        OK += 1
        print(f"  OK   {name}")
    else:
        KO += 1
        FAILS.append(name + (f" — {extra}" if extra else ""))
        print(f"  KO   {name} {extra}")


def balance_of(status_rows, code):
    if not isinstance(status_rows, list):
        return None
    for r in status_rows:
        if isinstance(r, dict) and r.get("code") == code:
            return r
    return None


DB_FILE = "/home/user/adiong/server/data/adiong.db"


def clean():
    # Remise à zéro du module comptabilité (permet de relancer l'E2E)
    import sqlite3
    con = sqlite3.connect(DB_FILE, timeout=10)
    cur = con.cursor()
    cur.execute("BEGIN")
    for t in ("acc_entry_lines", "acc_entries", "acc_assets", "acc_in_kind", "acc_exercises"):
        cur.execute(f"DELETE FROM {t}")
    cur.execute("DELETE FROM sqlite_sequence WHERE name IN ('acc_entries', 'acc_exercises', 'acc_assets', 'acc_in_kind')")
    cur.execute("INSERT INTO acc_exercises (start_date, end_date) VALUES ('2026-01-01', '2026-12-31')")
    con.commit()
    con.close()


def main():
    global OK, KO
    stamp = str(int(time.time()))[-6:]
    clean()

    print("== Auth ==")
    s, b = call("POST", "/api/auth/login", {"email": "admin@adiong.org", "password": "AdiOng2026!"})
    check("login admin", s == 200 and b.get("token"), f"status={s}")
    T = b.get("token")
    s, st = call("PUT", "/api/admin/modules", {"compta_enabled": True}, token=T)
    check("module compta activé", s == 200 and st.get("compta_enabled") is True, f"status={s} {st}")

    print("== Vue d'ensemble & tendance ==")
    s, o = call("GET", "/api/admin/compta/overview", token=T)
    check("overview 200", s == 200, f"status={s} {b}")
    check("overview: exercise ouvert 2026", o.get("exercise", {}).get("start_date") == "2026-01-01" and o["exercise"]["status"] == "ouvert")
    for f in ("treasury", "resources", "charges", "surplus", "year_result", "year_charges", "year_ressources", "reported_surplus", "month", "entries", "accounts"):
        check(f"overview: champ {f}", f in o)
    s, tr = call("GET", "/api/admin/compta/trend?months=12", token=T)
    check("trend 200", s == 200, f"status={s}")
    check("trend: 12 mois", isinstance(tr, list) and len(tr) == 12, f"len={len(tr) if isinstance(tr, list) else tr}")
    check("trend: champs", isinstance(tr, list) and all(("month" in m and "ressources" in m and "charges" in m) for m in tr))

    print("== Plan de comptes ==")
    s, accs = call("GET", "/api/admin/compta/accounts", token=T)
    check("plan 200", s == 200, f"status={s}")
    check("plan: >= 70 comptes", isinstance(accs, list) and len(accs) >= 70, f"n={len(accs) if isinstance(accs, list) else accs}")
    s, q = call("GET", "/api/admin/compta/accounts?q=651", token=T)
    check("plan: filtre q=651", s == 200 and any(a["code"] == "651" for a in q))
    acc_code = f"64{int(stamp) % 100:02d}"
    s, na = call("POST", "/api/admin/compta/accounts", {"code": acc_code, "name": "Autres charges de personnel E2E", "nature": "expense"}, token=T)
    if s == 409:
        s2, found = call("GET", f"/api/admin/compta/accounts?q={acc_code}", token=T)
        na = next((a for a in found if isinstance(a, dict) and a.get("code") == acc_code), {}) if isinstance(found, list) else {}
    check("plan: création de compte", s in (200, 201, 409) and na.get("id"), f"status={s} {na}")
    acc_id = na.get("id") if isinstance(na, dict) else None
    if acc_id:
        s, up = call("PUT", f"/api/admin/compta/accounts/{acc_id}", {"name": "Autres charges de personnel (E2E)"}, token=T)
        check("plan: renommage", s == 200 and "E2E" in up.get("name", ""), f"status={s}")

    print("== Écritures manuelles ==")
    s, e1 = call("POST", "/api/admin/compta/entries", {
        "date": "2026-03-15", "journal": "OD", "label": "Fournitures E2E",
        "lines": [
            {"account_code": "611", "debit": 100, "credit": 0, "label": "Services extérieurs"},
            {"account_code": "511", "debit": 0, "credit": 100, "label": "Banque"}
        ]
    }, token=T)
    check("écriture équilibrée 201", s in (200, 201) and e1.get("ref"), f"status={s} {e1}")
    ref1 = e1.get("ref")
    id1 = e1.get("id")

    s, b2 = call("POST", "/api/admin/compta/entries", {
        "date": "2026-03-16", "journal": "OD", "label": "Déséquilibrée",
        "lines": [{"account_code": "611", "debit": 100, "credit": 0}, {"account_code": "511", "debit": 0, "credit": 50}]
    }, token=T)
    check("écriture déséquilibrée 400", s == 400, f"status={s}")

    s, b3 = call("POST", "/api/admin/compta/entries", {
        "date": "2025-12-31", "journal": "OD", "label": "Hors exercice",
        "lines": [{"account_code": "611", "debit": 10, "credit": 0}, {"account_code": "511", "debit": 0, "credit": 10}]
    }, token=T)
    check("date avant l'exercice 400", s == 400, f"status={s}")

    s, lst = call("GET", "/api/admin/compta/entries?from=2026-03-01&to=2026-03-31", token=T)
    check("liste filtrée par période", s == 200 and isinstance(lst, list) and any(isinstance(x, dict) and x.get("ref") == ref1 for x in lst), f"status={s}")
    s, det = call("GET", f"/api/admin/compta/entries/{id1}", token=T)
    check("détail de l'écriture", s == 200 and det.get("ref") == ref1 and len(det.get("lines", [])) == 2, f"status={s}")

    print("== Balance & grand livre ==")
    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r611 = balance_of(bal, "611")
    check("balance 200", s == 200, f"status={s}")
    check("balance: 611 débit 100", r611 and abs(r611["debit"] - 100) < 0.005, f"r={r611}")
    s, led = call("GET", "/api/admin/compta/ledger?account=611&from=2026-01-01&to=2026-12-31", token=T)
    check("grand livre 611", s == 200 and isinstance(led, list) and any(isinstance(r, dict) and r.get("ref") == ref1 for r in led), f"status={s}")

    print("== Livres de caisse et de banque ==")
    s, ca = call("POST", "/api/admin/compta/entries", {
        "date": "2026-05-04", "journal": "CAI", "label": "Encaissement espèces E2E",
        "lines": [{"account_code": "531", "debit": 100, "credit": 0, "label": "Caisse"},
                  {"account_code": "749", "debit": 0, "credit": 100, "label": "Dons espèces"}]
    }, token=T)
    check("encaissement caisse 531 (201)", s in (200, 201) and ca.get("ref"), f"status={s} {ca}")
    ref_a = ca.get("ref")
    s, cb = call("POST", "/api/admin/compta/entries", {
        "date": "2026-05-11", "journal": "CAI", "label": "Paiement espèces E2E",
        "lines": [{"account_code": "641", "debit": 40, "credit": 0, "label": "Salaires"},
                  {"account_code": "531", "debit": 0, "credit": 40, "label": "Caisse"}]
    }, token=T)
    check("décaissement caisse 531 (201)", s in (200, 201) and cb.get("ref"), f"status={s} {cb}")
    ref_b = cb.get("ref")
    s, cc = call("POST", "/api/admin/compta/entries", {
        "date": "2026-05-18", "journal": "BQ", "label": "Virement banque E2E",
        "lines": [{"account_code": "511", "debit": 250, "credit": 0, "label": "Banque"},
                  {"account_code": "749", "debit": 0, "credit": 250, "label": "Don affecté"}]
    }, token=T)
    check("mouvement banque 511 (201)", s in (200, 201) and cc.get("ref"), f"status={s} {cc}")

    s, lc = call("GET", "/api/admin/compta/cash-book?book=caisse&from=2026-05-01&to=2026-05-31", token=T)
    lc_rows = lc.get("rows") if isinstance(lc, dict) else []
    check("livre de caisse (2 lignes, solde 60)", s == 200 and len(lc_rows) == 2 and lc.get("opening") == 0 and lc.get("closing") == 60, f"status={s} n={len(lc_rows)}")
    check("livre de caisse : solde courant (100 puis 60)", bool(lc_rows) and lc_rows[0].get("ref") == ref_a and lc_rows[0].get("cum") == 100 and lc_rows[1].get("cum") == 60, f"{[r.get('cum') for r in lc_rows]}")
    s, lc2 = call("GET", "/api/admin/compta/cash-book?book=caisse", token=T)
    check("livre de caisse sans période (solde 60)", s == 200 and lc2.get("closing") == 60, f"status={s} closing={lc2.get('closing') if isinstance(lc2, dict) else '-'}")
    s, lb = call("GET", "/api/admin/compta/cash-book?book=banque&from=2026-05-01&to=2026-05-31", token=T)
    lb_rows = lb.get("rows") if isinstance(lb, dict) else []
    check("livre de banque (solde initial -100, fin 150)", s == 200 and lb.get("opening") == -100 and lb.get("closing") == 150 and len(lb_rows) == 1, f"status={s} opening={lb.get('opening') if isinstance(lb, dict) else '-'}")
    s, _ = call("GET", "/api/admin/compta/cash-book?book=x", token=T)
    check("livre inconnu (400)", s == 400, f"status={s}")
    s, csv = call("GET", "/api/admin/compta/cash-book?book=caisse&from=2026-05-01&to=2026-05-31&format=csv", token=T)
    check("export CSV livre de caisse", s == 200 and "Date;Réf." in str(csv.get("raw", "")), f"status={s}")
    s, pdf = call("GET", "/api/admin/compta/cash-book?book=caisse&from=2026-05-01&to=2026-05-31&format=pdf", token=T)
    check("export PDF livre de caisse", s == 200 and str(pdf.get("raw", "")).startswith("pdf"), f"status={s}")
    for refx in (ca.get("id"), cb.get("id"), cc.get("id")):
        call("DELETE", f"/api/admin/compta/entries/{refx}", token=T)
    s, _ = call("GET", "/api/admin/compta/cash-book?book=caisse", token=T)
    check("écritures du livre purgées (solde 0)", s == 200 and isinstance(_, dict) and _.get("closing") == 0, f"closing={_.get('closing') if isinstance(_, dict) else '-'}")

    print("== Immobilisations ==")
    s, a1 = call("POST", "/api/admin/compta/assets", {
        "label": f"PC portable E2E {stamp}", "account_code": "211", "amount": 1200,
        "acquired_at": "2026-02-10", "useful_life": 4, "payment_method": "virement"
    }, token=T)
    check("acquisition 211 (1200, 4 ans)", s in (200, 201) and a1.get("id"), f"status={s} {a1}")
    aid1 = a1.get("id")
    check("acquisition: valeur nette = brute", abs(a1.get("net", 0) - 1200) < 0.005 and abs(a1.get("accumulated", 0)) < 0.005)

    s, a2 = call("POST", "/api/admin/compta/assets", {
        "label": f"Véhicule E2E {stamp}", "account_code": "243", "amount": 2000,
        "acquired_at": "2026-02-20", "useful_life": 5, "payment_method": "caisse"
    }, token=T)
    check("acquisition 243 via caisse", s in (200, 201) and a2.get("id"), f"status={s} {a2}")
    aid2 = a2.get("id")

    s, lst_a = call("GET", "/api/admin/compta/assets", token=T)
    check("registre liste 2 actifs", s == 200 and isinstance(lst_a, list) and len(lst_a) == 2, f"n={len(lst_a) if isinstance(lst_a, list) else lst_a}")

    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r211, r531 = balance_of(bal, "211"), balance_of(bal, "531")
    check("écriture d'acquisition 211/511+531", r211 and abs(r211["debit"] - 1200) < 0.005 and r531 and abs(r531["credit"] - 2000) < 0.005,
          f"211={r211} 531={r531}")

    s, dep = call("POST", "/api/admin/compta/assets/depreciate?year=2026", token=T)
    check("dotations 2026 générées (2)", s == 200 and dep.get("created") == 2, f"status={s} {dep}")
    s, lst_a = call("GET", "/api/admin/compta/assets", token=T)
    aa1 = next((a for a in lst_a if isinstance(a, dict) and a.get("id") == aid1), {})
    aa2 = next((a for a in lst_a if isinstance(a, dict) and a.get("id") == aid2), {})
    check("211 : dotation 300 (1200/4)", abs(aa1.get("accumulated", 0) - 300) < 0.005 and abs(aa1.get("net", 0) - 900) < 0.005, f"a={aa1}")
    check("243 : dotation 400 → 283", abs(aa2.get("accumulated", 0) - 400) < 0.005, f"a={aa2}")
    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r651, r281, r283 = balance_of(bal, "651"), balance_of(bal, "281"), balance_of(bal, "283")
    check("651 débit 700", r651 and abs(r651["debit"] - 700) < 0.005, f"r={r651}")
    check("281 crédit 300 / 283 crédit 400", r281 and abs(r281["credit"] - 300) < 0.005 and r283 and abs(r283["credit"] - 400) < 0.005, f"281={r281} 283={r283}")

    s, dep2 = call("POST", "/api/admin/compta/assets/depreciate?year=2026", token=T)
    check("dotations idempotentes (0)", s == 200 and dep2.get("created") == 0, f"{dep2}")

    s, bad = call("POST", "/api/admin/compta/assets", {"label": "X", "account_code": "511", "amount": 10, "acquired_at": "2026-03-01", "useful_life": 2}, token=T)
    check("compte non 2xx refusé", s == 400, f"status={s}")
    s, bad = call("POST", "/api/admin/compta/assets", {"label": "X", "account_code": "281", "amount": 10, "acquired_at": "2026-03-01", "useful_life": 2}, token=T)
    check("compte 28x refusé", s == 400, f"status={s}")
    s, bad = call("POST", "/api/admin/compta/assets", {"label": "X", "account_code": "211", "amount": 0, "acquired_at": "2026-03-01", "useful_life": 2}, token=T)
    check("montant 0 refusé", s == 400, f"status={s}")

    s, cede = call("PUT", f"/api/admin/compta/assets/{aid1}", {"status": "cede"}, token=T)
    check("cession 211", s == 200 and cede.get("status") == "cede", f"status={s} {cede}")

    s, rem = call("DELETE", f"/api/admin/compta/assets/{aid1}", token=T)
    check("suppression actif 211 (+ dotations)", s == 200, f"status={s} {rem}")
    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r211, r281, r651 = balance_of(bal, "211"), balance_of(bal, "281"), balance_of(bal, "651")
    check("211 à zéro après suppression", not r211 or abs(r211["debit"] - r211["credit"]) < 0.005, f"r={r211}")
    check("281 à zéro après suppression", not r281 or abs(r281["credit"]) < 0.005, f"r={r281}")
    check("651 restant = dotation 243 (400)", r651 and abs(r651["debit"] - r651["credit"] - 400) < 0.005, f"r={r651}")

    print("== Contributions en nature ==")
    s, ik1 = call("POST", "/api/admin/compta/in-kind", {
        "date": "2026-03-01", "direction": "recu", "partner": f"Fondation Test {stamp}",
        "description": "Kits scolaires offerts", "amount": 250, "account_code": "601"
    }, token=T)
    check("contribution reçue 601/971", s in (200, 201) and ik1.get("id"), f"status={s} {ik1}")
    iid1 = ik1.get("id")
    s, ik2 = call("POST", "/api/admin/compta/in-kind", {
        "date": "2026-03-05", "direction": "donne", "partner": f"Partenaire Test {stamp}",
        "amount": 150, "account_code": "311"
    }, token=T)
    check("contribution donnée 911/311", s in (200, 201) and ik2.get("id"), f"status={s} {ik2}")
    iid2 = ik2.get("id")

    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r971, r911 = balance_of(bal, "971"), balance_of(bal, "911")
    check("971 crédit 250", r971 and abs(r971["credit"] - 250) < 0.005, f"r={r971}")
    check("911 débit 150", r911 and abs(r911["debit"] - 150) < 0.005, f"r={r911}")

    s, bad = call("POST", "/api/admin/compta/in-kind", {"date": "2026-03-02", "direction": "recu", "partner": "X", "amount": 10, "account_code": "511"}, token=T)
    check("reçue hors classe 3/6 refusée", s == 400, f"status={s}")
    s, bad = call("POST", "/api/admin/compta/in-kind", {"date": "2026-03-02", "direction": "recu", "amount": 10, "account_code": "601"}, token=T)
    check("partenaire manquant refusé", s == 400, f"status={s}")

    s, lst_ik = call("GET", "/api/admin/compta/in-kind", token=T)
    check("liste contributions (2)", s == 200 and isinstance(lst_ik, list) and len(lst_ik) == 2, f"n={len(lst_ik) if isinstance(lst_ik, list) else lst_ik}")
    s, rem = call("DELETE", f"/api/admin/compta/in-kind/{iid1}", token=T)
    check("suppression contribution reçue", s == 200, f"status={s}")
    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r971 = balance_of(bal, "971")
    check("971 à zéro après suppression", not r971 or abs(r971["credit"]) < 0.005, f"r={r971}")
    # ik2 (911 débit 150) est conservée : elle devra être éteinte à la clôture (classe 9)

    print("== Contre-sens & suppression ==")
    s, rev = call("POST", f"/api/admin/compta/entries/{id1}/reverse", {}, token=T)
    check("contre-sens de l'écriture manuelle", s == 200, f"status={s} {rev}")
    s, dele = call("DELETE", f"/api/admin/compta/entries/{id1}", token=T)
    check("suppression manuelle (+ contre-sens)", s == 200, f"status={s} {dele}")
    s, gone = call("GET", f"/api/admin/compta/entries/{id1}", token=T)
    check("écriture disparue", s == 404, f"status={s}")

    print("== Clôture d'exercice ==")
    s, e_don = call("POST", "/api/admin/compta/entries", {
        "date": "2026-07-10", "journal": "OD", "label": "Don de clôture E2E",
        "lines": [
            {"account_code": "511", "debit": 1000, "credit": 0, "label": "Banque"},
            {"account_code": "749", "debit": 0, "credit": 1000, "label": "Don"}
        ]
    }, token=T)
    check("don 1000 (749)", s in (200, 201), f"status={s} {e_don}")
    s, e_exp = call("POST", "/api/admin/compta/entries", {
        "date": "2026-07-12", "journal": "OD", "label": "Charges de clôture E2E",
        "lines": [
            {"account_code": "613", "debit": 400, "credit": 0, "label": "Loyer"},
            {"account_code": "511", "debit": 0, "credit": 400, "label": "Banque"}
        ]
    }, token=T)
    check("loyer 400 (613)", s in (200, 201), f"status={s} {e_exp}")

    s, exs = call("GET", "/api/admin/compta/exercises", token=T)
    ex = next((x for x in exs if isinstance(x, dict) and x.get("status") == "ouvert"), None) if isinstance(exs, list) else None
    check("exercice ouvert trouvé", s == 200 and ex is not None, f"{exs if not isinstance(exs, list) else 'aucun ouvert'}")
    # 1000 (749) − 400 (613) − 400 (651 déjà doté) − 150 (911) = 50
    check("exercice: résultat calculé 50 (911 incluse)", ex and abs(ex["resultat_calcule"] - 50) < 0.005, f"r={ex and ex.get('resultat_calcule')}")

    s, cl = call("POST", f"/api/admin/compta/exercises/{ex['id']}/close", {}, token=T)
    check("clôture 200", s == 200 and cl.get("id") == ex["id"], f"status={s} {cl}")
    check("clôture: résultat 50 (classes 6/8/9 éteintes)", cl.get("result") == 50, f"result={cl.get('result')}")

    s, exs = call("GET", "/api/admin/compta/exercises", token=T)
    closed = next((x for x in exs if isinstance(x, dict) and x.get("id") == ex["id"]), {})
    nxt = next((x for x in exs if isinstance(x, dict) and x.get("status") == "ouvert" and x.get("id") != ex["id"]), None)
    check("exercice clôturé + verrouillé", closed.get("status") == "cloture" and closed.get("closed_by"), f"{closed}")
    check("exercice suivant ouvert (2027)", nxt is not None and nxt["start_date"].startswith("2027"), f"{nxt}")

    s, bal = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31", token=T)
    r613, r749, r651, r911, r171 = balance_of(bal, "613"), balance_of(bal, "749"), balance_of(bal, "651"), balance_of(bal, "911"), balance_of(bal, "171")
    check("613 éteinte à la clôture", not r613 or abs(r613["debit"] - r613["credit"]) < 0.005, f"r={r613}")
    check("749 éteinte à la clôture", not r749 or abs(r749["credit"] - r749["debit"]) < 0.005, f"r={r749}")
    check("651 éteinte (dotation auto incluse)", not r651 or abs(r651["debit"] - r651["credit"]) < 0.005, f"r={r651}")
    check("911 éteinte (classe 9 à la clôture)", not r911 or abs(r911["debit"] - r911["credit"]) < 0.005, f"r={r911}")
    check("171 créditeur de 50 (surplus reporté)", r171 and abs((r171["credit"] - r171["debit"]) - 50) < 0.005, f"r={r171}")

    s, ov = call("GET", "/api/admin/compta/overview", token=T)
    check("overview: reported_surplus = 50", s == 200 and ov.get("reported_surplus") == 50, f"status={s} v={ov.get('reported_surplus')}")

    s, dup = call("POST", f"/api/admin/compta/exercises/{ex['id']}/close", {}, token=T)
    check("re-clôture refusée 409", s == 409, f"status={s}")
    s, bad = call("POST", "/api/admin/compta/entries", {
        "date": "2026-06-01", "journal": "OD", "label": "Hors verrou",
        "lines": [{"account_code": "611", "debit": 5, "credit": 0}, {"account_code": "511", "debit": 0, "credit": 5}]
    }, token=T)
    check("écriture dans exercice clôturé refusée 400", s == 400, f"status={s}")
    s, ok27 = call("POST", "/api/admin/compta/entries", {
        "date": "2027-01-05", "journal": "OD", "label": "Ouverture 2027",
        "lines": [{"account_code": "611", "debit": 5, "credit": 0}, {"account_code": "511", "debit": 0, "credit": 5}]
    }, token=T)
    check("écriture dans l'exercice suivant acceptée", s in (200, 201), f"status={s}")
    if ok27.get("id"):
        call("DELETE", f"/api/admin/compta/entries/{ok27['id']}", token=T)

    s, lst = call("GET", "/api/admin/compta/entries?q=Dotations", token=T)
    check("écriture de dotation présente (source depreciation)",
          isinstance(lst, list) and any("Dotations aux amortissements 2026" in (x.get("label") or "") for x in lst),
          f"n={len(lst) if isinstance(lst, list) else lst}")

    print("== États financiers ==")
    s, bs = call("GET", "/api/admin/compta/statements/balance-sheet?at=2026-12-31", token=T)
    check("bilan 200", s == 200, f"status={s}")
    check("bilan équilibré", bs.get("equilibre") is True, f"actif={bs.get('actif', {}).get('total')} passif={bs.get('passif', {}).get('total')}")
    s, cr = call("GET", "/api/admin/compta/statements/result?from=2026-01-01&to=2026-12-31", token=T)
    check("compte de résultat 200", s == 200, f"status={s}")
    s, csvh = call("GET", "/api/admin/compta/statements/result?from=2026-01-01&to=2026-12-31&format=csv", token=T)
    check("export CSV résultat (200)", s == 200, f"status={s}")
    s, pdfh = call("GET", "/api/admin/compta/statements/balance-sheet?at=2026-12-31&format=pdf", token=T)
    check("export PDF bilan (200)", s == 200 and str(pdfh.get("raw", "")).startswith("pdf"), f"status={s}")
    s, pdfj = call("GET", "/api/admin/compta/entries?from=2026-01-01&to=2026-12-31&format=pdf", token=T)
    check("export PDF journal (200)", s == 200 and str(pdfj.get("raw", "")).startswith("pdf"), f"status={s}")
    s, pdfb = call("GET", "/api/admin/compta/balance?from=2026-01-01&to=2026-12-31&format=pdf", token=T)
    check("export PDF balance (200)", s == 200 and str(pdfb.get("raw", "")).startswith("pdf"), f"status={s}")
    s, pdfl = call("GET", "/api/admin/compta/ledger?account=511&from=2026-01-01&to=2026-12-31&format=pdf", token=T)
    check("export PDF grand livre 511 (200)", s == 200 and str(pdfl.get("raw", "")).startswith("pdf"), f"status={s}")
    s, pdfl2 = call("GET", "/api/admin/compta/ledger?format=pdf", token=T)
    check("grand livre PDF sans compte 400", s == 400, f"status={s}")

    print(f"\n==== RÉSULTAT : {OK} OK / {KO} KO ====")
    if FAILS:
        print("Échecs :")
        for f in FAILS:
            print("  -", f)
    return 1 if KO else 0


if __name__ == "__main__":
    sys.exit(main())
