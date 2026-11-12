'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';

export interface PlacePoint {
  latitude: number;
  longitude: number;
}

interface Found {
  label: string;
  short: string;
  point: PlacePoint;
}

// Mesmo mapa do app (src/map/geo.ts) e a mesma caixa de Belém e região (serviceArea.ts).
const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';
const belem: [number, number] = [-48.49, -1.45];
const area = { west: -48.62753, south: -1.59875, east: -48.08741, north: -0.9356 };

/** Calendarzinho do tipo do evento, o mesmo que aparece no mapa do app. */
const pinFiles: Record<string, string> = {
  vaccination: '/pins/event-pin-vaccination.png',
  neutering: '/pins/event-pin-neutering.png',
  adoption_fair: '/pins/event-pin-adoption-fair.png',
  fundraising: '/pins/event-pin-fundraising.png',
  community: '/pins/event-pin-community.png',
};

interface NominatimPlace {
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  address?: Record<string, string | undefined>;
}

/** "Praça Batista Campos · Batista Campos" a partir da resposta do Nominatim. */
function shortLabel(place: NominatimPlace): string {
  const address = place.address ?? {};
  const street = [address.road, address.house_number].filter(Boolean).join(', ');
  const first = place.name || address.amenity || address.leisure || street;
  const neighborhood = address.suburb || address.neighbourhood || address.quarter;
  return [first, neighborhood].filter(Boolean).join(' · ');
}

// O Nominatim pede no máximo um pedido por segundo e quer saber de onde vem: o painel manda a origem.
async function nominatim(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://nominatim.openstreetmap.org/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'pt-BR');
  const response = await fetch(url, { referrerPolicy: 'strict-origin' });
  if (!response.ok) throw new Error(`nominatim ${response.status}`);
  return response.json();
}

/**
 * Mapa para marcar o lugar exato do evento: procura o endereço ou toca no mapa, e arrasta o
 * calendarzinho para acertar. Fica dentro de Belém e região, como no app.
 */
export function EventPlacePicker({
  category,
  value,
  onChange,
  onSuggestLabel,
}: {
  category: string;
  value: PlacePoint | null;
  onChange: (point: PlacePoint) => void;
  /** Nome do lugar achado na busca ou no toque, para preencher o campo "Local" se estiver vazio. */
  onSuggestLabel: (label: string) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const placeRef = useRef<(point: PlacePoint, from: 'map' | 'search') => void>(() => undefined);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState('');
  const [mapFailed, setMapFailed] = useState(false);

  const inside = (point: PlacePoint) =>
    point.longitude >= area.west &&
    point.longitude <= area.east &&
    point.latitude >= area.south &&
    point.latitude <= area.north;

  useEffect(() => {
    placeRef.current = (point, from) => {
      if (!inside(point)) {
        setProblem('Esse lugar fica fora de Belém e região. O app só atende aqui.');
        return;
      }
      setProblem('');
      onChange(point);
      if (from === 'map') {
        nominatim('reverse', { lat: String(point.latitude), lon: String(point.longitude) })
          .then((body) => {
            const label = shortLabel(body as NominatimPlace);
            if (label) onSuggestLabel(label);
          })
          .catch((error: unknown) => console.warn('reverse geocode', error));
      }
    };
  });

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    import('maplibre-gl')
      .then(({ default: maplibregl }) => {
        if (cancelled) return;
        map = new maplibregl.Map({
          container: node,
          style: styleUrl,
          center: belem,
          zoom: 12,
          minZoom: 8.5,
          maxBounds: [
            [area.west, area.south],
            [area.east, area.north],
          ],
          attributionControl: { compact: true },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', (event) => {
          placeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }, 'map');
        });
        map.on('error', (event) => console.warn('mapa', event.error));
        mapRef.current = map;
        const element = document.createElement('img');
        element.alt = 'Local do evento';
        element.width = 56;
        element.height = 56;
        element.draggable = false;
        element.style.cursor = 'grab';
        const marker = new maplibregl.Marker({ element, anchor: 'bottom', draggable: true });
        marker.on('dragend', () => {
          const at = marker.getLngLat();
          placeRef.current({ latitude: at.lat, longitude: at.lng }, 'map');
        });
        markerRef.current = marker;
      })
      .catch((error: unknown) => {
        console.error('mapa', error);
        setMapFailed(true);
      });
    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // O calendarzinho segue o tipo escolhido e o ponto marcado.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const element = marker.getElement() as HTMLImageElement;
    element.src = pinFiles[category] ?? pinFiles.community;
    if (!value) {
      marker.remove();
      return;
    }
    marker.setLngLat([value.longitude, value.latitude]).addTo(map);
  });

  async function search() {
    const text = query.trim();
    if (text.length < 3) return;
    setSearching(true);
    setProblem('');
    try {
      const body = (await nominatim('search', {
        q: text,
        viewbox: `${area.west},${area.north},${area.east},${area.south}`,
        bounded: '1',
        limit: '5',
      })) as NominatimPlace[];
      setResults(
        body
          .filter((place) => place.lat && place.lon)
          .map((place) => ({
            label: place.display_name ?? '',
            short: shortLabel(place),
            point: { latitude: Number(place.lat), longitude: Number(place.lon) },
          })),
      );
    } catch (error) {
      console.warn('busca de endereço', error);
      setProblem('A busca de endereço não respondeu. Toque no mapa para marcar o lugar.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function choose(found: Found) {
    setResults(null);
    placeRef.current(found.point, 'search');
    if (found.short) onSuggestLabel(found.short);
    mapRef.current?.flyTo({
      center: [found.point.longitude, found.point.latitude],
      zoom: 17,
      duration: 700,
    });
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // Enter aqui procura o endereço, não publica o evento.
    event.preventDefault();
    void search();
  }

  return (
    <div className="place-picker">
      <span className="place-picker-title">Onde vai ser</span>
      <div className="place-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKey}
          placeholder="Procure o endereço ou o nome do lugar"
          aria-label="Procurar endereço"
        />
        <button type="button" className="quiet" onClick={() => void search()} disabled={searching}>
          {searching ? 'Procurando…' : 'Procurar'}
        </button>
      </div>
      {results ? (
        results.length > 0 ? (
          <ul className="place-results">
            {results.map((found) => (
              <li key={`${found.point.latitude},${found.point.longitude}`}>
                <button type="button" onClick={() => choose(found)}>
                  {found.label}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted hint">Nada achado em Belém. Tente outro nome ou toque no mapa.</p>
        )
      ) : null}
      {mapFailed ? (
        <p className="error">O mapa não carregou. Recarregue a página.</p>
      ) : (
        <div ref={host} className="place-map" />
      )}
      {problem ? <p className="error">{problem}</p> : null}
      <span className="muted hint">
        {value
          ? 'Ponto marcado. Arraste o calendário ou toque em outro lugar para corrigir.'
          : 'Toque no mapa no lugar exato do evento. É esse ponto que aparece no mapa do app.'}
      </span>
    </div>
  );
}
