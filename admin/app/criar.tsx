'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { EventPlacePicker, type PlacePoint } from './mapa-local';
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

/** "1.500,50" ou "1500.50" em centavos. */
export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^\d,.]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
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
  const [category, setCategory] = useState<string>('adoption_fair');
  const [point, setPoint] = useState<PlacePoint | null>(null);
  const [placeLabel, setPlaceLabel] = useState('');
  // O nome achado no mapa só entra se a pessoa ainda não escreveu o próprio.
  const [labelFromMap, setLabelFromMap] = useState(true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError('');
    setDone('');
    if (!point) {
      setError('Marque no mapa o lugar do evento.');
      return;
    }
    const day = text(form, 'day');
    const capacity = text(form, 'capacity');
    const description = text(form, 'description');
    const payload = {
      title: text(form, 'title'),
      category: text(form, 'category'),
      ...(description ? { description } : {}),
      placeLabel: placeLabel.trim(),
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
    setCategory('adoption_fair');
    setPoint(null);
    setPlaceLabel('');
    setLabelFromMap(true);
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
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
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
      <EventPlacePicker
        category={category}
        value={point}
        onChange={setPoint}
        onSuggestLabel={(label) => {
          if (labelFromMap) setPlaceLabel(label.slice(0, 160));
        }}
      />
      <label>
        Nome do local
        <input
          name="placeLabel"
          required
          maxLength={160}
          placeholder="Praça Batista Campos"
          value={placeLabel}
          onChange={(event) => {
            setPlaceLabel(event.target.value);
            setLabelFromMap(event.target.value.trim() === '');
          }}
        />
        <span className="muted hint">
          Vem do mapa. Ajuste para como as pessoas conhecem o lugar.
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
        <textarea name="purpose" required minLength={30} maxLength={2000} rows={4} />
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
      </label>
    </CreatePanel>
  );
}
