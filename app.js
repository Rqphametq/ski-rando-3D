lucide.createIcons();

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

map.on('load', () => {
    
    // OMBRES EXTRÊMES
    map.addLayer({
        id: 'sun-hillshade',
        type: 'hillshade',
        source: 'terrain-source',
        layout: { visibility: 'none' },
        paint: {
            'hillshade-illumination-anchor': 'map',
            'hillshade-exaggeration': 1.0, 
            'hillshade-shadow-color': 'rgba(4, 28, 59, 0.95)', 
            'hillshade-highlight-color': 'rgba(255, 255, 255, 0)', 
            'hillshade-accent-color': 'rgba(0, 0, 0, 0)'
        }
    }, 'ign-skitour-layer');

    document.getElementById('toggle-route').addEventListener('change', (e) => map.setLayoutProperty('ign-skitour-layer', 'visibility', e.target.checked ? 'visible' : 'none'));
    document.getElementById('toggle-slopes').addEventListener('change', (e) => map.setLayoutProperty('ign-slopes-layer', 'visibility', e.target.checked ? 'visible' : 'none'));
    document.getElementById('toggle-refuges').addEventListener('change', (e) => map.setLayoutProperty('refuges-layer', 'visibility', e.target.checked ? 'visible' : 'none'));

    map.addSource('imported-gpx', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'imported-gpx-layer', type: 'line', source: 'imported-gpx', paint: { 'line-color': '#d946ef', 'line-width': 5, 'line-opacity': 0.9 } });

    map.addSource('chart-cursor-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'chart-cursor-layer', type: 'circle', source: 'chart-cursor-source', paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': '#d946ef' } });

    map.addSource('refuges-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'refuges-layer', type: 'circle', source: 'refuges-source', paint: { 'circle-color': '#f59e0b', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

    fetchRefugesInView();
});

const toggleSun = document.getElementById('toggle-sun');
const sunContainer = document.getElementById('sun-slider-container');
const nightOverlay = document.getElementById('night-overlay');

toggleSun.addEventListener('change', (e) => {
    if (e.target.checked) {
        sunContainer.style.display = 'block';
        if (map.getLayer('sun-hillshade')) map.setLayoutProperty('sun-hillshade', 'visibility', 'visible');
        updateSunlight(); 
    } else {
        sunContainer.style.display = 'none';
        if (map.getLayer('sun-hillshade')) map.setLayoutProperty('sun-hillshade', 'visibility', 'none');
        if (nightOverlay) nightOverlay.style.opacity = '0';
    }
});

function updateSunlight() {
    if (!toggleSun.checked || !map.getLayer('sun-hillshade')) return;

    const dateStr = document.getElementById('date-picker').value;
    const timeVal = parseFloat(document.getElementById('time-slider').value);
    
    const hours = Math.floor(timeVal);
    const minutes = (timeVal % 1) * 60;
    document.getElementById('time-display').innerText = `${hours.toString().padStart(2, '0')}:${minutes === 0 ? '00' : minutes}`;

    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);

    const center = map.getCenter();
    const sunPos = SunCalc.getPosition(date, center.lat, center.lng);
    
    let azimuth = (sunPos.azimuth * 180 / Math.PI) + 180;
    if (azimuth > 360) azimuth -= 360;
    const altitude = sunPos.altitude * 180 / Math.PI;

    map.setPaintProperty('sun-hillshade', 'hillshade-illumination-direction', azimuth);

    if (nightOverlay) {
        if (altitude < -5) {
            nightOverlay.style.opacity = '0.7'; 
        } else if (altitude < 10) {
            let opacity = 0.7 * (1 - ((altitude + 5) / 15));
            nightOverlay.style.opacity = opacity.toString();
        } else {
            nightOverlay.style.opacity = '0'; 
        }
    }
}

document.getElementById('time-slider').addEventListener('input', updateSunlight);
document.getElementById('date-picker').addEventListener('change', updateSunlight);
map.on('move', updateSunlight); 

const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimeout = null;

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 3) { searchResults.style.display = 'none'; return; }

    searchTimeout = setTimeout(async () => {
        try {
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
                        map.flyTo({ center: [item.lon, item.lat], zoom: 14.5, pitch: 75, bearing: -20, duration: 4000 });
                        searchResults.style.display = 'none';
                        searchInput.value = nomCourt;
                    });
                    searchResults.appendChild(li);
                });
            } else { searchResults.style.display = 'none'; }
        } catch (err) {}
    }, 500);
});

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
        if(map.getSource('refuges-source')) map.getSource('refuges-source').setData(data);
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

const draw = new MapboxDraw({ displayControlsDefault: false });
map.addControl(draw); 

const btnDraw = document.getElementById('btn-draw');
btnDraw.addEventListener('click', () => { draw.changeMode('draw_line_string'); btnDraw.classList.add('active'); });
document.getElementById('btn-trash').addEventListener('click', () => { 
    draw.deleteAll(); 
    btnDraw.classList.remove('active'); 
    document.getElementById('gpx-analysis').style.display = 'none';
    if(map.getSource('chart-cursor-source')) map.getSource('chart-cursor-source').setData({ type: 'FeatureCollection', features: [] });
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

let elevationChart = null; 
let gpxCoordinatesList = []; 

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
    gpxCoordinatesList = []; 
    
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
                gpxCoordinatesList.push([p2[0], p2[1]]); 
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
            onHover: (event, chartElements) => {
                if (chartElements.length > 0) {
                    const coord = gpxCoordinatesList[chartElements[0].index];
                    if (coord && map.getSource('chart-cursor-source')) {
                        map.getSource('chart-cursor-source').setData({ type: 'Point', coordinates: coord });
                    }
                } else {
                    if(map.getSource('chart-cursor-source')) map.getSource('chart-cursor-source').setData({ type: 'FeatureCollection', features: [] });
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

// LA FONCTION MANQUANTE EST DE RETOUR ICI !
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

// --- SONDE TERRAIN & BERA (SÉCURISÉE) ---
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

    // 1. CALCUL TOPOGRAPHIQUE (100% Local, n'échoue jamais)
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

    const massifName = detectMassif(lat, lng);

    // Variables Météo par défaut si l'API échoue
    let absoluteElevation = eleCenter ? Math.round(eleCenter) : "N/D";
    let noonTemp = "N/D", snowStr = "N/D", lastSnowDate = "N/D", lastSnowAmount = "-";

    // 2. APPELS API (Isolés pour ne pas faire planter la topo)
    try {
        const eleRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        if(eleRes.ok) {
            const eleData = await eleRes.json();
            if(eleData.elevation) absoluteElevation = Math.round(eleData.elevation[0]);
        }
        
        const eleParam = absoluteElevation !== "N/D" ? `&elevation=${absoluteElevation}` : "";
        const selectedDate = document.getElementById('date-picker').value;
        const diffDays = Math.ceil((new Date() - new Date(selectedDate)) / (1000 * 60 * 60 * 24)); 
        
        let apiUrl = diffDays > 90 
            ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${selectedDate}&end_date=${selectedDate}&hourly=temperature_2m,snow_depth`
            : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${selectedDate}&end_date=${selectedDate}&hourly=temperature_2m,snow_depth`;

        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            if(data.hourly && data.hourly.temperature_2m) {
                noonTemp = data.hourly.temperature_2m[12] + ' °C';
                let noonSnow = data.hourly.snow_depth[12];
                if(noonSnow !== null && noonSnow !== undefined) snowStr = noonSnow > 20 ? 'Hors limites' : noonSnow + ' m';
            }
        }

        const dObj = new Date(selectedDate);
        dObj.setDate(dObj.getDate() - 10);
        const past10Days = dObj.toISOString().split('T')[0];
        
        const historyUrl = diffDays > 80
            ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${past10Days}&end_date=${selectedDate}&daily=snowfall_sum&timezone=Europe/Berlin`
            : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}${eleParam}&start_date=${past10Days}&end_date=${selectedDate}&daily=snowfall_sum&timezone=Europe/Berlin`;
            
        const historyRes = await fetch(historyUrl);
        if (historyRes.ok) {
            const historyData = await historyRes.json();
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
        }
    } catch (error) {
        console.warn("Erreur silencieuse API Météo (date probablement hors limites).");
    }

    // 3. AFFICHAGE (Fonctionne même si la météo a échoué)
    meteoBox.innerHTML = `
        <div class="data-card"><div class="card-title"><i data-lucide="mountain"></i> Topographie</div>
            <div class="card-grid">
                <div class="card-stat"><span class="stat-label">Altitude</span><span class="stat-value">${absoluteElevation} m</span></div>
                <div class="card-stat"><span class="stat-label">Versant</span><span class="stat-value">${aspectName}</span></div>
                <div class="card-stat full"><span class="stat-label">Pente locale</span><span class="stat-value ${slopeClass}">${slopeDeg}°</span></div>
            </div>
        </div>
        <div class="data-card"><div class="card-title"><i data-lucide="snowflake"></i> Météo & Neige</div>
            <div class="card-grid">
                <div class="card-stat"><span class="stat-label">Température</span><span class="stat-value">${noonTemp}</span></div>
                <div class="card-stat"><span class="stat-label">Épaisseur</span><span class="stat-value">${snowStr}</span></div>
            </div>
        </div>`;

    beraBox.innerHTML = `
        <div class="data-card"><div class="card-title"><i data-lucide="triangle-alert"></i> Avalanche (BERA)</div>
            <div class="card-grid">
                <div class="card-stat full"><span class="stat-label">Massif détecté</span><span class="stat-value" style="color:#3b82f6;">${massifName}</span></div>
                <div class="card-stat"><span class="stat-label">Dernière Neige</span><span class="stat-value">${lastSnowDate}</span></div>
                <div class="card-stat"><span class="stat-label">Quantité</span><span class="stat-value">${lastSnowAmount}</span></div>
            </div>
            <a href="https://meteofrance.com/meteo-montagne/alpes-du-nord/risques-avalanche" target="_blank" class="link-bera"><i data-lucide="external-link" style="width:14px;"></i> Bulletin Météo France</a>
        </div>`;
        
    lucide.createIcons();
    if (panelContent) {
        setTimeout(() => { panelContent.scrollTo({ top: panelContent.scrollHeight, behavior: 'smooth' }); }, 100);
    }
});