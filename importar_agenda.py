#!/usr/bin/env python3
"""Importador local de agenda; sem envio de dados pessoais ao GitHub."""
import argparse
import json
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from server import DATA, DB, FIELDS, db, initialize, validate_event

def import_file(filename, dry_run=False):
    filename=Path(filename).expanduser().resolve()
    if not filename.is_file(): raise ValueError(f"Arquivo não encontrado: {filename}")
    if filename.stat().st_size>200_000: raise ValueError("Arquivo muito grande.")
    data=json.loads(filename.read_text(encoding="utf-8-sig"))
    if not isinstance(data,dict) or data.get("format")!="davi-agenda-v1":
        raise ValueError("Arquivo não é uma agenda no formato davi-agenda-v1.")
    entries=data.get("events")
    if not isinstance(entries,list) or not 1<=len(entries)<=300:
        raise ValueError("A agenda precisa ter de 1 a 300 atividades.")
    validated=[]
    ids=set()
    for i,entry in enumerate(entries,1):
        if not isinstance(entry,dict): raise ValueError(f"Linha {i} inválida.")
        key=entry.get("key")
        if not isinstance(key,str) or not key.isascii() or not 1<=len(key)<=90 or not all(c.isalnum() or c in "-_" for c in key):
            raise ValueError(f"Identificador inválido na atividade {i}.")
        if key in ids: raise ValueError(f"Identificador duplicado no arquivo: {key}")
        ids.add(key)
        values=validate_event(entry)
        validated.append((key,values,entry["title"]))
    # Cria banco, mas nunca apaga/modifica linhas preexistentes sem controle.
    initialize()
    retire=data.get("retire_keys",[])
    if not isinstance(retire,list) or any(not isinstance(k,str) for k in retire):
        raise ValueError("Lista de chaves antigas inválida.")
    if set(retire)&ids:
        raise ValueError("Uma atividade não pode ser importada e removida no mesmo arquivo.")
    with db() as c:
        c.execute("CREATE TABLE IF NOT EXISTS import_keys (source_key TEXT PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE)")
        existing={r["source_key"]:r["event_id"] for r in c.execute("SELECT source_key,event_id FROM import_keys")}
        current={r["id"]:r for r in c.execute("SELECT * FROM events")}
    new=[item for item in validated if item[0] not in existing]
    changed=[]
    for key,values,title in validated:
        if key not in existing: continue
        old=current.get(existing[key])
        if old is None: continue
        if tuple(old[field] for field in FIELDS.split(","))!=tuple(values):
            changed.append((key,values,title,existing[key]))
    retired=[(key,existing[key]) for key in retire if key in existing]
    print(f"Atividades no arquivo: {len(validated)}")
    print(f"Novas atividades: {len(new)}")
    print(f"Atividades alteradas: {len(changed)}")
    print(f"Atividades antigas a remover: {len(retired)}")
    for _,_,title in new: print("  + "+title)
    for _,_,title,_ in changed: print("  ~ "+title)
    for key,_ in retired: print("  - "+key)
    if dry_run:
        print("SIMULAÇÃO: nenhuma atividade foi alterada.")
        return
    if not (new or changed or retired):
        print("Nada para importar. Os registros anteriores permanecem.")
        return
    DATA.mkdir(parents=True,exist_ok=True)
    backup=DATA/("agenda-backup-"+datetime.now().strftime("%Y%m%d-%H%M%S-%f")+".sqlite3")
    source=sqlite3.connect(DB)
    try:
        destination=sqlite3.connect(backup)
        try: source.backup(destination)
        finally: destination.close()
    finally: source.close()
    print("Backup pré-importação:",backup)
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        for key,values,_ in new:
            cur=c.execute(f"INSERT INTO events({FIELDS}) VALUES({','.join('?' * len(values))})",values)
            c.execute("INSERT INTO import_keys(source_key,event_id) VALUES(?,?)",(key,cur.lastrowid))
        for _,values,_,id in changed:
            c.execute("UPDATE events SET "+",".join(field+"=?" for field in FIELDS.split(","))+" WHERE id=?",(*values,id))
        for _,id in retired:
            c.execute("DELETE FROM events WHERE id=?",(id,))
    print(f"OK: {len(new)} incluídas, {len(changed)} atualizadas e {len(retired)} removidas. Recarregue a agenda.")

def main():
    p=argparse.ArgumentParser(description="Importa arquivo de atividades para SQLite local, com backup e sem duplicatas.")
    p.add_argument("arquivo",help="Caminho para JSON da agenda (não inclua dados pessoais no GitHub)")
    p.add_argument("--simular",action="store_true",help="Somente validar e exibir as atividades")
    args=p.parse_args()
    try: import_file(args.arquivo,args.simular)
    except (ValueError,sqlite3.Error,OSError,json.JSONDecodeError) as e:
        print("ERRO:",e,file=sys.stderr)
        raise SystemExit(1)

if __name__=="__main__": main()
