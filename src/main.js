import './style.css'
import Papa from 'papaparse'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data';

// ---- Helpers ----
const deg2rad = d => d * Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const tidy = s => (s ?? "").toString().trim();
const asBool = s => tidy(s).toLowerCase() === "true";

// Load and parse CSV from external file
async function loadCSVData() {
    const response = await fetch('./sites.csv');
    const csvText = await response.text();
    const { data: rows } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    return rows;
}

// Initialize the application
async function initApp() {
    const rows = await loadCSVData();

    // Normalize and enrich rows
    const enriched = rows.map(r => {
        const site = tidy(r["Site"]);
        const educator = tidy(r["Artist Educator"]);
        const partner = tidy(r["Partner Org"]) || "Unknown";
        const address = tidy(r["Address"]);
        const title = tidy(r["Title"]);
        const photo = tidy(r["Photo link"]);
        const link = tidy(r["Link"]);
        const earlyOn = asBool(r["EarlyON"]);
        const participation = parseFloat(tidy(r["Participation"])) || 0;
        // GPS like: "43.24..., -79.81..."
        const gps = tidy(r["GPS"])
            .split(",")
            .map(v => parseFloat(v));
        const [lat, lng] = gps.length >= 2 ? gps : [NaN, NaN];

        return { site, educator, partner, address, title, photo, link, earlyOn, participation, lat, lng };
    });

    // Calculate participation range for size mapping
    const participationValues = enriched.map(r => r.participation).filter(p => isFinite(p));
    const minParticipation = Math.min(...participationValues);
    const maxParticipation = Math.max(...participationValues);

    // Function to map participation to node size (12-36)
    const mapParticipationToSize = (participation) => {
        if (!isFinite(participation) || participationValues.length === 0) return 12;
        if (minParticipation === maxParticipation) return 24; // midpoint if all values are the same
        const normalized = (participation - minParticipation) / (maxParticipation - minParticipation);
        return Math.round(12 + normalized * 24); // maps to 12-36
    };

    // Build nodes
    // id: 1..N, label: site, group: partner (default), size based on participation
    const baseNodes = enriched.map((r, i) => ({
        id: i + 1,
        label: r.site,
        group: r.partner,
        size: mapParticipationToSize(r.participation),
        title:
            `<b>${r.site}</b><br>` +
            `${r.address ? r.address + "<br>" : ""}` +
            `${r.title ? "Project: " + r.title + "<br>" : ""}` +
            `Artist Educator: ${r.educator || "—"}<br>` +
            `Partner: ${r.partner || "—"}<br>` +
            `Participation: ${r.participation || "—"}<br>` +
            `EarlyON: ${r.earlyOn ? "Yes" : "No"}<br>` +
            (r.link ? `<a href="${r.link}" target="_blank">View Project</a><br>` : "") +
            (isFinite(r.lat) && isFinite(r.lng) ? `GPS: ${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}` : "GPS: —"),
        // keep lat/lng around for edge distance calculations & future features
        lat: enriched[i].lat,
        lng: enriched[i].lng,
        participation: r.participation
    }));

    // Build hierarchical edges: representatives connect to their group and to each other
    const baseEdges = [];

    // Group nodes by Partner Org
    const partnerGroups = {};
    baseNodes.forEach(node => {
        const partner = node.group;
        if (!partnerGroups[partner]) {
            partnerGroups[partner] = [];
        }
        partnerGroups[partner].push(node);
    });

    // Select representative node for each Partner Org (highest participation)
    const representatives = {};
    Object.keys(partnerGroups).forEach(partner => {
        const groupNodes = partnerGroups[partner];
        // Find the node with highest participation in this group
        const representative = groupNodes.reduce((best, current) => {
            return current.participation > best.participation ? current : best;
        });
        representatives[partner] = representative;
    });

    // Create edges from each representative to all other nodes in the same Partner Org
    Object.keys(partnerGroups).forEach(partner => {
        const rep = representatives[partner];
        const groupNodes = partnerGroups[partner];

        groupNodes.forEach(node => {
            if (node.id !== rep.id) { // Don't connect representative to itself
                const d = (isFinite(rep.lat) && isFinite(rep.lng) && isFinite(node.lat) && isFinite(node.lng))
                    ? haversine(rep.lat, rep.lng, node.lat, node.lng)
                    : NaN;

                const rounded = isFinite(d) ? +d.toFixed(3) : null;

                baseEdges.push({
                    id: `${rep.id}-${node.id}`,
                    from: rep.id,
                    to: node.id,
                    value: rounded ?? 1,
                    length: 30 + (isFinite(d) ? d * 8 : 80),
                    title: isFinite(d) ? `${rounded} km` : "distance unavailable"
                });
            }
        });
    });

    // Connect all representatives to each other
    const repNodes = Object.values(representatives);
    for (let i = 0; i < repNodes.length; i++) {
        for (let j = i + 1; j < repNodes.length; j++) {
            const a = repNodes[i], b = repNodes[j];
            const d = (isFinite(a.lat) && isFinite(a.lng) && isFinite(b.lat) && isFinite(b.lng))
                ? haversine(a.lat, a.lng, b.lat, b.lng)
                : NaN;

            const rounded = isFinite(d) ? +d.toFixed(3) : null;

            baseEdges.push({
                id: `${a.id}-${b.id}`,
                from: a.id,
                to: b.id,
                value: rounded ?? 1,
                length: 30 + (isFinite(d) ? d * 8 : 80),
                title: isFinite(d) ? `${rounded} km` : "distance unavailable"
            });
        }
    }

    // Mark representative nodes with distinctive appearance
    const repIds = new Set(repNodes.map(n => n.id));
    baseNodes.forEach(node => {
        if (repIds.has(node.id)) {
            node.borderWidth = 3; // Thicker border for representatives
            node.title = `<b>📍 REPRESENTATIVE: ${node.label}</b><br>` + node.title;
        }
    });

    // vis-network setup
    const container = document.getElementById("network");
    const nodesDS = new DataSet(baseNodes);
    const edgesDS = new DataSet(baseEdges);

    // Detect dark mode for text colors
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDarkMode ? '#ffffff' : '#000000';
    const edgeColor = isDarkMode ? '#666666' : '#848484';

    const options = {
        autoResize: true,
        physics: {
            solver: "forceAtlas2Based",
            forceAtlas2Based: { gravitationalConstant: -30, springLength: 80, springConstant: 0.08 },
            stabilization: { iterations: 150 }
        },
        interaction: { hover: true, tooltipDelay: 120 },
        nodes: {
            shape: "dot",
            size: 12,
            font: {
                size: 12,
                face: "Inter, system-ui, sans-serif",
                color: textColor
            },
            borderWidth: 1
        },
        edges: {
            smooth: { type: "dynamic" },
            scaling: { min: 1, max: 6 }, // width scaling driven by edge.value (our distance)
            color: {
                color: edgeColor,
                opacity: 0.7
            },
            font: {
                color: textColor,
                size: 11
            }
        }
    };

    const network = new Network(container, { nodes: nodesDS, edges: edgesDS }, options);

    // --- UI: regroup & toggle edge labels ---
    const groupBySel = document.getElementById("groupBy");
    const edgeLabelsChk = document.getElementById("edgeLabels");

    function computeGroup(node, key) {
        const idx = node.id - 1;
        const r = enriched[idx];
        if (key === "Artist Educator") return r.educator || "Unknown";
        if (key === "EarlyON") return r.earlyOn ? "EarlyON" : "Not EarlyON";
        return r.partner || "Unknown"; // default: Partner Org
    }

    function applyGrouping(key) {
        const updates = baseNodes.map(n => ({ id: n.id, group: computeGroup(n, key) }));
        nodesDS.update(updates);
    }

    function applyEdgeLabels(show) {
        const updates = baseEdges.map(e => ({ id: e.id, label: show && isFinite(parseFloat(e.value)) ? `${e.value} km` : undefined }));
        // If hiding labels, we must set label to undefined to remove it
        if (!show) updates.forEach(u => u.label = undefined);
        edgesDS.update(updates);
    }

    groupBySel.addEventListener("change", e => applyGrouping(e.target.value));
    edgeLabelsChk.addEventListener("change", e => applyEdgeLabels(e.target.checked));

    // initial state
    applyGrouping(groupBySel.value);
    applyEdgeLabels(edgeLabelsChk.checked);
}

// Start the application
initApp().catch(console.error); 