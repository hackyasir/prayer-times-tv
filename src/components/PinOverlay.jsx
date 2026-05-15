// ── PIN Overlay ──────────────────────────────────────────────────────────────
// Modal-style overlay shown when the user clicks the ⚙ Settings button and
// a PIN is configured (VITE_SETTINGS_PIN env var). Settings won't open until
// the correct PIN is entered. Failed attempts show an inline error message
// and clear the input.
//
// The PIN is verified by the parent — this component is purely presentational:
// it tracks its own input state and emits `onSubmit(input)` for verification.

export default function PinOverlay({ visible, input, error, onChange, onSubmit, onCancel }) {
  if (!visible) return null;
  return (
    <div className="overlay">
      <div style={{
        background:'#0A0A0A',
        border:'1px solid rgba(201,168,76,.45)',
        borderRadius:8,
        padding:36,
        width:'min(340px,90vw)',
        textAlign:'center',
      }}>
        <div style={{
          fontFamily:"'Amiri',serif", fontSize:20,
          color:'#C9A84C', letterSpacing:'.1em', textTransform:'uppercase',
          marginBottom:20,
        }}>🔒 Settings PIN</div>
        <input
          type="password"
          value={input}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="Enter PIN"
          autoFocus
          style={{
            width:'100%',
            background:'#111',
            border:`1px solid ${error ? '#c0392b' : 'rgba(201,168,76,.3)'}`,
            borderRadius:4, padding:'10px 14px',
            fontFamily:'Rajdhani,sans-serif', fontSize:22,
            color:'#F5EDD8', outline:'none',
            textAlign:'center', letterSpacing:'.3em', marginBottom:8,
          }}
        />
        {error && <div style={{
          fontSize:13, color:'#c0392b', marginBottom:8, letterSpacing:'.05em',
        }}>Incorrect PIN — try again</div>}
        <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:16 }}>
          <button className="sbtn" onClick={onCancel}>Cancel</button>
          <button className="sbtn pri" onClick={onSubmit}>Unlock</button>
        </div>
      </div>
    </div>
  );
}
