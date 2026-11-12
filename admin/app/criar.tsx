'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { moderate } from './painel';

const categories = [
  { value: 'adoption_fair', label: 'Feira de adoção' },
  { value: 'vaccination', label: 'Vacinação' },
  { value: 'neutering', label: 'Castração' },
  { value: 'fundraising', label: 'Arrecadação' },
  { value: 'community', label: 'Ação da comunidade' },
] as const;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

/** "-1.4569, -48.4889" ou o link do Google Maps com @lat,lng. */
export function parsePoint(value: string): { latitude: number; longitude: number } | null {
  const match = /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(value);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/** "1.500,50" ou "1500.50" em centavos. */
export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^\d,.]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

/** Cores do banner de destaques, as mesmas capas do app. */
export const bannerColors = [
  { value: 'coral', label: 'Coral', swatch: '#F26B4E' },
  { value: 'turquoise', label: 'Turquesa', swatch: '#1F7A7A' },
  { value: 'caramel', label: 'Caramelo', swatch: '#D98A3D' },
  { value: 'green', label: 'Verde', swatch: '#1E7B52' },
  { value: 'blue', label: 'Azul', swatch: '#2A64AE' },
] as const;

/** Reduz a foto no navegador (até 1600 px, JPEG) e manda para a API guardar. */
async function uploadBanner(file: File): Promise<{ key: string; url: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador não consegue preparar a foto.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
  const response = await fetch('/api/mod/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  const payload = (await response.json()) as { key?: string; url?: string; message?: string };
  if (!response.ok || !payload.key || !payload.url) {
    throw new Error(payload.message ?? 'Não consegui enviar a foto.');
  }
  return { key: payload.key, url: payload.url };
}

/** Escolha da cor e da foto do banner de destaques do app, com prévia. */
function BannerFields({
  color,
  onColor,
  banner,
  onBanner,
  onError,
}: {
  color: string;
  onColor: (value: string) => void;
  banner: { key: string; url: string } | null;
  onBanner: (value: { key: string; url: string } | null) => void;
  onError: (message: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const swatch = bannerColors.find((item) => item.value === color)?.swatch ?? '#F26B4E';
  return (
    <fieldset className="stack banner-fields">
      <legend>Banner de destaque no app</legend>
      <div
        className="banner-preview"
        style={{
          backgroundColor: swatch,
          backgroundImage: banner
            ? `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url(${banner.url})`
            : undefined,
        }}
      >
        <span>CAMPANHA</span>
      </div>
      <div className="swatches" role="radiogroup" aria-label="Cor do banner">
        {bannerColors.map((item) => (
          <label key={item.value} className="swatch">
            <input
              type="radio"
              name="bannerColor"
              value={item.value}
              checked={color === item.value}
              onChange={() => onColor(item.value)}
            />
            <span style={{ backgroundColor: item.swatch }} aria-hidden="true" />
            {item.label}
          </label>
        ))}
      </div>
      <label>
        Foto do banner (opcional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={sending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            setSending(true);
            uploadBanner(file)
              .then(onBanner)
              .catch((failure: unknown) =>
                onError(failure instanceof Error ? failure.message : 'Não consegui enviar a foto.'),
              )
              .finally(() => setSending(false));
          }}
        />
        <span className="muted hint">
          {sending
            ? 'Enviando a foto...'
            : 'Sem foto, o banner usa a cor escolhida. A foto fica com um véu escuro para o texto aparecer.'}
        </span>
      </label>
      {banner ? (
        <div className="actions">
          <button type="button" className="quiet" onClick={() => onBanner(null)}>
            Tirar a foto
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

function key(): string {
  return `painel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function CreatePanel({
  label,
  children,
  onSubmit,
  busy,
  error,
  done,
}: {
  label: string;
  children: ReactNode;
  onSubmit: (form: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
  done: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stack">
      <div className="actions">
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Fechar' : label}
        </button>
      </div>
      {done ? <p className="ok-text">{done}</p> : null}
      {open ? (
        <form className="card stack create-form" onSubmit={onSubmit}>
          {children}
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Publicar'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/** Evento da agenda criado pela equipe. Sai em nome da conta da equipe. */
export function CreateEvent({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [clientKey, setClientKey] = useState(key);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError('');
    setDone('');
    const point = parsePoint(text(form, 'point'));
    if (!point) {
      setError('Cole as coordenadas do local, por exemplo -1.4569, -48.4889.');
      return;
    }
    const day = text(form, 'day');
    const capacity = text(form, 'capacity');
    const description = text(form, 'description');
    const payload = {
      title: text(form, 'title'),
      category: text(form, 'category'),
      ...(description ? { description } : {}),
      placeLabel: text(form, 'placeLabel'),
      latitude: point.latitude,
      longitude: point.longitude,
      startsAt: `${day}T${text(form, 'start')}:00-03:00`,
      endsAt: `${day}T${text(form, 'end')}:00-03:00`,
      ...(capacity ? { capacity: Number(capacity) } : {}),
      clientKey,
    };
    setBusy(true);
    const failure = await moderate('events', payload);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    element.reset();
    setClientKey(key());
    setDone(`"${payload.title}" foi publicado na agenda.`);
    onCreated();
  }

  return (
    <CreatePanel
      label="Criar evento"
      onSubmit={(event) => void submit(event)}
      busy={busy}
      error={error}
      done={done}
    >
      <label>
        Nome do evento
        <input name="title" required minLength={3} maxLength={80} />
      </label>
      <label>
        Tipo
        <select name="category" defaultValue="adoption_fair">
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Descrição (opcional)
        <textarea name="description" maxLength={500} rows={3} />
      </label>
      <label>
        Local
        <input name="placeLabel" required maxLength={160} placeholder="Praça Batista Campos" />
      </label>
      <label>
        Coordenadas do local
        <input name="point" required placeholder="-1.4569, -48.4889" />
        <span className="muted hint">
          No Google Maps, toque e segure no lugar e copie os números que aparecem.
        </span>
      </label>
      <div className="form-row">
        <label>
          Dia
          <input name="day" type="date" required />
        </label>
        <label>
          Começa
          <input name="start" type="time" required />
        </label>
        <label>
          Termina
          <input name="end" type="time" required />
        </label>
      </div>
      <label>
        Vagas (opcional)
        <input name="capacity" type="number" min={1} max={2000} />
      </label>
      <p className="muted hint">Horário de Belém. O evento dura de meia hora a 12 horas.</p>
    </CreatePanel>
  );
}

/** Campanha aberta pela equipe em nome do responsável pelo Pix. */
export function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [clientKey, setClientKey] = useState(key);
  const [bannerColor, setBannerColor] = useState('coral');
  const [banner, setBanner] = useState<{ key: string; url: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError('');
    setDone('');
    const goalCents = parseMoney(text(form, 'goal'));
    if (!goalCents) {
      setError('Escreva a meta em reais, por exemplo 1.500,00.');
      return;
    }
    const ownerHandle = text(form, 'ownerHandle');
    const payload = {
      title: text(form, 'title'),
      purpose: text(form, 'purpose'),
      goalCents,
      deadline: text(form, 'deadline'),
      pixKey: text(form, 'pixKey'),
      bannerColor,
      ...(banner ? { bannerKey: banner.key } : {}),
      ...(ownerHandle ? { ownerHandle } : {}),
      clientKey,
    };
    setBusy(true);
    const failure = await moderate('campaigns', payload);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    element.reset();
    setClientKey(key());
    setBanner(null);
    setBannerColor('coral');
    setDone(`A campanha "${payload.title}" está no ar.`);
    onCreated();
  }

  return (
    <CreatePanel
      label="Criar campanha"
      onSubmit={(event) => void submit(event)}
      busy={busy}
      error={error}
      done={done}
    >
      <label>
        @ do responsável (opcional)
        <input name="ownerHandle" placeholder="@ong.exemplo" />
        <span className="muted hint">
          Quem é dono do Pix e confirma as doações pelo app. Precisa ser verificado. Sem @, a
          campanha fica com a conta da equipe.
        </span>
      </label>
      <label>
        Título
        <input name="title" required minLength={6} maxLength={80} />
      </label>
      <label>
        Para que é o dinheiro
        <textarea name="purpose" required maxLength={2000} rows={4} />
      </label>
      <div className="form-row">
        <label>
          Meta (R$)
          <input name="goal" required inputMode="decimal" placeholder="1.500,00" />
        </label>
        <label>
          Prazo
          <input name="deadline" type="date" required />
        </label>
      </div>
      <label>
        Chave Pix
        <input name="pixKey" required minLength={3} maxLength={120} />
        <span className="muted hint">
          Aparece na campanha com botão de copiar e com o QR code do Pix.
        </span>
      </label>
      <BannerFields
        color={bannerColor}
        onColor={setBannerColor}
        banner={banner}
        onBanner={setBanner}
        onError={setError}
      />
    </CreatePanel>
  );
}
