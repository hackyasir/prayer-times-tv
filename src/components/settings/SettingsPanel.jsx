// ── Settings Panel ──────────────────────────────────────────────────────────
//
// The big editing overlay. Opens via the ⚙ Settings button in the footer.
// Two-column layout (general/iqamah on left, jumu'ah/eid/etc on right) with
// a fixed header containing Cancel + Apply buttons.
//
// All settings drafts come from SettingsContext via the parent. Cancel just
// closes the overlay; Apply commits drafts → applied + persists to
// localStorage. Sanitisation/clamping happens in the parent's applySettings.
//
// This component receives a large prop bag because the panel is tightly
// coupled to almost every settings field. Rather than refactor each input
// to read from context directly (which would mean rewriting all input
// handlers), we pass the existing draft state and setters through verbatim.
// The result: SettingsContext owns persistence + applied/drafts lifecycle;
// this component owns the form UI.

import { THEMES }        from '../../lib/themes.js';
import { METHOD_LABELS } from '../../lib/constants.js';
import { fmt12, addMins } from '../../lib/formatters.js';
import { toHijri }       from '../../lib/hijri.js';
import { playBeep }      from '../../lib/audio.js';

export default function SettingsPanel({
  visible,
  // Lifecycle
  onCancel,
  onApply,
  // Draft state (all 11 settings drafts)
  draftMethod,    setDraftMethod,
  draftAsr,       setDraftAsr,
  draftIqamah,    setDraftIqamah,
  draftJumuah,    setDraftJumuah,
  draftEid,       setDraftEid,
  draftEidDays,   setDraftEidDays,
  draftHijri,     setDraftHijri,
  draftHighLat,   setDraftHighLat,
  draftTheme,     setDraftTheme,
  draftChime,     setDraftChime,
  draftFontScale, setDraftFontScale,
  draftProgress,  setDraftProgress,
  draftMasjid,    setDraftMasjid,
  // City search state + handlers
  searchQuery, searchResults, searchStatus,
  onSearchInput,
  onSelectCity,
  onClearCity,
  selectedCity,
  // Geolocation handler
  onGeolocate,
  // City-time context — used for Hijri preview + Jumu'ah time displays
  cityNow, cityTz,
  // Today's prayer times — used by the iqamah offset preview ("Fajr 4:19 → 4:39")
  todayTimes,
}) {
  if (!visible) return null;

  // Some local aliases to match the original variable names from App.jsx —
  // the inlined JSX below uses `setShowSett(false)` / `applySettings` /
  // `handleSearchInput` / `handleSelectCity` / `geolocate`. We bind those
  // to the corresponding prop-named callbacks here so we don't have to
  // touch the (large) JSX block.
  const setShowSett       = () => onCancel();
  const applySettings     = onApply;
  const handleSearchInput = onSearchInput;
  const handleSelectCity  = onSelectCity;
  const geolocate         = onGeolocate;

  return (
      <div className="overlay">
        <div className="sbox">
          {/* Fixed header with title + action buttons */}
          <div className="sbox-hdr">
            <div className="stitle">⚙ Display Settings</div>
            <div className="sbtn-row">
              <button className="sbtn" onClick={() => setShowSett(false)}>Cancel</button>
              <button className="sbtn pri" onClick={applySettings}>Apply</button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="sbox-body">

          {/* Theme picker */}
          <div className="sgrp">
            <label className="slbl">Display Theme</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {Object.entries(THEMES).map(([key, t]) => {
                const active = draftTheme === key;
                const [bg, acc, txt] = t.preview;
                return (
                  <button key={key} onClick={() => setDraftTheme(key)}
                    style={{
                      background: bg, border:`2px solid ${active ? acc : 'rgba(255,255,255,.1)'}`,
                      borderRadius:6, padding:'8px 6px', cursor:'pointer', textAlign:'center',
                      transition:'border-color .2s', outline:'none',
                    }}
                  >
                    {/* Colour swatches */}
                    <div style={{ display:'flex', gap:3, justifyContent:'center', marginBottom:5 }}>
                      {[bg, acc, txt].map((c,i) => (
                        <div key={i} style={{ width:12, height:12, borderRadius:'50%', background:c, border:'1px solid rgba(255,255,255,.15)' }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color: active ? acc : 'rgba(255,255,255,.5)', fontFamily:'Rajdhani,sans-serif', letterSpacing:'.05em', fontWeight: active ? 700 : 400 }}>
                      {t.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size scale */}
          <div className="sgrp">
            <label className="slbl">Display Size</label>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#111', border:'1px solid var(--t-border)', borderRadius:4, padding:'10px 14px' }}>
              <button
                onClick={() => setDraftFontScale(v => Math.max(70, v - 5))}
                style={{ width:32, height:32, borderRadius:4, border:'1px solid rgba(var(--t-accent-rgb),.3)', background:'transparent', color:'var(--t-accent)', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
              >A−</button>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:16, color:'var(--t-text)', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
                  {draftFontScale}%
                </div>
                <div style={{ fontSize:11, color:'var(--t-text-dim)', letterSpacing:'.05em', marginTop:2 }}>
                  {draftFontScale === 100 ? 'Default size' : draftFontScale < 100 ? 'Smaller' : 'Larger'}
                </div>
              </div>
              <button
                onClick={() => setDraftFontScale(v => Math.min(130, v + 5))}
                style={{ width:32, height:32, borderRadius:4, border:'1px solid rgba(var(--t-accent-rgb),.3)', background:'transparent', color:'var(--t-accent)', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
              >A+</button>
              {draftFontScale !== 100 && (
                <button
                  onClick={() => setDraftFontScale(100)}
                  style={{ background:'transparent', border:'1px solid var(--t-border)', borderRadius:4, padding:'5px 10px', color:'var(--t-text-dim)', fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:600, letterSpacing:'.08em', cursor:'pointer' }}
                >Reset</button>
              )}
            </div>
            <div style={{ marginTop:5, fontSize:11, color:'var(--t-text-dim)', letterSpacing:'.05em' }}>
              Adjusts text size only — layout stays put. Useful for TVs at distance.
            </div>
          </div>

          {/* Progress Style picker */}
          <div className="sgrp">
            <label className="slbl">Progress Style</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
              {[
                { key:'ring',   label:'Ring',     desc:'Circular % elapsed' },
                { key:'daybar', label:'Day Bar',  desc:'Full day timeline' },
                { key:'moon',   label:'Moon',     desc:'Crescent phase' },
                { key:'line',   label:'Line',     desc:'Thin bar + %' },
                { key:'hero',   label:'Hero',     desc:'Countdown only' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setDraftProgress(opt.key)}
                  style={{
                    background: draftProgress === opt.key ? 'rgba(var(--t-accent-rgb),.18)' : 'transparent',
                    border: `1px solid ${draftProgress === opt.key ? 'var(--t-border-hi)' : 'var(--t-border)'}`,
                    borderRadius: 4,
                    padding: '10px 6px',
                    color: draftProgress === opt.key ? 'var(--t-accent-hi)' : 'var(--t-text)',
                    fontFamily: 'Rajdhani,sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '.05em',
                    cursor: 'pointer',
                    transition: 'all .15s',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</div>
                  <div style={{ fontSize: 9, color:'var(--t-text-dim)', marginTop: 2, letterSpacing:'.03em' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop:5, fontSize:11, color:'var(--t-text-dim)', letterSpacing:'.05em' }}>
              Visual indicator between "Next Prayer" and the countdown.
            </div>
          </div>

          {/* Prayer beep toggle + test button */}
          <div className="sgrp">
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#111', border:'1px solid var(--t-border)', borderRadius:4, padding:'10px 14px' }}>
              <button
                onClick={() => setDraftChime(v => !v)}
                style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', background: draftChime ? 'var(--t-accent)' : '#333', position:'relative', flexShrink:0, transition:'background .2s' }}
              >
                <span style={{ position:'absolute', top:2, left: draftChime ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
              </button>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, color:'var(--t-text)', fontWeight:600 }}>Prayer Beep</div>
                <div style={{ fontSize:11, color:'var(--t-text-dim)', letterSpacing:'.05em', marginTop:2 }}>
                  Plays at adhan and iqamah times for each prayer
                </div>
              </div>
              <button
                onClick={() => playBeep()}
                style={{ background:'transparent', border:'1px solid var(--t-border)', borderRadius:4, padding:'5px 10px', color:'var(--t-accent)', fontFamily:'Rajdhani,sans-serif', fontSize:12, fontWeight:600, letterSpacing:'.08em', cursor:'pointer' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(var(--t-accent-rgb),.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >🔔 Test</button>
            </div>
          </div>

          {/* Masjid name */}
          <div className="sgrp">
            <label className="slbl">Masjid / Centre Name</label>
            <input
              className="sinput"
              type="text"
              placeholder="e.g. Masjid Al-Noor, Islamic Centre of Toronto…"
              value={draftMasjid}
              onChange={e => setDraftMasjid(e.target.value)}
              maxLength={60}
            />
            {draftMasjid && (
              <div style={{ marginTop:5, fontSize:11, color:'#9A8B6E', letterSpacing:'.05em' }}>
                Shown in header · leave blank to show "Prayer Times"
              </div>
            )}
          </div>

          {/* City search */}
          <div className="sgrp">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
              <label className="slbl" style={{ margin:0 }}>Search City</label>
              <button
                onClick={geolocate}
                style={{
                  background:'transparent',
                  border:'1px solid var(--t-border)',
                  borderRadius:4,
                  padding:'4px 10px',
                  color:'var(--t-accent)',
                  fontFamily:'Rajdhani,sans-serif',
                  fontSize:12,
                  fontWeight:600,
                  letterSpacing:'.08em',
                  cursor:'pointer',
                  whiteSpace:'nowrap',
                  transition:'background .2s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(var(--t-accent-rgb),.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >📍 Use my location</button>
            </div>
            {selectedCity ? (
              <div className="search-selected">
                <div>
                  <div className="search-selected-name">📍 {selectedCity.name}</div>
                  <div className="search-selected-sub">
                    {[selectedCity.admin1, selectedCity.country].filter(Boolean).join(', ')}
                    {' · '}{selectedCity.lat.toFixed(3)}°N {selectedCity.lng.toFixed(3)}°E
                  </div>
                </div>
                <button className="search-clear" onClick={onClearCity}>✕</button>
              </div>
            ) : (
              <>
                <input
                  className="sinput"
                  type="text"
                  placeholder="Type any city name, e.g. Karachi, Lyon, Nairobi…"
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  autoFocus
                />
                <div className="search-results">
                  {searchStatus === 'searching' && (
                    <div className="search-status">Searching…</div>
                  )}
                  {searchStatus === 'empty' && (
                    <div className="search-status">No results found — try a different spelling</div>
                  )}
                  {searchStatus === 'error' && (
                    <div className="search-status">Search unavailable — check your connection</div>
                  )}
                  {searchResults.map(r => (
                    <div key={r.id} className="search-item" onClick={() => handleSelectCity(r)}>
                      <div className="search-item-name">{r.name}</div>
                      <div className="search-item-sub">
                        {[r.admin1, r.country].filter(Boolean).join(', ')}
                        {r.tz ? ` · ${r.tz}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="sgrp">
            <label className="slbl">Calculation Method</label>
            <select className="ssel" value={draftMethod} onChange={e => setDraftMethod(e.target.value)}>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* High-latitude rule — for cities above ~48° (Stockholm, Edmonton,
              etc) where the sun doesn't dip 18° below the horizon in summer.
              Has no observable effect below ~48° latitude — fine to leave at
              the default. */}
          <div className="sgrp">
            <label className="slbl">High-Latitude Rule</label>
            <select className="ssel" value={draftHighLat} onChange={e => setDraftHighLat(e.target.value)}>
              <option value="middleOfNight">Middle of Night (default)</option>
              <option value="seventhOfNight">Seventh of Night</option>
              <option value="twilightAngle">Angle-Based</option>
            </select>
            <div style={{ fontSize:11, color:'#9A8B6E', marginTop:6, letterSpacing:'.04em', lineHeight:1.4 }}>
              Only matters above ~48° latitude in summer, when the sun doesn't
              dip far enough below the horizon for standard Fajr/Isha angles.
            </div>
          </div>

          {/* Hijri date adjustment */}
          <div className="sgrp">
            <label className="slbl">Hijri Date Adjustment</label>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#111', border:'1px solid rgba(201,168,76,.15)', borderRadius:4, padding:'10px 14px' }}>
              <button onClick={() => setDraftHijri(v => Math.max(-3, Number(v)-1))}
                style={{ width:32, height:32, borderRadius:4, border:'1px solid rgba(201,168,76,.3)', background:'transparent', color:'#C9A84C', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, color:'#F0C96A', fontVariantNumeric:'tabular-nums' }}>
                  {Number(draftHijri) === 0 ? '0' : (Number(draftHijri) > 0 ? `+${draftHijri}` : draftHijri)}
                </div>
                <div style={{ fontSize:11, color:'#9A8B6E', letterSpacing:'.1em', textTransform:'uppercase', marginTop:2 }}>
                  {Number(draftHijri) === 0 ? 'No adjustment' : `${Math.abs(draftHijri)} day${Math.abs(Number(draftHijri))!==1?'s':''} ${Number(draftHijri)>0?'forward':'back'}`}
                </div>
              </div>
              <button onClick={() => setDraftHijri(v => Math.min(3, Number(v)+1))}
                style={{ width:32, height:32, borderRadius:4, border:'1px solid rgba(201,168,76,.3)', background:'transparent', color:'#C9A84C', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
            </div>
            <div style={{ marginTop:5, fontSize:11, color:'#9A8B6E', letterSpacing:'.05em' }}>
              Preview: {(() => {
                const d = new Date(cityNow); d.setDate(d.getDate() + Number(draftHijri));
                return toHijri(d);
              })()}
            </div>
          </div>

          <div className="sgrp">
            <label className="slbl">Asr Method</label>
            <select className="ssel" value={draftAsr} onChange={e => setDraftAsr(e.target.value)}>
              <option value="Standard">Standard — Shafi'i / Maliki / Hanbali</option>
              <option value="Hanafi">Hanafi — Double shadow</option>
            </select>
          </div>
          {/* Iqamah offsets */}
          <div className="sgrp">
            <label className="slbl">Iqamah Offset (minutes after Adhan)</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {[['fajr','Fajr'],['dhuhr','Dhuhr'],['asr','Asr'],['maghrib','Maghrib'],['isha','Isha']].map(([key,label]) => {
                const adhanTime  = todayTimes[key];
                const offsetMins = Math.min(60, Math.max(0, Number(draftIqamah[key]) || 0));
                const iqamahTime = adhanTime ? addMins(adhanTime, offsetMins) : null;
                return (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#111', border:'1px solid rgba(201,168,76,.15)', borderRadius:4, padding:'7px 12px' }}>
                    {/* Prayer name */}
                    <span style={{ width:62, fontSize:13, color:'#9A8B6E', letterSpacing:'.08em', textTransform:'uppercase', flexShrink:0 }}>{label}</span>
                    {/* Adhan time */}
                    <span style={{ width:72, fontSize:14, color:'#F5EDD8', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                      {adhanTime ? fmt12(adhanTime, cityTz) : '--:--'}
                    </span>
                    {/* Offset input */}
                    <span style={{ fontSize:11, color:'rgba(201,168,76,.4)', flexShrink:0 }}>+</span>
                    <input
                      type="number" min="0" max="60"
                      value={draftIqamah[key]}
                      onChange={e => setDraftIqamah(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ width:44, background:'#0A0A0A', border:'1px solid rgba(201,168,76,.3)', borderRadius:3, padding:'4px 6px', color:'#F0C96A', fontFamily:'Rajdhani,sans-serif', fontSize:15, fontWeight:700, textAlign:'center', outline:'none' }}
                    />
                    <span style={{ fontSize:11, color:'rgba(201,168,76,.4)', flexShrink:0 }}>min</span>
                    {/* Arrow + resulting iqamah time */}
                    <span style={{ fontSize:13, color:'rgba(201,168,76,.3)', flexShrink:0 }}>→</span>
                    <span style={{ flex:1, fontSize:15, fontWeight:700, color:'#C9A84C', fontVariantNumeric:'tabular-nums', textAlign:'right' }}>
                      {iqamahTime ? fmt12(iqamahTime, cityTz) : '--:--'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Jumu'ah congregations */}
          <div className="sgrp">
            <label className="slbl">Jumu'ah Congregations</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {draftJumuah.map((j, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, background:'#111', border:`1px solid ${j.enabled ? 'rgba(61,200,120,.3)' : 'rgba(201,168,76,.1)'}`, borderRadius:4, padding:'8px 10px' }}>
                  {/* Enable toggle */}
                  <button
                    onClick={() => setDraftJumuah(prev => prev.map((x,xi) => xi===i ? {...x, enabled:!x.enabled} : x))}
                    style={{ width:28, height:16, borderRadius:8, border:'none', cursor:'pointer', background: j.enabled ? '#3DC878' : '#333', position:'relative', flexShrink:0, transition:'background .2s' }}
                  >
                    <span style={{ position:'absolute', top:2, left: j.enabled ? 14 : 2, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
                  </button>
                  <span style={{ fontSize:12, color: j.enabled ? '#3DC878' : '#9A8B6E', letterSpacing:'.1em', textTransform:'uppercase', width:28 }}>
                    {i===0?'1st':i===1?'2nd':'3rd'}
                  </span>
                  {/* Time picker */}
                  <input
                    type="time"
                    value={j.time}
                    disabled={!j.enabled}
                    onChange={e => setDraftJumuah(prev => prev.map((x,xi) => xi===i ? {...x, time:e.target.value} : x))}
                    style={{ background:'#0A0A0A', border:'1px solid rgba(201,168,76,.25)', borderRadius:3, padding:'4px 8px', color: j.enabled ? '#F0C96A' : '#555', fontFamily:'Rajdhani,sans-serif', fontSize:15, fontWeight:700, outline:'none', flex:1, opacity: j.enabled ? 1 : .4, colorScheme:'dark' }}
                  />
                  {/* Iqamah offset */}
                  <span style={{ fontSize:11, color:'#9A8B6E', flexShrink:0 }}>Iqamah</span>
                  <input
                    type="number" min="0" max="60"
                    value={j.iqamah}
                    disabled={!j.enabled}
                    onChange={e => setDraftJumuah(prev => prev.map((x,xi) => xi===i ? {...x, iqamah:e.target.value} : x))}
                    style={{ width:44, background:'#0A0A0A', border:'1px solid rgba(201,168,76,.25)', borderRadius:3, padding:'4px 6px', color: j.enabled ? '#F0C96A' : '#555', fontFamily:'Rajdhani,sans-serif', fontSize:14, fontWeight:700, textAlign:'center', outline:'none', opacity: j.enabled ? 1 : .4 }}
                  />
                  <span style={{ fontSize:11, color:'#9A8B6E', flexShrink:0 }}>min</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eid prayers */}
          <div className="sgrp">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label className="slbl" style={{ margin:0 }}>Eid Prayer Congregations</label>
            </div>
            {/* Days before to show banner */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, background:'#111', border:'1px solid rgba(201,168,76,.12)', borderRadius:4, padding:'8px 12px' }}>
              <span style={{ flex:1, fontSize:13, color:'#9A8B6E', letterSpacing:'.06em' }}>Show banner this many days before Eid</span>
              <input type="number" min="0" max="30" value={draftEidDays}
                onChange={e => setDraftEidDays(e.target.value)}
                style={{ width:48, background:'#0A0A0A', border:'1px solid rgba(180,120,255,.25)', borderRadius:3, padding:'4px 6px', color:'#c49eff', fontFamily:'Rajdhani,sans-serif', fontSize:15, fontWeight:700, textAlign:'center', outline:'none' }}
              />
              <span style={{ fontSize:11, color:'#9A8B6E' }}>days</span>
            </div>
            {/* Eid name selector */}
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              {["Eid ul-Fitr","Eid ul-Adha"].map(name => (
                <button key={name}
                  onClick={() => setDraftEid(prev => prev.map(e => ({...e, label:name})))}
                  style={{ flex:1, padding:'6px 0', background: draftEid[0]?.label===name ? 'rgba(180,120,255,.2)' : '#111', border:`1px solid ${draftEid[0]?.label===name ? 'rgba(180,120,255,.5)' : 'rgba(201,168,76,.15)'}`, borderRadius:4, color: draftEid[0]?.label===name ? '#c49eff' : '#9A8B6E', fontFamily:'Rajdhani,sans-serif', fontSize:13, letterSpacing:'.06em', cursor:'pointer' }}
                >{name}</button>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {draftEid.map((e, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, background:'#111', border:`1px solid ${e.enabled ? 'rgba(180,120,255,.3)' : 'rgba(201,168,76,.1)'}`, borderRadius:4, padding:'8px 10px' }}>
                  {/* Toggle */}
                  <button
                    onClick={() => setDraftEid(prev => prev.map((x,xi) => xi===i ? {...x, enabled:!x.enabled} : x))}
                    style={{ width:28, height:16, borderRadius:8, border:'none', cursor:'pointer', background: e.enabled ? '#b47cff' : '#333', position:'relative', flexShrink:0, transition:'background .2s' }}
                  >
                    <span style={{ position:'absolute', top:2, left: e.enabled ? 14 : 2, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
                  </button>
                  <span style={{ fontSize:12, color: e.enabled ? '#c49eff' : '#9A8B6E', letterSpacing:'.1em', textTransform:'uppercase', width:28 }}>
                    {i===0?'1st':i===1?'2nd':'3rd'}
                  </span>
                  <input type="time" value={e.time} disabled={!e.enabled}
                    onChange={ev => setDraftEid(prev => prev.map((x,xi) => xi===i ? {...x, time:ev.target.value} : x))}
                    style={{ background:'#0A0A0A', border:'1px solid rgba(180,120,255,.25)', borderRadius:3, padding:'4px 8px', color: e.enabled ? '#c49eff' : '#555', fontFamily:'Rajdhani,sans-serif', fontSize:15, fontWeight:700, outline:'none', flex:1, opacity: e.enabled ? 1 : .4, colorScheme:'dark' }}
                  />
                  <span style={{ fontSize:11, color:'#9A8B6E', flexShrink:0 }}>Iqamah</span>
                  <input type="number" min="0" max="60" value={e.iqamah} disabled={!e.enabled}
                    onChange={ev => setDraftEid(prev => prev.map((x,xi) => xi===i ? {...x, iqamah:ev.target.value} : x))}
                    style={{ width:44, background:'#0A0A0A', border:'1px solid rgba(180,120,255,.25)', borderRadius:3, padding:'4px 6px', color: e.enabled ? '#c49eff' : '#555', fontFamily:'Rajdhani,sans-serif', fontSize:14, fontWeight:700, textAlign:'center', outline:'none', opacity: e.enabled ? 1 : .4 }}
                  />
                  <span style={{ fontSize:11, color:'#9A8B6E', flexShrink:0 }}>min</span>
                </div>
              ))}
            </div>
          </div>

          </div>{/* end sbox-body */}
        </div>
      </div>
  );
}
