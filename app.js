/* PollinatorPath: application data, graph calculations, then page/event handling. */
(() => {
  "use strict";

  // Positions are intentionally schematic (local kilometers for distance math, not GIS).
  const cityData = {
    columbia: {
      name: "Columbia, SC", title: "Columbia habitat network", mapKind: "schematic",
      habitats: [
        { id: "finlay", name: "Finlay Park", kind: "park", x: 4.0, y: 3.2, note: "Real city park. Published reference point: 34.006317, -81.041680; position here is schematic." },
        { id: "earlewood", name: "Earlewood Park", kind: "park", x: 2.0, y: 7.0, note: "Real city park; plotted approximately in this schematic." },
        { id: "riverfront", name: "Riverfront Park", kind: "park", x: 0.5, y: 3.1, note: "Real city park; a long riverfront park represented as one simplified node." },
        { id: "memorial", name: "Memorial Park", kind: "park", x: 6.2, y: 2.3, note: "Real city park; plotted approximately in this schematic." },
        { id: "granby", name: "Granby Park", kind: "park", x: 5.0, y: 0.5, note: "Real city park; plotted approximately in this schematic." },
        { id: "owens", name: "Owens Field Park", kind: "park", x: 8.8, y: 1.0, note: "Real city park; plotted approximately in this schematic." }
      ],
      candidates: [
        { id: "garden-1", name: "Vista garden concept", x: 6.8, y: 4.4 }, { id: "garden-2", name: "North Main garden concept", x: 3.5, y: 5.8 },
        { id: "garden-3", name: "West Gervais garden concept", x: 2.2, y: 2.5 }, { id: "garden-4", name: "Southside garden concept", x: 7.0, y: 0.2 },
        { id: "garden-5", name: "Canal edge garden concept", x: 1.0, y: 5.0 }, { id: "garden-6", name: "East neighborhood garden concept", x: 8.3, y: 3.1 }
      ], plants: [
        { name: "Purple coneflower", latin: "Echinacea purpurea", bloom: "Summer", sun: "Full sun", water: "Average; established plants tolerate some dryness", benefit: "Nectar and pollen for bees and butterflies." },
        { name: "Scarlet bee balm", latin: "Monarda didyma", bloom: "Summer", sun: "Sun to partial shade", water: "Moist soil", benefit: "Tubular flowers attract bees, butterflies, and hummingbirds." },
        { name: "Cardinal flower", latin: "Lobelia cardinalis", bloom: "Summer to early fall", sun: "Sun to partial shade", water: "Moist to wet soil", benefit: "Nectar-rich flowers attract hummingbirds and other pollinators." },
        { name: "Swamp milkweed", latin: "Asclepias incarnata", bloom: "Summer", sun: "Full sun", water: "Moist soil", benefit: "Nectar for pollinators and a monarch caterpillar host plant." },
        { name: "Carolina rose", latin: "Rosa carolina", bloom: "Early summer", sun: "Sun to partial shade", water: "Average; adaptable once established", benefit: "Flowers provide pollen and nectar for native bees." },
        { name: "Blue mistflower", latin: "Conoclinium coelestinum", bloom: "Late summer to fall", sun: "Sun to partial shade", water: "Average to moist", benefit: "Late-season nectar source for butterflies and bees." }
      ]
    },
    demo: {
      name: "Fictional Neighborhood Demo", title: "Fictional neighborhood network", mapKind: "fictional schematic",
      habitats: [
        { id: "demo-a", name: "Cedar Pocket Park", kind: "green", x: 1, y: 1, note: "Fictional habitat node for demonstration." },
        { id: "demo-b", name: "Schoolyard Meadow", kind: "green", x: 2.5, y: 6.8, note: "Fictional habitat node for demonstration." },
        { id: "demo-c", name: "Creekside Green", kind: "green", x: 7, y: 6.1, note: "Fictional habitat node for demonstration." },
        { id: "demo-d", name: "Community Orchard", kind: "green", x: 9, y: 1.5, note: "Fictional habitat node for demonstration." },
        { id: "demo-e", name: "Library Garden", kind: "green", x: 5, y: 2.5, note: "Fictional habitat node for demonstration." }
      ], candidates: [
        { id: "demo-g1", name: "Maple Corner garden concept", x: 3.5, y: 3.7 }, { id: "demo-g2", name: "Creek bridge garden concept", x: 8, y: 4 },
        { id: "demo-g3", name: "West block garden concept", x: 1.4, y: 4.2 }, { id: "demo-g4", name: "South lot garden concept", x: 6.7, y: 1.8 }
      ], plants: []
    }
  };

  const state = { cityId: "columbia", range: 3, planted: [], recommendedId: null, beforeScore: 0, journeyTimer: null, lastPlantedId: null, presentationTimers: [] };
  const $ = (id) => document.getElementById(id);

  // Graph calculations: Euclidean distance, adjacency list, components, pair score, BFS.
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function buildGraph(nodes, range) {
    const adjacency = new Map(nodes.map((node) => [node.id, []]));
    for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
      if (distance(nodes[i], nodes[j]) <= range) { adjacency.get(nodes[i].id).push(nodes[j].id); adjacency.get(nodes[j].id).push(nodes[i].id); }
    }
    return adjacency;
  }
  function components(nodes, adjacency) {
    const seen = new Set(); const groups = [];
    for (const node of nodes) if (!seen.has(node.id)) {
      const group = []; const queue = [node.id]; seen.add(node.id);
      for (let i = 0; i < queue.length; i += 1) { const id = queue[i]; group.push(id); for (const next of adjacency.get(id) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
      groups.push(group);
    }
    return groups;
  }
  function shortestPath(adjacency, start, end) {
    if (!adjacency.has(start) || !adjacency.has(end)) return null;
    const queue = [start]; const parent = new Map([[start, null]]);
    for (let i = 0; i < queue.length; i += 1) { const id = queue[i]; if (id === end) break; for (const next of adjacency.get(id) || []) if (!parent.has(next)) { parent.set(next, id); queue.push(next); } }
    if (!parent.has(end)) return null;
    const path = []; for (let id = end; id !== null; id = parent.get(id)) path.unshift(id); return path;
  }
  function scoreOriginalPairs(original, adjacency) {
    let connected = 0; let total = 0;
    for (let i = 0; i < original.length; i += 1) for (let j = i + 1; j < original.length; j += 1) { total += 1; if (shortestPath(adjacency, original[i].id, original[j].id)) connected += 1; }
    return { connected, total, percent: total ? connected / total * 100 : 100 };
  }
  function findBestCandidate(habitats, candidates, planted, range) {
    const available = candidates.filter((candidate) => !planted.some((item) => item.id === candidate.id));
    let best = null;
    for (const candidate of available) {
      const trialNodes = [...habitats, ...planted.map((g) => ({ ...g, kind: "garden" })), { ...candidate, kind: "garden" }];
      const score = scoreOriginalPairs(habitats, buildGraph(trialNodes, range));
      if (!best || score.percent > best.score.percent) best = { candidate, score };
    }
    return best;
  }
  function activeCity() { return cityData[state.cityId]; }
  function allNodes(planted = state.planted) { const city = activeCity(); return [...city.habitats, ...planted.map((g) => ({ ...g, kind: "garden", note: "Hypothetical garden planted in this simulation." }))]; }
  function currentGraph(planted = state.planted, range = state.range) { const nodes = allNodes(planted); return { nodes, adjacency: buildGraph(nodes, range) }; }
  function getStats() { const city = activeCity(); const { nodes, adjacency } = currentGraph(); const comps = components(nodes, adjacency); const origScore = scoreOriginalPairs(city.habitats, adjacency); return { groups: new Set(city.habitats.map((h) => comps.findIndex((c) => c.includes(h.id)))).size, score: origScore }; }

  function svgEl(tag, attrs = {}) { const el = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; }
  function mapPoint(node) { const x = 55 + node.x / 10 * 650; const y = 425 - node.y / 8 * 365; return { x, y }; }
  function reducedMotion() { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }
  function seededRandom(seedText) {
    let seed = 2166136261;
    for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function pointToSegmentDistance(point, a, b) {
    const dx = b.x - a.x; const dy = b.y - a.y; const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len)) : 0;
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
  }
  function distanceToPolyline(point, points) {
    let closest = Infinity;
    for (let i = 0; i < points.length - 1; i += 1) closest = Math.min(closest, pointToSegmentDistance(point, points[i], points[i + 1]));
    return closest;
  }
  function drawScenery() {
    const layer = $("scenery-layer"); if (!layer) return; layer.replaceChildren();
    layer.append(svgEl("rect", { x: 0, y: 0, width: 760, height: 480, class: "map-bg" }));
    const city = activeCity(); const rand = seededRandom(state.cityId); const narrow = window.matchMedia?.("(max-width: 600px)").matches ?? false;
    const desired = (state.cityId === "columbia" ? 34 : 27) * (narrow ? 0.5 : 1);
    const protectedPoints = [...city.habitats, ...city.candidates].map((node) => ({ ...mapPoint(node), node }));
    // These polylines approximate the decorative road and creek strokes in drawMap.
    const road = [{ x: 30, y: 170 }, { x: 190, y: 190 }, { x: 270, y: 105 }, { x: 420, y: 135 }, { x: 575, y: 360 }, { x: 740, y: 310 }];
    const river = [{ x: 80, y: 360 }, { x: 205, y: 295 }, { x: 230, y: 340 }, { x: 355, y: 245 }, { x: 530, y: 125 }, { x: 700, y: 155 }];
    const palette = ["#e8a18a", "#eac469", "#a7bb92", "#c3a1bd", "#8caeaa"];
    let placed = 0; let attempts = 0;
    while (placed < desired && attempts < desired * 90) {
      attempts += 1;
      const kindRoll = rand(); const x = 28 + rand() * 704; const y = 28 + rand() * 420; const size = 13 + rand() * 11; const point = { x, y };
      if (protectedPoints.some((target) => Math.hypot(x - target.x, y - target.y) < 48)) continue;
      // Keep clear of node labels as well as marker centers.
      if (protectedPoints.some((target) => x > target.x + 4 && x < target.x + 145 && y > target.y - 27 && y < target.y + 21)) continue;
      if (distanceToPolyline(point, road) < 22 || distanceToPolyline(point, river) < 24) continue;
      const g = svgEl("g", { class: "scenery-item" });
      if (kindRoll < 0.18) {
        const w = size * 2.1; const h = size * 1.55; const tint = palette[Math.floor(rand() * palette.length)];
        g.append(svgEl("path", { d: `M ${x - w / 2} ${y - h / 2} L ${x} ${y - h} L ${x + w / 2} ${y - h / 2} V ${y + h / 2} H ${x - w / 2} Z`, class: "scenery-house", fill: tint }));
        g.append(svgEl("path", { d: `M ${x - w / 2 - 3} ${y - h / 2} L ${x} ${y - h - 4} L ${x + w / 2 + 3} ${y - h / 2}`, fill: "none", stroke: "#74543c", "stroke-width": 3, "stroke-linejoin": "round" }));
        g.append(svgEl("rect", { x: x - w * .29, y: y - h * .28, width: 6, height: 7, rx: 1, class: "scenery-window" }));
        g.append(svgEl("rect", { x: x + w * .12, y: y - h * .28, width: 6, height: 7, rx: 1, class: "scenery-window" }));
      } else if (kindRoll < 0.47) {
        g.append(svgEl("path", { d: `M ${x} ${y + size * .7} V ${y - size * .15}`, class: "scenery-trunk" }));
        g.append(svgEl("circle", { cx: x - size * .35, cy: y - size * .2, r: size * .58, class: rand() > .5 ? "scenery-tree" : "scenery-tree-dark" }));
        g.append(svgEl("circle", { cx: x + size * .35, cy: y - size * .22, r: size * .52, class: "scenery-tree" }));
        g.append(svgEl("circle", { cx: x, cy: y - size * .57, r: size * .61, class: "scenery-tree-dark" }));
      } else if (kindRoll < 0.72) {
        g.append(svgEl("ellipse", { cx: x, cy: y, rx: size * 1.2, ry: size * .55, class: "scenery-meadow" }));
        for (let i = 0; i < 3; i += 1) {
          const fx = x + (rand() - .5) * size * 1.6; const fy = y + (rand() - .5) * size * .65; const fh = size * (.55 + rand() * .45);
          g.append(svgEl("path", { d: `M ${fx} ${fy + fh} Q ${fx - 2} ${fy + fh / 2} ${fx} ${fy}`, class: "scenery-flower-stem", fill: "none" }));
          g.append(svgEl("circle", { cx: fx, cy: fy, r: 2.2, class: "scenery-flower" }));
        }
      } else {
        for (let i = 0; i < 5; i += 1) {
          const fx = x + (rand() - .5) * size * 2.5; const fy = y + (rand() - .5) * size * 1.1; const stem = size * (.5 + rand() * .5);
          g.append(svgEl("path", { d: `M ${fx} ${fy + stem} v ${-stem}`, class: "scenery-flower-stem", fill: "none" }));
          g.append(svgEl("circle", { cx: fx, cy: fy, r: 2.2 + rand() * 1.3, class: "scenery-flower" }));
        }
      }
      layer.append(g); placed += 1;
    }
    const bees = $("ambient-bees"); if (bees) { bees.replaceChildren(); if (!reducedMotion()) {
      for (let i = 0; i < 3; i += 1) { const bee = svgEl("g", { class: "ambient-bee", transform: `translate(${115 + i * 210} ${82 + (i % 2) * 63}) scale(.36)` }); bee.append(svgEl("use", { href: "#buzzy-happy", width: 80, height: 70 })); bees.append(bee); }
    } }
  }
  function plantArt(name) {
    const styles = {
      "Purple coneflower": ["#d4a6b5", "#9a6d8c"], "Scarlet bee balm": ["#e78e72", "#a9513f"], "Cardinal flower": ["#da786c", "#a7453d"],
      "Swamp milkweed": ["#e5a1a5", "#a95c7b"], "Carolina rose": ["#f0aaa2", "#bc6c69"], "Blue mistflower": ["#a9a8cd", "#77759f"]
    };
    const [petal, center] = styles[name] || ["#efbf62", "#9f7442"];
    return `<svg class="plant-art" viewBox="0 0 76 76" aria-hidden="true"><path d="M38 42v29m0-12q-15-14-22-3m22-8q12-15 23-6" fill="none" stroke="#58734d" stroke-width="3" stroke-linecap="round"/><g fill="${petal}" stroke="#674b38" stroke-width="1.4"><ellipse cx="38" cy="19" rx="6" ry="12"/><ellipse cx="38" cy="19" rx="6" ry="12" transform="rotate(60 38 31)"/><ellipse cx="38" cy="19" rx="6" ry="12" transform="rotate(120 38 31)"/></g><circle cx="38" cy="31" r="7" fill="${center}" stroke="#674b38" stroke-width="1.5"/><circle cx="25" cy="13" r="2" fill="#fff8e9"/><circle cx="54" cy="25" r="2" fill="#fff8e9"/></svg>`;
  }
  function setTemporaryClass(element, className, duration = 2400) {
    if (!element) return;
    element.classList.add(className);
    state.presentationTimers.push(setTimeout(() => element.classList.remove(className), duration));
  }
  function burstPetals(x, y, target = $("bee-layer"), count = 7) {
    if (!target) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count; const travel = 15 + (i % 3) * 8;
      const petal = svgEl("ellipse", { cx: x, cy: y, rx: 3, ry: 5, class: "petal" });
      petal.style.setProperty("--dx", `${Math.cos(angle) * travel}px`); petal.style.setProperty("--dy", `${Math.sin(angle) * travel}px`); target.append(petal);
      state.presentationTimers.push(setTimeout(() => petal.remove(), 900));
    }
  }
  function clearPresentationTimers() { for (const timer of state.presentationTimers) clearTimeout(timer); state.presentationTimers = []; }
  function syncSliderFill() {
    const slider = $("range-slider"); if (!slider) return;
    const fill = (Number(slider.value) - Number(slider.min)) / (Number(slider.max) - Number(slider.min)) * 100;
    slider.style.setProperty("--fill", `${Math.max(0, Math.min(100, fill))}%`);
  }
  function drawMap() {
    const layer = $("map-layer"); layer.replaceChildren(); const city = activeCity(); const { nodes, adjacency } = currentGraph();
    for (let x = 70; x < 760; x += 70) layer.append(svgEl("line", { x1: x, y1: 0, x2: x, y2: 480, class: "map-grid" }));
    layer.append(svgEl("path", { d: "M 80 360 C 205 295, 230 340, 355 245 S 530 125, 700 155", class: "map-river" }));
    layer.append(svgEl("path", { d: "M 30 170 C 190 190, 270 105, 420 135 S 575 360, 740 310", class: "map-road" }));
    for (const node of nodes) for (const otherId of adjacency.get(node.id) || []) if (node.id < otherId) { const other = nodes.find((n) => n.id === otherId); const p = mapPoint(node); const q = mapPoint(other); const hasGarden = node.kind === "garden" || other.kind === "garden"; layer.append(svgEl("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: hasGarden ? "map-link planted-link" : "map-link" })); }
    const visibleCandidates = city.candidates.filter((c) => !state.planted.some((p) => p.id === c.id));
    for (const candidate of visibleCandidates) drawNode(layer, candidate, state.recommendedId === candidate.id ? "recommended" : "candidate");
    for (const node of nodes) drawNode(layer, node, node.kind === "garden" ? "garden" : "park");
    $("map-title").textContent = city.title; $("map-description").textContent = `${city.mapKind} diagram. Parks and green spaces are represented as nodes; lines are simulated distance-threshold connections.`;
    $("data-note").textContent = city.mapKind === "schematic" ? "Columbia park locations are approximate in this schematic." : "All locations in this demo are fictional.";
  }
  function drawNode(layer, node, type) {
    const { x, y } = mapPoint(node); const g = svgEl("g", { class: "node", tabindex: "0", role: "button", "aria-label": `${node.name}, ${type === "candidate" || type === "recommended" ? "hypothetical candidate garden" : type === "garden" ? "planted hypothetical garden" : "existing park or habitat node"}`, "data-node-id": node.id });
    const mapScale = ($("habitat-map").getBoundingClientRect().width || 760) / 760;
    g.append(svgEl("circle", { cx: x, cy: y, r: Math.max(22, 22 / mapScale), class: "node-hit" }));
    if (type === "park") {
      g.append(svgEl("path", { d: `M ${x - 18} ${y + 5} Q ${x - 23} ${y - 5} ${x - 12} ${y - 12} Q ${x - 2} ${y - 21} ${x + 8} ${y - 12} Q ${x + 22} ${y - 8} ${x + 17} ${y + 5} Q ${x + 13} ${y + 16} ${x - 2} ${y + 14} Q ${x - 17} ${y + 16} ${x - 18} ${y + 5} Z`, class: "node-park-lawn" }));
      g.append(svgEl("path", { d: `M ${x - 14} ${y + 1}v-11m0 6q-6-6-8-1m8-3q6-7 9-2`, class: "node-park-trunk", fill: "none" }));
      g.append(svgEl("circle", { cx: x - 14, cy: y - 12, r: 7, class: "node-park-tree" }));
      g.append(svgEl("circle", { cx: x - 8, cy: y - 13, r: 5, class: "node-park-tree" }));
      g.append(svgEl("circle", { cx: x + 6, cy: y + 3, r: 5.5, class: "node-ring" }));
      g.append(svgEl("circle", { cx: x + 6, cy: y + 3, r: 3.5, class: "node-park" }));
    } else if (type === "candidate") {
      g.append(svgEl("circle", { cx: x, cy: y, r: 15, class: "node-garden" }));
      g.append(svgEl("path", { d: `M ${x} ${y + 9}v-9m0 5q-8-8-9-2m9-2q7-8 10-2`, class: "node-sprout" }));
    } else if (type === "recommended") {
      g.append(svgEl("circle", { cx: x, cy: y, r: 20, class: "node-halo" }));
      g.append(svgEl("circle", { cx: x, cy: y, r: 15, class: "node-recommended" }));
      g.append(svgEl("path", { d: `M ${x} ${y - 11} L ${x + 3} ${y - 4} L ${x + 11} ${y - 3} L ${x + 5} ${y + 2} L ${x + 7} ${y + 10} L ${x} ${y + 6} L ${x - 7} ${y + 10} L ${x - 5} ${y + 2} L ${x - 11} ${y - 3} L ${x - 3} ${y - 4} Z`, class: "node-recommend-star" }));
    } else {
      g.append(svgEl("ellipse", { cx: x, cy: y + 4, rx: 19, ry: 10, class: "node-planted-bed" }));
      for (let i = 0; i < 3; i += 1) { const fx = x - 9 + i * 9; const fy = y + 1 - (i % 2) * 5; g.append(svgEl("path", { d: `M ${fx} ${y + 8}v-5`, class: "scenery-flower-stem", fill: "none" })); g.append(svgEl("circle", { cx: fx, cy: fy, r: 4, class: "scenery-flower bloom-target", "data-flower": i })); }
    }
    const label = svgEl("text", { x: x + 13, y: y - 4, class: "node-label" }); label.textContent = node.name; g.append(label);
    const sub = svgEl("text", { x: x + 13, y: y + 9, class: "node-type" }); sub.textContent = type === "candidate" || type === "recommended" ? (type === "recommended" ? "RECOMMENDED · CONCEPT" : "HYPOTHETICAL SITE") : type === "garden" ? "SIMULATED GARDEN" : "EXISTING HABITAT NODE"; g.append(sub);
    const show = () => { const graph = currentGraph(); const neighbors = (graph.adjacency.get(node.id) || []).map((id) => graph.nodes.find((n) => n.id === id).name); $("map-status").textContent = `${node.name}: ${node.note || "Hypothetical garden location; not confirmed as available land."} Simulated connections at ${state.range.toFixed(1)} km: ${neighbors.length ? neighbors.join(", ") : "none"}.`; };
    g.addEventListener("click", show); g.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); show(); } }); layer.append(g);
  }
  function updateDashboard() {
    const city = activeCity(); const { groups, score } = getStats(); const improvement = score.percent - state.beforeScore;
    $("stat-habitats").textContent = city.habitats.length; $("stat-groups").textContent = groups; $("stat-gardens").textContent = state.planted.length;
    $("stat-before").textContent = `${state.beforeScore.toFixed(1)}%`; $("stat-after").textContent = `${score.percent.toFixed(1)}%`; $("stat-improvement").textContent = `${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)} pts`;
  }
  function updateJourneyOptions() {
    const selectStart = $("journey-start"); const selectEnd = $("journey-end"); const oldStart = selectStart.value; const oldEnd = selectEnd.value; const city = activeCity();
    for (const select of [selectStart, selectEnd]) { select.replaceChildren(); for (const node of city.habitats) { const opt = document.createElement("option"); opt.value = node.id; opt.textContent = node.name; select.append(opt); } }
    selectStart.value = city.habitats.some((n) => n.id === oldStart) ? oldStart : city.habitats[0].id; selectEnd.value = city.habitats.some((n) => n.id === oldEnd) ? oldEnd : city.habitats.at(-1).id;
  }
  function renderPlants() {
    const target = $("plant-list"); target.replaceChildren(); const plants = activeCity().plants;
    if (!plants.length) { target.innerHTML = '<p class="helper">Plant guidance is not authored for this fictional demo location.</p>'; return; }
    for (const plant of plants) {
      const card = document.createElement("article"); card.className = "plant-card";
      card.innerHTML = `<h3>${plant.name}</h3><div class="latin">${plant.latin}</div>${plantArt(plant.name)}<div class="plant-meta"><p><span class="meta-label"><svg aria-hidden="true"><use href="#icon-flower"/></svg>Bloom:</span><span>${plant.bloom}</span></p><p><span class="meta-label"><svg aria-hidden="true"><use href="#icon-sun"/></svg>Sun:</span><span>${plant.sun}</span></p><p><span class="meta-label"><svg aria-hidden="true"><use href="#icon-leaf"/></svg>Water:</span><span>${plant.water}</span></p><p><span class="meta-label"><svg aria-hidden="true"><use href="#buzzy-happy"/></svg>Supports:</span><span>${plant.benefit}</span></p></div>`;
      target.append(card);
    }
  }
  function clearBee() {
    if (state.journeyTimer) { clearInterval(state.journeyTimer); state.journeyTimer = null; }
    clearPresentationTimers(); $("bee-layer").replaceChildren();
    $("map-layer").querySelectorAll(".bloom, .pop").forEach((item) => item.classList.remove("bloom", "pop")); state.lastPlantedId = null;
    for (const id of ["stat-gardens", "stat-groups", "stat-before", "stat-after", "stat-improvement"]) $(id).classList.remove("pop");
    $("journey-message").classList.remove("is-success", "is-fail"); $("optimization-message").classList.remove("is-celebrating");
  }
  function runJourney() {
    clearBee(); const start = $("journey-start").value; const end = $("journey-end").value; const { nodes, adjacency } = currentGraph(); const path = shortestPath(adjacency, start, end);
    if (!path) {
      $("journey-message").textContent = "These habitats are disconnected in the current simulation. Try increasing the travel range or planting a connecting garden.";
      $("journey-message").classList.add("is-fail");
      const startNode = nodes.find((node) => node.id === start); const endNode = nodes.find((node) => node.id === end);
      if (startNode) { const p = mapPoint(startNode); const ring = svgEl("circle", { cx: p.x, cy: p.y, r: 25, class: "journey-endpoint is-pulsing" }); $("bee-layer").append(ring); const sleepy = svgEl("g", { class: "buzzy-group is-sleepy", transform: `translate(${p.x - 22} ${p.y - 19})` }); sleepy.append(svgEl("use", { href: "#buzzy-sleepy", width: 44, height: 38 })); $("bee-layer").append(sleepy); }
      if (endNode) { const p = mapPoint(endNode); $("bee-layer").append(svgEl("circle", { cx: p.x, cy: p.y, r: 25, class: "journey-endpoint is-pulsing" })); }
      setTemporaryClass($("journey-message"), "is-fail", 2600); state.presentationTimers.push(setTimeout(() => $("bee-layer").replaceChildren(), 2600)); return;
    }
    if (path.length === 1) { $("journey-message").textContent = "Buzzy is already at the selected habitat."; return; }
    $("journey-message").textContent = `BFS found a route through ${path.length} habitat node${path.length === 1 ? "" : "s"}. Buzzy is following the simulated path.`;
    $("journey-message").classList.add("is-success");
    const routePoints = path.map((id) => mapPoint(nodes.find((node) => node.id === id)));
    const route = svgEl("path", { d: routePoints.map((p, index) => `${index ? "L" : "M"} ${p.x} ${p.y}`).join(" "), pathLength: 1, class: "route-draw" }); $("bee-layer").append(route);
    const bee = svgEl("g", { class: "buzzy-group", transform: `translate(${routePoints[0].x} ${routePoints[0].y})` }); bee.append(svgEl("use", { href: "#buzzy-happy", x: -24, y: -21, width: 48, height: 42 })); $("bee-layer").append(bee);
    let step = 0; state.journeyTimer = setInterval(() => {
      step += 1;
      if (step >= path.length) {
        clearInterval(state.journeyTimer); state.journeyTimer = null;
        $("journey-message").textContent = `Buzzy completed the simulated route: ${path.map((id) => nodes.find((n) => n.id === id).name).join(" → ")}.`;
        const dest = routePoints[routePoints.length - 1]; burstPetals(dest.x, dest.y); setTemporaryClass($("journey-message"), "is-success", 2800);
        state.presentationTimers.push(setTimeout(() => { bee.remove(); route.remove(); }, 2300)); return;
      }
      const next = routePoints[step]; bee.setAttribute("transform", `translate(${next.x} ${next.y})`);
    }, 650);
  }
  function findBestGarden() {
    const city = activeCity(); const best = findBestCandidate(city.habitats, city.candidates, state.planted, state.range);
    if (!best) { state.recommendedId = null; $("optimization-message").textContent = "All garden concepts have already been planted."; $("plant-button").disabled = true; drawMap(); return; }
    state.recommendedId = best.candidate.id; const gain = best.score.percent - getStats().score.percent;
    $("optimization-message").textContent = `Recommended: ${best.candidate.name}. Model score would change by ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} percentage points (${best.score.percent.toFixed(1)}% original habitat pairs connected).`;
    $("plant-button").disabled = false; drawMap();
  }
  function plantGarden() {
    const candidate = activeCity().candidates.find((c) => c.id === state.recommendedId); if (!candidate) return;
    const before = getStats().score.percent; state.planted.push(candidate); state.recommendedId = null; $("plant-button").disabled = true; drawMap(); updateDashboard();
    const after = getStats().score.percent; $("optimization-message").textContent = `${candidate.name} added to the simulation. Original-habitat connectivity changed from ${before.toFixed(1)}% to ${after.toFixed(1)}% (+${(after - before).toFixed(1)} points).`;
    state.lastPlantedId = candidate.id;
    const node = $("map-layer").querySelector(`[data-node-id="${candidate.id}"]`);
    if (node) node.querySelectorAll(".bloom-target").forEach((flower) => flower.classList.add("bloom"));
    for (const id of ["stat-gardens", "stat-groups", "stat-before", "stat-after", "stat-improvement"]) $(id).classList.add("pop");
    state.presentationTimers.push(setTimeout(() => { for (const id of ["stat-gardens", "stat-groups", "stat-before", "stat-after", "stat-improvement"]) $(id).classList.remove("pop"); }, 500));
    setTemporaryClass($("optimization-message"), "is-celebrating", 2400);
    const target = mapPoint({ ...candidate, kind: "garden" }); const fromNode = allNodes().filter((item) => item.id !== candidate.id).sort((a, b) => distance(a, candidate) - distance(b, candidate))[0];
    if (!reducedMotion() && fromNode) {
      const from = mapPoint(fromNode); const flightPath = `M ${from.x} ${from.y} Q ${(from.x + target.x) / 2} ${Math.min(from.y, target.y) - 52} ${target.x} ${target.y}`;
      const flight = svgEl("path", { d: flightPath, class: "route-draw", pathLength: 1 }); $("bee-layer").append(flight);
      const buzzy = svgEl("g", { class: "buzzy-group" }); buzzy.append(svgEl("use", { href: "#buzzy-happy", x: -22, y: -19, width: 44, height: 38 })); buzzy.append(svgEl("animateMotion", { dur: "1.25s", path: flightPath, fill: "freeze" })); $("bee-layer").append(buzzy);
      state.presentationTimers.push(setTimeout(() => { burstPetals(target.x, target.y); buzzy.remove(); flight.remove(); }, 1350));
    } else { burstPetals(target.x, target.y); }
    state.presentationTimers.push(setTimeout(() => { node?.querySelectorAll(".bloom-target").forEach((flower) => flower.classList.remove("bloom")); state.lastPlantedId = null; }, 900));
  }
  function updateRange() {
    state.range = Number($("range-slider").value); $("range-value").value = `${state.range.toFixed(1)} km`; $("range-value").textContent = `${state.range.toFixed(1)} km`;
    // Keep the scoring denominator and the no-garden comparison tied to the
    // original habitats at the currently selected travel range.
    const originalGraph = buildGraph(activeCity().habitats, state.range);
    state.beforeScore = scoreOriginalPairs(activeCity().habitats, originalGraph).percent;
    drawMap(); updateDashboard(); $("map-status").textContent = `Travel threshold set to ${state.range.toFixed(1)} km. Lines and connectivity statistics have been recalculated.`;
  }
  function switchCity() {
    clearBee(); state.cityId = $("city-select").value; state.planted = []; state.recommendedId = null; $("plant-button").disabled = true; $("location-name").textContent = activeCity().name; $("optimization-message").textContent = "Find a candidate that most improves the original habitats' connectivity."; $("journey-message").textContent = "Choose two habitats to check the simulated route.";
    const baseline = currentGraph(); state.beforeScore = scoreOriginalPairs(activeCity().habitats, baseline.adjacency).percent; updateJourneyOptions(); renderPlants(); drawMap(); updateDashboard(); drawScenery();
  }
  function updateBudget() {
    const ids = ["budget-plants", "budget-soil", "budget-mulch"]; const total = ids.reduce((sum, id) => { const val = Number($(id).value); return sum + (Number.isFinite(val) && val > 0 ? val : 0); }, 0); $("budget-total").textContent = total.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  function initialize() {
    const citySelect = $("city-select"); for (const [id, city] of Object.entries(cityData)) { const option = document.createElement("option"); option.value = id; option.textContent = city.name; citySelect.append(option); }
    citySelect.value = state.cityId; $("range-slider").addEventListener("input", updateRange); $("range-slider").addEventListener("input", syncSliderFill); citySelect.addEventListener("change", switchCity); $("find-best-button").addEventListener("click", findBestGarden); $("plant-button").addEventListener("click", plantGarden); $("reset-button").addEventListener("click", () => { clearBee(); state.planted = []; state.recommendedId = null; state.beforeScore = scoreOriginalPairs(activeCity().habitats, buildGraph(activeCity().habitats, state.range)).percent; $("plant-button").disabled = true; $("optimization-message").textContent = "Simulation reset. Find a candidate garden to begin again."; drawMap(); updateDashboard(); }); $("journey-button").addEventListener("click", runJourney);
    for (const id of ["budget-size", "budget-plants", "budget-soil", "budget-mulch"]) $(id).addEventListener("input", updateBudget);
    state.beforeScore = scoreOriginalPairs(activeCity().habitats, currentGraph().adjacency).percent; updateJourneyOptions(); renderPlants(); updateRange(); updateDashboard(); updateBudget(); drawScenery(); syncSliderFill();
  }

  // Expose pure functions for lightweight local verification / learning.
  window.PollinatorPath = { buildGraph, components, shortestPath, scoreOriginalPairs, findBestCandidate, distance };
  initialize();
})();
