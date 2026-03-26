/* ═══════════════════════════════════════════════
   ✦ Astral of the Sun PWA — app.js
   No Tailwind, pure vanilla JS
═══════════════════════════════════════════════ */
'use strict'

const API_BASE = window.location.origin
let currentUser = null
let _currentPhone = ''

/* ══════════════════════════════════
   HELPERS (defined first so everything below can use them)
══════════════════════════════════ */
const el    = id => document.getElementById(id)
const set   = (id,v) => { const e=el(id); if(e) e.textContent=v }
const later = (fn,ms) => setTimeout(fn,ms)
const sleep = ms => new Promise(r=>setTimeout(r,ms))
const cap   = s => s ? s[0].toUpperCase()+s.slice(1) : '—'
const fmt   = n => Number(n||0).toLocaleString()

function fmtGold(n) {
  n = Number(n||0)
  if (n>=1e6) return (n/1e6).toFixed(1)+'M'
  if (n>=1e3) return (n/1e3).toFixed(1)+'K'
  return n.toLocaleString()
}

function itemEmoji(id='') {
  id = String(id).toLowerCase()
  if (id.includes('sword')||id.includes('blade'))  return '⚔️'
  if (id.includes('shield')||id.includes('armor')) return '🛡️'
  if (id.includes('potion')||id.includes('hp'))    return '🧪'
  if (id.includes('bow')||id.includes('arrow'))    return '🏹'
  if (id.includes('staff')||id.includes('wand'))   return '🪄'
  if (id.includes('ring')||id.includes('amulet'))  return '💍'
  if (id.includes('gem')||id.includes('crystal'))  return '💎'
  if (id.includes('scroll'))                       return '📜'
  return '📦'
}

let toastT
function toast(msg) {
  const e = el('toast'); if(!e) return
  e.textContent = msg; e.classList.add('show')
  clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 3200)
}

function authError(msg) {
  // Show error under active step
  document.querySelectorAll('.auth-error').forEach(e => { e.style.display='none'; e.textContent='' })
  const activeStep = document.querySelector('.auth-step.active') || document.querySelector('.auth-step[style*="block"]')
  if (activeStep) {
    const errEl = activeStep.querySelector('.auth-error')
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block' }
  }
  toast(msg)
}

function setBtnLoading(id, loading, labelWhenDone) {
  const btn = el(id); if (!btn) return
  btn.disabled = loading
  if (loading) {
    btn.dataset.origText = btn.innerHTML
    btn.textContent = '...'
  } else {
    btn.innerHTML = btn.dataset.origText || labelWhenDone || 'Submit'
  }
}

/* ══════════════════════════════════
   LOADING SCREEN
══════════════════════════════════ */
const HINTS = [
  'Awakening your power...',
  'Entering the Astral Realm...',
  'Summoning your stats...',
  'Consulting the Oracle...',
  'Sharpening your blade...',
  'Reading the stars...',
]

function startLoading() {
  const bar  = el('ls-bar')
  const hint = el('ls-hint')
  if (!bar) return () => {}
  let pct = 0, hi = 0
  const iv = setInterval(() => {
    pct = Math.min(pct + Math.random() * 20 + 4, 94)
    bar.style.width = pct + '%'
    const step = Math.floor(pct / 20)
    if (step > hi && hi < HINTS.length - 1) { hi = step; if(hint) hint.textContent = HINTS[hi] }
  }, 280)
  return () => {
    clearInterval(iv)
    bar.style.width = '100%'
    setTimeout(() => el('loading-screen')?.classList.add('gone'), 450)
  }
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  const done = startLoading()
  try {
    const saved = localStorage.getItem('astral_session')
    if (saved) {
      try {
        const session = JSON.parse(saved)
        await loginWithSession(session)
      } catch {
        localStorage.removeItem('astral_session')
        showAuthPanel()
      }
    } else {
      showAuthPanel()
    }
  } catch(err) {
    console.error('[init]', err)
    showAuthPanel()
  }
  await sleep(1100)
  done()
})

/* ══════════════════════════════════
   AUTH
══════════════════════════════════ */
function showAuthPanel() {
  const s = (id, v) => { const e = document.getElementById(id); if(e) e.style.display = v }
  const rc = (id, cls) => document.getElementById(id)?.classList.remove(cls)
  s('login-wrap', 'flex')
  s('app',        'none')
  s('topbar',     'none')
  s('bottom-nav', 'none')
  s('desktop-nav','none')
  rc('sidebar',   'open')
  rc('sb-overlay','on')
  clearAuthError()
  showLogin()
}

function hideAuth() {
  const s = (id, v) => { const e = document.getElementById(id); if(e) e.style.display = v }
  s('login-wrap', 'none')
  s('app',        'block')
  s('topbar',     '')
  s('bottom-nav', '')
  s('desktop-nav','')
}

function setAuthError(msg) {
  document.querySelectorAll('.auth-error').forEach(e => {
    e.textContent = msg; e.style.display = msg ? 'block' : 'none'
  })
}
function clearAuthError() {
  document.querySelectorAll('.auth-error').forEach(e => {
    e.textContent = ''; e.style.display = 'none'
  })
}
function setAuthLoading(btn, loading) {
  btn.disabled = loading
  btn.dataset.orig = btn.dataset.orig || btn.innerHTML
  btn.innerHTML = loading ? '<span class="btn-spinner"></span> Please wait...' : btn.dataset.orig
}

async function submitLogin() {
  const btn  = document.getElementById('btn-login')
  const user = document.getElementById('username-field').value.trim()
  const pass = document.getElementById('password-field').value.trim()
  if (!user) { setAuthError('Enter your username'); return }
  if (!pass) { setAuthError('Enter your password'); return }

  setAuthLoading(btn, true); clearAuthError()
  try {
    const data = await post('/api/auth/login', { username: user, password: pass })
    localStorage.setItem('astral_session', JSON.stringify({ username: user, password: pass }))
    toast('Welcome, ' + (data.player?.name || user) + '! ⚔️')
    currentUser = data.player
    render(data.player)
    hideAuth()
  } catch(e) {
    setAuthError(e.message)
  } finally {
    setAuthLoading(btn, false)
  }
}

async function loginWithSession(session) {
  const data = await post('/api/auth/login', session)
  currentUser = data.player
  render(data.player)
  hideAuth()
}

function showLogin() {
  document.querySelectorAll('.auth-step').forEach(s => s.style.display = 'none')
  const s = document.getElementById('step-login')
  if (s) s.style.display = 'flex'
  clearAuthError()
}

function showForgot() {
  document.querySelectorAll('.auth-step').forEach(s => s.style.display = 'none')
  const s = document.getElementById('step-forgot')
  if (s) s.style.display = 'flex'
  clearAuthError()
}

async function submitReset() {
  const btn  = document.getElementById('btn-reset')
  const user = document.getElementById('reset-username').value.trim()
  const code = document.getElementById('reset-code').value.trim()
  const pass = document.getElementById('reset-newpass').value.trim()
  const conf = document.getElementById('reset-confirm').value.trim()
  if (!user)         { setAuthError('Enter your username'); return }
  if (!code)         { setAuthError('Enter the code from WhatsApp'); return }
  if (pass.length < 6) { setAuthError('Password must be at least 6 characters'); return }
  if (pass !== conf) { setAuthError('Passwords do not match'); return }

  setAuthLoading(btn, true); clearAuthError()
  try {
    await post('/api/auth/reset-password', { username: user, code, newPassword: pass })
    toast('Password reset! Log in with your new password.')
    showLogin()
    document.getElementById('username-field').value = user
  } catch(e) {
    setAuthError(e.message)
  } finally {
    setAuthLoading(btn, false)
  }
}

function handleLogout() {
  localStorage.removeItem('astral_session')
  currentUser = null
  showAuthPanel()
  closeSidebar()
  navigate('home')
  toast('Logged out')
}

/* ══════════════════════════════════
   FETCH
══════════════════════════════════ */
async function api(path) {
  const r = await fetch(API_BASE + path)
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || `HTTP ${r.status}`) }
  return r.json()
}

async function post(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || `HTTP ${r.status}`) }
  return r.json()
}

async function loadUserById(id) {
  const d = await api(`/api/player/${id}`)
  if (!d?.name) throw new Error('Player not found')
  currentUser = d
  render(d)
  hideLogin()
}

async function refreshData() {
  if (!currentUser) { toast('Log in first'); return }
  toast('Refreshing...')
  try {
    const savedId = localStorage.getItem('astral_uid') || currentUser.id
    await loadUserById(savedId)
    toast('Updated ✓')
  } catch { toast('Could not refresh. Try again.') }
}

/* ══════════════════════════════════
   RENDER
══════════════════════════════════ */
function render(p) {
  /* Images — load saved or default */
  const avatarEl = el('avatar-img')
  const coverEl  = el('cover-img')
  if (avatarEl) avatarEl.src = p.webPfp    || 'images/default-pfp.png'
  if (coverEl)  coverEl.src  = p.webBanner || 'images/default-banner.png'

  set('hero-name',       p.name || '—')
  set('hero-sub',        `${cap(p.class||'Warrior')} · Lv ${p.level||1}`)
  set('hero-title-text', p.equippedTitle || '')
  set('hero-number',     p.id ? `+${p.id}` : '')
  set('hsr-level',       p.level || 1)

  set('pg-solars', fmtGold(p.gold))
  set('pg-vault',  fmtGold(p.bankGold))
  set('pg-xp',     fmtGold(p.exp||0))

  set('cs-str', p.str||0); set('cs-agi', p.agi||0); set('cs-int', p.int||0)
  set('cs-def', p.def||0); set('cs-lck', p.lck||0)
  set('cs-hp',  `${p.hp||0}/${p.maxHp||100}`)

  const hpPct = Math.min(100,Math.round(((p.hp||0)/(p.maxHp||100))*100))
  const mpPct = Math.min(100,Math.round(((p.mp||0)/(p.maxMp||50))*100))
  set('hp-num', `${p.hp||0}/${p.maxHp||100}`)
  set('mp-num', `${p.mp||0}/${p.maxMp||50}`)
  later(() => {
    el('hp-fill') && (el('hp-fill').style.width = hpPct+'%')
    el('mp-fill') && (el('mp-fill').style.width = mpPct+'%')
  }, 500)

  set('p-class',    cap(p.class||'—'))
  set('p-race',     cap(p.race||'—'))
  const stripEmoji = s => String(s||'').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F300}-\u{1F9FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FFFF}]/gu,'').replace(/[^\x20-\x7E\u00C0-\u024F]/g,'').trim()
  set('p-rank',   stripEmoji(p.rank)||'—')
  set('p-region', stripEmoji(p.location)||'—')
  set('p-kills',    fmt(p.kills||0))
  set('p-floor',    p.dungeonFloor||1)
  set('p-prestige', p.prestige?(p.isKami?'Ascendant':'Reborn '+p.prestige):'None')
  set('p-affinity', p.affinity||p.combatStyle||'—')
  const rawGuild = p.guild||'None'
  set('p-guild', '...')
  if (rawGuild && rawGuild !== 'None') {
    // Fetch real guild name from factions API
    api('/api/factions').then(guilds => {
      const found = (guilds||[]).find(g => g.id === rawGuild || g.name === rawGuild)
      if (found?.name) {
        set('p-guild', found.name)
      } else {
        // fallback: strip guild_ and pure numeric suffix
        const stripped = rawGuild.replace(/^guild_/i,'').replace(/^\d+$/, '').replace(/_/g,' ').trim()
        set('p-guild', stripped || rawGuild)
      }
    }).catch(() => set('p-guild', '—'))
  } else {
    set('p-guild', 'None')
  }
  set('p-title',    p.equippedTitle||'None')
  window._playerData = p

  const eq = p.equipped||{}
  const svgW = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>`
  const svgA = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
  const svgC = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
  const svgR = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  function equipSVG(id) {
    id = String(id||'').toLowerCase()
    // weapon types
    if(id.includes('sword')||id.includes('blade')||id.includes('dagger')||id.includes('katana')||id.includes('claymore')||id.includes('scythe')||id.includes('axe')||id.includes('spear')||id.includes('lance'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>`
    if(id.includes('bow')||id.includes('arrow')||id.includes('quiver'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 1 0 6"/><line x1="5" y1="12" x2="15" y2="12"/><polyline points="12 9 15 12 12 15"/><line x1="2" y1="12" x2="5" y2="12"/></svg>`
    if(id.includes('staff')||id.includes('wand')||id.includes('rod')||id.includes('tome')||id.includes('grimoire'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="21" x2="12" y2="3"/><path d="M12 3c0 0-4-1-4 3s4 3 4 3 4-1 4-3-4-3-4-3z"/><circle cx="12" cy="3" r="1.5" fill="currentColor" opacity="0.5"/></svg>`
    if(id.includes('fist')||id.includes('claw')||id.includes('knuckle')||id.includes('gauntlet'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`
    // armor/plate/robe/cloak
    if(id.includes('armor')||id.includes('plate')||id.includes('mail')||id.includes('robe')||id.includes('cloak')||id.includes('mantle')||id.includes('coat')||id.includes('vest')||id.includes('tunic'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
    if(id.includes('shield'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
    if(id.includes('helm')||id.includes('hood')||id.includes('hat')||id.includes('crown')||id.includes('mask'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1z"/></svg>`
    // accessory/ring/amulet
    if(id.includes('ring')||id.includes('band'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>`
    if(id.includes('amulet')||id.includes('necklace')||id.includes('pendant')||id.includes('charm'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6"/></svg>`
    if(id.includes('boot')||id.includes('shoe')||id.includes('greave')||id.includes('sandal'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L7 4h10l4 8v4H3v-4z"/><line x1="3" y1="16" x2="21" y2="16"/></svg>`
    if(id.includes('gem')||id.includes('crystal')||id.includes('orb')||id.includes('shard'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 19 8 16 20 8 20 5 8 12 2"/></svg>`
    if(id.includes('astral'))
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    // generic fallback by slot
    return null
  }
  function applyEquip(id, val, fallbackSvg) {
    const box = el(id); if(!box) return
    if(val) {
      box.classList.add('active')
      const svg = equipSVG(val) || fallbackSvg.replace(/stroke="currentColor"/g, 'stroke="#0e0e0e"')
      box.innerHTML = svg.replace(/stroke="currentColor"/g, 'stroke="#0e0e0e"')
    } else {
      box.classList.remove('active')
      box.innerHTML = fallbackSvg
    }
  }
  applyEquip('eq-weapon',    eq.weapon,    svgW)
  applyEquip('eq-armor',     eq.armor,     svgA)
  applyEquip('eq-accessory', eq.accessory, svgC)
  applyEquip('eq-relic',     eq.relic,     svgR)

  const ig = el('inv-grid')
  if (ig) {
    const items = p.inventory||[]
    ig.innerHTML = items.length
      ? items.map(i=>`<div class="item-box"><div class="item-box-ico">${itemEmoji(i.id||i.name)}</div><div class="item-box-name">${i.name||i.id}</div>${(i.qty>1)?`<div class="item-box-qty">x${i.qty}</div>`:''}</div>`).join('')
      : `<div class="empty-state">Inventory empty</div>`
  }

  const sl = el('skills-list')
  if (sl) {
    const skills = p.skills||[]
    function skillSVG(id) {
      id = String(id||'').toLowerCase()
      // FIRE / heat
      if(id.includes('fire')||id.includes('flame')||id.includes('fireball')||id.includes('burn')||id.includes('blaze')||id.includes('inferno')||id.includes('scorch')||id.includes('ignite')||id.includes('ember')||id.includes('pyro'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`
      // ICE / frost / cold
      if(id.includes('ice')||id.includes('frost')||id.includes('freeze')||id.includes('frozen')||id.includes('cold')||id.includes('blizzard')||id.includes('cryo')||id.includes('chill')||id.includes('snow')||id.includes('glacial'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5l-5 5-5-5"/><path d="M17 19l-5-5-5 5"/><path d="M2 12l10 0"/><path d="M22 12l-10 0"/><path d="M5 7l2 5-2 5"/><path d="M19 7l-2 5 2 5"/></svg>`
      // SHIELD / barrier / protect / mana
      if(id.includes('shield')||id.includes('barrier')||id.includes('protect')||id.includes('ward')||id.includes('guard')||id.includes('mana')||id.includes('block')||id.includes('wall')||id.includes('bulwark')||id.includes('aegis'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
      // LIGHTNING / bolt / thunder / speed / dash
      if(id.includes('bolt')||id.includes('thunder')||id.includes('lightning')||id.includes('dash')||id.includes('speed')||id.includes('static')||id.includes('shock')||id.includes('arc')||id.includes('zap')||id.includes('electro'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
      // VOID / dark / shadow / null / abyss
      if(id.includes('void')||id.includes('dark')||id.includes('shadow')||id.includes('null')||id.includes('abyss')||id.includes('eclipse')||id.includes('black')||id.includes('curse')||id.includes('corrupt')||id.includes('doom'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
      // SLASH / strike / cut / blade / attack
      if(id.includes('slash')||id.includes('strike')||id.includes('cut')||id.includes('edge')||id.includes('blade')||id.includes('cleave')||id.includes('rend')||id.includes('slice')||id.includes('smash')||id.includes('crush')||id.includes('stab'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>`
      // HEAL / restore / regen / cure / life
      if(id.includes('heal')||id.includes('regen')||id.includes('restore')||id.includes('cure')||id.includes('life')||id.includes('revive')||id.includes('mend')||id.includes('recover')||id.includes('holy')||id.includes('divine')||id.includes('sacred'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
      // STEALTH / cloak / invisible / hide / phantom
      if(id.includes('cloak')||id.includes('invisible')||id.includes('stealth')||id.includes('hide')||id.includes('phantom')||id.includes('ghost')||id.includes('vanish')||id.includes('mist')||id.includes('smoke'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      // WIND / storm / gale / air / tornado
      if(id.includes('wind')||id.includes('gale')||id.includes('storm')||id.includes('tornado')||id.includes('cyclone')||id.includes('breeze')||id.includes('air')||id.includes('whirl'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`
      // EARTH / rock / stone / quake / terra
      if(id.includes('earth')||id.includes('rock')||id.includes('stone')||id.includes('quake')||id.includes('terra')||id.includes('ground')||id.includes('tremor')||id.includes('boulder'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 20 2 20 12 2"/></svg>`
      // POISON / toxic / venom / plague
      if(id.includes('poison')||id.includes('toxic')||id.includes('venom')||id.includes('plague')||id.includes('acid')||id.includes('blight')||id.includes('rot'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v4L6 14a4 4 0 0 0 12 0l-4-7V3"/><line x1="6" y1="11" x2="18" y2="11"/></svg>`
      // ASTRAL / cosmic / star / nova / pulse / realm
      if(id.includes('astral')||id.includes('cosmic')||id.includes('nova')||id.includes('pulse')||id.includes('burst')||id.includes('realm')||id.includes('celestial')||id.includes('solar'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`
      // DEFAULT — star fallback
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
    }
    sl.innerHTML = skills.length
      ? skills.map((s,i)=>{
          const ico = i===0 ? 'white' : 'dark'
          const svg = skillSVG(s.id||s.name||s)
          const name = String(s.name||s.id||s).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
          const mp = s.mpCost ? `<span class="sk-mp">${s.mpCost} MP</span>` : ''
          return `<div class="skill-item"><div class="sk-ico ${ico}">${svg}</div><div class="sk-info"><div class="sk-name">${name}</div><div class="sk-desc">${s.desc||s.description||''}</div></div>${mp}</div>`
        }).join('')
      : `<div class="empty-state">No skills yet</div>`
  }

  // Update premium tier buttons based on status
  // Mark current premium plan on plans page
  const planKey = p.premium?.plan || ''
  const isActive = p.premium?.active === true
  const till = p.premium?.expiresAt ? new Date(p.premium.expiresAt).toLocaleDateString('en-GB') : ''
  const tillTxt = till ? ` · ${till}` : ''

  // Map plan key to button onclick text match
  const planMap = {
    weekly:    '!premium buy weekly',
    monthly:   '!premium buy monthly',
    bimonthly: '!premium buy bimonthly',
    quarterly: '!premium buy quarterly',
    yearly:    '!premium buy yearly',
    gems:      '!premium buy Astra',
    legacy:    '', grandfathered: ''
  }

  if (isActive) {
    // Find the correct tier button by its data-cmd and mark it
    document.querySelectorAll('.tier-btn').forEach(btn => {
      const cmd = btn.dataset.cmd || btn.getAttribute('onclick') || ''
      const matchCmd = planMap[planKey] || ''
      if (matchCmd && cmd.includes(matchCmd)) {
        btn.textContent = 'CURRENT PLAN' + tillTxt
        btn.classList.add('solid')
        btn.classList.remove('outline')
      }
    })
    // Hide "CURRENT PLAN" on free tier since they have active plan
    const freeBtn = el('prem-status')
    if (freeBtn) { freeBtn.textContent = 'UPGRADE'; freeBtn.classList.remove('solid') }
  } else {
    // On free — show CURRENT PLAN on free card
    const freeBtn = el('prem-status')
    if (freeBtn) { freeBtn.textContent = 'CURRENT PLAN' }
  }
}

/* ══════════════════════════════════
   LEADERBOARD
══════════════════════════════════ */
async function loadLB() {
  try {
    const d = await api('/api/leaderboard')
    lbList('lb-lv-list', d.byLevel,  p=>`Lv ${p.level}`)
    lbList('lb-ki-list', d.byKills,  p=>`${fmt(p.kills)} kills`)
    lbList('lb-go-list', d.byGold,   p=>fmtGold((p.gold||0)+(p.bankGold||0)))
  } catch {}
}
function lbList(id, players, valFn) {
  const e = el(id); if(!e) return
  const rankSVG = [
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M12 2v12M8 6l4-4 4 4"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8 22h8M12 14v8"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>`
  ]
  const avaSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/></svg>`
  e.innerHTML = (players||[]).slice(0,20).map((p,i)=>`
    <div class="lb-item ${i===0?'r1':i===1?'r2':i===2?'r3':''}">
      <div class="lb-rank" style="display:flex;align-items:center;justify-content:center;min-width:28px">${i<3?rankSVG[i]:`<span style="font-family:var(--headline);font-size:13px;font-weight:800;color:var(--t3)">${i+1}</span>`}</div>
      <div class="lb-ava" style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3)">${avaSVG}</div>
      <div class="lb-info">
        <div class="lb-name">${p.name}</div>
        <div class="lb-sub">${cap(p.class||'')} · ${(p.rank||'').replace(/[^\x20-\x7E]/g,'').trim()}</div>
      </div>
      <div class="lb-val">${valFn(p)}</div>
    </div>`).join('') || `<div class="empty-state">No data yet</div>`
}

/* ══════════════════════════════════
   SHOP / GUILDS
══════════════════════════════════ */
let _shopItems = []
let _currentCat = 'weapon'

function weaponTypeSVG(wt, id) {
  id = String(id||'').toLowerCase()
  wt = String(wt||'').toLowerCase()
  const s = wt || id
  if(s.includes('sword')||s.includes('blade')||s.includes('saber')||s.includes('sabre')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>`
  if(s.includes('greatsword')||s.includes('claymore')||s.includes('longsword')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M8 7l4-5 4 5"/><line x1="7" y1="13" x2="17" y2="13"/></svg>`
  if(s.includes('katana')||s.includes('wakizashi')||s.includes('nodachi')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21L21 3"/><path d="M15 3h6v6"/><path d="M3 18l3 3"/></svg>`
  if(s.includes('dagger')||s.includes('knife')||s.includes('dirk')||s.includes('stiletto')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2 8H10l2-8z"/><line x1="12" y1="10" x2="12" y2="20"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`
  if(s.includes('axe')||s.includes('hatchet')||s.includes('cleaver')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2C11 2 8 5 8 8c0 1 .3 2 .8 2.8L3 17l1.5 1.5 5.7-5.7c.8.5 1.8.8 2.8.8 3 0 6-3 6-6s-3-4-5-4z"/></svg>`
  if(s.includes('hammer')||s.includes('mace')||s.includes('maul')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="8" rx="1"/><line x1="12" y1="10" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/></svg>`
  if(s.includes('spear')||s.includes('lance')||s.includes('pike')||s.includes('trident')||s.includes('halberd')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 5h-6l3-5z"/><line x1="12" y1="7" x2="12" y2="22"/></svg>`
  if(s.includes('bow')||s.includes('crossbow')||s.includes('arrow')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5c4 0 8 4 8 8"/><path d="M5 5l3 3M5 5l3-1"/><line x1="13" y1="13" x2="20" y2="20"/><path d="M17 20l3 0 0-3"/></svg>`
  if(s.includes('scythe')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20C4 12 12 4 20 4c-4 0-8 4-8 8"/><line x1="4" y1="20" x2="12" y2="12"/></svg>`
  if(s.includes('staff')||s.includes('rod')||s.includes('wand')||s.includes('scepter')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="22" x2="12" y2="6"/><circle cx="12" cy="4" r="2"/><path d="M9 7l-3-3M15 7l3-3"/></svg>`
  if(s.includes('grimoire')||s.includes('tome')||s.includes('book')||s.includes('codex')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`
  if(s.includes('rapier')||s.includes('estoc')||s.includes('foil')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/><path d="M17 4h3v3"/><circle cx="6.5" cy="17.5" r="1.5"/></svg>`
  if(s.includes('whip')||s.includes('chain')||s.includes('flail')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5c2 2 2 6 0 8s-2 6 2 8"/><path d="M5 5l2-3"/></svg>`
  if(s.includes('claw')||s.includes('fang')||s.includes('talon')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c1-4 4-6 6-4s2 6 4 4 2-8 6-8"/></svg>`
  if(s.includes('gauntlet')||s.includes('fist')||s.includes('knuckle')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10V6a2 2 0 0 0-4 0v8M6 16a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-5"/></svg>`
  if(s.includes('divine')||s.includes('holy')||s.includes('sacred')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`
  // generic weapon fallback
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>`
}

function categorySVG(cat, id, wt) {
  id = String(id||'').toLowerCase()
  if(cat==='weapon') return weaponTypeSVG(wt, id)
  if(cat==='armor') {
    if(id.includes('shield')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
    if(id.includes('robe')||id.includes('cloth')||id.includes('mage')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><path d="M12 3c1.5 0 3 .8 3 2s-1.5 2-3 2-3-.8-3-2 1.5-2 3-2z"/><line x1="8" y1="10" x2="6" y2="21"/><line x1="16" y1="10" x2="18" y2="21"/></svg>`
    if(id.includes('helm')||id.includes('hood')||id.includes('crown')||id.includes('hat')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1z"/></svg>`
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
  }
  if(cat==='accessory') {
    if(id.includes('ring')||id.includes('band')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>`
    if(id.includes('amulet')||id.includes('necklace')||id.includes('pendant')||id.includes('charm')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v6M8 4l4-2 4 2"/></svg>`
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>`
  }
  if(cat==='consumable') {
    if(id.includes('potion')||id.includes('elixir')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v4L6 14a4 4 0 0 0 12 0l-4-7V3"/><line x1="6" y1="11" x2="18" y2="11"/></svg>`
    if(id.includes('scroll')||id.includes('tome')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
    if(id.includes('food')||id.includes('bread')||id.includes('meat')) return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v4L6 14a4 4 0 0 0 12 0l-4-7V3"/><line x1="6" y1="11" x2="18" y2="11"/></svg>`
  }
  if(cat==='material') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 19 8 16 20 8 20 5 8 12 2"/></svg>`
  if(cat==='wardrobe') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H5v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h1.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>`
  if(cat==='egg') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 4 8 4 13a8 8 0 0 0 16 0c0-5-4-11-8-11z"/></svg>`
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`
}

function rarityBadge(r) {
  const map = {legendary:'LEGENDARY',epic:'EPIC',rare:'RARE',uncommon:'UNCOMMON',common:'COMMON'}
  return map[(r||'').toLowerCase()] || (r||'').toUpperCase() || 'COMMON'
}

function renderCatalog(cat) {
  _currentCat = cat
  const items = (typeof SHOP_CATALOG !== 'undefined' ? SHOP_CATALOG[cat] : null) || []
  const e = el('shop-grid'); if(!e) return
  if(!items.length){ e.innerHTML=`<div class="empty-state">No items</div>`; return }
  const solarSVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`
  const gemSVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 19 8 16 20 8 20 5 8 12 2"/></svg>`
  e.innerHTML = items.map(i => {
    const name = i.name
    const isAstral = cat === 'astral'
    const priceLabel = isAstral
      ? (i.gemCost ? `${fmtGold(i.gemCost)} Astra` : `${fmtGold(i.goldCost)} S`)
      : `${fmtGold(i.price)} S`
    const priceIcon = isAstral && i.gemCost ? gemSVG : solarSVG
    const rarity = rarityBadge(i.rarity)
    const typeLabel = isAstral ? (i.type||'astral').toUpperCase() : (i.weaponType ? i.weaponType.replace(/_/g,' ').toUpperCase() : cat.toUpperCase())
    const svgCat = isAstral ? (i.type||'astral') : cat
    const svg = categorySVG(svgCat, i.id, i.weaponType||'')
    const buyCmd = isAstral
      ? '!astralbuy ' + name + (i.gemCost ? ' gems' : ' gold')
      : '!buy ' + name
    const cleanCmd = buyCmd.replace(/'/g, '’')
    return `<div class="vi-row">
      <div class="vi-row-ico ${isAstral?'vi-row-ico-astral':''}">${svg}</div>
      <div class="vi-row-info">
        <div class="vi-row-meta">${typeLabel} · ${rarity}</div>
        <div class="vi-row-name">${name}</div>
        ${i.desc?`<div class="vi-row-stats">${i.desc.slice(0,50)}</div>`:''}
        <div class="vi-row-price">${priceIcon} ${priceLabel}</div>
      </div>
      <button class="vi-row-btn" data-cmd="${cleanCmd.replace(/"/g,'&quot;')}" onclick="copyBuyCmd(this.dataset.cmd)">BUY</button>
    </div>`
  }).join('')
}

function filterVault(btn, cat) {
  document.querySelectorAll('.vf-tab').forEach(t=>t.classList.remove('active'))
  btn.classList.add('active')
  renderCatalog(cat)
}

async function loadShop() {
  renderCatalog('weapon')
}


function fmtPower(n) {
  n = Number(n)||0
  if(n>=1000000) return (n/1000000).toFixed(1)+'M'
  if(n>=1000) return (n/1000).toFixed(1)+'K'
  return String(n)
}
function guildRankIcon(i) {
  const svgs = [
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`
  ]
  return svgs[i] || svgs[2]
}
async function loadFactions() {
  try {
    const d = await api('/api/factions')
    const e = el('factions-list'); if(!e) return
    const guilds = (d||[]).sort((a,b)=>(b.power||b.totalPower||0)-(a.power||a.totalPower||0))
    if(!guilds.length){ e.innerHTML=`<div class="empty-state">No guilds yet</div>`; return }
    const maxPower = guilds[0] ? (guilds[0].power||guilds[0].totalPower||1) : 1
    e.innerHTML = guilds.slice(0,10).map((g,i)=>{
      const memCount = (g.members||[]).length || g.memberCount || 0
      const rank = g.rank||'S'
      const power = fmtPower(g.power||g.totalPower||0)
      const ico = guildRankIcon(i)
      const num = String(i+1).padStart(2,'0')
      const pct = Math.round(((g.power||g.totalPower||0) / maxPower) * 100)
      return `<div class="glb-item ${i<3?'glb-top':''}">
        <div class="glb-item-inner">
          <span class="glb-num">${num}</span>
          <div class="glb-ico ${i===0?'glb-ico-active':''}">${ico}</div>
          <div class="glb-info">
            <div class="glb-name">${g.name||'Unknown'}</div>
            <div class="glb-sub">RANK ${rank} &bull; ${memCount} MEMBERS</div>
          </div>
          <div class="glb-right">
            <div class="glb-power">${power}</div>
            <div class="glb-pwr-label">PWR</div>
          </div>
        </div>
        <div class="glb-power-bar-wrap"><div class="glb-power-bar" style="width:0%" data-pct="${pct}"></div></div>
      </div>`
    }).join('')
    // Animate power bars in
    setTimeout(() => {
      e.querySelectorAll('.glb-power-bar').forEach(bar => {
        bar.style.width = (bar.dataset.pct || 0) + '%'
      })
    }, 120)

    // populate user guild hero if player data is available
    // Populate guild hero card
    const pg = window._playerData || {}
    const rawId = pg.guild || ''
    // match by id, or by name, or fallback to first guild
    const userGuild = guilds.find(g => g.id === rawId || g.name === rawId) || guilds[0]
    if (userGuild) {
      const cleanName = userGuild.name
        ? userGuild.name
        : rawId.replace(/^guild_/i,'').replace(/_/g,' ').replace(/\w/g,ch=>ch.toUpperCase())
      const n=el('gh-name'), r=el('gh-rank'), lv=el('gh-level-tag'), mem=el('gs-members'), glv=el('gs-level'), pwr=el('gs-power')
      if(n) n.textContent = cleanName
      if(r) r.textContent = 'RANK '+(userGuild.rank||pg.rank||'—')
      if(lv) lv.textContent = 'LVL '+(pg.level||'—')
      if(mem) mem.textContent = `${(userGuild.members||[]).length || userGuild.memberCount || 0}/50`
      if(glv) glv.textContent = userGuild.level || '—'
      if(pwr) pwr.textContent = fmtPower(userGuild.power||userGuild.totalPower||0)
    } else if (rawId) {
      // guild exists in player data but not in factions list yet
      const cleanName = rawId.replace(/^guild_/i,'').replace(/_/g,' ').replace(/\w/g,ch=>ch.toUpperCase())
      const n=el('gh-name'), r=el('gh-rank'), lv=el('gh-level-tag')
      if(n) n.textContent = cleanName || '—'
      if(r) r.textContent = 'RANK '+(pg.rank||'—')
      if(lv) lv.textContent = 'LVL '+(pg.level||'—')
    }
  } catch {}
}

/* ══════════════════════════════════
   NAVIGATION
══════════════════════════════════ */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.bn').forEach(b=>b.classList.remove('active'))
  document.querySelectorAll('.sb-link').forEach(l=>l.classList.remove('active'))
  const pg = el('page-'+page); if (pg) pg.classList.add('active')
  document.querySelector(`.bn[data-page="${page}"]`)?.classList.add('active')
  document.querySelector(`.sb-link[data-page="${page}"]`)?.classList.add('active')
  closeSidebar()
  if (page==='leaderboard') loadLB()
  if (page==='shop')        loadShop()
  if (page==='factions')    loadFactions()
  if (page==='premium')     {}
  if (page==='terms')       {}
  if (page==='topup')       {} // static page
}

function switchPTab(btn, targetId) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.ptab-pane').forEach(p => p.classList.remove('active'))
  btn.classList.add('active')
  el(targetId)?.classList.add('active')
}

function switchTab(btn, targetId) {
  const row  = btn.closest('.tabs')
  const body = btn.closest('.page-body') || btn.closest('.page')
  row?.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'))
  body?.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'))
  btn.classList.add('active')
  el(targetId)?.classList.add('active')
}

/* ══════════════════════════════════
   SIDEBAR
══════════════════════════════════ */
function openSidebar()  { el('sidebar')?.classList.add('open');    el('sb-overlay')?.classList.add('on') }
function closeSidebar() { el('sidebar')?.classList.remove('open'); el('sb-overlay')?.classList.remove('on') }

/* ══════════════════════════════════
   GLOBALS for inline onclick
══════════════════════════════════ */
Object.assign(window, {
  navigate, switchTab, switchPTab, openSidebar, closeSidebar,
  submitLogin, submitReset, showForgot, showLogin,
  handleLogout, refreshData, handleImageUpload,
})

/* ══════════════════════════════════
   IMAGE UPLOAD (PFP / BANNER)
══════════════════════════════════ */
async function handleImageUpload(input, type) {
  const file = input.files[0]
  if (!file) return
  if (file.size > 3 * 1024 * 1024) { toast('Image too large (max 3MB)'); return }

  const reader = new FileReader()
  reader.onload = async (e) => {
    const b64 = e.target.result
    if (type === 'pfp') {
      document.getElementById('avatar-img').src = b64
    } else {
      document.getElementById('cover-img').src = b64
    }

    const session = JSON.parse(localStorage.getItem('astral_session') || '{}')
    if (!session.username) { toast('Log in first'); return }

    try {
      await post('/api/profile/image', { username: session.username, password: session.password, type, image: b64 })
      toast(type === 'pfp' ? 'Avatar updated ✓' : 'Banner updated ✓')
    } catch (e) {
      toast('Failed to save image')
    }
    input.value = ''
  }
  reader.readAsDataURL(file)
}



/* ══════════════════════════════════
   BILLING TOGGLE
══════════════════════════════════ */
const BOT_WA_NUMBER = '2348090685240'
function openWA(cmd) {
  window.open('https://wa.me/' + BOT_WA_NUMBER + '?text=' + encodeURIComponent(cmd), '_blank')
}
function copyBuyCmd(cmd) { openWA(cmd) }

function switchPremTab(btn, paneId) {
  document.querySelectorAll('.prem-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.prem-tab-pane').forEach(p => p.classList.remove('active'))
  btn.classList.add('active')
  const pane = document.getElementById(paneId)
  if(pane) pane.classList.add('active')
}
function switchTopupTab(btn, paneId) {
  btn.closest('.prem-tabs').querySelectorAll('.prem-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.topup-tab-pane').forEach(p => p.classList.remove('active'))
  btn.classList.add('active')
  const pane = document.getElementById(paneId)
  if(pane) pane.classList.add('active')
}
function switchTermsTab(btn, paneId) {
  document.querySelectorAll('.terms-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.terms-pane').forEach(p => p.classList.remove('active'))
  btn.classList.add('active')
  const pane = document.getElementById(paneId)
  if(pane) pane.classList.add('active')
}
function setBilling(type) {
  const togW = el('tog-weekly'), togM = el('tog-monthly')
  const sp = el('silver-price'), sper = el('silver-period')
  const ip = el('immortal-price')
  if (!togW) return
  if (type === 'weekly') {
    togW.classList.add('active'); togM.classList.remove('active')
    if (sp) sp.textContent = '$6.99'; if (sper) sper.textContent = '/week'
    if (ip) ip.textContent = '$24.99'
  } else {
    togM.classList.add('active'); togW.classList.remove('active')
    if (sp) sp.textContent = '$19.99'; if (sper) sper.textContent = '/month'
    if (ip) ip.textContent = '$69.99'
  }
}

/* ═══════════════════════════════════════════════
   ✦ ENHANCED ANIMATIONS & INTERACTIONS
   Parallax · Particles · Scroll Reveal · Desktop
═══════════════════════════════════════════════ */

/* ── Particle System (Loading Screen) ── */
function initParticles() {
  const canvas = document.getElementById('ls-particles')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let W, H, particles = [], raf

  function resize() {
    W = canvas.width  = window.innerWidth
    H = canvas.height = window.innerHeight
  }

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.006,
      dx: (Math.random() - 0.5) * 0.25,
      dy: -Math.random() * 0.5 - 0.1,
    }
  }

  resize()
  for (let i = 0; i < 80; i++) particles.push(mkParticle())

  function draw() {
    ctx.clearRect(0, 0, W, H)
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy; p.a += p.da
      if (p.a < 0 || p.a > 1) p.da *= -1
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W }
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, p.a)) * 0.6})`
      ctx.fill()
    })
    raf = requestAnimationFrame(draw)
  }

  draw()
  window.addEventListener('resize', resize)

  // stop when loading screen fades
  const obs = new MutationObserver(() => {
    if (document.getElementById('loading-screen')?.classList.contains('gone')) {
      cancelAnimationFrame(raf)
      obs.disconnect()
    }
  })
  const ls = document.getElementById('loading-screen')
  if (ls) obs.observe(ls, { attributes: true, attributeFilter: ['class'] })
}

/* ── Parallax Scroll ── */
function initParallax() {
  const cover = document.getElementById('cover-img')
  const loginBg = document.querySelector('.login-bg-art')

  function onScroll() {
    const scrollY = window.scrollY

    // Hero cover parallax
    if (cover && cover.closest('.ph-cover-wrap')) {
      const wrap = cover.closest('.ph-cover-wrap')
      const rect = wrap.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const pct = (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
        const shift = (pct - 0.5) * 80
        cover.style.transform = `scale(1.08) translateY(${shift}px)`
      }
    }

    // Scroll progress bar
    const prog = document.getElementById('scroll-progress')
    if (prog) {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const pct = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0
      prog.style.width = pct + '%'
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true })
}

/* ── Scroll Reveal via IntersectionObserver ── */
function initScrollReveal() {
  // Add reveal class to all glass cards and tier cards
  document.querySelectorAll('.glass-card, .tier-card, .lb-item, .vi-row, .skill-item, .ach-item, .glb-item, .ga-item').forEach((el, i) => {
    el.classList.add('reveal')
    if (i % 4 === 1) el.classList.add('reveal-delay-1')
    if (i % 4 === 2) el.classList.add('reveal-delay-2')
    if (i % 4 === 3) el.classList.add('reveal-delay-3')
  })

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed')
        io.unobserve(e.target)
      }
    })
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' })

  document.querySelectorAll('.reveal').forEach(el => io.observe(el))
}

/* ── Re-run scroll reveal when new content is injected ── */
function revealNewContent(container) {
  if (!container) return
  container.querySelectorAll('.lb-item, .vi-row, .skill-item, .glb-item, .ga-item').forEach(el => {
    el.classList.add('reveal')
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('revealed')))
  })
}

/* ── Animated stat counter ── */
function animateCounter(el, target, duration = 900) {
  if (!el) return
  const start = performance.now()
  const from = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0
  const to = parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0
  const isFormatted = String(target).includes(',') || String(target).includes('K') || String(target).includes('M')

  function step(now) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
    const current = from + (to - from) * eased
    el.textContent = isFormatted ? fmtGold(Math.round(current)) : Math.round(current).toLocaleString()
    if (progress < 1) requestAnimationFrame(step)
    else el.textContent = target
  }
  requestAnimationFrame(step)
}

/* ── Desktop nav: auto-populate links from sidebar ── */
function initDesktopNav() {
  const nav = document.getElementById('desktop-nav')
  if (!nav) return

  const brandHTML = `
    <div class="dn-brand">
      <img src="icons/icon-192.png" class="dn-icon" onerror="this.style.display='none'" alt=""/>
      <span>Astral of the Sun</span>
    </div>
    <div class="dn-links" id="dn-links"></div>
    <button class="dn-link dn-logout" onclick="handleLogout()" style="color:rgba(255,100,100,0.6);font-size:10px">LOGOUT</button>
  `
  nav.innerHTML = brandHTML

  const pages = [
    { id: 'home',        label: 'HOME' },
    { id: 'leaderboard', label: 'LEADERBOARD' },
    { id: 'shop',        label: 'VAULT' },
    { id: 'factions',    label: 'GUILDS' },
    { id: 'premium',     label: 'PREMIUM' },
    { id: 'terms',       label: 'TERMS' },
  ]

  const linksEl = document.getElementById('dn-links')
  if (!linksEl) return

  pages.forEach(p => {
    const a = document.createElement('a')
    a.className = 'dn-link' + (p.id === 'home' ? ' active' : '')
    a.dataset.page = p.id
    a.textContent = p.label
    a.onclick = () => {
      navigate(p.id)
      document.querySelectorAll('.dn-link[data-page]').forEach(l => l.classList.remove('active'))
      a.classList.add('active')
    }
    linksEl.appendChild(a)
  })
}

/* ── Patch navigate() to update desktop nav active state ── */
const _origNavigate = window.navigate
window.navigate = function(page) {
  _origNavigate(page)
  document.querySelectorAll('#dn-links .dn-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page)
  })
  // Re-run scroll reveal for new page content
  setTimeout(() => {
    document.querySelectorAll('.page.active .glass-card, .page.active .tier-card, .page.active .lb-item, .page.active .vi-row').forEach(el => {
      if (!el.classList.contains('reveal')) {
        el.classList.add('reveal')
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('revealed')))
      }
    })
  }, 80)
}

/* ── Login parallax (subtle) ── */
function initLoginParallax() {
  const bg = document.querySelector('.login-bg-art')
  if (!bg) return
  window.addEventListener('mousemove', (e) => {
    if (document.getElementById('login-wrap')?.style.display === 'none') return
    const x = (e.clientX / window.innerWidth - 0.5) * 8
    const y = (e.clientY / window.innerHeight - 0.5) * 8
    bg.style.transform = `translate(${x}px, ${y}px) scale(1.05)`
    bg.style.transition = 'transform 0.6s ease'
  })
}

/* ── Patch render() to animate stat counters ── */
const _origRender = window.render
if (typeof render === 'function') {
  window.render = function(p) {
    _origRender(p)
    // After render, animate key stat numbers
    setTimeout(() => {
      ['hsr-level','p-kills','pg-solars','p-prestige','cs-str','cs-agi','cs-int','cs-def','cs-lck','cs-hp'].forEach(id => {
        const e = document.getElementById(id)
        if (e && e.textContent && e.textContent !== '—') {
          const val = e.textContent
          animateCounter(e, val, 800)
        }
      })
      initScrollReveal()
    }, 200)
  }
}

/* ── Boot all enhancements on DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  initParticles()
  initParallax()
  initDesktopNav()
  initLoginParallax()
  // Delay scroll reveal until after first render
  setTimeout(initScrollReveal, 600)
})

// Also expose helpers to window for reuse
Object.assign(window, {
  switchPremTab, switchTopupTab, switchTermsTab, setBilling, openWA, copyBuyCmd, revealNewContent
})
