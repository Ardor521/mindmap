import fs from 'node:fs';
import { parseProject } from './src/lib/projectStorage';

for (const name of ['projets/knowledge-universe.json','projets/présentation.json','projets/japonais.json','projets/systeme-solaire.json']) {
  const raw = fs.readFileSync(name,'utf8');
  const parsedRaw = JSON.parse(raw);
  const g : any = parsedRaw.project || parsedRaw;
  const parsed = parseProject(raw);
  if (!parsed) { console.log(name, "parse failed"); continue; }
  console.log(`\n=== ${name} ===`);
  console.log(`before mapKind=${g.mapKind} after mapKind=${parsed.mapKind}`);
  const origMap = new Map(g.nodes.map((n:any)=>[n.id,{x:n.x,y:n.y,scale:n.scale,depth:n.depth,parentId:n.parentId,scaleLocked:n.scaleLocked}]));
  let posChanges=0,scaleChanges=0,depthChanges=0,parentChanges=0,lockedChanges=0;
  let maxScaleDiff=0;
  for (const n of parsed.nodes) {
    const o:any = origMap.get(n.id);
    if (!o) continue;
    if (Math.abs(n.x - o.x)>0.01 || Math.abs(n.y - o.y)>0.01) posChanges++;
    if (Math.abs(n.scale - o.scale)>0.001) { scaleChanges++; maxScaleDiff=Math.max(maxScaleDiff,Math.abs(n.scale-o.scale)); }
    if (n.depth!==o.depth) depthChanges++;
    if (n.parentId!==o.parentId) parentChanges++;
    if (!!n.scaleLocked !== !!o.scaleLocked) lockedChanges++;
  }
  console.log(`changes: pos=${posChanges} scale=${scaleChanges} maxScaleDiff=${maxScaleDiff.toFixed(4)} depth=${depthChanges} parent=${parentChanges} lockedChanges=${lockedChanges}`);
  if (scaleChanges>0) {
    for (const n of parsed.nodes.slice(0,10)) {
      const o:any=origMap.get(n.id);
      if (Math.abs(n.scale-o.scale)>0.001) console.log(`  SCALE ${n.title.slice(0,20)} ${o.scale.toFixed(3)}->${n.scale.toFixed(3)} locked ${o.scaleLocked}->${n.scaleLocked}`);
    }
  }
  // Check preserved
  const ok = posChanges===0 && scaleChanges===0 && depthChanges===0 && parentChanges===0;
  console.log(ok ? "✅ PARFAIT — mise en place 100% préservée" : "❌ encore des diffs");
}
