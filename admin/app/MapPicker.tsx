'use client';

import 'leaflet/dist/leaflet.css';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';

export interface Point {
  latitude: number;
  longitude: number;
}

/** Centro de Belém, onde o mapa abre quando ainda não há ponto. */
const belem: Point = { latitude: -1.4558, longitude: -48.4902 };

/**
 * Mapa para marcar um lugar: clique (ou toque) onde vai ser e o ponto vai para lá; dá para
 * arrastar o mapa e dar zoom antes. Usa os mapas do OpenStreetMap, sem chave.
 */
export function MapPicker({
  value,
  onChange,
}: {
  value: Point | null;
  onChange: (point: Point) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !box.current || map.current) return;
      const start = value ?? belem;
      const created = L.map(box.current, { zoomControl: true }).setView(
        [start.latitude, start.longitude],
        value ? 16 : 13,
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(created);
      created.on('click', (event) => {
        change.current({
          latitude: Number(event.latlng.lat.toFixed(6)),
          longitude: Number(event.latlng.lng.toFixed(6)),
        });
      });
      map.current = created;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // O mapa nasce uma vez; o ponto é atualizado no efeito de baixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void import('leaflet').then((L) => {
      const current = map.current;
      if (!current) return;
      if (!value) {
        marker.current?.remove();
        marker.current = null;
        return;
      }
      const at: [number, number] = [value.latitude, value.longitude];
      if (marker.current) marker.current.setLatLng(at);
      else {
        marker.current = L.circleMarker(at, {
          radius: 10,
          color: '#FFFFFF',
          weight: 3,
          fillColor: '#F26B4E',
          fillOpacity: 1,
        }).addTo(current);
      }
      if (!current.getBounds().contains(at)) current.setView(at, Math.max(current.getZoom(), 15));
    });
  }, [value]);

  return <div ref={box} className="map-picker" role="application" aria-label="Mapa do local" />;
}
