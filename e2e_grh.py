#!/usr/bin/env python3
# Test E2E du module GRH : départements, employés, documents, congés, pointage,
# paie (dont intégration comptable SYCEBNL), recrutement, évaluations, formations,
# annonces, projets/tâches, chat employé↔admin, certificats, sécurité.
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

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


def call_multipart(method, path, fields, file_field, filename, content, mime, token):
    boundary = "----e2e" + str(int(time.time() * 1000))
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
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


def next_monday():
    d = date.today()
    ahead = 7 - d.weekday()
    if ahead <= 0:
        ahead = 7
    return d + timedelta(days=ahead)


def main():
    global OK, KO
    stamp = str(int(time.time()))[-6:]
    today = date.today()
    MONTH = today.strftime("%Y-%m")
    MONTH_PREV = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    MON = next_monday()
    emailE = f"e2e.grh.{stamp}@adiong.org"
    emailV = f"e2e.grh2.{stamp}@adiong.org"
    PASS = "E2Egrh123!"

    print("== Setup ==")
    s, b = call("POST", "/api/auth/login", {"email": "admin@adiong.org", "password": "AdiOng2026!"})
    check("login super admin", s == 200 and b.get("token"), f"status={s}")
    T = b.get("token")
    s, mods = call("GET", "/api/admin/modules", token=T)
    check("modules 200", s == 200, f"status={s}")
    orig_grh = mods.get("grh_enabled", False)
    if not orig_grh:
        call("PUT", "/api/admin/modules", {"grh_enabled": True}, token=T)

    s, uE = call("POST", "/api/admin/users", {"email": emailE, "password": PASS, "full_name": "Testeur GRH", "role": "admin"}, token=T)
    check("création utilisateur E (admin)", s in (200, 201) and uE.get("id"), f"status={s} {uE}")
    idE = uE.get("id")
    s, uV = call("POST", "/api/admin/users", {"email": emailV, "password": PASS, "full_name": "Lecteur E2E", "role": "viewer"}, token=T)
    check("création utilisateur V (viewer)", s in (200, 201) and uV.get("id"), f"status={s} {uV}")
    idV = uV.get("id")
    s, b = call("POST", "/api/auth/login", {"email": emailE, "password": PASS})
    TE = b.get("token")
    s, b = call("POST", "/api/auth/login", {"email": emailV, "password": PASS})
    TV = b.get("token")
    check("logins E et V", bool(TE and TV))

    dept_id = id1 = id2 = None
    doc_id = hire_id = cand_id = job_id = None
    l_conge = l_mal = l_self = None
    att_id = pid = pid_prev = None
    eval_id = eval_id2 = train_id = ann_id = proj_id = task_id = adoc_id = None

    try:
        print("== Départements ==")
        s, dep = call("POST", "/api/admin/grh/departments", {"name": f"Direction E2E {stamp}"}, token=T)
        check("département créé", s in (200, 201) and dep.get("id"), f"status={s} {dep}")
        dept_id = dep.get("id")
        s, _ = call("POST", "/api/admin/grh/departments", {"name": "  "}, token=T)
        check("nom vide refusé (400)", s == 400, f"status={s}")
        s, deps = call("GET", "/api/admin/grh/departments", token=T)
        check("département listé", s == 200 and any(d.get("id") == dept_id for d in deps), f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/departments/{dept_id}", {"name": f"Direction E2E {stamp} (modif)"}, token=T)
        check("département renommé", s == 200, f"status={s}")
        s, _ = call("PUT", "/api/admin/grh/departments/999999", {"name": "X"}, token=T)
        check("PUT département inconnu (aucune donnée)", s == 200 and not _, f"status={s} body={_}")

        print("== Employés ==")
        s, e1 = call("POST", "/api/admin/grh/employees", {
            "full_name": f"Manager E2E {stamp}", "email": f"e2e.emp1.{stamp}@adiong.org",
            "phone": "+243 990 000 001", "position": "Chef de projet", "department_id": dept_id,
            "contract_type": "permanent", "hire_date": "2026-01-15", "status": "actif",
            "salary": 1200, "salary_currency": "USD", "annual_days": 22
        }, token=T)
        check("employé 1 créé (salaire super admin)", s in (200, 201) and e1.get("id") and e1.get("salary") == 1200, f"status={s} {e1}")
        id1 = e1.get("id")
        s, _ = call("POST", "/api/admin/grh/employees", {"full_name": ""}, token=T)
        check("nom d'employé requis (400)", s == 400, f"status={s}")
        s, _ = call("POST", "/api/admin/grh/employees", {"full_name": "Dupliqué E2E", "email": f"e2e.emp1.{stamp}@adiong.org"}, token=T)
        check("email employé dupliqué (409)", s == 409, f"status={s}")
        s, e2 = call("POST", "/api/admin/grh/employees", {
            "full_name": f"Collaborateur E2E {stamp}", "email": emailE,
            "position": "Agent de programme", "department_id": dept_id,
            "hire_date": "2026-03-01", "status": "actif", "annual_days": 22,
            "manager_id": id1
        }, token=T)
        check("employé 2 créé (lié au compte E)", s in (200, 201) and e2.get("id"), f"status={s} {e2}")
        id2 = e2.get("id")
        s, emps = call("GET", "/api/admin/grh/employees", token=T)
        r1 = next((r for r in emps if r.get("id") == id1), {}) if isinstance(emps, list) else {}
        check("liste employées (salaire visible pour super admin)", s == 200 and r1.get("salary") == 1200, f"status={s}")
        s, emps2 = call("GET", "/api/admin/grh/employees", token=TE)
        r2 = next((r for r in emps2 if r.get("id") == id1), {}) if isinstance(emps2, list) else {}
        check("salaire masqué pour un non-super", s == 200 and r2.get("salary") is None, f"salary={r2.get('salary')}")
        s, det = call("GET", f"/api/admin/grh/employees/{id1}", token=T)
        check("détail employé", s == 200 and det.get("id") == id1 and det.get("department"), f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/employees/{id1}", {"salary": 1300}, token=T)
        check("salaire mis à jour (1200 → 1300)", s == 200, f"status={s}")
        s, oc = call("GET", "/api/admin/grh/orgchart", token=T)
        node1 = next((n for n in (oc if isinstance(oc, list) else []) if n.get("id") == id1), None)
        check("organigramme (2 sous l'employé 1)", bool(node1) and any(c.get("id") == id2 for c in node1.get("children", [])), f"status={s}")

        print("== Documents employés ==")
        s, doc = call_multipart("POST", f"/api/admin/grh/employees/{id1}/documents",
                                {"name": "Contrat E2E", "category": "contrat"}, "file", "contrat-e2e.pdf", PDF_BYTES, "application/pdf", T)
        check("document PDF joint", s in (200, 201) and doc.get("id"), f"status={s} {doc}")
        doc_id = doc.get("id")
        s, _ = call("POST", f"/api/admin/grh/employees/{id1}/documents", {}, token=T)
        check("upload sans fichier (400)", s == 400, f"status={s}")
        s, _ = call_multipart("POST", f"/api/admin/grh/employees/{id1}/documents",
                              {"name": "Virus", "category": "autre"}, "file", "malware.exe", b"MZ" + b"\x00" * 16, "application/x-msdownload", T)
        check("format non supporté refusé", s in (400, 500), f"status={s}")
        s, _ = call("GET", f"/api/admin/grh/documents/{doc_id}", token=T)
        check("téléchargement du document", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/documents/{doc_id}", token=T)
        check("document supprimé", s == 200, f"status={s}")
        s, _ = call("GET", f"/api/admin/grh/documents/{doc_id}", token=T)
        check("document supprimé (404)", s == 404, f"status={s}")

        print("== Congés ==")
        s, lc = call("POST", "/api/me/employee/leaves",
                     {"start_date": MON.isoformat(), "end_date": (MON + timedelta(days=2)).isoformat(), "type": "conge", "reason": "Congé E2E"}, token=TE)
        check("demande self-service (3 jours ouvrés)", s in (200, 201) and lc.get("status") == "en_attente" and lc.get("days") == 3, f"status={s} {lc}")
        l_conge = lc.get("id")
        s, _ = call("POST", "/api/me/employee/leaves", {"type": "conge"}, token=TE)
        check("demande sans date (400)", s == 400, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/leaves/{l_conge}", {"status": "approuve"}, token=T)
        check("approbation admin", s == 200, f"status={s}")
        s, _ = call("POST", "/api/admin/grh/leaves",
                    {"employee_id": id2, "type": "conge", "status": "approuve",
                     "start_date": MON.isoformat(), "end_date": (MON + timedelta(days=42)).isoformat()}, token=T)
        check("solde annuel insuffisant (400)", s == 400 and "insuffisant" in str(_), f"status={s} {_}")
        s, lm = call("POST", "/api/me/employee/leaves",
                     {"start_date": (MON + timedelta(days=7)).isoformat(), "end_date": (MON + timedelta(days=8)).isoformat(), "type": "maladie"}, token=TE)
        check("maladie self-service (2 jours, hors solde)", s in (200, 201) and lm.get("days") == 2, f"status={s} {lm}")
        l_mal = lm.get("id")
        s, _ = call("PUT", f"/api/admin/grh/leaves/{l_mal}", {"status": "rejette"}, token=T)
        check("rejet admin (maladie)", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/me/employee/leaves/{l_conge}", token=TE)
        check("retrait refusé si approuvé (409)", s == 409, f"status={s}")
        s, _ = call("DELETE", f"/api/me/employee/leaves/{l_mal}", token=TE)
        check("retrait refusé si rejeté (409)", s == 409, f"status={s}")
        s, ls = call("POST", "/api/me/employee/leaves",
                     {"start_date": (MON + timedelta(days=14)).isoformat(), "type": "maladie"}, token=TE)
        check("demande courte (1 jour)", s in (200, 201) and ls.get("days") == 1, f"status={s} {ls}")
        l_self = ls.get("id")
        s, _ = call("DELETE", f"/api/me/employee/leaves/{l_self}", token=TE)
        check("retrait self-service (200)", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/leaves/{l_conge}", token=T)
        check("suppression admin (congé approuvé)", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/leaves/{l_mal}", token=T)
        check("suppression admin (maladie rejetée)", s == 200, f"status={s}")

        print("== Pointage ==")
        s, p1 = call("POST", "/api/me/attendance/ping", {}, token=TE)
        check("ping (horodatage d'arrivée)", s == 200 and bool(p1.get("clock_in")), f"status={s} {p1}")
        s, p2 = call("POST", "/api/me/attendance/ping", {}, token=TE)
        check("2ᵉ ping (mise à jour présence)", s == 200, f"status={s}")
        s, atts = call("GET", f"/api/admin/grh/attendance?month={MONTH}", token=T)
        att_row = next((a for a in atts if a.get("employee_id") == id2), {}) if isinstance(atts, list) else {}
        check("liste du pointage (mois courant)", s == 200 and att_row.get("id"), f"status={s} n={len(atts) if isinstance(atts, list) else '-'}")
        att_id = att_row.get("id")
        s, _ = call("PUT", f"/api/admin/grh/attendance/{att_id}", {"clock_in": "09:00", "clock_out": "17:30"}, token=T)
        check("correction admin (corrected)", s == 200, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/attendance/{att_id}", {"clock_in": "abc"}, token=T)
        check("heure invalide (400)", s == 400, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/attendance/{att_id}", {"clock_in": "16:00", "clock_out": "09:00"}, token=T)
        check("fin avant début (400)", s == 400, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/attendance/{att_id}", {"date": (today - timedelta(days=1)).isoformat()}, token=T)
        check("déplacement de date", s == 200, f"status={s}")
        s, csv = call("GET", f"/api/admin/grh/attendance/export?month={MONTH}", token=T)
        check("export CSV du pointage", s == 200 and "Date;Employé" in str(csv.get("raw", "")), f"status={s}")

        print("== Paie ==")
        s, pay = call("POST", "/api/admin/grh/payroll", {
            "employee_id": id1, "month": MONTH, "base_salary": 1300,
            "bonus": 100, "bonus_label": "Prime E2E", "deductions": 50, "deductions_label": "Retenue E2E",
            "status": "brouillon"
        }, token=T)
        check("bulletin créé (net = 1300+100-50)", s in (200, 201) and pay.get("net") == 1350, f"status={s} {pay}")
        pid = pay.get("id")
        s, _ = call("POST", "/api/admin/grh/payroll", {"employee_id": id1, "month": MONTH}, token=T)
        check("bulletin dupliqué (409)", s == 409, f"status={s}")
        s, _ = call("POST", "/api/admin/grh/payroll", {"employee_id": id1, "month": "2026-13"}, token=T)
        check("mois invalide (400)", s == 400, f"status={s}")
        s, _ = call("POST", "/api/admin/grh/payroll", {"employee_id": id1, "month": MONTH}, token=TE)
        check("paie réservée au super admin (403)", s == 403, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/payroll/{pid}", {"status": "envoye"}, token=T)
        check("bulletin envoyé", s == 200, f"status={s}")
        s, entries = call("GET", f"/api/admin/compta/entries?from={MONTH}-01&to={MONTH}-31", token=T)
        pe = next((x for x in entries if isinstance(x, dict) and x.get("source_id") == pid), None) if isinstance(entries, list) else None
        check("paie envoyée → écriture SYCEBNL (journal BQ, 2 lignes)",
              bool(pe) and pe.get("journal_code") == "BQ" and pe.get("line_count") == 2, f"status={s} {pe and pe.get('label')}")
        s, pdf = call("GET", f"/api/admin/grh/payroll/{pid}/pdf", token=T)
        check("bulletin de paie PDF", s == 200 and str(pdf.get("raw", "")).startswith("pdf"), f"status={s}")
        s, csv = call("GET", f"/api/admin/grh/payroll/export?month={MONTH}", token=T)
        check("export CSV de la paie", s == 200 and "Employé;Fonction" in str(csv.get("raw", "")), f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/payroll/{pid}", {"status": "brouillon"}, token=T)
        check("retour en brouillon", s == 200, f"status={s}")
        s, entries2 = call("GET", f"/api/admin/compta/entries?from={MONTH}-01&to={MONTH}-31", token=T)
        pe2 = next((x for x in entries2 if isinstance(x, dict) and x.get("source_id") == pid), None) if isinstance(entries2, list) else None
        check("écriture SYCEBNL supprimée (revenir en brouillon)", pe2 is None, f"trouvé={bool(pe2)}")
        s, gen = call("POST", "/api/admin/grh/payroll/generate", {"month": MONTH_PREV}, token=T)
        check("génération de la paie du mois précédent", s == 200 and isinstance(gen, dict) and gen.get("created", 0) >= 1, f"status={s} {gen}")
        s, prev = call("GET", f"/api/admin/grh/payroll?month={MONTH_PREV}", token=T)
        pid_prev = next((p for p in prev if p.get("employee_id") == id1), {}).get("id") if isinstance(prev, list) else None
        check("bulletin généré listé", s == 200 and bool(pid_prev), f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/payroll/{pid}", token=T)
        check("bulletin supprimé", s == 200, f"status={s}")

        print("== Recrutement ==")
        s, job = call("POST", "/api/admin/grh/jobs", {
            "title": f"Agent de terrain E2E {stamp}", "department_id": dept_id,
            "description": "Offre de test", "requirements": "Expérience 2 ans",
            "contract_type": "permanent", "location": "Goma"
        }, token=T)
        check("offre d'emploi créée", s in (200, 201) and job.get("id"), f"status={s} {job}")
        job_id = job.get("id")
        s, _ = call("POST", "/api/admin/grh/jobs", {"title": "  "}, token=T)
        check("offre sans intitulé (400)", s == 400, f"status={s}")
        s, cand = call_multipart("POST", "/api/admin/grh/candidates",
                                 {"full_name": f"Candidat E2E {stamp}", "email": f"e2e.cand.{stamp}@exemple.org",
                                  "phone": "+243 990 000 002", "job_id": job_id},
                                 "cv", "cv-e2e.pdf", PDF_BYTES, "application/pdf", T)
        check("candidat créé avec CV", s in (200, 201) and cand.get("id") and bool(cand.get("cv_file")), f"status={s} {cand}")
        cand_id = cand.get("id")
        s, _ = call("POST", "/api/admin/grh/candidates", {"full_name": ""}, token=T)
        check("candidat sans nom (400)", s == 400, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/candidates/{cand_id}", {"stage": "entretien", "interview_date": (MON + timedelta(days=3)).isoformat()}, token=T)
        check("passage en entretien", s == 200, f"status={s}")
        s, c2 = call("PUT", f"/api/admin/grh/candidates/{cand_id}", {"stage": "invalide"}, token=T)
        check("stage invalide ignoré", s == 200 and c2.get("stage") == "entretien", f"stage={c2.get('stage')}")
        s, hired = call("POST", f"/api/admin/grh/candidates/{cand_id}/hire", {}, token=T)
        check("embauche → employé créé (poste hérité)", s in (200, 201) and hired.get("id") and hired.get("position") == f"Agent de terrain E2E {stamp}", f"status={s} {hired}")
        hire_id = hired.get("id")
        s, _ = call("POST", f"/api/admin/grh/candidates/{cand_id}/hire", {}, token=T)
        check("re-embauche refusée (409)", s == 409, f"status={s}")
        s, _ = call("GET", f"/api/admin/grh/candidates/{cand_id}/cv", token=T)
        check("CV téléchargeable", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/jobs/{job_id}", token=T)
        check("offre supprimée", s == 200, f"status={s}")

        print("== Évaluations ==")
        s, ev = call("POST", "/api/admin/grh/evaluations", {
            "employee_id": id1, "period": MONTH,
            "criteria": [{"label": "Rigueur", "score": 4}, {"label": "Travail en équipe", "score": 5}],
            "comments": "Évaluation E2E"
        }, token=T)
        check("évaluation créée (moyenne 4,5)", s in (200, 201) and ev.get("overall") == 4.5, f"status={s} {ev}")
        eval_id = ev.get("id")
        s, ev2 = call("POST", "/api/admin/grh/evaluations", {
            "employee_id": id1, "period": MONTH_PREV, "criteria": [{"label": "Autonomie", "score": 9}]
        }, token=T)
        crit = ev2.get("criteria") if isinstance(ev2, dict) else []
        check("score hors bornes ramené à 5", s in (200, 201) and bool(crit) and crit[0].get("score") == 5, f"status={s} {crit}")
        eval_id2 = ev2.get("id")
        s, _ = call("POST", "/api/admin/grh/evaluations", {"employee_id": id1, "period": MONTH, "criteria": [{"label": "X", "score": 3}]}, token=T)
        check("double évaluation même période (409)", s == 409, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/evaluations/{eval_id}", {"status": "validee"}, token=T)
        check("évaluation validée", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/evaluations/{eval_id}", token=T)
        s2, _ = call("DELETE", f"/api/admin/grh/evaluations/{eval_id2}", token=T)
        check("évaluations supprimées", s == 200 and s2 == 200, f"status={s},{s2}")

        print("== Formations ==")
        s, tr = call("POST", "/api/admin/grh/trainings", {
            "title": f"Formation sécurité E2E {stamp}", "type": "interne", "provider": "E2E",
            "start_date": (MON + timedelta(days=10)).isoformat(), "end_date": (MON + timedelta(days=11)).isoformat(), "cost": 500
        }, token=T)
        check("formation créée", s in (200, 201) and tr.get("id"), f"status={s} {tr}")
        train_id = tr.get("id")
        s, _ = call("POST", "/api/admin/grh/trainings", {"title": "  "}, token=T)
        check("formation sans intitulé (400)", s == 400, f"status={s}")
        s, att = call("POST", f"/api/admin/grh/trainings/{train_id}/attendees", {"employee_id": id1}, token=T)
        check("participant inscrit", s in (200, 201), f"status={s} {att}")
        aid = att.get("id")
        s, _ = call("POST", f"/api/admin/grh/trainings/{train_id}/attendees", {"employee_id": id1}, token=T)
        check("double inscription (409)", s == 409, f"status={s}")
        s, _ = call("PUT", f"/api/admin/grh/trainings/attendees/{aid}", {"status": "termine"}, token=T)
        check("participation terminée", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/trainings/{train_id}", token=T)
        check("formation supprimée", s == 200, f"status={s}")

        print("== Annonces ==")
        s, an = call("POST", "/api/admin/grh/announcements", {"title": f"Annonce E2E {stamp}", "content": "Annonce de test pour le module GRH."}, token=T)
        check("annonce publiée", s in (200, 201) and an.get("id"), f"status={s} {an}")
        ann_id = an.get("id")
        s, _ = call("POST", "/api/admin/grh/announcements", {"title": "  ", "content": "   "}, token=T)
        check("annonce vide (400)", s == 400, f"status={s}")
        s, myann = call("GET", "/api/me/employee/announcements", token=TE)
        check("annonce visible côté employé", s == 200 and any(a.get("id") == ann_id for a in myann), f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/announcements/{ann_id}", token=T)
        check("annonce supprimée", s == 200, f"status={s}")

        print("== Projets & tâches ==")
        s, pj = call("POST", "/api/admin/grh/projects", {
            "name": f"Projet E2E {stamp}", "description": "Projet de test", "client": "E2E",
            "deadline": (MON + timedelta(days=30)).isoformat(), "status": "en_cours"
        }, token=T)
        check("projet créé", s in (200, 201) and pj.get("id"), f"status={s} {pj}")
        proj_id = pj.get("id")
        s, _ = call("POST", "/api/admin/grh/projects", {"name": "  "}, token=T)
        check("projet sans nom (400)", s == 400, f"status={s}")
        s, tk = call("POST", "/api/admin/grh/tasks", {
            "title": f"Tâche E2E {stamp}", "project_id": proj_id, "assignee_id": id1,
            "priority": "haute", "due_date": (MON + timedelta(days=7)).isoformat(), "status": "a_faire"
        }, token=T)
        check("tâche créée (priorité haute)", s in (200, 201) and tk.get("id"), f"status={s} {tk}")
        task_id = tk.get("id")
        s, _ = call("POST", "/api/admin/grh/tasks", {"title": ""}, token=T)
        check("tâche sans intitulé (400)", s == 400, f"status={s}")
        s, _ = call("POST", "/api/admin/grh/tasks", {"title": "X", "priority": "maximale"}, token=T)
        check("priorité invalide (400)", s == 400, f"status={s}")
        s, _ = call("POST", "/api/admin/grh/tasks", {"title": "X", "project_id": 999999}, token=T)
        check("projet inconnu (400)", s == 400, f"status={s}")
        s, _ = call("PATCH", f"/api/admin/grh/tasks/{task_id}/status", {"status": "en_cours"}, token=T)
        check("tâche en cours", s == 200, f"status={s}")
        s, td = call("PATCH", f"/api/admin/grh/tasks/{task_id}/status", {"status": "terminee"}, token=T)
        check("tâche terminée (completed_at)", s == 200 and bool(td.get("completed_at")), f"status={s}")
        s, _ = call("PATCH", f"/api/admin/grh/tasks/{task_id}/status", {"status": "invalide"}, token=T)
        check("statut invalide (400)", s == 400, f"status={s}")
        s, note = call("POST", f"/api/admin/grh/tasks/{task_id}/notes", {"body": f"note e2e {stamp}"}, token=T)
        check("commentaire ajouté", s in (200, 201) and note.get("id"), f"status={s}")
        s, _ = call("POST", f"/api/admin/grh/tasks/{task_id}/notes", {"body": "  "}, token=T)
        check("commentaire vide (400)", s == 400, f"status={s}")
        s, tdet = call("GET", f"/api/admin/grh/tasks/{task_id}", token=T)
        check("détail tâche avec commentaire", s == 200 and f"note e2e {stamp}" in json.dumps(tdet), f"status={s}")
        s, pdf = call("GET", f"/api/admin/grh/tasks/{task_id}/pdf", token=T)
        check("fiche de tâche PDF", s == 200 and str(pdf.get("raw", "")).startswith("pdf"), f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/tasks/{task_id}", token=T)
        check("tâche supprimée", s == 200, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/projects/{proj_id}", token=T)
        check("projet supprimé", s == 200, f"status={s}")

        print("== Chat employé ↔ admin ==")
        s, mc = call("GET", "/api/me/chat", token=TE)
        check("boîte employé ouverte", s == 200, f"status={s}")
        s, mm = call("POST", "/api/me/chat", {"body": f"bonjour e2e {stamp}"}, token=TE)
        check("message envoyé par l'employé", s in (200, 201) and mm.get("id"), f"status={s} {mm}")
        s, al = call("GET", "/api/admin/grh/chat", token=T)
        check("conversation listée côté admin", s == 200 and any(c.get("employee_id") == id2 or c.get("id") == id2 for c in al), f"status={s}")
        s, msgs = call("GET", f"/api/admin/grh/chat/{id2}", token=T)
        check("message reçu côté admin", s == 200 and f"bonjour e2e {stamp}" in json.dumps(msgs), f"status={s}")
        s, _ = call("POST", f"/api/admin/grh/chat/{id2}", {"body": f"réponse e2e {stamp}"}, token=T)
        check("réponse de l'admin", s in (200, 201), f"status={s}")

        print("== Certificats & documents internes ==")
        s, pdf = call("GET", f"/api/admin/grh/employees/{id1}/certificate?type=emploi", token=T)
        check("certificat de travail (PDF)", s == 200 and str(pdf.get("raw", "")).startswith("pdf"), f"status={s}")
        s, pdf = call("GET", f"/api/admin/grh/employees/{id1}/certificate?type=travail&end_date=2026-12-31", token=T)
        check("attestation (PDF)", s == 200 and str(pdf.get("raw", "")).startswith("pdf"), f"status={s}")
        s, adoc = call_multipart("POST", "/api/admin/grh/admin-docs",
                                 {"name": "Note de service E2E", "category": "interne"},
                                 "file", "note-e2e.pdf", PDF_BYTES, "application/pdf", T)
        check("document interne joint", s in (200, 201) and adoc.get("id"), f"status={s} {adoc}")
        adoc_id = adoc.get("id")
        s, _ = call("GET", f"/api/admin/grh/admin-docs/{adoc_id}/download", token=T)
        check("document interne téléchargeable", s == 200, f"status={s}")
        s, _ = call("GET", "/api/admin/grh/admin-docs")
        check("documents internes sans token (401)", s == 401, f"status={s}")
        s, _ = call("DELETE", f"/api/admin/grh/admin-docs/{adoc_id}", token=T)
        check("document interne supprimé", s == 200, f"status={s}")

        print("== Sécurité des rôles ==")
        s, _ = call("GET", "/api/admin/grh/employees", token=TV)
        check("viewer bloqué sur l'admin GRH (403)", s == 403, f"status={s}")
        s, _ = call("GET", "/api/me/employee", token=TV)
        check("sans dossier employé lié (404)", s == 404, f"status={s}")
        s, _ = call("POST", "/api/me/employee/leaves", {"start_date": MON.isoformat(), "type": "conge"}, token=TV)
        check("demande de congé sans dossier lié (404)", s == 404, f"status={s}")

        print("== Module désactivé ==")
        call("PUT", "/api/admin/modules", {"grh_enabled": False}, token=T)
        s, _ = call("GET", "/api/admin/grh/employees", token=T)
        check("GRH désactivée → admin (403)", s == 403, f"status={s}")
        s, _ = call("GET", "/api/me/employee", token=TE)
        check("GRH désactivée → espace employé (403)", s == 403, f"status={s}")
        call("PUT", "/api/admin/modules", {"grh_enabled": True}, token=T)
        s, _ = call("GET", "/api/admin/grh/employees", token=T)
        check("GRH réactivée (200)", s == 200, f"status={s}")
    finally:
        print("== Nettoyage ==")
        for p in (pid, pid_prev):
            if p:
                try:
                    call("DELETE", f"/api/admin/grh/payroll/{p}", token=T)
                except Exception:
                    pass
        for rid, route in (
            (task_id, "tasks"), (proj_id, "projects"), (train_id, "trainings"),
            (ann_id, "announcements"), (eval_id, "evaluations"), (eval_id2, "evaluations"),
            (cand_id, "candidates"), (job_id, "jobs"), (hire_id, "employees"), (id1, "employees"), (id2, "employees"),
            (dept_id, "departments"), (adoc_id, "admin-docs")
        ):
            if rid:
                try:
                    call("DELETE", f"/api/admin/grh/{route}/{rid}", token=T)
                except Exception:
                    pass
        for uid in (idE, idV):
            if uid:
                try:
                    s, _ = call("DELETE", f"/api/admin/users/{uid}", token=T)
                    check(f"utilisateur {uid} supprimé", s == 200, f"status={s}")
                except Exception as e:
                    KO += 1
                    FAILS.append(f"nettoyage utilisateur {uid} — {e}")
        try:
            con = sqlite3.connect(DB_FILE, timeout=10)
            cur = con.cursor()
            cur.execute("BEGIN")
            for eid in (id1, id2, hire_id):
                if eid:
                    cur.execute("DELETE FROM grh_attendance WHERE employee_id = ?", (eid,))
                    cur.execute("DELETE FROM grh_chat WHERE employee_id = ?", (eid,))
            cur.execute("DELETE FROM acc_entries WHERE source = 'payroll'")
            cur.execute("DELETE FROM acc_entry_lines WHERE entry_id NOT IN (SELECT id FROM acc_entries)")
            con.commit()
            con.close()
            print("  OK   résidus de test effacés (base)")
            OK += 1
        except Exception as e:
            KO += 1
            FAILS.append(f"nettoyage base — {e}")
            print(f"  KO   nettoyage base — {e}")
        if not orig_grh:
            call("PUT", "/api/admin/modules", {"grh_enabled": False}, token=T)

    print(f"\n==== RÉSULTAT : {OK} OK / {KO} KO ====")
    if FAILS:
        print("Échecs :")
        for f in FAILS:
            print("  -", f)
    return 1 if KO else 0


if __name__ == "__main__":
    sys.exit(main())
