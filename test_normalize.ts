import fs from 'node:fs';
import { normalizeGraphData } from './src/lib/layout';
import { parseProject, serializeProject } from './src/lib/projectStorage';
import type { GraphData } from './src/lib/types';

for (const name of ['projets/knowledge-universe.json','projets/présentation.json','projets/japonais.json','projets/systeme-solaire.json']) {
  const raw = fs.readFileSync(name,'utf8');
  const parsed = JSON.parse(raw);
  const g : GraphData = (parsed.project || parsed) as GraphData;
  console.log(`\n=== ${name} BEFORE === mapKind=${(g as any).mapKind} nodes=${g.nodes.length} edges=${g.edges.length}`);
  // store original positions
  const origMap = new Map(g.nodes.map(n=>[n.id,{x:n.x,y:n.y,scale:n.scale,depth:n.depth,parentId:n.parentId}]));
  const norm = parseProject(raw);
  if (!norm) { console.log("parse failed"); continue; }
  console.log(`AFTER mapKind=${norm.mapKind} projectName=${norm.projectName}`);
  // diff
  let posChanges=0, scaleChanges=0, depthChanges=0, parentChanges=0;
  let maxDx=0, maxDy=0, maxScaleDiff=0;
  for (const n of norm.nodes) {
    const o = origMap.get(n.id);
    if (!o) { console.log(`  NEW NODE ${n.id}`); continue; }
    const dx = n.x - o.x;
    const dy = n.y - o.y;
    if (Math.abs(dx)>0.01 || Math.abs(dy)>0.01) { posChanges++; maxDx=Math.max(maxDx,Math.abs(dx)); maxDy=Math.max(maxDy,Math.abs(dy)); }
    if (Math.abs(n.scale - o.scale)>0.001) { scaleChanges++; maxScaleDiff=Math.max(maxScaleDiff, Math.abs(n.scale - o.scale)); }
    if (n.depth !== o.depth) depthChanges++;
    if (n.parentId !== o.parentId) parentChanges++;
  }
  console.log(`changes: pos=${posChanges} (maxDx ${maxDx.toFixed(1)} maxDy ${maxDy.toFixed(1)}) scale=${scaleChanges} maxScaleDiff ${maxScaleDiff.toFixed(3)} depth=${depthChanges} parent=${parentChanges}`);
  if (posChanges>0) {
    for (const n of norm.nodes.slice(0,8)) {
      const o = origMap.get(n.id)!;
      if (Math.abs(n.x - o.x)>0.01 || Math.abs(n.y - o.y)>0.01) {
        console.log(`  POS DIFF ${n.title.slice(0,20)}: before (${o.x.toFixed(1)},${o.y.toFixed(1)}) -> after (${n.x.toFixed(1)},${n.y.toFixed(1)})`);
      }
    }
  }
  if (scaleChanges>0) {
    for (const n of norm.nodes.slice(0,10)) {
      const o = origMap.get(n.id)!;
      if (Math.abs(n.scale - o.scale)>0.001) {
        console.log(`  SCALE DIFF ${n.title.slice(0,20)}: ${o.scale.toFixed(3)} -> ${n.scale.toFixed(3)} depth ${o.depth}->${n.depth} parent ${o.parentId}->${n.parentId}`);
      }
    }
  }
  if (parentChanges>0) {
    for (const n of norm.nodes.slice(0,20)) {
      const o = origMap.get(n.id)!;
      if (n.parentId !== o.parentId) {
        console.log(`  PARENT DIFF ${n.title.slice(0,20)}: ${o.parentId} -> ${n.parentId}`);
      }
    }
  }
  // Also test forceScales true
  const normForce = normalizeGraphData(g as GraphData, {forceScales:true});
  let scaleChangesForce=0;
  for (const n of normForce.nodes) {
    const o = origMap.get(n.id);
    if (o && Math.abs(n.scale - o.scale)>0.001) scaleChangesForce++;
  }
  console.log(`  forceScales=true scaleChanges=${scaleChangesForce}`);
}
