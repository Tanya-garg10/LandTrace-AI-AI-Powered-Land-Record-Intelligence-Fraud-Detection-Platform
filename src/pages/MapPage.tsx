import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { ExternalLink, FileCheck2, Globe2, Layers, Map as MapIcon, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { Property } from '../types';
import { RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';

function statusColor(status: string): string {
  switch (status) {
    case 'Verified':
      return '#398568';
    case 'Pending Review':
      return '#E5A13A';
    case 'Flagged':
    case 'Under Investigation':
      return '#D95B55';
    default:
      return '#173F32';
  }
}

export function MapPage() {
  const { canWrite } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParcel, setSearchParcel] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [baseLayer, setBaseLayer] = useState<'street' | 'satellite'>('street');
  const [selected, setSelected] = useState<Property | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiRequest<{ properties: Property[] }>('/api/properties?limit=100')
      .then((res) => {
        setProperties(res.properties);
        if (res.properties.length > 0) {
          const demoProp = res.properties.find((p) => p.parcel_id === 'LT-PAR-1004') || res.properties[0];
          setSelected(demoProp);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const districts = useMemo(
    () => ['All', ...Array.from(new Set(properties.map((p) => p.district_name))).sort()],
    [properties]
  );

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (districtFilter !== 'All' && p.district_name !== districtFilter) return false;
      if (statusFilter !== 'All' && p.verification_status !== statusFilter) return false;
      if (riskFilter !== 'All' && p.risk_category !== riskFilter) return false;
      if (searchParcel.trim()) {
        const q = searchParcel.trim().toLowerCase();
        if (
          !p.parcel_id.toLowerCase().includes(q) &&
          !p.survey_number.toLowerCase().includes(q) &&
          !p.current_owner.toLowerCase().includes(q) &&
          !p.village.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [properties, districtFilter, statusFilter, riskFilter, searchParcel]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [18.532, 73.855],
      zoom: 12,
      zoomControl: true,
    });
    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors · Illustrative Demo Parcels',
      maxZoom: 19,
    }).addTo(map);
    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    tileLayerRef.current = tile;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Switch between Street Map and Satellite Imagery layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const url =
      baseLayer === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution =
      baseLayer === 'satellite'
        ? 'Imagery &copy; Esri · Illustrative Demo Parcels'
        : '&copy; OpenStreetMap contributors · Illustrative Demo Parcels';

    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [baseLayer]);

  // Render parcel polygons & markers
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    for (const p of filtered) {
      const color = statusColor(p.verification_status);
      const isSelected = selected?.parcel_id === p.parcel_id;
      bounds.push([p.latitude, p.longitude]);

      if (showBoundaries && p.boundary_geojson) {
        try {
          const geo = JSON.parse(p.boundary_geojson) as { coordinates?: number[][][] };
          const ring = geo.coordinates?.[0];
          if (ring && ring.length >= 3) {
            const latLngs = ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
            const poly = L.polygon(latLngs, {
              color: isSelected ? '#173F32' : color,
              weight: isSelected ? 3 : 1.75,
              fillColor: color,
              fillOpacity: isSelected ? 0.34 : 0.16,
            });
            poly.on('click', () => setSelected(p));
            poly.addTo(group);
          }
        } catch {
          // ignore malformed geojson
        }
      }

      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: isSelected ? 9 : 6.5,
        color: '#FFFFFF',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.96,
      });

      marker.bindTooltip(`${p.parcel_id} · ${p.current_owner}`, { direction: 'top', offset: [0, -6] });
      marker.on('click', () => setSelected(p));
      marker.addTo(group);
    }

    if (bounds.length > 0 && (districtFilter !== 'All' || statusFilter !== 'All' || riskFilter !== 'All' || searchParcel.trim())) {
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
    }
  }, [filtered, showBoundaries, selected, districtFilter, statusFilter, riskFilter, searchParcel]);

  const focusParcel = (p: Property) => {
    setSelected(p);
    mapRef.current?.setView([p.latitude, p.longitude], 15, { animate: true });
  };

  return (
    <div className="space-y-5">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#242B27]">
            Land Intelligence Map
          </h1>
          <p className="text-xs text-[#616D66] mt-0.5">
            Illustrative synthetic parcel boundaries on OpenStreetMap · Not official government cadastral data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#242B27]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#398568]" />
            Verified
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#E5A13A]" />
            Pending
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#D95B55]" />
            Flagged
          </span>
        </div>
      </div>

      {/* Filter & Layer Toolbar */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-center">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchParcel}
            onChange={(e) => setSearchParcel(e.target.value)}
            placeholder="Search Parcel ID, Survey, Owner, Village..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          />
        </div>

        <select
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          aria-label="Filter by district"
        >
          {districts.map((d) => (
            <option key={d} value={d}>
              {d === 'All' ? 'All Districts' : d}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          aria-label="Filter by verification status"
        >
          <option value="All">All Statuses</option>
          <option value="Verified">Verified</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Flagged">Flagged</option>
          <option value="Under Investigation">Under Investigation</option>
        </select>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          aria-label="Filter by risk category"
        >
          <option value="All">All Risk Levels</option>
          <option value="Low">Low Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="High">High Risk</option>
          <option value="Critical">Critical Risk</option>
        </select>

        {/* Map / Satellite + Boundary Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBaseLayer((b) => (b === 'street' ? 'satellite' : 'street'))}
            className="flex-1 px-2.5 py-2 text-xs font-medium rounded-lg border border-[#E4E7DF] bg-white hover:bg-[#FAFAF6] text-[#242B27] inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Toggle Street / Satellite imagery"
          >
            {baseLayer === 'street' ? <Globe2 className="w-3.5 h-3.5 text-[#173F32]" /> : <MapIcon className="w-3.5 h-3.5 text-[#173F32]" />}
            <span>{baseLayer === 'street' ? 'Satellite' : 'Map'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBoundaries((v) => !v)}
            className={`px-2.5 py-2 text-xs font-medium rounded-lg border inline-flex items-center justify-center gap-1 cursor-pointer ${
              showBoundaries
                ? 'bg-[#EAF0E9] text-[#173F32] border-[#398568]/40'
                : 'bg-white text-[#616D66] border-[#E4E7DF]'
            }`}
            title="Toggle parcel boundaries"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Signature 70% Map / 30% Property Intelligence Split */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch">
        {/* 70% Interactive Leaflet Map */}
        <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden relative min-h-[560px]">
          <div ref={mapContainerRef} className="w-full h-[580px] z-10" />
          {loading && (
            <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center text-xs text-[#616D66]">
              Loading geospatial parcel layer...
            </div>
          )}
        </div>

        {/* 30% Property Intelligence Panel */}
        <div className="lg:col-span-3 bg-white border border-[#E4E7DF] rounded-xl flex flex-col overflow-hidden">
          {selected ? (
            <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="pb-4 border-b border-[#EFF2EC]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#173F32]">{selected.parcel_id}</span>
                    <VerificationStatusText status={selected.verification_status} />
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#242B27] mt-1">
                    Survey No. {selected.survey_number}
                  </h2>
                  <p className="text-xs text-[#616D66]">
                    {selected.land_type} · Registered {selected.registration_date}
                  </p>
                </div>

                <dl className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#616D66]">Location</dt>
                    <dd className="font-medium text-[#242B27] text-right">
                      {selected.village}, {selected.tehsil}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#616D66]">District</dt>
                    <dd className="font-medium text-[#242B27] text-right">{selected.district_name}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#616D66]">Land Area</dt>
                    <dd className="font-display font-semibold text-[#242B27] tabular-nums text-right">
                      {selected.land_area_display}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#616D66]">Registered Owner</dt>
                    <dd className="font-semibold text-[#242B27] text-right">{selected.current_owner}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <dt className="text-[#616D66]">Risk Score</dt>
                    <dd>
                      <RiskScoreDisplay score={selected.risk_score} category={selected.risk_category} />
                    </dd>
                  </div>
                  <div className="pt-2 border-t border-[#EFF2EC]">
                    <dt className="text-[11px] text-[#616D66]">Illustrative Coordinates</dt>
                    <dd className="font-mono text-[11px] text-[#616D66] mt-0.5 tabular-nums">
                      {selected.latitude.toFixed(4)}° N, {selected.longitude.toFixed(4)}° E
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="pt-4 border-t border-[#EFF2EC] space-y-2">
                <button
                  onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(selected.parcel_id)}`)}
                  className="w-full py-2.5 px-3 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Full Record</span>
                </button>
                {canWrite && (
                  <button
                    onClick={() => navigate(`/workspace/documents?parcel=${encodeURIComponent(selected.parcel_id)}`)}
                    className="w-full py-2 px-3 bg-[#FAFAF6] hover:bg-[#EAF0E9] text-[#242B27] border border-[#E4E7DF] text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-[#173F32]" />
                    <span>Verify Document</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-xs text-[#616D66]">Select a parcel polygon on the map to inspect details.</div>
          )}

          {/* Parcel Switcher List */}
          <div className="border-t border-[#E4E7DF] bg-[#FAFAF6] p-3">
            <p className="text-[11px] font-semibold text-[#616D66] mb-2">
              Parcels in View ({filtered.length})
            </p>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filtered.map((p) => (
                <button
                  key={p.parcel_id}
                  onClick={() => focusParcel(p)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    selected?.parcel_id === p.parcel_id
                      ? 'bg-[#EAF0E9] text-[#173F32] font-semibold'
                      : 'hover:bg-white text-[#242B27]'
                  }`}
                >
                  <span className="font-mono">{p.parcel_id}</span>
                  <span className="truncate max-w-[130px] text-[#616D66]">{p.village}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
