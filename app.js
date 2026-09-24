lucide.createIcons();

// --- INITIALISATION DE LA CARTE ---
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'satellite': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
            'terrain-source': { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256 },
            'ign-slopes': { type: 'raster', tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'], tileSize: 256 },
            'ign-skitour': { type: 'raster', tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=TRACES.RANDO.HIVERNALE&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'], tileSize: 256 }
        },
        layers: [ 
            { id: 'satellite-layer', type: 'raster', source: 'satellite' },
            { id: 'ign-skitour-layer', type: 'raster', source: 'ign-skitour', paint: { 'raster-opacity': 1.0 } },
            { id: 'ign-slopes-layer', type: 'raster', source: 'ign-slopes', paint: { 'raster-opacity': 0.6 } }
        ],
        terrain: { source: 'terrain-source', exaggeration: 1.2 }
    },
    center: [6.93, 45.86], zoom: 12.5, pitch: 70, bearing: -35
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

document.getElementById('btn-rerun').addEventListener('click', () => window.location.reload());

// --- CALQUES, REFUGES & CURSEUR GRAPHIQUE ---
map.on('load', () => {
    document.getElementById('toggle-route').addEventListener('change', (e) => map.setLayoutProperty('ign-skitour-layer', 'visibility', e.target.checked ? 'visible' : 'none'));
    document.getElementById('toggle-slopes').addEventListener('change', (e) => map.setLayoutProperty('ign-slopes-layer', 'visibility', e.target.checked ? 'visible' : 'none'));
    document.getElementById('toggle-refuges').addEventListener('change', (e) => map.setLayoutProperty('refuges-layer', 'visibility', e.target.checked ? 'visible' : 'none'));

    map.addSource('imported-gpx', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'imported-gpx-layer', type: 'line', source: 'imported-gpx', paint: { 'line-color': '#d946ef', 'line-width': 5, 'line-opacity': 0.9 } });

    // NOUVEAU : Le curseur dynamique qui suit le graphique
    map.addSource('chart-cursor-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'chart-cursor-layer',
        type: 'circle',
        source: 'chart-cursor-source',
        paint: {
            'circle-radius': 6,
            'circle-color': '#fff',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#d946ef'
        }
    });

    map.addSource('refuges-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'refuges-layer', type: 'circle', source: 'refuges-source',
        paint: { 'circle-color': '#f59e0b', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
    });

    fetchRefugesInView();
});

// --- BARRE DE RECHERCHE VOL 3D (Nominatim API) ---
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimeout = null;

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            // On ajoute "Alpes" ou "France" pour orienter la recherche
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Alpes')}&format=json&limit=5`);
            const data = await res.json();
            
            searchResults.innerHTML = '';
            if (data.length > 0) {
                searchResults.style.display = 'block';
                data.forEach(item => {
                    const li = document.createElement('li');
                    const nomCourt = item.display_name.split(',')[0];
                    const details = item.display_name.split(',').slice(1, 3).join(',');
                    li.innerHTML = `<b>${nomCourt}</b><br><small>${details}</small>`;
                    
                    li.addEventListener('click', () => {
                        // VOL 3D MAGIQUE
                        map.flyTo({ center: [item.lon, item.lat], zoom: 14.5, pitch: 75, bearing: -20, duration: 4000 });
                        searchResults.style.display = 'none';
                        searchInput.value = nomCourt;
                    });
                    searchResults.appendChild(li);
                });
            } else {
                searchResults.style.display = 'none';
            }
        } catch (err) { console.error(err); }
    }, 500); // Attend 500ms après la frappe pour chercher
});

// --- REFUGES ---
let refugesTimeout = null;
map.on('moveend', () => {
    if (map.getZoom() > 10) { clearTimeout(refugesTimeout); refugesTimeout = setTimeout(fetchRefugesInView, 1000); }
});

async function fetchRefugesInView() {
    const bounds = map.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    const url = `https://www.refuges.info/api/bbox?nb_points=all&type_points=7,9,10&bbox=${bbox}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        map.getSource('refuges-source').setData(data);
    } catch(err) {}
}

map.on('click', 'refuges-layer', (e) => {
    const coords = e.features[0].geometry.coordinates.slice();
    const nom = e.features[0].properties.nom;
    let alt = "N/D";
    try { alt = JSON.parse(e.features[0].properties.coord).alt; } catch(err) {}
    new maplibregl.Popup({ closeButton: false }).setLngLat(coords).setHTML(`<div style="color:#000; font-family:'Inter'; padding:5px;"><b>${nom}</b><br>Altitude : ${alt} m</div>`).addTo(map);
});
map.on('mouseenter', 'refuges-layer', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'refuges-layer', () => map.getCanvas().style.cursor = '');


// --- DESSIN ET EXPORT ---
const draw = new MapboxDraw({ displayControlsDefault: false });
map.addControl(draw); 

const btnDraw = document.getElementById('btn-draw');
btnDraw.addEventListener('click', () => { draw.changeMode('draw_line_string'); btnDraw.classList.add('active'); });
document.getElementById('btn-trash').addEventListener('click', () => { 
    draw.deleteAll(); 
    btnDraw.classList.remove('active'); 
    document.getElementById('gpx-analysis').style.display = 'none';
    map.getSource('chart-cursor-source').setData({ type: 'FeatureCollection', features: [] }); // Cache le point
});
map.on('draw.create', () => { btnDraw.classList.remove('active'); });

document.getElementById('btn-export-gpx').addEventListener('click', () => {
    const data = draw.getAll();
    if (data.features.length === 0) return alert("Tracez un itinéraire d'abord.");
    const routes = { type: "FeatureCollection", features: data.features.filter(f => f.geometry.type === 'LineString') };
    if (routes.features.length === 0) return alert("Veuillez tracer une ligne.");
    const gpxString = togpx(routes, { creator: "SkiRando Explorer" });
    const blob = new Blob([gpxString], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trace_skirando_${new Date().toISOString().slice(0,10)}.gpx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

// --- IMPORT GPX, STATS ET CHART.JS (AVEC SURVOL) ---
let elevationChart = null; 
let gpxCoordinatesList = []; // Stocke les [Lng, Lat] pour la synchronisation du survol

document.getElementById('gpx-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const gpxText = event.target.result;
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, "text/xml");
        const geoJson = toGeoJSON.gpx(gpxDoc); 
        
        if(map.getSource('imported-gpx')) map.getSource('imported-gpx').setData(geoJson);
        calculateGPXStats(geoJson);
        
        try {
            const bounds = new maplibregl.LngLatBounds();
            geoJson.features.forEach(f => {
                if (f.geometry.type === 'LineString') f.geometry.coordinates.forEach(c => bounds.extend([c[0], c[1]]));
                else if (f.geometry.type === 'MultiLineString') f.geometry.coordinates.forEach(line => line.forEach(c => bounds.extend([c[0], c[1]])));
            });
            map.fitBounds(bounds, { padding: 80, pitch: 60, bearing: -20, duration: 2000 });
        } catch(err) {}
    };
    reader.readAsText(file);
});

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1) * (Math.PI/180);  
    const dLon = (lon2-lon1) * (Math.PI/180); 
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function calculateGPXStats(geoJson) {
    let totalDist = 0, dPlus = 0, dMinus = 0;
    const chartLabels = [], chartData = [];
    gpxCoordinatesList = []; // Reset global
    
    geoJson.features.forEach(feature => {
        let coords = feature.geometry.coordinates;
        if (feature.geometry.type === 'MultiLineString') coords = coords.flat();
        if (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString') return;
        
        if (coords.length > 0 && coords[0].length > 2) {
             chartLabels.push(0);
             chartData.push(coords[0][2]);
             gpxCoordinatesList.push([coords[0][0], coords[0][1]]);
        }

        for (let i = 1; i < coords.length; i++) {
            const p1 = coords[i-1], p2 = coords[i];
            totalDist += getDistanceFromLatLonInKm(p1[1], p1[0], p2[1], p2[0]);
            
            if (p1.length > 2 && p2.length > 2) {
                const eleDiff = p2[2] - p1[2];
                if (eleDiff > 0) dPlus += eleDiff; 
                else if (eleDiff < 0) dMinus += Math.abs(eleDiff); 
                chartLabels.push(totalDist.toFixed(1));
                chartData.push(p2[2]);
                gpxCoordinatesList.push([p2[0], p2[1]]); // On stocke la coordonnée GPS
            }
        }
    });
    
    document.getElementById('gpx-analysis').style.display = 'block';
    document.getElementById('stat-dist').innerText = totalDist.toFixed(1) + ' km';
    document.getElementById('stat-dplus').innerText = '+' + Math.round(dPlus) + ' m';
    document.getElementById('stat-dminus').innerText = '-' + Math.round(dMinus) + ' m';

    renderElevationChart(chartLabels, chartData);
}

function renderElevationChart(labels, data) {
    const ctx = document.getElementById('elevation-chart').getContext('2d');
    if (elevationChart) elevationChart.destroy();

    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderWidth: 2, pointRadius: 0, pointHitRadius: 10, fill: true, tension: 0.1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            // NOUVEAU : Interaction Graphique -> Carte 3D
            onHover: (event, chartElements) => {
                if (chartElements.length > 0) {
                    const dataIndex = chartElements[0].index;
                    const coord = gpxCoordinatesList[dataIndex];
                    if (coord && map.getSource('chart-cursor-source')) {
                        map.getSource('chart-cursor-source').setData({ type: 'Point', coordinates: coord });
                    }
                } else {
                    if(map.getSource('chart-cursor-source')) {
                        map.getSource('chart-cursor-source').setData({ type: 'FeatureCollection', features: [] });
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false, callbacks: { label: c => c.parsed.y + ' m', title: c => c[0].label + ' km' } }
            },
            scales: {
                x: { ticks: { color: '#71717a', maxTicksLimit: 6 }, grid: { display: false } },
                y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

// --- MASSIFS & SONDE (LE RETOUR DU BERA) ---
function detectMassif(lat, lng) {
    const massifs = [
        { name: "Chablais", latMin: 46.10, latMax: 46.40, lngMin: 6.40, lngMax: 6.90 },
        { name: "Mont-Blanc", latMin: 45.75, latMax: 46.05, lngMin: 6.70, lngMax: 7.10 },
        { name: "Aravis", latMin: 45.80, latMax: 46.05, lngMin: 6.25, lngMax: 6.65 },
        { name: "Bauges", latMin: 45.55, latMax: 45.80, lngMin: 5.95, lngMax: 6.30 },
        { name: "Beaufortain", latMin: 45.55, latMax: 45.75, lngMin: 6.50, lngMax: 6.80 },
        { name: "Haute-Tarentaise", latMin: 45.45, latMax: 45.75, lngMin: 6.80, lngMax: 7.15 },
        { name: "Vanoise", latMin: 45.25, latMax: 45.50, lngMin: 6.60, lngMax: 7.00 },
        { name: "Haute-Maurienne", latMin: 45.15, latMax: 45.40, lngMin: 6.80, lngMax: 7.20 },
        { name: "Maurienne", latMin: 45.15, latMax: 45.40, lngMin: 6.20, lngMax: 6.60 },
        { name: "Chartreuse", latMin: 45.25, latMax: 45.50, lngMin: 5.70, lngMax: 5.95 },
        { name: "Belledonne", latMin: 45.10, latMax: 45.40, lngMin: 5.90, lngMax: 6.20 },
        { name: "Grandes Rousses", latMin: 45.05, latMax: 45.20, lngMin: 6.05, lngMax: 6.25 },
        { name: "Oisans", latMin: 44.80, latMax: 45.05, lngMin: 5.90, lngMax: 6.40 },
        { name: "Vercors", latMin: 44.75, latMax: 45.25, lngMin: 5.30, lngMax: 5.70 }
    ];
    for (let m of massifs) if (lat >= m.latMin && lat <= m.latMax && lng >= m.lngMin && lng <= m.lngMax) return m.name;
    return "Hors Massif";
}

map.on('click', async (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['refuges-layer'] });
    if (features.length > 0) return;

    try { if (draw.getMode() === 'draw_line_string' || draw.getMode() === 'direct_select') return; } catch (err) {}

    const lng = e.lngLat.lng, lat = e.lngLat.lat;
    const meteoBox = document.getElementById('meteo-box');
    const beraBox = document.getElementById('bera-box');
    const panelContent = document.querySelector('.panel-content');
    
    meteoBox.innerHTML = `<div class="empty-state"><i data-lucide="loader-circle" class="lucide-spin"></i><p>Calcul topo en cours...</p></div>`;
    beraBox.innerHTML = '';
    lucide.createIcons();

    const massifName = detectMassif(lat, lng);
    const eleCenter = map.queryTerrainElevation([lng, lat]);
    let slopeDeg = "N/D", aspectName = "N/D", slopeClass = "";

    if (eleCenter !== null) {
        const delta = 0.0005; 
        const eleNorth = map.queryTerrainElevation([lng, lat + delta]) || eleCenter;
        const eleEast = map.queryTerrainElevation([lng + delta, lat]) || eleCenter;
        const distY = delta * 111000, distX = delta * 111000 * Math.cos(lat * Math.PI / 180);
        const dz_dy = (eleNorth - eleCenter) / distY, dz_dx = (eleEast - eleCenter) / distX;
        
        slopeDeg = Math.round(Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy)) * 180 / Math.PI);
        if (slopeDeg >= 30) slopeClass = "alert";

        let aspectDeg = Math.atan2(-dz_dx, -dz_dy) * 180 / Math.PI;
        if (aspectDeg < 0) aspectDeg += 360;
        const compass = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"];
        aspectName = compass[Math.round(aspectDeg / 45) % 8];
    }

    try {
        const eleRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        const eleData = await eleRes.json();
        const absoluteElevation = eleData.elevation ? Math.round(eleData.elevation[0]) : "N/D";
        const eleParam = absoluteElevation !== "N/D" ? `&elevation=${absoluteElevation}` : "";

        const selectedDate = document.getElementById('date-picker').value;
        const diffDays = Math.ceil((new Date() - new Date(selectedDate)) / (1000 * 60 * 60 * 24)); 
        let apiUrl = diffDays > 90 
            ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${selectedDate}&end_date=${selectedDate}&hourly=temperature_2m,snow_depth`
            : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${selectedDate}&end_date=${selectedDate}&hourly=temperature_2m,snow_depth`;

        const response = await fetch(apiUrl);
        const data = await response.json();
        const noonTemp = data.hourly.temperature_2m[12];
        let noonSnow = data.hourly.snow_depth[12];
        let snowStr = noonSnow !== null ? noonSnow + ' m' : 'N/D';
        if (noonSnow > 20) snowStr = 'Absence de données';

        // LE BERA (Historique des 10 derniers jours)
        const dObj = new Date(selectedDate);
        dObj.setDate(dObj.getDate() - 10);
        const past10Days = dObj.toISOString().split('T')[0];
        
        const historyUrl = diffDays > 80
            ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${past10Days}&end_date=${selectedDate}&daily=snowfall_sum&timezone=Europe/Berlin`
            : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${past10Days}&end_date=${selectedDate}&daily=snowfall_sum&timezone=Europe/Berlin`;
            
        const historyRes = await fetch(historyUrl);
        const historyData = await historyRes.json();
        
        let lastSnowDate = "Aucune (10j)", lastSnowAmount = "-";
        if (historyData.daily && historyData.daily.snowfall_sum) {
            for (let i = historyData.daily.time.length - 1; i >= 0; i--) {
                if (historyData.daily.snowfall_sum[i] > 0.5) {
                    const d = new Date(historyData.daily.time[i]);
                    lastSnowDate = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    lastSnowAmount = historyData.daily.snowfall_sum[i] + ' cm';
                    break;
                }
            }
        }

        meteoBox.innerHTML = `
            <div class="data-card">
                <div class="card-title"><i data-lucide="mountain"></i> Topographie</div>
                <div class="card-grid">
                    <div class="card-stat"><span class="stat-label">Altitude</span><span class="stat-value">${absoluteElevation} m</span></div>
                    <div class="card-stat"><span class="stat-label">Versant</span><span class="stat-value">${aspectName}</span></div>
                    <div class="card-stat full"><span class="stat-label">Pente locale</span><span class="stat-value ${slopeClass}">${slopeDeg}°</span></div>
                </div>
            </div>
            <div class="data-card">
                <div class="card-title"><i data-lucide="snowflake"></i> Météo & Neige</div>
                <div class="card-grid">
                    <div class="card-stat"><span class="stat-label">Température</span><span class="stat-value">${noonTemp !== null ? noonTemp + ' °C' : 'N/D'}</span></div>
                    <div class="card-stat"><span class="stat-label">Épaisseur</span><span class="stat-value">${snowStr}</span></div>
                </div>
            </div>
        `;

        beraBox.innerHTML = `
            <div class="data-card">
                <div class="card-title"><i data-lucide="triangle-alert"></i> Avalanche (BERA)</div>
                <div class="card-grid">
                    <div class="card-stat full"><span class="stat-label">Massif détecté</span><span class="stat-value" style="color:#3b82f6;">${massifName}</span></div>
                    <div class="card-stat"><span class="stat-label">Dernière Neige</span><span class="stat-value">${lastSnowDate}</span></div>
                    <div class="card-stat"><span class="stat-label">Quantité</span><span class="stat-value">${lastSnowAmount}</span></div>
                </div>
                <a href="https://meteofrance.com/meteo-montagne/alpes-du-nord/risques-avalanche" target="_blank" class="link-bera"><i data-lucide="external-link" style="width:14px;"></i> Lire le bulletin Météo France</a>
            </div>
        `;
        lucide.createIcons();
        setTimeout(() => { panelContent.scrollTo({ top: panelContent.scrollHeight, behavior: 'smooth' }); }, 100);

    } catch (error) { meteoBox.innerHTML = `<div class="empty-state"><p>Erreur réseau lors de l'analyse.</p></div>`; }
});