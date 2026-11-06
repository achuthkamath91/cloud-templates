import { type FormEvent, useEffect, useState } from 'react';
import { createPatient, listPatients, type Patient } from './api';
import { answer, currentSession, login, logout, type Session, type Step } from './auth';

const WRITERS = ['admin', 'clinician', 'staff'];

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    currentSession().then(setSession);
  }, []);

  if (session === undefined) return <main>Loading…</main>;
  if (!session) return <Login onDone={() => currentSession().then(setSession)} />;
  return (
    <Home
      session={session}
      onLogout={async () => {
        await logout();
        setSession(null);
      }}
    />
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const next = step.kind === 'credentials' ? await login(email, password) : await answer(value);
      setValue('');
      if (next.kind === 'done') onDone();
      else setStep(next);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main>
      <h1>Healthcare CRM</h1>
      <form onSubmit={submit}>
        {step.kind === 'credentials' && (
          <>
            <input type="email" placeholder="Email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </>
        )}
        {step.kind === 'new_password' && (
          <input type="password" placeholder="Choose a new password (12+ chars)" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} required />
        )}
        {step.kind === 'totp_setup' && (
          <>
            <p>Add this key to your authenticator app, then enter the 6-digit code:</p>
            <code>{step.secret}</code>
          </>
        )}
        {(step.kind === 'totp_setup' || step.kind === 'totp_code') && (
          <input inputMode="numeric" placeholder="6-digit code" autoComplete="one-time-code" value={value} onChange={(e) => setValue(e.target.value)} required />
        )}
        <button type="submit">Continue</button>
        {error && <p className="err">{error}</p>}
      </form>
    </main>
  );
}

function Home({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '' });
  const canWrite = session.groups.some((g) => WRITERS.includes(g));

  const load = (token?: string) =>
    listPatients(token)
      .then((r) => {
        setPatients((prev) => (token ? [...prev, ...r.items] : r.items));
        setNext(r.next);
      })
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createPatient({ ...form, status: 'lead' });
      setForm({ firstName: '', lastName: '', dob: '' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main>
      <div className="row">
        <h1>Patients</h1>
        <div>
          <small>
            {session.email} · {session.groups.join(', ') || 'no role'}
          </small>{' '}
          <button className="secondary" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
      {error && <p className="err">{error}</p>}
      {canWrite && (
        <form onSubmit={add}>
          <input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required />
          <button type="submit">Add patient</button>
        </form>
      )}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>DOB</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id}>
              <td>
                {p.lastName}, {p.firstName}
              </td>
              <td>{p.dob}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {next && (
        <button className="secondary" onClick={() => load(next)}>
          Load more
        </button>
      )}
    </main>
  );
}
