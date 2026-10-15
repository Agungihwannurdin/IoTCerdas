/* Dashboard AQMS Kelompok A — GitHub Pages
   Tiga mode: Monitoring Online via channel publik ThingSpeak, Berkas CSV, dan Demo.
   ESP32 mengirim HTTPS sendiri ke ThingSpeak + server tugas RnD BiruLangit.
   Website tidak membutuhkan password Wi-Fi maupun Write API Key.
   CO2 dan PM2.5 pada tugas masih berupa simulasi; jangan anggap sebagai sensor fisik.
*/
(function () {
  'use strict';
  const { createApp } = Vue;

  // ---------- parameter ----------
  // CHANNEL ID PUBLIK SAJA (bukan Write API Key). Boleh diisi sebelum upload ke GitHub Pages.
  // Jika dikosongkan, pengunjung perlu memasukkan Channel ID secara manual.
  const PUBLIC_CHANNEL_ID = '3538727';
  const KEYS = ['co2', 'pm25', 'temp', 'rh'];
  const META = {
    co2:  { name: 'CO₂',        unit: 'ppm',   dec: 0, color: 'var(--s-co2)'  },
    pm25: { name: 'PM2.5',      unit: 'µg/m³', dec: 1, color: 'var(--s-pm)'   },
    temp: { name: 'Suhu',       unit: '°C',    dec: 1, color: 'var(--s-temp)' },
    rh:   { name: 'Kelembapan', unit: '%',     dec: 1, color: 'var(--s-rh)'   },
  };
  const LEVELS = ['Baik', 'Sedang', 'Tidak sehat', 'Sangat tidak sehat'];
  const LEVEL_VAR = ['var(--st0)', 'var(--st1)', 'var(--st2)', 'var(--st3)'];
  const LEVEL_ON = ['#ffffff', '#0b0b0b', '#0b0b0b', '#ffffff'];

  // ---------- utilitas ----------
  const pad = n => String(n).padStart(2, '0');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function fmtHM(t) { const d = new Date(t * 1000); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function fmtFull(t) {
    const d = new Date(t * 1000);
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }
  function fmtNum(v, dec) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    return v.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function flagText(f) {
    const a = [];
    if (f & 1) a.push('Di luar rentang');
    if (f & 2) a.push('Outlier');
    if (f & 4) a.push('Tanpa waktu');
    if (f & 8) a.push('Sensor gagal');
    return a.join(', ');
  }
  function niceTicks(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; }
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / mag, step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  // ---------- klasifikasi (indikatif) ----------
  function pmLevel(v) { return v <= 15.5 ? 0 : v <= 55.4 ? 1 : v <= 150.4 ? 2 : 3; }     // rentang ISPU PM2.5
  function co2Level(v) { return v <= 800 ? 0 : v <= 1000 ? 1 : v <= 1500 ? 2 : 3; }
  function tempState(v) { return v < 22 ? { l: 1, t: 'Dingin' } : v <= 28 ? { l: 0, t: 'Nyaman' } : v <= 31 ? { l: 1, t: 'Hangat' } : { l: 2, t: 'Panas' }; }
  function rhState(v) { return v < 30 ? { l: 2, t: 'Sangat kering' } : v < 40 ? { l: 1, t: 'Kering' } : v <= 70 ? { l: 0, t: 'Nyaman' } : v <= 80 ? { l: 1, t: 'Lembap' } : { l: 2, t: 'Sangat lembap' }; }

  // ---------- parsing ----------
  // baris API: [epoch, co2, pm25, temp, rh, fCO2, fPM, fT, fRH]
  function rowFromArray(a) {
    return { t: a[0], v: [a[1], a[2], a[3], a[4]], f: [a[5] | 0, a[6] | 0, a[7] | 0, a[8] | 0] };
  }
  function parseCsv(text) {
    const lines = text.split(/\r?\n/);
    let idx = { co2: 1, pm25: 2, temp: 3, rh: 4, fCO2: 5, fPM: 6, fT: 7, fRH: 8 };
    const out = [];
    for (const ln of lines) {
      const s = ln.trim();
      if (s.startsWith('epoch')) {                       // judul kolom: pakai urutan nyata
        const h = s.split(',');
        const f = n => h.indexOf(n);
        if (f('co2') > 0) idx = { co2: f('co2'), pm25: f('pm25'), temp: f('temp'), rh: f('rh'), fCO2: f('fCO2'), fPM: f('fPM'), fT: f('fT'), fRH: f('fRH') };
        continue;
      }
      if (!/^\d{9,11},/.test(s)) continue;               // abaikan baris log lain
      const c = s.split(',');
      const num = i => (i >= 0 && c[i] !== undefined && c[i] !== '' && isFinite(+c[i])) ? +c[i] : null;
      const fl = i => (i >= 0 && c[i] !== undefined && c[i] !== '') ? (parseInt(c[i], 10) || 0) : 0;
      out.push({ t: +c[0], v: [num(idx.co2), num(idx.pm25), num(idx.temp), num(idx.rh)], f: [fl(idx.fCO2), fl(idx.fPM), fl(idx.fT), fl(idx.fRH)] });
    }
    return out;
  }
  // ThingSpeak timestamp ISO-8601 = waktu UTC nyata. Firmware menyimpan epoch WIB
  // "seolah UTC", jadi tambahkan +7 jam agar grafik/tabel berformat WIB konsisten.
  function rowFromThingSpeak(f) {
    const epochUTC = Date.parse(f.created_at) / 1000;
    if (!Number.isFinite(epochUTC)) return null;
    const val = i => (f['field' + i] === null || f['field' + i] === undefined || f['field' + i] === '')
      ? null : Number(f['field' + i]);
    const fl = i => Number(f['field' + i] || 0) | 0;
    return { t: Math.round(epochUTC) + 7 * 3600,
      v: [1, 2, 3, 4].map(i => { const x = val(i); return x === null || !Number.isFinite(x) ? null : x; }),
      f: [5, 6, 7, 8].map(fl), h: parseHourlyStatus(f.status) };
  }
  // Format status dikirim oleh firmware pada slot pertama setelah jam berganti.
  // contoh: indoor|H1|1792112400|15|510.11|41.52|27.88|61.20
  function parseHourlyStatus(status) {
    if (typeof status !== 'string') return null;
    const p = status.split('|');
    if (p.length !== 8 || p[1] !== 'H1') return null;
    const t = Number(p[2]), mask = Number(p[3]);
    if (!Number.isSafeInteger(t) || t < 1000000000 || !Number.isInteger(mask) || mask < 0 || mask > 15) return null;
    const v = p.slice(4).map((x, i) => {
      if (!(mask & (1 << i)) || x === '-') return null;
      const n = Number(x); return x !== '' && Number.isFinite(n) ? n : null;
    });
    return { t, mask, v };
  }
  function parseHourlyCsv(text) {
    const out = [];
    let hasHeader = false;
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (s.startsWith('epoch_awal,')) { hasHeader = true; continue; }
      if (!hasHeader || !/^\d{9,11},/.test(s)) continue;
      const c = s.split(','), t = Number(c[0]), mask = Number(c[5]);
      if (!Number.isSafeInteger(t) || !Number.isInteger(mask) || mask < 0 || mask > 15) continue;
      const v = [1, 2, 3, 4].map((i, k) => {
        if (!(mask & (1 << k)) || c[i] === '') return null;
        const n = Number(c[i]); return Number.isFinite(n) ? n : null;
      });
      out.push({ t, mask, v });
    }
    return out;
  }
  // Demo hanya untuk presentasi: agregasi 30 sampel per jam dengan aturan 23 valid.
  function demoHourly(rows) {
    const groups = new Map();
    const latest = rows.length ? rows[rows.length - 1].t : 0;
    for (const r of rows) {
      const t = Math.floor(r.t / 3600) * 3600;
      if (t + 3600 > latest) continue; // jangan tampilkan jam yang belum selesai
      if (!groups.has(t)) groups.set(t, { t, sum: [0,0,0,0], n: [0,0,0,0] });
      const g = groups.get(t);
      for (let k = 0; k < 4; k++) if (r.f[k] === 0 && r.v[k] !== null) { g.sum[k] += r.v[k]; g.n[k]++; }
    }
    return Array.from(groups.values()).sort((a,b)=>a.t-b.t).map(g => {
      let mask = 0;
      const v = g.sum.map((s,k) => { if(g.n[k] >= 23) { mask |= 1 << k; return s/g.n[k]; } return null; });
      return {t:g.t,mask,v};
    });
  }
  function mergeHourly(rows) {
    const m = new Map();
    rows.forEach(h => { if (h && Number.isFinite(h.t)) m.set(h.t, h); });
    return Array.from(m.values()).sort((a,b)=>a.t-b.t);
  }
  function mergeRows(a) {                                 // urut waktu, buang duplikat
    a.sort((x, y) => x.t - y.t);
    const out = [];
    for (const r of a) if (!out.length || out[out.length - 1].t !== r.t) out.push(r);
    return out;
  }

  // ---------- data demo ----------
  function demoRow(t, st) {
    const tf = (t % 86400) / 3600;
    const g = (m, s) => Math.exp(-0.5 * Math.pow((tf - m) / s, 2));
    const rnd = () => Math.random() - 0.5;
    st.co2 += (450 + 35 * Math.cos(2 * Math.PI * (tf - 3) / 24) - st.co2) * 0.25 + rnd() * 16;
    st.pm += ((20 + 35 * g(7.5, 1.5) + 40 * g(18.5, 1.5)) - st.pm) * 0.25 + rnd() * 2.4;
    const temp = 27.5 + 2.5 * Math.sin(2 * Math.PI * (tf - 9) / 24) + rnd() * 0.2;
    const rh = 68 - 8 * Math.sin(2 * Math.PI * (tf - 9) / 24) + rnd() * 1.2;
    const v = [Math.round(st.co2), +st.pm.toFixed(1), +temp.toFixed(2), +rh.toFixed(2)], f = [0, 0, 0, 0];
    if (Math.random() < 0.02) { const k = Math.random() < 0.5 ? 0 : 1; v[k] = +(v[k] * (3 + Math.random() * 2)).toFixed(1); f[k] = 2; }
    return { t, v, f };
  }

  // ===================================================================
  //  Komponen grafik garis (SVG) dengan crosshair, tooltip, penanda outlier
  // ===================================================================
  const LineChart = {
    props: {
      rows: Array, hourly: { type: Array, default: () => [] }, k: Number, name: String, unit: String, dec: Number, color: String,
      refs: { type: Array, default: () => [] },
      band: { type: Array, default: null },
      domain: Array,
    },
    data() { return { w: 520, hover: -1 }; },
    computed: {
      h() { return 200; },
      pl() { return 44; }, pr() { return 18; }, pt() { return 8; }, pb() { return 22; },
      iw() { return Math.max(50, this.w - this.pl - this.pr); },
      ih() { return this.h - this.pt - this.pb; },
      t0() { return this.domain[0]; },
      t1() { return this.domain[1] > this.domain[0] ? this.domain[1] : this.domain[0] + 1; },
      yd() {                                              // domain y: data + batas acuan yang dekat
        let lo = Infinity, hi = -Infinity;
        for (const r of this.rows) { const v = r.v[this.k]; if (v !== null && r.f[this.k] === 0) { if (v < lo) lo = v; if (v > hi) hi = v; } }
        if (lo === Infinity) {                                // belum ada nilai sah: pakai semua nilai
          for (const r of this.rows) { const v = r.v[this.k]; if (v !== null) { if (v < lo) lo = v; if (v > hi) hi = v; } }
        }
        if (lo === Infinity) { lo = 0; hi = 1; }
        const span = Math.max(hi - lo, Math.abs(hi) * 0.05, 1e-6);
        let a = lo - span * 0.1, b = hi + span * 0.1;
        for (const rf of this.refs) if (rf.v >= lo - span * 0.5 && rf.v <= hi + span * 0.5) { a = Math.min(a, rf.v - span * 0.05); b = Math.max(b, rf.v + span * 0.05); }
        return [a, b];
      },
      yticks() { return niceTicks(this.yd[0], this.yd[1], 4); },
      xticks() {
        const span = this.t1 - this.t0, steps = [600, 1800, 3600, 7200, 10800, 21600, 43200];
        let st = steps[steps.length - 1];
        for (const s of steps) if (span / s <= 6) { st = s; break; }
        const out = [];
        for (let t = Math.ceil(this.t0 / st) * st; t <= this.t1; t += st) out.push(t);
        return out;
      },
      rawPath() {
        let d = '', pen = false, prev = null;
        for (const r of this.rows) {
          const v = r.v[this.k];
          if (v === null || (prev !== null && r.t - prev > 400)) pen = false;
          if (v === null) { prev = r.t; continue; }
          // Nilai ekstrim dibatasi area grafik agar skala valid tetap terbaca.
          d += (pen ? 'L' : 'M') + this.x(r.t).toFixed(1) + ' ' + this.yc(v).toFixed(1);
          pen = true; prev = r.t;
        }
        return d;
      },
      hourlyPath() {
        let d = '', pen = false, prev = null;
        for (const h of this.hourly) {
          const v = h.v[this.k];
          if (v === null || (prev !== null && h.t - prev > 5400)) pen = false;
          if (v === null) { prev = h.t; continue; }
          // Plot rerata pada tengah jam pengukuran (awal + 30 menit).
          const t = h.t + 1800;
          if (t < this.t0 || t > this.t1) { pen = false; prev = h.t; continue; }
          d += (pen ? 'L' : 'M') + this.x(t).toFixed(1) + ' ' + this.yc(v).toFixed(1);
          pen = true; prev = h.t;
        }
        return d;
      },
      path() {
        let d = '', pen = false, prev = null;
        for (const r of this.rows) {
          const v = r.v[this.k];
          if (v === null || (prev !== null && r.t - prev > 400)) pen = false;   // celah data: garis putus
          if (v === null) { prev = r.t; continue; }
          if (r.f[this.k] !== 0) { pen = false; prev = r.t; continue; }   // nilai bertanda tidak ikut digaris
          d += (pen ? 'L' : 'M') + this.x(r.t).toFixed(1) + ' ' + this.y(v).toFixed(1);
          pen = true; prev = r.t;
        }
        return d;
      },
      bandBox() {                                         // pita zona nyaman, dipotong ke area grafik
        if (!this.band) return null;
        const lo = Math.max(this.band[0], this.yd[0]), hi = Math.min(this.band[1], this.yd[1]);
        return hi > lo ? { y: this.y(hi), h: this.y(lo) - this.y(hi) } : null;
      },
      flagged() { return this.rows.filter(r => r.f[this.k] !== 0 && r.v[this.k] !== null); },
      clamped() { return this.flagged.some(r => r.v[this.k] < this.yd[0] || r.v[this.k] > this.yd[1]); },
      showDots() { return this.rows.length <= 90; },
      hv() { return this.hover >= 0 && this.hover < this.rows.length ? this.rows[this.hover] : null; },
      tipStyle() {
        if (!this.hv) return {};
        const px = this.x(this.hv.t);
        return px > this.w - 170 ? { right: (this.w - px + 12) + 'px' } : { left: (px + 12) + 'px' };
      },
      label() { return this.name + ' (' + this.unit + ')'; },
    },
    methods: {
      x(t) { return this.pl + (t - this.t0) / (this.t1 - this.t0) * this.iw; },
      y(v) { return this.pt + (1 - (v - this.yd[0]) / (this.yd[1] - this.yd[0])) * this.ih; },
      yc(v) { return this.y(Math.min(this.yd[1], Math.max(this.yd[0], v))); },     // dijepit ke tepi grafik
      fmt(v) { return fmtNum(v, this.dec); },
      tl(t) {                                             // label sumbu waktu
        const d = new Date(t * 1000);
        return (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && this.t1 - this.t0 > 21600) ? d.getUTCDate() + ' ' + MON[d.getUTCMonth()] : fmtHM(t);
      },
      ft(t) { return fmtFull(t); },
      ftext(f) { return flagText(f); },
      measure() { const el = this.$refs.box; if (el && el.clientWidth) this.w = el.clientWidth; },
      onMove(e) {
        const svg = this.$refs.svg, rect = svg.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (this.w / rect.width);
        const t = this.t0 + (px - this.pl) / this.iw * (this.t1 - this.t0);
        this.hover = this.nearest(t);
      },
      nearest(t) {                                         // pencarian biner baris terdekat
        const a = this.rows; if (!a.length) return -1;
        let lo = 0, hi = a.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].t < t) lo = m + 1; else hi = m; }
        if (lo > 0 && Math.abs(a[lo - 1].t - t) < Math.abs(a[lo].t - t)) lo--;
        return lo;
      },
      onKey(e) {
        const n = this.rows.length; if (!n) return;
        if (e.key === 'ArrowLeft') { this.hover = this.hover < 0 ? n - 1 : Math.max(0, this.hover - 1); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { this.hover = this.hover < 0 ? n - 1 : Math.min(n - 1, this.hover + 1); e.preventDefault(); }
        else if (e.key === 'Escape') this.hover = -1;
      },
    },
    mounted() {
      this.measure();
      if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.measure()); this.ro.observe(this.$refs.box); }
      else window.addEventListener('resize', this.measure);
    },
    beforeUnmount() { if (this.ro) this.ro.disconnect(); else window.removeEventListener('resize', this.measure); },
    template: `
      <div class="chartbox" ref="box">
        <svg ref="svg" :viewBox="'0 0 ' + w + ' ' + h" :height="h" tabindex="0" role="img"
             :aria-label="'Grafik ' + label + ', ' + rows.length + ' titik data. Gunakan panah kiri dan kanan untuk membaca nilai.'"
             @pointermove="onMove" @pointerleave="hover = -1" @keydown="onKey" @blur="hover = -1">
          <rect v-if="bandBox" :x="pl" :y="bandBox.y" :width="iw" :height="bandBox.h" fill="var(--band)"/>
          <text v-if="bandBox" :x="pl + 4" :y="bandBox.y + 12">{{ band[2] }}</text>
          <g v-for="v in yticks" :key="'y' + v">
            <line :x1="pl" :x2="pl + iw" :y1="y(v)" :y2="y(v)" stroke="var(--grid)" stroke-width="1"/>
            <text :x="pl - 6" :y="y(v) + 4" text-anchor="end">{{ fmt(v) }}</text>
          </g>
          <line :x1="pl" :x2="pl + iw" :y1="pt + ih" :y2="pt + ih" stroke="var(--axis)" stroke-width="1"/>
          <text v-for="t in xticks" :key="'x' + t" :x="x(t)" :y="h - 6" text-anchor="middle">{{ tl(t) }}</text>
          <g v-for="rf in refs" :key="rf.label">
            <line v-if="rf.v > yd[0] && rf.v < yd[1]" :x1="pl" :x2="pl + iw" :y1="y(rf.v)" :y2="y(rf.v)" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>
            <text v-if="rf.v > yd[0] && rf.v < yd[1]" :x="pl + iw - 2" :y="y(rf.v) - 4" text-anchor="end">{{ rf.label }}</text>
          </g>
          <!-- Raw (garis putus), Validated (garis tegas), dan rerata jam ESP32. -->
          <path :d="rawPath" fill="none" stroke="var(--muted)" stroke-opacity="0.75" stroke-width="1.15" stroke-dasharray="4 4"/>
          <path :d="path" fill="none" :stroke="color" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>
          <path :d="hourlyPath" fill="none" stroke="var(--hour-line)" stroke-width="2.6" stroke-linecap="round"/>
          <circle v-for="h0 in hourly.filter(h0 => h0.v[k] !== null && h0.t + 1800 >= t0 && h0.t + 1800 <= t1)"
             :key="'h'+h0.t" :cx="x(h0.t + 1800)" :cy="yc(h0.v[k])" r="4" fill="var(--hour-line)" stroke="var(--surface)" stroke-width="1.5"/>
          <template v-if="showDots">
            <circle v-for="r in rows" :key="'d' + r.t" v-show="r.v[k] !== null && r.f[k] === 0" :cx="x(r.t)" :cy="r.v[k] === null ? 0 : y(r.v[k])" r="2.5" :fill="color"/>
          </template>
          <g v-for="r in flagged" :key="'f' + r.t" :transform="'translate(' + x(r.t) + ' ' + yc(r.v[k]) + ') rotate(45)'">
            <rect x="-5" y="-5" width="10" height="10" fill="var(--flag)" stroke="var(--surface)" stroke-width="2"/>
          </g>
          <g v-if="hv">
            <line :x1="x(hv.t)" :x2="x(hv.t)" :y1="pt" :y2="pt + ih" stroke="var(--muted)" stroke-width="1"/>
            <circle v-if="hv.v[k] !== null" :cx="x(hv.t)" :cy="yc(hv.v[k])" r="4.5" :fill="hv.f[k] ? 'var(--flag)' : color" stroke="var(--surface)" stroke-width="2"/>
          </g>
          <text v-if="!rows.length" :x="w / 2" :y="h / 2" text-anchor="middle">Belum ada data</text>
        </svg>
        <div v-if="clamped" class="muted small">Titik bertanda di tepi grafik = nilai di luar skala (nilai asli ada di tooltip).</div>
        <div v-if="hv" class="tip" :style="tipStyle">
          <div class="muted small">{{ ft(hv.t) }}</div>
          <div><span class="key" :style="{ borderColor: color }"></span><b>Raw:</b> <span class="v">{{ fmt(hv.v[k]) }}</span> {{ unit }}</div>
          <div><b>Validated:</b> {{ hv.f[k] === 0 ? fmt(hv.v[k]) : 'NULL (ditolak)' }}</div>
          <div v-if="hv.f[k]" class="f">{{ ftext(hv.f[k]) }}</div>
          <div v-else-if="hv.v[k] === null" class="muted">Tidak ada nilai</div>
        </div>
      </div>`,
  };

  // ikon status: bentuk berbeda per tingkat (tidak hanya warna)
  const StatusIcon = {
    props: { level: { type: Number, default: 0 }, size: { type: Number, default: 22 } },
    computed: { fill() { return LEVEL_VAR[this.level]; }, on() { return LEVEL_ON[this.level]; } },
    template: `
      <svg :width="size" :height="size" viewBox="0 0 20 20" aria-hidden="true" style="flex:none">
        <circle v-if="level === 0" cx="10" cy="10" r="9" :fill="fill"/>
        <path v-if="level === 0" d="M5.5 10.5l3 3 6-6.5" fill="none" :stroke="on" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle v-if="level === 1" cx="10" cy="10" r="9" :fill="fill"/>
        <path v-if="level === 1" d="M10 5.5v6M10 14.2v.1" fill="none" :stroke="on" stroke-width="2.2" stroke-linecap="round"/>
        <path v-if="level === 2" d="M10 1.5L19 17.5H1z" :fill="fill" stroke-linejoin="round"/>
        <path v-if="level === 2" d="M10 7.5v5M10 15v.1" fill="none" :stroke="on" stroke-width="2" stroke-linecap="round"/>
        <path v-if="level === 3" d="M6.2 1h7.6L19 6.2v7.6L13.8 19H6.2L1 13.8V6.2z" :fill="fill"/>
        <path v-if="level === 3" d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" fill="none" :stroke="on" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
  };

  // ===================================================================
  //  Aplikasi utama
  // ===================================================================
  const App = {
    components: { LineChart, StatusIcon },
    data() {
      return {
        source: 'cloud',  // Selalu tampilkan monitoring online saat website pertama dibuka
        cloudChannel: PUBLIC_CHANNEL_ID,
        esp32Ip: store('aqms.esp32Ip') || '', // alamat IP lokal milik ESP32, disimpan di browser ini saja
        range: +(store('aqms.range') || 1440),
        theme: store('aqms.theme') || 'dark',
        rows: [],
        hourlyCSV: [],
        meta: {},
        conn: { state: 'idle', msg: '' },
        csvName: '',
        timer: null, demoSt: null, busy: false,
        KEYS, META,
      };
    },
    computed: {
      cloudReady() { return /^[0-9]+$/.test(this.cloudChannel.trim()); },
      // CSV cloud berisi field 1-8 dan status H1, bukan salinan file SPIFFS asli.
      // ThingSpeak membatasi API menjadi paling banyak 8000 entri per permintaan.
      cloudCsvUrl() {
        const id = this.cloudChannel.trim();
        return /^\d+$/.test(id)
          ? `https://api.thingspeak.com/channels/${id}/feeds.csv?results=8000&days=365&status=true`
          : '';
      },
      // Hanya buka halaman LAN ESP32 pada jaringan privat; tidak memakai fetch HTTP
      // dari situs HTTPS GitHub Pages agar tidak terkena pembatasan mixed content.
      localEsp32Url() {
        const ip = this.esp32Ip.trim();
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return '';
        const x = ip.split('.').map(Number);
        if (x.some(n => n < 0 || n > 255)) return '';
        const privateIP = x[0] === 10 || (x[0] === 172 && x[1] >= 16 && x[1] <= 31)
          || (x[0] === 192 && x[1] === 168);
        return privateIP ? `http://${ip}/` : '';
      },
      lastT() { return this.rows.length ? this.rows[this.rows.length - 1].t : 0; },
      refNow() { return this.source === 'cloud' ? Math.floor(Date.now() / 1000) + 7 * 3600 : this.lastT; },
      win() {
        if (!this.rows.length) return [];
        if (this.range === 0) return this.rows;
        const t0 = this.lastT - this.range * 60;
        let i = 0; while (i < this.rows.length && this.rows[i].t < t0) i++;
        return this.rows.slice(i);
      },
      hourlyAll() {
        if (this.source === 'csv') return mergeHourly(this.hourlyCSV);
        if (this.source === 'demo') return demoHourly(this.rows);
        return mergeHourly(this.rows.map(r => r.h).filter(Boolean));
      },
      hourlyWin() {
        if (!this.rows.length) return [];
        if (this.range === 0) return this.hourlyAll;
        const min = this.lastT - this.range * 60;
        return this.hourlyAll.filter(h => h.t + 3600 >= min && h.t <= this.lastT);
      },
      hourlyLatest() {
        const out = {};
        KEYS.forEach((key,k) => {
          const a = this.hourlyAll.filter(h => h.v[k] !== null);
          out[key] = a.length ? { value: a[a.length-1].v[k], start: a[a.length-1].t } : null;
        });
        return out;
      },
      domain() {
        if (!this.win.length) return [0, 1];
        const t1 = this.lastT, t0 = this.range === 0 ? this.win[0].t : Math.max(t1 - this.range * 60, this.win[0].t);
        return [t0, t1];
      },
      stats() {                                          // hanya nilai tanpa flag
        const o = {};
        KEYS.forEach((k, i) => {
          let mn = Infinity, mx = -Infinity, s = 0, n = 0, last = null, lastT = 0, flagged = 0;
          for (const r of this.win) {
            const v = r.v[i];
            if (r.f[i] !== 0) { flagged++; continue; }
            if (v === null) continue;
            if (v < mn) mn = v; if (v > mx) mx = v; s += v; n++; last = v; lastT = r.t;
          }
          o[k] = { min: n ? mn : null, max: n ? mx : null, avg: n ? s / n : null, last, lastT, n, flagged };
        });
        return o;
      },
      statuses() {
        const s = this.stats, out = {};
        if (s.pm25.last !== null) out.pm25 = { l: pmLevel(s.pm25.last), t: LEVELS[pmLevel(s.pm25.last)] };
        if (s.co2.last !== null) out.co2 = { l: co2Level(s.co2.last), t: LEVELS[co2Level(s.co2.last)] };
        if (s.temp.last !== null) out.temp = tempState(s.temp.last);
        if (s.rh.last !== null) out.rh = rhState(s.rh.last);
        return out;
      },
      overall() {
        const st = this.statuses;
        if (!st.pm25 && !st.co2) return null;
        const l = Math.max(st.pm25 ? st.pm25.l : 0, st.co2 ? st.co2.l : 0);
        const basis = [];
        if (st.pm25) basis.push('PM2.5 ' + fmtNum(this.stats.pm25.last, 1) + ' µg/m³ (' + st.pm25.t + ')');
        if (st.co2) basis.push('CO₂ ' + fmtNum(this.stats.co2.last, 0) + ' ppm (' + st.co2.t + ')');
        let label = LEVELS[l];
        if (st.pm25 && this.stats.pm25.last > 250.4) label = 'Berbahaya';
        return { l, label, basis: basis.join(' · ') };
      },
      ageSec() { return this.rows.length && this.refNow ? this.refNow - this.lastT : null; },
      recs() {
        const out = [], s = this.stats, st = this.statuses;
        const add = (l, title, text) => out.push({ l, title, text });
        if (this.rows.length === 0) return out;
        if (this.source === 'cloud' && this.ageSec !== null && this.ageSec > 360)
          add(2, 'Data terlambat', 'Data terakhir ' + Math.round(this.ageSec / 60) + ' menit lalu. Periksa WiFi, catu daya, atau apakah perangkat sedang restart.');
        const lastRow = this.rows[this.rows.length - 1];
        if ((lastRow.f[2] & 8) || (lastRow.f[3] & 8))
          add(2, 'Sensor SHT31 tidak terbaca', 'Suhu dan kelembapan kosong pada data terbaru. Periksa kabel SDA/SCL (GPIO21/22), catu 3,3 V, dan alamat I²C 0x44.');
        if (st.pm25) {
          const v = fmtNum(s.pm25.last, 1), l = st.pm25.l;
          if (l === 1) add(1, 'Kelompok sensitif perlu berhati-hati', 'PM2.5 ' + v + ' µg/m³. Anak, lansia, serta penderita asma atau penyakit jantung sebaiknya mengurangi aktivitas berat di luar ruang.');
          if (l === 2) add(2, 'Gunakan masker dan kurangi paparan', 'PM2.5 ' + v + ' µg/m³. Pakai masker N95/KN95 saat di luar, tutup jendela, nyalakan air purifier bila ada, dan tunda olahraga di luar ruang.');
          if (l === 3) add(3, 'Hindari aktivitas di luar ruang', 'PM2.5 ' + v + ' µg/m³. Tetap di dalam dengan jendela tertutup, gunakan air purifier, dan pakai masker N95 bila terpaksa keluar. Cari bantuan medis bila sesak napas.');
        }
        if (st.co2) {
          const v = fmtNum(s.co2.last, 0), l = st.co2.l;
          if (l === 1) add(1, 'Sirkulasi udara mulai berkurang', 'CO₂ ' + v + ' ppm. Pertimbangkan membuka jendela atau pintu sebentar.');
          if (l === 2) add(2, 'Buka ventilasi sekarang', 'CO₂ ' + v + ' ppm. Di atas 1000 ppm konsentrasi dapat menurun dan mengantuk. Buka jendela/pintu, nyalakan exhaust, atau kurangi jumlah orang di ruangan.');
          if (l === 3) add(3, 'Ruangan sangat pengap', 'CO₂ ' + v + ' ppm. Keluar sejenak ke udara segar dan segera ventilasi ruangan. Periksa juga sumber CO₂ lain selain pernapasan.');
        }
        if (st.temp) {
          const v = fmtNum(s.temp.last, 1);
          if (st.temp.t === 'Dingin') add(1, 'Suhu ruangan dingin', 'Suhu ' + v + ' °C. Naikkan suhu AC atau gunakan pakaian hangat.');
          if (st.temp.t === 'Hangat') add(1, 'Suhu terasa hangat', 'Suhu ' + v + ' °C. Aktifkan kipas atau AC dan perbanyak minum.');
          if (st.temp.t === 'Panas') add(2, 'Suhu panas', 'Suhu ' + v + ' °C. Hindari aktivitas berat, minum cukup, dan dinginkan ruangan untuk mencegah kelelahan akibat panas.');
        }
        if (st.rh) {
          const v = fmtNum(s.rh.last, 1);
          if (s.rh.last < 40) add(st.rh.l, 'Udara kering', 'Kelembapan ' + v + ' %. Tambah kelembapan (humidifier atau wadah berisi air) dan minum cukup agar kulit dan tenggorokan tidak kering.');
          if (s.rh.last > 70) add(st.rh.l, 'Udara lembap', 'Kelembapan ' + v + ' %. Kurangi dengan ventilasi atau dehumidifier; kelembapan di atas 70 % memicu jamur dan tungau.');
        }
        const trend = (i, key, rel, abs) => {                // perubahan ~30 menit terakhir
          const r = this.rows.filter(x => x.f[i] === 0 && x.v[i] !== null);
          if (r.length < 16) return null;
          const now = r.slice(-3).reduce((a, x) => a + x.v[i], 0) / 3, bef = r.slice(-18, -15).reduce((a, x) => a + x.v[i], 0) / 3;
          return (now - bef >= abs && (bef <= 0 || (now - bef) / bef >= rel)) ? { now, bef } : null;
        };
        const tp = trend(1, 'pm25', 0.3, 5);
        if (tp) add(1, 'PM2.5 naik cepat', 'Naik dari ' + fmtNum(tp.bef, 1) + ' ke ' + fmtNum(tp.now, 1) + ' µg/m³ dalam ±30 menit. Siapkan masker dan tutup jendela bila terus naik.');
        const tc = trend(0, 'co2', 0.2, 150);
        if (tc) add(1, 'CO₂ naik cepat', 'Naik dari ' + fmtNum(tc.bef, 0) + ' ke ' + fmtNum(tc.now, 0) + ' ppm dalam ±30 menit. Buka ventilasi sebelum terlalu pengap.');
        const fl = this.win.filter(r => r.f.some(x => x !== 0)).length;
        if (fl >= 5) add(1, 'Banyak data ditandai', fl + ' pembacaan pada rentang ini ditandai outlier, di luar rentang, atau sensor gagal. Data bertanda tidak dipakai untuk status dan statistik.');
        out.sort((a, b) => b.l - a.l);
        if (!out.length) add(0, 'Semua parameter dalam batas wajar', 'PM2.5, CO₂, suhu, dan kelembapan berada pada kisaran nyaman. Tidak ada tindakan yang diperlukan.');
        return out;
      },
      tableRows() { return this.win.slice(-50).reverse(); },
      lastLabel() {
        if (!this.rows.length) return '–';
        const a = this.ageSec;
        return fmtFull(this.lastT) + (a !== null && this.source !== 'csv' ? ' (' + (a < 90 ? 'baru saja' : Math.round(a / 60) + ' menit lalu') + ')' : '');
      },
      uptimeLabel() {
        const u = this.meta.uptime; if (u === undefined) return '';
        return Math.floor(u / 3600) + ' j ' + pad(Math.floor(u % 3600 / 60)) + ' m';
      },
    },
    methods: {
      fmtNum, flagText, fmtFull, fmtHM, store,
      saveEsp32Ip() { store('aqms.esp32Ip', this.esp32Ip.trim()); },
      statusVar(l) { return LEVEL_VAR[l]; },
      setSource(s) { this.source = s; store('aqms.source', s); this.start(); },
      setRange(m) { this.range = m; store('aqms.range', String(m)); },
      setTheme(t) {
        this.theme = t; store('aqms.theme', t);
        if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
      },
      stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
      start() {
        this.stop(); this.meta = {}; this.hourlyCSV = []; this.conn = { state: 'idle', msg: '' };
        if (this.source === 'demo') this.startDemo();
        else if (this.source === 'cloud') this.startCloud();
        else { this.rows = []; this.conn = { state: 'idle', msg: 'Pilih berkas m<tanggal>.csv untuk ditampilkan.' }; }
      },
      // --- demo ---
      startDemo() {
        const now = Math.floor(Date.now() / 1000) + 7 * 3600;       // jam dinding WIB
        let t = Math.floor(now / 120) * 120 - 24 * 3600;
        this.demoSt = { co2: 450, pm: 20 };
        const a = [];
        for (; t <= now; t += 120) a.push(demoRow(t, this.demoSt));
        this.rows = a; this.conn = { state: 'ok', msg: 'DATA SIMULASI untuk demo presentasi · bukan data ESP32 (1 titik tiap 4 detik)' };
        this.timer = setInterval(() => {
          const t2 = this.lastT + 120;
          this.rows = this.rows.concat([demoRow(t2, this.demoSt)]).slice(-1500);
        }, 4000);
      },
      // --- ThingSpeak channel PUBLIK (hanya CHANNEL ID, bukan API key) ---
      startCloud() {
        this.rows = [];
        const id = this.cloudChannel.trim();
        if (!/^\d+$/.test(id)) {
          this.conn = { state: 'idle', msg: 'Isi CHANNEL ID angka dari ThingSpeak lalu klik Hubungkan.' };
          return;
        }
        this.fetchCloud(true);
        // Tampil terbaru: permintaan kecil (<100 baris), tanpa cache 5 menit ThingSpeak.
        this.timer = setInterval(() => this.fetchCloud(false), 40000);
      },
      async fetchCloud(initial) {
        if (this.busy) return;
        this.busy = true;
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 15000);
        try {
          const id = this.cloudChannel.trim();
          if (!/^\d+$/.test(id)) throw new Error('Channel ID tidak valid');
          const count = initial ? 1500 : 100;
          const url = `https://api.thingspeak.com/channels/${id}/feeds.json?results=${count}&days=3`;
          const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const json = await res.json();
          const add = (json.feeds || []).map(rowFromThingSpeak).filter(Boolean);
          this.rows = initial ? mergeRows(add) : mergeRows(this.rows.concat(add)).slice(-2000);
          const last = (json.feeds || []).filter(f => f && f.created_at).slice(-1)[0];
          this.meta = { group: json.channel && json.channel.name,
            env: last && typeof last.status === 'string' ? last.status.split('|')[0] : undefined };
          this.conn = this.rows.length
            ? { state: 'ok', msg: `ThingSpeak Channel ${id} · ${this.rows.length} data tersedia (tidak selalu berarti perangkat sedang online)` }
            : { state: 'idle', msg: `ThingSpeak Channel ${id} terbaca, tetapi belum memiliki data. Periksa kiriman firmware ESP32.` };
        } catch (e) {
          this.conn = { state: 'error', msg: 'Cloud gagal dibaca: ' + e.message + '. Pastikan Channel ID benar, channel PUBLIC, dan browser online.' };
        } finally { clearTimeout(to); this.busy = false; }
      },
      // --- CSV ---
      async onFiles(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        let all = [], hours = [];
        for (const f of files) {
          const txt = await f.text();
          all = all.concat(parseCsv(txt));
          hours = hours.concat(parseHourlyCsv(txt));
        }
        e.target.value = '';
        this.stop();
        this.source = 'csv'; store('aqms.source', 'csv');
        this.rows = mergeRows(all);
        this.hourlyCSV = mergeHourly(hours);
        this.csvName = files.map(f => f.name).join(', ');
        this.conn = this.rows.length ? { state: 'ok', msg: 'Berkas dimuat: ' + this.csvName + ' (' + this.rows.length + ' sampel, ' + this.hourlyCSV.length + ' jam ESP32)' }
                                     : { state: 'error', msg: 'Tidak ada baris data yang dikenali. Pastikan berkas m<tanggal>.csv.' };
      },
    },
    mounted() {
      if (this.theme !== 'auto') document.documentElement.setAttribute('data-theme', this.theme);
      this.start();
    },
    beforeUnmount() { this.stop(); },
    template: `
    <div class="wrap">
      <header class="top">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 22h6l4-10 6 17 5-12 3 5h4" stroke="white" stroke-width="3.1" stroke-linejoin="round" stroke-linecap="round"/>
              <circle cx="30" cy="9" r="2.6" fill="white" opacity=".85"/>
            </svg>
          </div>
          <div>
            <div class="eyebrow">SMART ENVIRONMENT MONITORING <span class="eyebrow-pill">KELOMPOK A</span></div>
            <h1>Air Quality <em>Intelligence.</em></h1>
            <div class="sub">Dashboard AQMS · ESP32 + SHT31 · Pemantauan suhu, kelembapan, CO₂ &amp; PM2.5</div>
          </div>
        </div>
        <div class="top-side">
          <div class="system-indicator"><span class="dot" :class="conn.state"></span>{{ source === 'demo' ? 'DEMO · DATA SIMULASI' : source === 'csv' ? 'MODE BERKAS CSV' : conn.state === 'ok' ? 'DATA CLOUD TERSEDIA' : conn.state === 'error' ? 'CLOUD GAGAL DIBACA' : 'MENUNGGU DATA CLOUD' }}</div>
          <div class="theme-control"><div class="seg" role="group" aria-label="Tema">
            <button :aria-pressed="theme === 'dark'" @click="setTheme('dark')">Gelap</button>
            <button :aria-pressed="theme === 'light'" @click="setTheme('light')">Terang</button>
            <button :aria-pressed="theme === 'auto'" @click="setTheme('auto')">Auto</button>
          </div></div>
        </div>
      </header>

      <section class="control-panel" aria-label="Pengaturan sumber data dan rentang waktu">
        <div class="control-group">
          <div>
            <span class="control-label">SUMBER DATA</span>
            <div class="control-inline">
              <div class="seg" role="group" aria-label="Sumber data">
                <button :aria-pressed="source === 'cloud'" @click="setSource('cloud')">☁ Monitoring Online</button>
                <button :aria-pressed="source === 'csv'" @click="setSource('csv')">Riwayat CSV</button>
                <button :aria-pressed="source === 'demo'" @click="setSource('demo')">✦ Demo</button>
              </div>
              <template v-if="source === 'cloud'">
                <span class="channel-pill" title="ID channel publik ThingSpeak">Channel 3538727 · Publik</span>
                <button class="btn btn-primary" @click="start()">↻ Muat ulang</button>
                <a class="btn" href="https://thingspeak.com/channels/3538727" target="_blank" rel="noopener noreferrer">Lihat channel ↗</a>
              </template>
              <label v-if="source === 'csv'" class="btn btn-primary">Pilih berkas CSV
                <input type="file" accept=".csv,.txt" multiple hidden @change="onFiles">
              </label>
            </div>
          </div>
        </div>
        <div class="control-group range-group">
          <div>
            <span class="control-label">RENTANG WAKTU</span>
            <div class="seg" role="group" aria-label="Rentang waktu">
              <button :aria-pressed="range === 60" @click="setRange(60)">1 jam</button>
              <button :aria-pressed="range === 360" @click="setRange(360)">6 jam</button>
              <button :aria-pressed="range === 1440" @click="setRange(1440)">24 jam</button>
              <button :aria-pressed="range === 0" @click="setRange(0)">Semua</button>
            </div>
          </div>
        </div>
      </section>
      <!-- Akses unduh tersedia khusus pada tab Riwayat CSV. Tanpa tambahan server/cloud. -->
      <section v-if="source === 'csv'" class="csv-download-grid" aria-label="Unduh data CSV">
        <div class="csv-download-card">
          <div class="csv-download-title"><span class="csv-symbol" aria-hidden="true">☁</span><div><strong>CSV ThingSpeak</strong><span class="csv-card-subtitle">Unduh riwayat dari cloud</span></div></div>
          <p>Field 1–8, waktu pengiriman, flag, dan status H1. Maksimal 8.000 baris terbaru.</p>
          <a v-if="cloudCsvUrl" class="btn btn-primary" :href="cloudCsvUrl" target="_blank" rel="noopener noreferrer">↓ Unduh CSV ThingSpeak</a>
        </div>
        <div class="csv-download-card">
          <div class="csv-download-title"><span class="csv-symbol" aria-hidden="true">▣</span><div><strong>CSV Asli ESP32 (LAN)</strong><span class="csv-card-subtitle">Unduh dari penyimpanan SPIFFS</span></div></div>
          <p>Laptop/HP harus berada di Wi-Fi yang sama dengan ESP32. Masukkan IP dari Serial Monitor.</p>
          <div class="csv-local-controls">
            <label class="sr-only" for="aqms-esp32-ip">Alamat IP lokal ESP32</label>
            <input id="aqms-esp32-ip" type="text" inputmode="decimal" placeholder="192.168.1.100" v-model.trim="esp32Ip" @change="saveEsp32Ip" autocomplete="off" spellcheck="false">
            <a v-if="localEsp32Url" class="btn btn-local" :href="localEsp32Url" target="_blank" rel="noopener noreferrer">↗ Buka daftar CSV</a>
            <span v-else class="btn btn-inactive" aria-disabled="true">↗ Buka daftar CSV</span>
          </div>
          <div class="csv-lan-note">File <code>mYYYYMMDD.csv</code> dan <code>hYYYYMMDD.csv</code> dipilih untuk diunduh pada halaman ESP32.</div>
        </div>
      </section>
      <div class="conn" aria-live="polite">
        <span class="conn-lead"><span class="dot" :class="conn.state"></span><b>{{ source === 'demo' ? 'Simulasi aktif' : source === 'csv' ? 'Data lokal' : conn.state === 'ok' ? 'Data cloud' : conn.state === 'error' ? 'Bermasalah' : 'Menunggu data' }}</b> · {{ conn.msg }}</span>
        <span>Terakhir diperbarui: <b>{{ lastLabel }}</b></span>
        <span v-if="meta.env">Mode: <b>{{ meta.env }}</b></span>
        <span v-if="meta.rssi">Wi-Fi: <b>{{ meta.rssi }} dBm</b></span>
        <span v-if="uptimeLabel">Uptime: <b>{{ uptimeLabel }}</b></span>
        <span v-if="meta.boot !== undefined">Boot: <b>{{ meta.boot }}</b></span>
        <span v-if="meta.heap">Heap: <b>{{ Math.round(meta.heap / 1000) }} KB</b></span>
      </div>


      <div v-if="source === 'csv'"
          class="data-source-note"
          role="status">
        <strong>MODE CSV:</strong>
        Pilih file mYYYYMMDD.csv dan hYYYYMMDD.csv
        untuk menampilkan data pengukuran.
      </div>

      <div class="section-title">
        <div><h2>Ringkasan sensor</h2><div class="section-caption">Nilai terakhir yang lolos validasi, diperbarui otomatis sesuai sumber data</div></div>
        <div class="section-tag">{{ win.length }} sampel pada rentang ini</div>
      </div>
      <div class="metrics-grid">
        <section v-for="k in ['temp', 'rh', 'co2', 'pm25']" :key="k" class="metric-card" :style="{'--metric-color': META[k].color}" :aria-label="'Ringkasan ' + META[k].name">
          <div class="metric-head"><span>{{ META[k].name }}</span><span class="metric-ico" aria-hidden="true">{{ {temp:'°', rh:'◌', co2:'◈', pm25:'✳'}[k] }}</span></div>
          <div class="metric-value">{{ fmtNum(stats[k].last, META[k].dec) }}<small>{{ META[k].unit }}</small></div>
          <div class="metric-state">{{ statuses[k] ? statuses[k].t : 'Belum ada pembacaan' }}</div>
          <div class="metric-foot"><span>Rata-rata periode</span><strong>{{ fmtNum(stats[k].avg, META[k].dec) }} {{ META[k].unit }}</strong></div>
        </section>
      </div>
      <div class="section-title"><div><h2>Analisis kondisi udara</h2><div class="section-caption">Ringkasan indikatif dan saran berbasis pembacaan valid</div></div></div>
      <div class="grid2 hero">
        <section class="card hero-card" :style="{ '--lv': overall ? statusVar(overall.l) : 'var(--axis)' }" aria-label="Status udara">
          <div class="hero-kicker">◉ STATUS KUALITAS UDARA</div>
          <div v-if="overall" class="hero-label"><status-icon :level="overall.l" :size="30"></status-icon><span>{{ overall.label }}</span></div>
          <div v-else class="hero-label muted">Menunggu data</div>
          <div v-if="overall" class="muted small">{{ overall.basis }}</div>
          <div class="chips" v-if="overall">
            <div class="chip" v-for="k in ['pm25', 'co2', 'temp', 'rh']" :key="k" v-show="statuses[k]">
              <div class="nm">{{ META[k].name }}</div>
              <div class="st" v-if="statuses[k]"><status-icon :level="statuses[k].l" :size="16"></status-icon>{{ statuses[k].t }}</div>
              <div class="val" v-if="statuses[k]">{{ fmtNum(stats[k].last, META[k].dec) }} {{ META[k].unit }}</div>
            </div>
          </div>
        </section>

        <section class="card recommendations" aria-label="Rekomendasi otomatis">
          <h2>Rekomendasi otomatis</h2>
          <ul class="recs" v-if="recs.length">
            <li class="rec" v-for="r in recs" :key="r.title">
              <status-icon :level="r.l" :size="22"></status-icon>
              <div><div class="t">{{ r.title }}</div><div class="d">{{ r.text }}</div></div>
            </li>
          </ul>
          <div v-else class="empty-note">Rekomendasi akan ditampilkan setelah data sensor terhubung.</div>
        </section>
      </div>

      <div class="section-title"><div><h2>Tren parameter sensor</h2><div class="section-caption">Grafik historis, nilai minimum, rata-rata, maksimum &amp; penanda outlier</div></div><div class="section-tag">Waktu WIB · auto refresh</div></div>
      <div class="charts">
        <section class="card chart-card" v-for="k in ['temp', 'rh', 'pm25', 'co2']" :key="k" :style="{'--metric-color': META[k].color}">
          <div class="chart-head">
            <h2><span class="key" :style="{ borderColor: META[k].color }"></span>{{ META[k].name }}</h2>
            <div class="muted small">{{ META[k].unit }}</div>
          </div>
          <div class="big">{{ fmtNum(stats[k].last, META[k].dec) }}<small>{{ META[k].unit }}</small></div>
          <div class="stats">
            <span>Min <strong>{{ fmtNum(stats[k].min, META[k].dec) }}</strong></span>
            <span>Rata-rata valid pada grafik <strong>{{ fmtNum(stats[k].avg, META[k].dec) }}</strong></span>
            <span>Maks <strong>{{ fmtNum(stats[k].max, META[k].dec) }}</strong></span>
          </div>
          <line-chart :rows="win" :hourly="hourlyWin" :k="KEYS.indexOf(k)" :name="META[k].name" :unit="META[k].unit" :dec="META[k].dec" :color="META[k].color" :domain="domain"
            :refs="k === 'pm25' ? [{ v: 15.5, label: 'batas baik 15,5' }, { v: 55.4, label: 'batas sedang 55,4' }] : k === 'co2' ? [{ v: 1000, label: 'ventilasi 1000' }] : []"
            :band="k === 'temp' ? [22, 28, 'zona nyaman'] : k === 'rh' ? [40, 70, 'zona nyaman'] : null"></line-chart>
          <div class="legend">
            <span><span class="key key-dashed"></span>Raw (nilai asli)</span>
            <span><span class="key" :style="{ borderColor: META[k].color }"></span>Validated (flag 0)</span>
            <span><span class="key key-hour"></span>Hourly dari ESP32</span>
            <span><span class="dia"></span>Flag outlier / tidak valid</span>
          </div>
        </section>
      </div>

      <div class="section-title"><div><h2>Rata rata per Jam</h2><div class="section-caption"></div></div><div class="section-tag">{{ hourlyWin.length }} jam tersedia</div></div>
      <section class="card hourly-card" aria-label="Ringkasan rata-rata per jam dari ESP32">
        <div class="hour-grid">
          <div class="hour-metric" v-for="k in ['temp','rh','co2','pm25']" :key="k" :style="{'--metric-color':META[k].color}">
            <span>{{ META[k].name }}</span>
            <strong>{{ hourlyLatest[k] ? fmtNum(hourlyLatest[k].value, META[k].dec) : '–' }} <small>{{ META[k].unit }}</small></strong>
            <small>{{ hourlyLatest[k] ? 'Jam ' + fmtHM(hourlyLatest[k].start) + '–' + fmtHM(hourlyLatest[k].start+3600) + ' WIB' : 'Belum ada jam lengkap' }}</small>
          </div>
        </div>
        <p class="muted small" v-if="source==='csv' && !hourlyAll.length">Tambahkan berkas hYYYYMMDD.csv dari SPIFFS untuk menampilkan hasil perhitungan jam asli ESP32.</p>
      </section>
      <details class="card">
        <summary>Tabel rata-rata jam ESP32 ({{ hourlyWin.length }} jam)</summary>
        <div class="tablewrap">
          <table>
            <thead><tr><th>Awal jam WIB</th><th>CO₂ (ppm)</th><th>PM2.5 (µg/m³)</th><th>Suhu (°C)</th><th>RH (%)</th><th>Mask valid</th></tr></thead>
            <tbody>
              <tr v-for="h in hourlyWin.slice().reverse()" :key="h.t">
                <td>{{ fmtFull(h.t) }}</td><td>{{ fmtNum(h.v[0],2) }}</td><td>{{ fmtNum(h.v[1],2) }}</td><td>{{ fmtNum(h.v[2],2) }}</td><td>{{ fmtNum(h.v[3],2) }}</td><td>{{ h.mask }}/15</td>
              </tr>
              <tr v-if="!hourlyWin.length"><td colspan="6">Belum ada rata-rata jam dari ESP32</td></tr>
            </tbody>
          </table>
        </div>
      </details>
      <details class="card">
        <summary>Tabel data ({{ tableRows.length }} baris terbaru pada rentang ini)</summary>
        <div class="tablewrap">
          <table>
            <thead><tr><th>Waktu (WIB)</th><th>CO₂ (ppm)</th><th>PM2.5 (µg/m³)</th><th>Suhu (°C)</th><th>RH (%)</th><th>Tanda</th></tr></thead>
            <tbody>
              <tr v-for="r in tableRows" :key="r.t">
                <td>{{ fmtFull(r.t) }}</td>
                <td>{{ fmtNum(r.v[0], 0) }}</td><td>{{ fmtNum(r.v[1], 1) }}</td><td>{{ fmtNum(r.v[2], 2) }}</td><td>{{ fmtNum(r.v[3], 2) }}</td>
                <td>{{ flagText(r.f[0] | r.f[1] | r.f[2] | r.f[3]) || '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <div class="footer-signoff">AQMS KELOMPOK A &nbsp;·&nbsp; ESP32 EDGE COMPUTING &nbsp;·&nbsp; IoT CERDAS</div>
    </div>`,
  };

  createApp(App).mount('#app');
})();
